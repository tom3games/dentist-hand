import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 台本どおりに進めて撮る。node shot.mjs [幅 高さ]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 5883
const [W, H] = [Number(process.argv[2] || 390), Number(process.argv[3] || 844)]
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: process.env.EN ? 'en-US' : 'ja-JP', viewport: { width: W, height: H }, deviceScaleFactor: 2 })
await muteContext(ctx)
await ctx.addInitScript(() => { try { localStorage.setItem('dh_tut', '1') } catch (e) {} })
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__dhReady)
await p.waitForTimeout(500)
const tag = `${W}x${H}${process.env.EN ? '-en' : ''}`
await p.screenshot({ path: `shots/s-${tag}-title.png` })
await p.click('#bHow'); await p.waitForTimeout(200); await p.screenshot({ path: `shots/s-${tag}-how.png` })
await p.click('#bHowGo'); await p.evaluate(() => { dh.dbg.pause(true); dh.startGame({ seed: 1000, tutorial: false, boss: false }) })
const S = await p.evaluate(() => { const S = dh.run.S; return { spikes: S.spikes, blocks: S.blocks } })
const sp = S.spikes.find(x => x.pat === 'B') || S.spikes[0], spA = S.spikes.find(x => x.pat === 'A') || S.spikes[0]
const at = async (tt, name) => { await p.evaluate(tt => dh.dbg.to(tt), tt); await p.waitForTimeout(250); await p.screenshot({ path: `shots/s-${tag}-${name}.png` }) }
const rinse = S.blocks.find(x => x.kind === 'rinse'), chat = S.blocks.find(x => x.kind === 'chat')
const plan = [[2, 'intro'], [spA.w0 - 1.2, 'hum'], [spA.w0 + 0.6, 'warnLook', true], [sp.p0 + 0.9, 'pain'], [rinse.a + 3.6, 'rinse'], [chat.a + 2.6, 'chat']].sort((x, y) => x[0] - y[0])
for (const [tt, name, up] of plan) {
  await at(tt, name)
  if (up) { await p.evaluate(() => { dh.raise(); dh.dbg.step(30) }); await p.waitForTimeout(250); await p.screenshot({ path: `shots/s-${tag}-${name}-raised.png` }) }
}
await p.evaluate(() => { dh.dbg.to(1e9) }); await p.waitForTimeout(5200)
await p.screenshot({ path: `shots/s-${tag}-result.png` })
console.log(tag, 'errors:', errs.length ? errs : 'none', await p.evaluate(() => dh.result))
await b.close(); server.kill()
