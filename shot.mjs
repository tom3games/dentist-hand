import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 台本を決めて進め、見せ場を撮る。node shot.mjs [幅 高さ]（EN=1 で英語）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 5883
mkdirSync(ROOT + '/shots', { recursive: true })
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
const snap = async name => { await p.waitForTimeout(120); await p.screenshot({ path: `shots/s-${tag}-${name}.png` }) }
await snap('title')
await p.click('#bHow'); await snap('how')
await p.click('#bHowBack')
// 台本: 結婚式 → 院長 → 借金（足でハンコ）→ 電話 → ミラーボール → 誕生日 → ドリルが飛ぶ → 跡継ぎ → けんか → 音楽
await p.evaluate(() => { dh.dbg.pause(true); dh.startGame({ seed: 7, tutorial: false, topics: ['wedding', 'loan', 'onsen', 'mascot'], events: ['boss', 'phone', 'ball', 'bday', 'fly', 'heir', 'fight', 'music'] }) })
const st = n => p.evaluate(n => dh.dbg.step(n), n)
const toReply = () => p.evaluate(() => dh.dbg.toReply())
const reply = k => p.evaluate(k => dh.reply(k), k)
await st(70); await snap('intro-hand')
await toReply(); await st(20); await snap('q1')
await reply('aga'); await st(10); await snap('psay')
await toReply(); await st(40); await snap('q2-prop')
await reply('oga'); await st(60); await snap('huh')
await toReply(); await st(20); await snap('q2b-big')
await reply('aga'); await st(50); await snap('commit-stamp')
// 院長
await toReply(); await snap('boss')
await reply('nn'); await st(45); await snap('boss-after')
await p.evaluate(() => dh.dbg.skipReply())
// 借金
for (let i = 0; i < 3; i++) { await toReply(); const id = await p.evaluate(() => dh.run.deck[dh.run.segI].id); if (id === 'loan' && await p.evaluate(() => !!dh.run.vis.prop)) break; await p.evaluate(() => dh.dbg.skipReply()) }
await snap('loan-ask')
await p.evaluate(() => dh.dbg.skipReply()); await st(200); await snap('loan-foot')
const evShots = async (name, k) => {
  for (let i = 0; i < 6; i++) { await toReply(); const id = await p.evaluate(() => dh.run.deck[dh.run.segI].id); if (id === name) break; await p.evaluate(() => dh.dbg.skipReply()) }
  await snap('ev-' + name)
  if (k) { await reply(k); await st(130); await snap('ev-' + name + '-after') } else await p.evaluate(() => dh.dbg.skipReply())
}
await evShots('phone', 'nn')
await evShots('ball', 'aga')
await evShots('bday', 'ea')
await evShots('fly', 'nn')
await evShots('heir', 'nn')
await evShots('fight', 'nn')
await evShots('music', 'aga')
await p.evaluate(() => dh.dbg.finish()); await p.waitForTimeout(5200)
await snap('result')
console.log(tag, 'errors:', errs.length ? errs : 'none', JSON.stringify(await p.evaluate(() => ({ n: dh.result.n, A: dh.result.A, title: dh.result.title }))))
await b.close(); server.kill()
