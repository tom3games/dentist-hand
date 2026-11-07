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
console.log('返事     同意/件  ひどさ(平均/最小-最大)  長さ秒        同意書の中身（c=そのまま cb=盛った cw=別の話 cn=押し切り）  称号')
for (const bot of bots) {
  const a = rows[bot], titles = {}, vs = {}
  for (const x of a) { titles[x.title] = (titles[x.title] || 0) + 1; for (const it of x.items) { const v = it.startsWith('bonus:') ? 'おまけ' : it.split(':')[1]; vs[v] = (vs[v] || 0) + 1 } }
  const sv = a.map(x => x.sev)
  console.log(`${bot.padEnd(7)} ${avg(a, 'n').toFixed(1)}/${avg(a, 'A').toFixed(0)}   ${avg(a, 'sev').toFixed(0).padStart(3)} / ${Math.min(...sv)}-${Math.max(...sv)}       ${Math.min(...a.map(x => x.len))}-${Math.max(...a.map(x => x.len))}   ${JSON.stringify(vs)}   ${Object.entries(titles).map(([k, v]) => k + v).join(' ')}`)
}
// 同じ台本（同じ種）で返事だけ変えた時、同意書の項目がどれだけ重なるか（1=全部同じ）
const jac = (A, B) => { const a = new Set(A), b = new Set(B); const i = [...a].filter(x => b.has(x)).length; return i / Math.max(1, new Set([...a, ...b]).size) }
console.log('\n同じ種で返事だけ変えた時の同意書の重なり（項目の一致率、0=まったく別・1=同じ）')
const names = ['none', 'aga', 'oga', 'ea', 'nn']
console.log('       ' + names.map(n => n.padStart(6)).join(''))
for (const x of names) console.log(x.padEnd(7) + names.map(y => (rows[x].reduce((s, r, i) => s + jac(r.items, rows[y][i].items), 0) / N).toFixed(2).padStart(6)).join(''))
const ex = i => names.map(n => `  ${n.padEnd(5)}: ${rows[n][i].items.join(' ')}`).join('\n')
console.log('\n例（種 1000）:\n' + ex(0))
await b.close(); server.kill()
