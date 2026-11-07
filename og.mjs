import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// SNS 用の画像 og.png（1200x630）。一番おもしろい場面＝口を開けたまま黙っていたら、足で借金の連帯保証人のハンコを押された瞬間。node og.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 5884
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 430, height: 760 }, deviceScaleFactor: 2 })
await muteContext(ctx)
await ctx.addInitScript(() => { try { localStorage.setItem('dh_tut', '1') } catch (e) {} })
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__dhReady); await p.waitForTimeout(400)
await p.evaluate(async () => {
  dh.dbg.pause(true); dh.startGame({ seed: 7, tutorial: false, topics: ['wedding', 'ring', 'loan'], events: ['phone'] })
  // 前の2つは同意させて、モニターに物を並べておく
  for (let i = 0; i < 40; i++) { dh.dbg.toReply(); const id = dh.run.deck[dh.run.segI].id; if (id === 'loan' && dh.run.vis.prop) break; dh.reply('aga') }
  dh.reply('aga'); window.__ogHow = dh.run.asks[dh.run.asks.length - 1]
  let n = 0; while (!(dh.run.vis.tag) && n++ < 900) dh.dbg.step(1)
  dh.dbg.step(26)
  for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r))
  document.querySelector('#bMute').style.display = 'none'
})
await p.waitForTimeout(200)
const how = await p.evaluate(() => dh.run.asks[dh.run.asks.length - 1]); console.log('loan:', JSON.stringify(how))
const shot = await p.screenshot({ type: 'png' })
const og = await b.newPage({ viewport: { width: 1200, height: 630 } })
await og.setContent(`<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Klee+One:wght@600&display=swap" rel="stylesheet"><style>
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;background:#e9e4da;font-family:"BIZ UDPGothic",sans-serif;position:relative}
.shotwrap{position:absolute;left:40px;top:0;width:430px;height:630px;overflow:hidden}
.shot{position:absolute;left:0;top:-8px;width:430px;height:760px;background:url(data:image/png;base64,${shot.toString('base64')}) 0 0/430px 760px}
.card{position:absolute;left:520px;top:92px;width:630px;background:#fbfaf6;border-radius:12px;padding:28px 34px 30px;box-shadow:0 22px 50px -22px rgba(40,30,20,.6);transform:rotate(-2deg)}
.top{display:flex;align-items:center;gap:10px;border-bottom:3px solid #3d8f86;padding-bottom:12px;margin-bottom:18px;color:#245e58;font-weight:700;font-size:26px;letter-spacing:.06em}
.top span{margin-left:auto;font-size:17px;color:#5d6467;font-weight:400;letter-spacing:0}
h1{font-size:62px;line-height:1.16;color:#22272b;white-space:nowrap}h1 b{display:block;color:#245e58}
p{margin-top:16px;font-size:27px;color:#5d6467;line-height:1.4}
.m{display:flex;gap:8px;margin-top:14px}.m svg{width:62px;height:46px}
.stamp{position:absolute;right:40px;bottom:-96px;width:160px;height:160px;border:6px solid #c8322b;border-radius:50%;color:#c8322b;display:grid;place-items:center;text-align:center;font-weight:700;font-size:28px;line-height:1.25;transform:rotate(14deg);opacity:.92;background:rgba(251,250,246,.65)}
</style></head><body>
<svg width="0" height="0" style="position:absolute">${readFileSync(ROOT + '/index.html', 'utf8').match(/<defs>[\s\S]*?<\/defs>/)[0]}</svg>
<div class="shotwrap"><div class="shot"></div></div>
<div class="card"><div class="top">よそみ歯科<span>診察券</span></div><h1>口を開けたまま、<b>同意しました</b></h1><p>治療中の世間話に「あが」で答えたら<br>借金の保証人になっていた。</p>
<div class="m"><svg><use href="#m-aga"/></svg><svg><use href="#m-oga"/></svg><svg><use href="#m-nn"/></svg><svg><use href="#m-ea"/></svg></div>
<div class="stamp">本日の<br>同意書</div></div>
</body></html>`, { waitUntil: 'networkidle' })
await og.evaluate(() => document.fonts.ready)
await og.screenshot({ path: ROOT + '/og.png' })
console.log('og.png', readFileSync(ROOT + '/og.png').length)
await b.close(); server.kill()
