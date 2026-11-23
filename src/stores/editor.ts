/**
 * md2html - 公众号排版工具
 * Copyright (C) 2026 diyun <diyun@diyun.site>
 * Licensed under AGPL-3.0-or-later. See LICENSE for full text.
 * Based on gzh-design-skill by 甲木 × 摸鱼小李
 * https://github.com/isjiamu/gzh-design-skill
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AIEnhanceResult, ValidationResult } from '../core/types'
import { renderFaithful, prepareSource } from '../core/faithful'
import { parseMarkdown } from '../core/parser'
import { generateHtml } from '../core/generator'
import { validateGzhHtml } from '../core/validator'
import { enhanceArticle } from '../ai/enhance'
import { isLikelyMarkdown, convertToMarkdown } from '../ai/convert'
import { useSettingsStore } from './settings'
import { themes, getTheme, defaultTheme } from '../themes'

const MD_STORAGE_KEY = 'md2html-markdown'
const THEME_STORAGE_KEY = 'md2html-theme'

/** ClipboardItem 构造器（部分环境的 TS lib 里没有，故做一次运行时探测） */
function getClipboardItemCtor():
  | (new (items: Record<string, Blob>) => ClipboardItem)
  | undefined {
  return (window as unknown as {
    ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem
  }).ClipboardItem
}

/** 从生成的 HTML 提取纯文本，作为剪贴板 text/plain 兜底 */
function htmlToPlainText(html: string): string {
  try {
    const el = document.createElement('div')
    el.innerHTML = html
    return (el.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
  } catch {
    return ''
  }
}

/**
 * 降级复制：把正文放进一个空白 iframe 再走 execCommand。
 * iframe 里没有本站的 CSS（Tailwind），序列化出来的 HTML 是干净的，
 * 不会像直接插进 body 那样被注入一堆 --tw-* 变量。
 */
function legacyCopyViaIframe(html: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      'position:fixed;left:-9999px;top:0;width:677px;height:600px;border:0;opacity:0;'
    iframe.srcdoc = `<!DOCTYPE html><meta charset="utf-8"><body>${html}</body>`
    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument
        const win = iframe.contentWindow
        if (!doc || !win) return resolve(false)
        const range = doc.createRange()
        range.selectNodeContents(doc.body)
        const sel = win.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
        resolve(doc.execCommand('copy'))
      } catch (err) {
        console.error('iframe 复制失败:', err)
        resolve(false)
      } finally {
        iframe.remove()
      }
    }
    document.body.appendChild(iframe)
  })
}

export const useEditorStore = defineStore('editor', () => {
  // Markdown 内容
  const markdown = ref<string>(
    localStorage.getItem(MD_STORAGE_KEY) ||
      `# 把答案交给 AI，把判断留给自己

> 好的问题，让我们看见自己的假设。

表达清楚与判断可靠，需要分别检查。这里保留原文字句，只调整版式。

## 本期看点

- 从答案退回问题
- 把假设放到桌面
- 用行动检验判断

## 从答案退回问题

先问一句：**我到底要做什么决定？**

## 把假设放到桌面

将事实与解释分开，寻找能改变判断的证据。

> 不急着把解释写成结论。

## 写在最后

把下一步做小，把验证标准说清楚。
`
  )

  // 选中的主题 ID
  const selectedThemeId = ref<string>(
    localStorage.getItem(THEME_STORAGE_KEY) || defaultTheme.id
  )

  // 生成的 HTML
  const generatedHtml = ref<string>('')
  const renderError = ref('')
  const annotations = ref<string[]>([])
  const copyMessage = ref('')

  const canCopy = computed(() => !!generatedHtml.value && !renderError.value && !annotations.value.length && !(validationResult.value?.errors.length))

  // 校验结果
  const validationResult = ref<ValidationResult | null>(null)

  // AI 增强结果
  const enhanceResult = ref<AIEnhanceResult | null>(null)

  // AI 增强失败原因（失败时展示给用户，避免「点了没反应」）
  const enhanceError = ref('')

  // 是否正在 AI 增强中
  const loading = ref(false)
  const progressMessage = ref('')

  // 滚动联动比例（0-1，双向同步）
  const editorScrollRatio = ref(0)
  const previewScrollRatio = ref(0)

  // 当前主题
  const currentTheme = computed(() => getTheme(selectedThemeId.value) || defaultTheme)

  // 所有主题
  const allThemes = computed(() => themes)

  // 保存 Markdown
  function saveMarkdown() {
    localStorage.setItem(MD_STORAGE_KEY, markdown.value)
  }

  // 更新 Markdown
  function setMarkdown(value: string) {
    markdown.value = value
    saveMarkdown()
  }

  // 选择主题
  function selectTheme(themeId: string) {
    selectedThemeId.value = themeId
    localStorage.setItem(THEME_STORAGE_KEY, themeId)
  }

  // 基础渲染（无 AI，实时调用）
  function convertBasic() {
    try {
      const settings = useSettingsStore()
      renderError.value = ''
      let html: string
      if (settings.faithfulMode) {
        const result = renderFaithful(markdown.value, currentTheme.value, settings.showToc, settings.footerNote)
        html = result.html
        annotations.value = result.annotations
      } else {
      const prepared = prepareSource(markdown.value)
      annotations.value = prepared.annotations
      const doc = parseMarkdown(prepared.markdown)
      html = generateHtml(doc, {
        theme: currentTheme.value,
        enhance: enhanceResult.value,
        authorName: settings.authorName || undefined,
        authorBio: settings.authorBio || undefined,
        showCover: settings.showCover,
        showToc: settings.showToc,
      })
      }
      generatedHtml.value = html
      validationResult.value = validateGzhHtml(html)
      if(settings.faithfulMode) validationResult.value.warnings = validationResult.value.warnings.filter(w=>!w.message.includes('半角标点'))
    } catch (err) {
      generatedHtml.value = '';validationResult.value = null
      renderError.value = err instanceof Error ? err.message : String(err)
      console.error('渲染失败:', err)
    }
  }

  // 清除 AI 增强结果（markdown 变更时调用）
  function clearEnhance() {
    if (enhanceResult.value) {
      enhanceResult.value = null
    }
    enhanceError.value = ''
  }

  // 关闭 AI 增强错误提示
  function dismissEnhanceError() {
    enhanceError.value = ''
  }

  // AI 增强（需要 LLM 配置）
  // 自动检测：如果内容不是 Markdown，先转换为 Markdown 再增强
  async function enhanceWithAI(): Promise<{ success: boolean; message?: string }> {
    const settings = useSettingsStore()
    if (settings.faithfulMode) return { success:false, message:'保真模式不使用 AI 增强。' }
    if (!settings.isConfigured) {
      return { success: false, message: '请先配置 LLM API Key' }
    }

    enhanceError.value = ''
    loading.value = true
    progressMessage.value = '正在解析内容...'

    try {
      // 检测是否为 Markdown，非 Markdown 自动转换
      if (!isLikelyMarkdown(markdown.value)) {
        progressMessage.value = '检测到非 Markdown 文本，正在智能转换...'
        const converted = await convertToMarkdown(markdown.value, settings.llmConfig)
        markdown.value = converted
        localStorage.setItem(MD_STORAGE_KEY, converted)
      }

      const doc = parseMarkdown(markdown.value)
      if (doc.blocks.length === 0) {
        enhanceError.value = '编辑器里还没有内容，先写点什么再点 AI 增强'
        return { success: false, message: enhanceError.value }
      }

      progressMessage.value = '正在 AI 增强...'
      const enhance = await enhanceArticle(doc, settings.llmConfig, {
        onProgress: (step) => {
          progressMessage.value = step
        },
      })

      // AI 返回 null = JSON 解析失败或无内容可分析
      if (!enhance) {
        enhanceError.value =
          'AI 未返回有效结果：可能是模型不支持 JSON 输出或 token 不足，请更换模型后重试（详见控制台日志）'
        return { success: false, message: enhanceError.value }
      }

      // 如果 AI 推荐了主题，自动切换
      if (enhance?.recommendedTheme && getTheme(enhance.recommendedTheme)) {
        selectTheme(enhance.recommendedTheme)
      }

      enhanceResult.value = enhance

      // 用 AI 结果重新生成
      progressMessage.value = '正在生成 HTML...'
      convertBasic()

      progressMessage.value = ''
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      progressMessage.value = `AI 增强失败: ${message}`
      enhanceError.value = `AI 增强失败：${message}`
      console.error(err)
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  // 复制到剪贴板
  //
  // 关键：必须绕开 execCommand('copy')。它走的是「选区序列化」，Chromium 会把页面上
  // 由 CSS 类 / 全局 `*` 选择器带来的计算样式（本项目是 Tailwind 的一堆 `--tw-*`
  // 变量）连同容器的 position:fixed 一起内联进剪贴板——实测 15KB 的正文被撑成 254KB。
  // 公众号编辑器收到这种内容会直接降级成纯文本，样式全部丢失。
  //
  // 所以这里直接把「生成好的 HTML 字符串」写进剪贴板，不经 DOM 序列化。
  async function copyToClipboard(): Promise<boolean> {
    copyMessage.value = ''
    if (!canCopy.value) { copyMessage.value='请先解决正文错误或移除已处理的批注，再复制。'; return false }
    // Always render current input; a click can arrive before the debounce finishes.
    convertBasic()
    if (!canCopy.value) return false
    const html = generatedHtml.value
    copyMessage.value = '正文已复制；请粘贴、保存并重新打开检查。'

    // 主路径：Clipboard API 直接写入（localhost / https 下可用）
    // 注意：调用前不能再 await 其它东西，否则会丢失用户手势。
    try {
      const ClipboardItemCtor = getClipboardItemCtor()
      if (navigator.clipboard && ClipboardItemCtor) {
        await navigator.clipboard.write([
          new ClipboardItemCtor({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([htmlToPlainText(html)], { type: 'text/plain' }),
          }),
        ])
        return true
      }
    } catch (err) {
      console.warn('Clipboard API 写入失败，降级为 iframe 复制:', err)
    }

    const success = await legacyCopyViaIframe(html)
    if (!success) copyMessage.value='浏览器未能复制，请导出 HTML 或更换浏览器重试。'
    return success
  }

  // 导出 HTML 文件
  function exportHtml(): string {
    convertBasic()
    if (!canCopy.value) {copyMessage.value='请先解决正文错误或未决批注，再导出。';return ''}
    return generatedHtml.value
  }

  return {
    renderError, annotations, canCopy, copyMessage,
    markdown,
    selectedThemeId,
    currentTheme,
    allThemes,
    generatedHtml,
    validationResult,
    enhanceResult,
    enhanceError,
    loading,
    progressMessage,
    editorScrollRatio,
    previewScrollRatio,
    setMarkdown,
    selectTheme,
    convertBasic,
    clearEnhance,
    dismissEnhanceError,
    enhanceWithAI,
    copyToClipboard,
    exportHtml,
  }
})
