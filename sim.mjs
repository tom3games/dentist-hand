import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 返事のしかたごとの分布。node sim.mjs [回数=40]
// none=だまる / aga=全部あが / nn=全部んー（断りたい人）/ oga=全部おが / ea=全部えあ / random
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 5882, N = Number(process.argv[2] || 40)
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP' })
await muteContext(ctx)
const p = await ctx.newPage()
p.on('pageerror', e => console.log('pageerror', e.message))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__dhReady)
const bots = ['none', 'aga', 'nn', 'oga', 'ea', 'random']
const rows = await p.evaluate(({ bots, N }) => {
  const out = {}
  for (const bot of bots) { const rs = []; for (let i = 0; i < N; i++) rs.push(window.dh.simulate(bot, 1000 + i * 7919)); out[bot] = rs }
  return out
}, { bots, N })
const avg = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length
console.log('bot      同意(平均/最小/最大)/件数  長さ秒(最小-最大)  称号')
for (const bot of bots) {
  const a = rows[bot], ns = a.map(x => x.n), titles = {}
  for (const x of a) titles[x.title] = (titles[x.title] || 0) + 1
  console.log(`${bot.padEnd(8)} ${avg(a, 'n').toFixed(1).padStart(4)} / ${Math.min(...ns)} / ${Math.max(...ns)} / ${avg(a, 'A').toFixed(1)}    ${Math.min(...a.map(x => x.len))}-${Math.max(...a.map(x => x.len))}   ${Object.entries(titles).map(([k, v]) => k + v).join(' ')}`)
}
const seen = {}
for (const x of rows.none) for (const id of x.deck.split(',')) seen[id] = (seen[id] || 0) + 1
console.log('\n出た回数（none の', N, '回）:', JSON.stringify(seen))
await b.close(); server.kill()
