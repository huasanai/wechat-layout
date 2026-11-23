/** Deterministic layout: source words and punctuation remain unchanged. */
import MarkdownIt from 'markdown-it'
import { parseMarkdown, inlineToPlainText } from './parser'
import { escapeHtml, wrapLeaf, isConclusionChapter } from './transform'
import type { BlockNode, InlineNode, ThemeConfig } from './types'

export function prepareSource(raw: string): { markdown: string; annotations: string[] } {
  let text = raw
  if (/^---\r?\n/.test(text)) {
    const fm = text.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)
    if (!fm) throw new Error('frontmatter 未闭合，请先检查原稿。')
    text = text.slice(fm[0].length)
  }
  const mask = new Uint8Array(text.length)
  const offsets = [0]
  for (const line of text.split(/(?<=\n)/)) offsets.push(offsets[offsets.length-1]+line.length)
  for (const token of new MarkdownIt().parse(text, {})) {
    if (['fence','code_block'].includes(token.type) && token.map) mask.fill(1,offsets[token.map[0]],offsets[token.map[1]])
  }
  // Inline code, including %% examples, is literal text.
  const code = /(`+)([\s\S]*?)\1(?!`)/g
  for (const m of text.matchAll(code)) mask.fill(1,m.index!,m.index!+m[0].length)
  let clean='', start=-1
  const annotations: string[]=[]
  for(let i=0;i<text.length;i++) {
    if(text.slice(i,i+2)==='%%' && !mask[i]) {
      if(start<0) start=i
      else { annotations.push(text.slice(start+2,i));clean+='\n'.repeat((text.slice(start,i+2).match(/\n/g)||[]).length);start=-1 }
      i++;continue
    }
    if(start<0) clean+=text[i]
  }
  if(start>=0) throw new Error('存在未配对的 %% 批注，请先检查原稿。')
  return {markdown:clean,annotations}
}

function publicImage(src: string): string {
  if(!/^https:\/\//i.test(src)) throw new Error('正文图片请使用 HTTPS 地址；本地图片请在公众号编辑器中手动插入。')
  return escapeHtml(src)
}
export function renderFaithful(raw: string, theme: ThemeConfig, showToc=true, footerNote=''): { html:string; annotations:string[] } {
  const prepared=prepareSource(raw), doc=parseMarkdown(prepared.markdown,true), c=theme.components,v=theme.designVars
  function inline(nodes:InlineNode[]):string {
    return nodes.map(n=>{
      if(n.type==='break') return n.hard ? '<br>' : '\n'
      if(n.type==='text') return wrapLeaf(escapeHtml(n.content))
      if(n.type==='code') return c.inlineCode(escapeHtml(n.content))
      if(n.type==='image') return c.image(publicImage(n.src),n.alt)
      const content=inline(n.children)
      if(n.type==='strong') return c.boldPrimary(content)
      if(n.type==='em') return `<em>${content}</em>`
      if(n.type==='highlight') return c.highlightMark(content)
      if(n.type==='underline') return c.underlineMark(content)
      if(n.type==='del') return `<span style="text-decoration:line-through;">${content}</span>`
      // Keep a readable source URL; WeChat may disable external link clicking.
      if(n.type==='link') {
        if(!/^(https?:|mailto:|#)/i.test(n.href)) throw new Error('链接须为公开 HTTP(S)、邮件或页内地址。')
        return `<a href="${escapeHtml(n.href)}" style="color:${v.primary};text-decoration:underline;">${content}</a>`
      }
      return content
    }).join('')
  }
  let chapter=0
  function block(b:BlockNode, inList=false):string {
    switch(b.type) {
      case 'paragraph': return c.bodyParagraph(inline(b.children), inList)
      case 'heading': {
        const text=inlineToPlainText(b.children)
        if(b.level===1) return `<h2 style="font-size:25px;line-height:1.5;margin:0 20px 28px;color:${v.titleColor};">${inline(b.children)}</h2>`
        if(b.level>=3) return `<h3 style="font-size:17px;line-height:1.6;margin:26px 20px 14px;">${inline(b.children)}</h3>`
        chapter++
        const last=isConclusionChapter(text)
        // Replace only our opaque slot after theme formatting, preserving punctuation and inline emphasis.
        return c.chapterTitle({num:last?'∞':String(chapter).padStart(2,'0'),enLabel:last?'THE END':'',title:'HUASAN_TITLE_SLOT'}).replace('HUASAN_TITLE_SLOT',inline(b.children))
      }
      case 'blockquote': return c.quoteBlock(b.children.map(child=>block(child)).join(''))
      case 'code_block': return (theme.codeStyle==='light'?c.codeBlockLight:c.codeBlockDark)(b.lang,b.content.replace(/\n$/,'').split('\n'))
      case 'image': return c.image(publicImage(b.src),b.alt)
      case 'hr': return c.hr()
      case 'list': {
        const tag=b.ordered?'ol':'ul'
        // Reserve marker space inside the same side margins as body paragraphs.
        // Item paragraphs must not add the article's side margins a second time.
        const markerWidth=b.ordered?Math.max(2, String((b.start ?? 1)+b.items.length-1).length*0.65+0.8):2
        return `<${tag}${b.ordered?` start="${b.start ?? 1}"`:''} style="margin:0 ${inList?'0':'20px'} 22px;padding:0 0 0 ${markerWidth}em;list-style-position:outside;font-size:${v.bodyFontSize};line-height:${v.bodyLineHeight};color:${v.bodyColor};">${b.items.map(items=>`<li style="margin:0 0 8px;padding:0;">${items.map(child=>block(child,true)).join('')}</li>`).join('')}</${tag}>`
      }
      case 'list_item': return b.children.map(child=>block(child,inList)).join('')
      case 'table': {
        const cell=(nodes:InlineNode[],head=false)=>`<td style="padding:8px;border:1px solid ${v.borderColor};overflow-wrap:anywhere;${head?'font-weight:700;':''}">${inline(nodes)}</td>`
        return `<section style="margin:20px 20px;"><table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:13px;"><thead><tr>${b.headers.map(x=>cell(x,true)).join('')}</tr></thead><tbody>${b.rows.map(row=>`<tr>${row.map(x=>cell(x)).join('')}</tr>`).join('')}</tbody></table></section>`
      }
    }
  }
  const parts:string[]=[]
  for(let i=0;i<doc.blocks.length;i++) {
    const b=doc.blocks[i]
    if(b.type==='heading' && ['本期看点','本文看点'].includes(inlineToPlainText(b.children))) {
      const next=doc.blocks[++i]
      if(next?.type!=='list' || next.items.length!==3 || next.items.some(x=>x.length!==1||x[0].type!=='paragraph')) throw new Error('本期看点后需要恰好三个非嵌套短列表项。')
      if(showToc) parts.push(c.toc(next.items.map(x=>({title:inlineToPlainText((x[0] as Extract<BlockNode,{type:'paragraph'}>).children)})),'∞'))
      else {parts.push(block(b));parts.push(block(next))}
    } else parts.push(block(b))
  }
  if(doc.blocks.length) parts.push(`<section style="text-align:center;margin:38px 0 28px;font-size:10px;letter-spacing:3px;color:${v.primary};">${wrapLeaf('—— END ——')}</section>`)
  if(footerNote.trim()) parts.push(`<section style="margin:0 20px;border-top:1px solid ${v.borderColor};padding-top:22px;font-size:13px;line-height:1.9;color:${v.mutedText};">${footerNote.split('\n').filter(x=>x.trim()).map(x=>`<p>${wrapLeaf(escapeHtml(x))}</p>`).join('')}</section>`)
  return {html:c.globalContainer(parts.join('\n')),annotations:prepared.annotations}
}
