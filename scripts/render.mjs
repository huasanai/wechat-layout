#!/usr/bin/env node
// Local file adapter for the same renderer used by the browser. No publishing.
import { createServer } from 'vite'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const args=process.argv.slice(2), source=args.shift()
const options={theme:'huasan-claude',out:''}
for(let i=0;i<args.length;i+=2) {const key=args[i]?.replace(/^--/,'');if(!Object.hasOwn(options,key)||!args[i+1])throw new Error('参数：源稿.md --out 新目录 [--theme huasan-claude|huasan-forest]');options[key]=args[i+1]}
if(!source||!options.out)throw new Error('需要源稿与 --out 新目录')
const out=resolve(options.out)
try {if((await readdir(out)).length)throw new Error('输出目录非空，请使用新目录')}catch(e){if(e.code!=='ENOENT')throw e}
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},root,server:{middlewareMode:true},appType:'custom'})
try {
 const {renderFaithful,prepareSource}=await server.ssrLoadModule('/src/core/faithful.ts')
 const {getTheme}=await server.ssrLoadModule('/src/themes/index.ts')
 const theme=getTheme(options.theme);if(!theme)throw new Error('未知主题')
 const raw=await readFile(resolve(source),'utf8'),result=renderFaithful(raw,theme)
 if(result.annotations.length)throw new Error('存在未决批注，未导出；请先处理工作稿中的批注。')
 const body=result.html
 await mkdir(out,{recursive:true})
 const safe=JSON.stringify(body).replaceAll('<','\\u003c')
 const preview=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WeChat layout · 排版预览</title><style>body{margin:0;background:#eee;font-family:system-ui}header,main{max-width:677px;margin:20px auto;padding:20px;background:white}*{box-sizing:border-box}button{padding:8px 16px}img{max-width:100%}</style><header><button id="copy">复制到公众号</button><p id="status">设计预览，公众号保存后效果待实测。</p></header><main>${body}</main><script>const html=${safe};document.querySelector('#copy').onclick=async()=>{try{const node=document.createElement('section');node.innerHTML=html;await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([node.textContent],{type:'text/plain'})})]);document.querySelector('#status').textContent='正文已复制，请到公众号粘贴并核对。'}catch(e){document.querySelector('#status').textContent='复制受阻，请通过 localhost 打开预览后重试。'}};</script></html>`
 await writeFile(join(out,'article-body.html'),body)
 await writeFile(join(out,'preview.html'),preview)
 await writeFile(join(out,'article.md'),prepareSource(raw).markdown)
 const check={theme:theme.id,mode:'faithful',source_sha256:createHash('sha256').update(raw).digest('hex'),annotations:0,browser_verified:false,wechat_verified:false,publish:'disabled',status:'preview'}
 await writeFile(join(out,'check.json'),JSON.stringify(check,null,2)+'\n')
 console.log(JSON.stringify({out,...check}))
} finally {await server.close()}
