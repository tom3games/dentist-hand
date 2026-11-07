import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 遊び方ごとの分布。node sim.mjs [回数=12]
// reader=鼻歌・助手・ドリルの音を読んで挙げる（反応0.4秒）/ painOnly=ドリルが高い時だけ挙げる（視線を読まない）/ spam=ずっと挙げ続ける / none=何もしない / random=適当 / looker=見られたら挙げる（痛みを見ない）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 5882, N = Number(process.argv[2] || 12)
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP' })
await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__dhReady)
const bots = ['reader', 'painOnly', 'looker', 'random', 'spam', 'none']
const rows = await p.evaluate(({ bots, N }) => {
  const out = {}
  for (const bot of bots) {
    const rs = []
    for (let i = 0; i < N; i++) rs.push(window.dh.simulate(bot, 1000 + i * 7919))
    out[bot] = rs
  }
  return out
}, { bots, N })
const avg = (a, k) => (a.reduce((s, x) => s + x[k], 0) / a.length)
console.log(`bot      score(平均/最小/最大)  ランク平均  挙げた  気づかれ  痛かった  先回り  大げさ  称号`)
for (const bot of bots) {
  const a = rows[bot], sc = a.map(x => x.score)
  const titles = {}; for (const x of a) titles[x.title] = (titles[x.title] || 0) + 1
  console.log(`${bot.padEnd(8)} ${avg(a, 'score').toFixed(1).padStart(5)} / ${String(Math.min(...sc)).padStart(3)} / ${String(Math.max(...sc)).padStart(3)}      ${avg(a, 'rank').toFixed(2)}     ${avg(a, 'raised').toFixed(1).padStart(5)}   ${avg(a, 'seen').toFixed(1).padStart(5)}     ${avg(a, 'hurt').toFixed(1).padStart(5)}    ${avg(a, 'avoided').toFixed(1)}    ${avg(a, 'bigesa').toFixed(1)}   ${Object.entries(titles).map(([k, v]) => k + v).join(' ')}`)
}
const boss = rows.reader.filter(x => x.boss).length
console.log(`\n院長が出た回: ${boss}/${N}（reader の回）  治療の長さ(秒): ${avg(rows.reader, 'len').toFixed(0)}〜${avg(rows.none, 'len').toFixed(0)}`)
// 判定: reader が一番・none が最低
const means = Object.fromEntries(bots.map(k => [k, avg(rows[k], 'score')]))
const best = Object.entries(means).sort((x, y) => y[1] - x[1])[0][0], worst = Object.entries(means).sort((x, y) => x[1] - y[1])[0][0]
console.log(`一番: ${best}  最低: ${worst}  ${best === 'reader' && worst === 'none' ? 'OK' : 'NG'}`)
// 再現性: 同じ種と同じ手なら同じ結果
const again = await p.evaluate(() => JSON.stringify(window.dh.simulate('reader', 1000)) === JSON.stringify(window.dh.simulate('reader', 1000)))
console.log('同じ種なら同じ結果:', again ? 'OK' : 'NG')
await b.close(); server.kill()
process.exit(best === 'reader' && worst === 'none' && again ? 0 : 1)
