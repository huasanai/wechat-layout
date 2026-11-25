<script setup lang="ts">
defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const projectGithub = 'https://github.com/huasanai/wechat-layout'
const skillGithub = 'https://github.com/isjiamu/gzh-design-skill'

function close() {
  emit('close')
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    @click.self="close"
  >
    <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800">关于 WeChat layout</h2>
        <button
          @click="close"
          class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="space-y-4 text-sm text-gray-600">
        <!-- 项目简介 -->
        <p>
          WeChat layout 是一个纯前端的微信公众号排版工具，将 Markdown 一键转换为可直接粘贴进公众号编辑器的 HTML。
          所有样式内联、文字用 <code class="rounded bg-gray-100 px-1 text-xs">&lt;span leaf=""&gt;</code> 包裹，粘贴后格式不丢。
        </p>

        <!-- 链接区 -->
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="w-20 shrink-0 text-xs text-gray-400">本项目</span>
            <a
              :href="projectGithub"
              target="_blank"
              class="text-emerald-600 hover:underline"
            >
              {{ projectGithub }}
            </a>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-20 shrink-0 text-xs text-gray-400">原 Skill</span>
            <a
              :href="skillGithub"
              target="_blank"
              class="text-emerald-600 hover:underline"
            >
              {{ skillGithub }}
            </a>
          </div>
        </div>

        <!-- 关系说明 -->
        <div class="rounded-lg bg-gray-50 p-4">
          <p class="mb-2 font-medium text-gray-700">开源鸣谢</p>
          <p class="leading-relaxed">
            感谢 diyun 开源 <a href="https://github.com/DemoJ/md2html" target="_blank" class="text-emerald-600 hover:underline">md2html</a>。
            WeChat layout 在原项目基础上增加了保真排版和文件渲染，优化了手机微信中的列表字距与代码块横滑。
            排版组件设计源于甲木 × 摸鱼小李的 gzh-design-skill。本项目沿用 AGPL-3.0-or-later 许可证。
          </p>
        </div>

        <!-- 技术栈 -->
        <div class="flex flex-wrap gap-2">
          <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">Vue 3</span>
          <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">TypeScript</span>
          <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">Vite</span>
          <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">Tailwind CSS</span>
          <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">markdown-it</span>
          <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">Pinia</span>
        </div>
      </div>
    </div>
  </div>
</template>
