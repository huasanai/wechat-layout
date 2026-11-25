import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'})
try {
 const {renderFaithful,prepareSource}=await server.ssrLoadModule('/src/core/faithful.ts')
 const {moyuGreen}=await server.ssrLoadModule('/src/themes/moyu-green.ts')
 const withoutColors=html=>html.replace(/style="([^"]*)"/g,(_,css)=>`style="${css.replace(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi,'COLOR')}"`)
 const {huasanClaude,huasanForest}=await server.ssrLoadModule('/src/themes/huasan.ts')
 const raw='---\nprivate: do-not-export\n---\n# 标题\n\n原文, "保留"; <测试> & 内容。\n\n## 本期看点\n\n- 看点一\n- 看点二\n- 看点三\n\n## 正文\n\n- 外层\n  - 内层\n\n| 项目 | 内容 |\n| --- | --- |\n| **粗体** | [来源](https://example.com) |\n\n## 写在最后\n\n完成。'
 for(const theme of [huasanClaude,huasanForest]){
  const {html}=renderFaithful(raw,theme)
  assert(html.includes('原文, &quot;保留&quot;; &lt;测试&gt; &amp; 内容。'))
  assert(!html.includes('do-not-export'))
  assert(!html.includes('点赞')&&!html.includes('THANKS FOR READING'))
  assert(html.includes('内层')&&html.includes('<strong')&&html.includes('href="https://example.com"'))
  assert(html.includes('THE END')&&html.includes('—— END ——'))
  assert.equal(withoutColors(html),withoutColors(renderFaithful(raw,moyuGreen).html),'A palette variant must preserve the original theme geometry and markup')
  assert.equal(theme.designVars.bodyFontSize,moyuGreen.designVars.bodyFontSize)
  assert.equal(theme.codeStyle,moyuGreen.codeStyle)
  const off=renderFaithful(raw,theme,false).html;assert(off.includes('看点一')&&!off.includes('Parts + Conclusion'))
 }
 assert(renderFaithful('first\nsecond  \nthird',huasanClaude).html.includes('first</span>\n<span leaf="">second</span><br>'))
 assert(renderFaithful('5. five\n6. six',huasanClaude).html.includes('start="5"'))
 // Regression: list markers share the body inset, item paragraphs do not double it,
 // and arbitrary ordered starts / nested blocks remain intact.
 const {themes}=await server.ssrLoadModule('/src/themes/index.ts')
 for(const theme of themes){
  assert.equal(theme.designVars.bodyFontSize,'15px')
  const list=renderFaithful('正文基线。\n\n99. **长项目** [来源](https://example.com)\n\n    续段。\n\n    - 内层条目\n      - 更深一层\n\n100. 第二项\n\n- 无序条目',theme).html
  assert.match(list,/<ol start="99" style="margin:0 20px 22px;padding:0 0 0 [\d.]+em;list-style-position:outside;font-size:15px;/)
  assert.match(list,/<ul style="margin:0 0 22px;/)
  assert.match(list,/<li[^>]*><p style="margin:0 0 8px;font-size:15px;/)
  assert.match(list,/<li[^>]*><p style="[^"]*text-align:left;[^"]*overflow-wrap:anywhere;/)
  assert(list.includes('续段。')&&list.includes('更深一层')&&list.includes('<strong')&&list.includes('href="https://example.com"'))
 }
 // Both code palettes must preserve literal tabs, blank lines and escaped markup.
 for (const render of [moyuGreen.components.codeBlockDark, moyuGreen.components.codeBlockLight]) {
  const html = render('txt', ['\t  <tag> & data', '', '  final  ', ''])
  assert.match(html, /<pre\b[^>]*overflow-x:auto;[^>]*white-space:pre;/)
  assert(html.includes('<span leaf="">\t  &lt;tag&gt; &amp; data\n\n  final  \n\n</span>'))
 }
 const comments=prepareSource('正文 %%未决\n备注%% 结尾。\n\n`%%字面%%`\n\n```txt\n%%代码%%\n```')
 assert.equal(comments.annotations.length,1);assert(!comments.markdown.includes('未决'));assert(comments.markdown.includes('%%字面%%')&&comments.markdown.includes('%%代码%%'))
 assert.throws(()=>prepareSource('正文 %% 未配对'))
 assert.throws(()=>prepareSource('---\n未闭合'))
 assert.throws(()=>renderFaithful('## 本期看点\n\n- 一\n- 二',huasanClaude))
 assert.throws(()=>renderFaithful('![图片](file:///private/image.png)',huasanClaude))
 assert(renderFaithful('正文',huasanClaude,true,'作者提供的说明').html.includes('作者提供的说明'))
 // Regression: article card has subtle light gray background & rounded corners, and images have no white card frame.
 const imgDoc=renderFaithful('前文。\n\n![](https://example.com/a.png)\n\n![说明](https://example.com/b.png)\n\n后文。',huasanClaude).html
 assert(imgDoc.startsWith('<section style="max-width:677px;margin:0 auto;padding:24px 0;background:#FBFBFB;border-radius:16px;'))
 assert(!imgDoc.includes('background:#FFF;border-radius:12px;padding:6px;'))
 assert(imgDoc.includes('<section style="margin:0 20px 20px;"><span leaf=""><img src="https://example.com/a.png"'))
 assert(imgDoc.includes('<section style="margin:0 20px 8px;"><span leaf=""><img src="https://example.com/b.png"'))
 assert(imgDoc.includes('>说明</span></p>'))
 console.log('PASS: palette-only parity with original moyuGreen;  two themes, punctuation, metadata, nested lists, rich table/link, explicit highlights, conclusion, annotation/code boundaries, malformed source and local image rejection.')
}finally{await server.close()}
