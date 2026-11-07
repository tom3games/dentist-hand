import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く。V=2 で配信中の ?v= を確かめる
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
mkdirSync(import.meta.dirname + '/shots', { recursive: true })
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = 'https://tom3games.github.io/dentist-hand/'
const out = []
let bad = 0
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.setItem('dh_tut', '1') } catch (e) {} })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|googletagmanager/.test(r.url())) errs.push('fail ' + r.url()) })
  const t0 = Date.now()
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => window.__dhReady, null, { timeout: 20000 })
  const ready = ((Date.now() - t0) / 1000).toFixed(1)
  const ver = await p.evaluate(() => [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean).find(s => /^game\.js/.test(s)))
  if (process.env.V && !ver.endsWith('?v=' + process.env.V)) { out.push(`${name}: まだ古い版 ${ver}`); bad++ }
  // ---- 遊びの通し: タイトル → 受付する → ドリルが白い歯へ向かい先生が見ている時に手を挙げる（止まる）→ 最後まで → カルテ（口の中の写真）
  const tap = s => name === 'webkit' ? p.tap(s) : p.click(s)
  await tap('#bStart'); await p.waitForTimeout(400)
  const muteOk = await p.evaluate(() => window.__muteOk())
  await p.evaluate(() => { dh.dbg.pause(true); dh.startGame({ seed: 1000, tutorial: false, boss: false }); const e = dh.run.S.ev.find(x => x.kind === 'bad' && x.pat === 'A'); dh.dbg.to(e.a0 + 0.7) })
  await tap('#bHand'); await p.evaluate(() => dh.dbg.step(10))
  const seen = await p.evaluate(() => [dh.run.raised, dh.run.seen, dh.run.saved])
  await p.screenshot({ path: `shots/live-${name}-play.png` })
  await p.evaluate(() => dh.dbg.to(1e9)); await p.waitForTimeout(5200)
  const res = await p.evaluate(() => ({ view: !document.querySelector('#vResult').hidden, title: dh.result && dh.result.title, teeth: dh.result && dh.result.teeth.length, support: !!document.querySelector('#tmSupport'), post: dh.postUrl() }))
  await p.screenshot({ path: `shots/live-${name}-result.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  const ok = res.view && res.teeth === 14 && seen.join() === '1,1,1' && muteOk && /^200 image\/png/.test(og) && !errs.length && res.support
  if (!ok) bad++
  out.push(`${name}: ${ok ? 'OK' : 'NG'} ready=${ready}s ver=${ver} raised/seen/saved=${seen} result=${res.title} support=${res.support} mute=${muteOk} og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (!process.env.SKIPGH) {
  // ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
  const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
  for (const u of ['https://github.com/tom3games/dentist-hand', 'https://github.com/tom3games/dentist-hand/commits/main']) {
    const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
    const found = OWNER && (await p.content()).toLowerCase().includes(OWNER)
    if (found || res.status() !== 200) bad++
    out.push(`${u} status=${res.status()} owner=${found ? 'FOUND' : 'none'}`)
  }
  await b.close()
}
console.log(out.join('\n'))
process.exit(bad ? 1 : 0)
