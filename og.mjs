import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// SNS 用の画像 og.png（1200x630）。一番おもしろい場面＝銀歯が並んだ口の中カメラの前で、手を挙げてドリルを止めた瞬間（あ、ごめんごめん）を撮って右にタイトルを重ねる。node og.mjs
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
  dh.dbg.pause(true); dh.startGame({ seed: 1000, tutorial: false, boss: false })
  const bad = dh.run.S.ev.filter(x => x.kind === 'bad'), A = bad.find(x => x.pat === 'A' && bad.indexOf(x) >= 2) || bad.find(x => x.pat === 'A')
  dh.dbg.to(A.a0 + 0.75); dh.raise(); dh.dbg.step(14)
  for (let i = 0; i < 20; i++) { dh.dbg.step(1); await new Promise(r => requestAnimationFrame(r)) }
  document.querySelector('#bMute').style.display = 'none'; document.querySelectorAll(".sweat").forEach(e => e.remove())
})
await p.waitForTimeout(200)
const shot = await p.screenshot({ type: 'png' })
const og = await b.newPage({ viewport: { width: 1200, height: 630 } })
await og.setContent(`<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Klee+One:wght@600&display=swap" rel="stylesheet"><style>
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;background:#e9e4da;font-family:"BIZ UDPGothic",sans-serif;position:relative}
.shot{position:absolute;left:0;top:0;width:430px;height:760px;background:url(data:image/png;base64,${shot.toString('base64')}) 0 0/430px 760px;transform-origin:0 0;transform:scale(1.0)}
.shotwrap{position:absolute;left:40px;top:0;width:430px;height:630px;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.05)}
.card{position:absolute;left:520px;top:110px;width:620px;background:#fbfaf6;border-radius:12px;padding:28px 34px 30px;box-shadow:0 22px 50px -22px rgba(40,30,20,.6);transform:rotate(-2deg)}
.top{display:flex;align-items:center;gap:10px;border-bottom:3px solid #3d8f86;padding-bottom:12px;margin-bottom:18px;color:#245e58;font-weight:700;font-size:26px;letter-spacing:.06em}
.top span{margin-left:auto;font-size:17px;color:#5d6467;font-weight:400;letter-spacing:0}
h1{font-size:56px;line-height:1.18;color:#22272b;white-space:nowrap}h1 b{display:block;color:#245e58}
p{margin-top:16px;font-size:26px;color:#5d6467}
.stamp{position:absolute;right:46px;bottom:-128px;width:150px;height:150px;border:5px solid #c8322b;border-radius:50%;color:#c8322b;display:grid;place-items:center;text-align:center;font-weight:700;font-size:26px;line-height:1.2;transform:rotate(14deg);opacity:.9;background:rgba(251,250,246,.6)}
</style></head><body><div class="shotwrap"><div class="shot"></div></div>
<div class="card"><div class="top">よそみ歯科<span>診察券</span></div><h1>痛かったら<b>手を挙げてください</b></h1><p>健康な歯を、守れ。</p><div class="stamp">鼻歌<br>止まる瞬間<br>を読め</div></div>
</body></html>`, { waitUntil: 'networkidle' })
await og.evaluate(() => document.fonts.ready)
await og.screenshot({ path: ROOT + '/og.png' })
console.log('og.png', readFileSync(ROOT + '/og.png').length)
await b.close(); server.kill()
