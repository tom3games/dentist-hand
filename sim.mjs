import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 遊び方ごとの分布。node sim.mjs [回数=12]
// reader=ドリルの行き先と視線（鼻歌・助手）を読む（反応0.4秒）/ dest=行き先だけ見て挙げる / spam=ずっと挙げ続ける / random=適当 / none=何もしない
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 5882, N = Number(process.argv[2] || 12)
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP' })
await muteContext(ctx)
const p = await ctx.newPage()
p.on('pageerror', e => console.log('pageerror', e.message))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__dhReady)
const bots = ['reader', 'dest', 'random', 'spam', 'none']
const rows = await p.evaluate(({ bots, N }) => {
  const out = {}
  for (const bot of bots) { const rs = []; for (let i = 0; i < N; i++) rs.push(window.dh.simulate(bot, 1000 + i * 7919)); out[bot] = rs }
  return out
}, { bots, N })
const avg = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length
const f = v => v.toFixed(1).padStart(5)
console.log('bot      点(平均/最小/最大)   守った歯   銀歯   治った虫歯  残った虫歯  挙げた  大げさ  称号')
for (const bot of bots) {
  const a = rows[bot], sc = a.map(x => x.score), titles = {}
  for (const x of a) titles[x.title] = (titles[x.title] || 0) + 1
  console.log(`${bot.padEnd(8)} ${f(avg(a, 'score'))} / ${String(Math.min(...sc)).padStart(3)} / ${String(Math.max(...sc)).padStart(3)}   ${f(avg(a, 'kept'))}/${avg(a, 'H').toFixed(1)}  ${f(avg(a, 'silver'))}   ${f(avg(a, 'fixed'))}     ${f(avg(a, 'left'))}   ${f(avg(a, 'raised'))}  ${f(avg(a, 'bigesa'))}   ${Object.entries(titles).map(([k, v]) => k + v).join(' ')}`)
}
console.log(`\n健康な歯へ向かう回数: ${Math.min(...rows.none.map(x => x.bad))}〜${Math.max(...rows.none.map(x => x.bad))}  治療の長さ(秒): ${Math.min(...rows.none.map(x => x.len))}〜${Math.max(...rows.reader.map(x => x.len))}  院長: ${rows.reader.filter(x => x.boss).length}/${N}`)
const m = k => avg(rows[k], 'score')
const keptBest = bots.every(k => avg(rows.reader, 'kept') >= avg(rows[k], 'kept'))
const ok = keptBest && bots.every(k => m('reader') >= m(k)) && bots.every(k => m('none') <= m(k)) && avg(rows.none, 'silver') >= 5 && avg(rows.spam, 'left') >= 2
console.log(`読むが歯を一番守る:${keptBest} 読むが最高点:${bots.every(k => m('reader') >= m(k))} 何もしないが最低:${bots.every(k => m('none') <= m(k))} 何もしない=銀歯だらけ:${avg(rows.none, 'silver').toFixed(1)} ずっと挙げる=虫歯が残る:${avg(rows.spam, 'left').toFixed(1)}  ${ok ? 'OK' : 'NG'}`)
const again = await p.evaluate(() => JSON.stringify(window.dh.simulate('reader', 1000)) === JSON.stringify(window.dh.simulate('reader', 1000)))
console.log('同じ種なら同じ結果:', again ? 'OK' : 'NG')
await b.close(); server.kill()
process.exit(ok && again ? 0 : 1)
