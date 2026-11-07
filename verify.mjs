import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 検証。node verify.mjs（音は出さない。スマホ縦3サイズ × 全画面、Chromium と WebKit）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5881
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) }
async function open(browser, opts = {}, { tut = true, locale = 'ja-JP' } = {}) {
  const ctx = await browser.newContext({ locale, viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(tut => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); if (tut) localStorage.setItem('dh_tut', '1'); sessionStorage.setItem('x', '1') } } catch (e) {} }, tut)
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__dhReady, null, { timeout: 20000 })
  return p
}
// 横のはみ出し（飾りの人物・天井は画面の外まで描くので、押せる物と文字だけを見る）
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) :is(button,a,p,h1,h2,li,span,small,.say,#mon,canvas,#zz)')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) :is(button,canvas,a,.card,.sheet)')) { if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue; if (el.closest('[hidden]')) continue; const r = el.getBoundingClientRect(); if (!r.height) continue; if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
// 同時に出ている文字（台詞＋ドリルの音）の数
const texts = p => p.evaluate(() => {
  const vis = el => el && !el.hidden && el.offsetParent !== null && +getComputedStyle(el).opacity > 0.05 && el.textContent.trim()
  return [...document.querySelectorAll('#vPlay .say, #zz, #tut:not([hidden]) p')].filter(vis).length
})
const variance = (p, sel) => p.evaluate(sel => {
  const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
}, sel)
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ロード画面が消えてタイトルが出る', async () => p.evaluate(() => document.querySelector('#vLoad').hidden && !document.querySelector('#vTitle').hidden))
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', r); return r
})
await t('OGP 一式があり og:image が 1200x630 の png', async () => {
  const r = await p.evaluate(async () => {
    const m = k => (document.querySelector(`meta[property="${k}"]`) || document.querySelector(`meta[name="${k}"]`) || {}).content
    const img = new Image(); img.src = 'og.png?v=1'; await img.decode().catch(() => {})
    return { title: m('og:title'), desc: m('og:description'), image: m('og:image'), url: m('og:url'), type: m('og:type'), card: m('twitter:card'), w: img.naturalWidth, h: img.naturalHeight }
  })
  expect(r.title && r.desc && /^https:\/\/tom3games\.github\.io\/dentist-hand\/og\.png/.test(r.image) && r.url === 'https://tom3games.github.io/dentist-hand/' && r.card === 'summary_large_image' && r.w === 1200 && r.h === 630, r)
})
await t('ja-JP では日本語で出る', async () => p.evaluate(() => document.documentElement.lang === 'ja' && /痛かったら/.test(document.querySelector('.card h1').textContent)))
await t('English に切り替えると英語、戻すと日本語', async () => {
  await p.click('#bLang'); const en = await p.evaluate(() => [document.querySelector('.card h1').textContent, document.querySelector('#bStart').textContent])
  await p.click('#bLang'); const ja = await p.evaluate(() => document.querySelector('#bStart').textContent)
  expect(/Raise Your Hand/.test(en[0]) && en[1] === 'Check in' && ja === '受付する', { en, ja }); return en
})
await t('遊び方の下にプライバシーのリンク（押せる高さ38px以上）とドリルの音の作者名', async () => {
  await p.click('#bHow')
  const r = await p.evaluate(() => { const a = document.querySelector('#vHow a[href="privacy.html"]'); const b = a.getBoundingClientRect(); return { h: b.height, credit: document.querySelector('#vHow .foot').textContent.includes('Work With Sounds') } })
  await p.click('#bHowBack'); expect(r.h >= 38 && r.credit, r); return r
})
await t('privacy.html が開ける', async () => { const r = await p.request.get(URL0 + 'privacy.html'); expect(r.status() === 200, r.status()) })

// ---- 遊びの仕組み（時間を止めて台本どおりに進める）
const begin = (seed, o = {}) => p.evaluate(({ seed, o }) => { dh.dbg.pause(true); dh.startGame({ seed, tutorial: false, boss: false, ...o }); return { ev: dh.run.S.ev, blocks: dh.run.S.blocks, dLook: dh.run.S.dLook, aPose: dh.run.S.aPose, teeth: dh.run.S.teeth } }, { seed, o })
await t('始めると TM.start と音（呼ばれた回数）が記録され、実際には無音', async () => {
  await p.click('#bStart'); await p.waitForTimeout(400)
  const r = await p.evaluate(() => ({ tm: window.__tmLog.map(x => x.name), calls: window.__soundCalls, ok: window.__muteOk(), play: !document.querySelector('#vPlay').hidden }))
  expect(r.tm.includes('game_start') && r.calls > 0 && r.ok && r.play, r); return r
})
let S = await begin(1000)
await t('天井のモニターに口の中（歯14本）が映り、虫歯は3〜4本、健康な歯へ向かう場面が6〜8回', async () => {
  const r = await p.evaluate(() => { const c = document.querySelector('#monC'), b = c.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), cw: c.width } })
  const cav = S.teeth.filter(x => x === 'cav').length, bad = S.ev.filter(e => e.kind === 'bad').length
  const counts = await p.evaluate(() => { const a = []; for (let i = 0; i < 40; i++) { const s = dh.buildScript(i); a.push([s.teeth.filter(x => x === 'cav').length, s.ev.filter(e => e.kind === 'bad').length]) } return a })
  expect(S.teeth.length === 14 && cav >= 3 && cav <= 4 && bad >= 6 && bad <= 8 && r.w >= 200 && r.cw > 0 && counts.every(([c, b]) => c >= 3 && c <= 4 && b >= 6 && b <= 8), { r, cav, bad }); return { mon: r, cav, bad }
})
await t('モニターに歯が描けている（色の散らばり）', async () => { await p.evaluate(() => dh.dbg.to(6)); const v = await variance(p, '#monC'); expect(v > 800, v); return v })
await t('虫歯は削らせると治る（黒が消える）', async () => {
  S = await begin(1000)
  const e = S.ev.find(x => x.kind === 'cav')
  const r = await p.evaluate(e => { dh.dbg.to(e.contact - 0.1); const a = dh.run.teeth[e.tooth]; dh.dbg.to(e.end + 0.1); return [a, dh.run.teeth[e.tooth], dh.run.fixed] }, e)
  expect(r[0] === 'cav' && r[1] === 'fixed' && r[2] >= 1, r); return r
})
await t('健康な歯へ向かったのを止めないと銀歯になる（ガリッ）', async () => {
  S = await begin(1000)
  const e = S.ev.find(x => x.kind === 'bad')
  const r = await p.evaluate(e => { dh.dbg.to(e.a0 + 0.3); const o = dh.obs(); dh.dbg.to(e.end + 0.1); return { tgt: o.tgt, tstate: o.tstate, after: dh.run.teeth[e.tooth], silver: dh.run.silver, gari: Snd.played.gari || 0 } }, e)
  expect(r.tgt === e.tooth && r.tstate === 'ok' && r.after === 'silver' && r.silver === 1 && r.gari >= 1, r); return r
})
await t('ドリルの行き先と同時に、モニターの縁が光る', async () => {
  S = await begin(1000)
  const e = S.ev.find(x => x.kind === 'bad'), c = S.ev.find(x => x.kind === 'cav')
  const r = await p.evaluate(({ e, c }) => { dh.dbg.to(e.a0 + 0.3); const a = document.querySelector('#mon').classList.contains('alert'); dh.dbg.to(c.a0 + 0.3); return [a, document.querySelector('#mon').classList.contains('alert')] }, { e, c })
  expect(r[0] === true && r[1] === false, r); return r
})
await t('先生が顔を上げる0.8秒前に鼻歌が止まる（見る前の合図）', async () => {
  S = await begin(1000)
  const lk = S.dLook.find(l => l.pose === 'look' && S.blocks.some(b => b.kind === 'drill' && l.a > b.a + 4 && l.a < b.b) && !S.aPose.some(a => a.pose === 'glare' && Math.abs(a.a - l.a) < 4))
  const r = await p.evaluate(lk => { dh.dbg.to(lk.a - 1.3); const a = dh.obs().hum; dh.dbg.to(lk.a - 0.5); const b = dh.obs().hum; dh.dbg.to(lk.a + 0.2); return { before: a, justBefore: b, d: dh.obs().d } }, lk)
  expect(r.before === true && r.justBefore === false && r.d === 'look', r); return r
})
await t('先生が見ている時に挙げると「ごめんごめん」で止まり、その歯は白いまま', async () => {
  S = await begin(1000)
  const e = S.ev.find(x => x.kind === 'bad' && x.pat === 'A')
  const r = await p.evaluate(e => { dh.dbg.to(e.a0 + 0.7); dh.raise(); dh.dbg.step(12); const r = dh.run; const k = r.say && r.say.key; const paused = r.clock < r.pauseUntil; dh.dbg.to(e.end + 1); return { seen: r.seen, saved: r.saved, paused, say: k, tooth: r.teeth[e.tooth] } }, e)
  expect(r.seen === 1 && r.saved === 1 && r.paused && r.say === 'sorry' && r.tooth === 'ok', r); return r
})
await t('誰も見ていない時に挙げると「はい、もう少しね」で続き、銀歯になる', async () => {
  S = await begin(1000)
  const e = S.ev.find(x => x.kind === 'bad' && x.pat === 'D') || S.ev.find(x => x.kind === 'bad' && x.pat === 'C')
  const r = await p.evaluate(e => { dh.dbg.to(e.a0 + 0.3); dh.raise(); dh.dbg.step(70); const k = dh.run.say && dh.run.say.key; dh.dbg.to(e.end + 0.1); return { seen: dh.run.seen, say: k, tooth: dh.run.teeth[e.tooth] } }, e)
  expect(r.seen === 0 && r.say === 'notSeen' && r.tooth === 'silver', r); return r
})
await t('助手が叱った後こっちを見る。その時に挙げると助手が先生に言って止まる', async () => {
  S = await begin(1000)
  const e = S.ev.find(x => x.kind === 'bad' && x.pat === 'B')
  const r = await p.evaluate(e => { dh.dbg.to(e.a0 + 0.4); const g = dh.obs().a; dh.dbg.to(e.a0 + 1.3); const a = dh.obs().a; dh.raise(); dh.dbg.step(3); const k1 = dh.run.say && dh.run.say.key; dh.dbg.step(40); return { g, a, k1, saved: dh.run.saved } }, e)
  expect(r.g === 'glare' && r.a === 'look' && r.k1 === 'seenByA' && r.saved === 1, r); return r
})
await t('虫歯の上で止めると虫歯が残り、大げさと思われる', async () => {
  S = await begin(1000)
  const e = S.ev.find(x => x.kind === 'cav' && S.dLook.some(l => l.pose === 'look' && l.a > x.contact && l.a < x.end))
  const lk = S.dLook.find(l => l.pose === 'look' && l.a > e.contact && l.a < e.end)
  const r = await p.evaluate(({ e, lk }) => { dh.dbg.to(lk.a + 0.1); dh.raise(); dh.dbg.step(120); dh.dbg.to(e.end + 2); return { tooth: dh.run.teeth[e.tooth], bigesa: dh.run.bigesa } }, { e, lk })
  expect(r.tooth === 'cav' && r.bigesa === 1, r); return r
})
await t('何もない時に見られて挙げると大げさ', async () => {
  S = await begin(1000)
  const r = await p.evaluate(() => { dh.dbg.to(1); dh.raise(); dh.dbg.step(5); return dh.run.bigesa })
  expect(r === 1, r); return r
})
await t('挙げっぱなしにはできない（1.1秒で下がる・気づかれないと次まで1.6秒）', async () => {
  S = await begin(1000)
  const e = S.ev.find(x => x.kind === 'bad' && x.pat === 'D') || S.ev.find(x => x.kind === 'cav')
  const r = await p.evaluate(e => { dh.dbg.to(e.a0 + 0.1); const a = dh.run.hand.up; const b = dh.raise(); dh.dbg.step(70); const c = dh.run.hand.up; const d = dh.raise(); dh.dbg.step(100); const f = dh.raise(); return { a, b, c, d, f } }, e)
  expect(!r.a && r.b && !r.c && r.d === false && r.f === true, r); return r
})
await t('痛みは演出（手・足の指・天井・暗さ）で、勝ち負けのバーは無い', async () => {
  S = await begin(1000)
  const e = S.ev.find(x => x.kind === 'cav')
  const r = await p.evaluate(async e => {
    dh.dbg.to(e.contact + 1.0); for (let i = 0; i < 10; i++) { dh.dbg.step(1); await new Promise(r => requestAnimationFrame(r)) }
    const on = s => document.querySelector(s + ' img.on').dataset.k
    return { hand: on('#hand'), feet: on('#feet'), vig: +getComputedStyle(document.querySelector('#vig')).opacity, blur: document.querySelector('#ceilP').style.filter, bars: document.querySelectorAll('progress,meter,[role=progressbar]').length }
  }, e)
  expect(r.hand === 'fist' && r.feet === 'curl' && r.vig > 0.2 && /blur/.test(r.blur) && r.bars === 0, r); return r
})
await t('通しで同時に出る文字は2つまで（160か所で数える）', async () => {
  S = await begin(1234)
  const n = await p.evaluate(async () => { let mx = 0, at = 0; for (let i = 0; i < 160; i++) { dh.dbg.step(50); if (i % 7 === 3) dh.raise(); await new Promise(r => requestAnimationFrame(r)); const k = [...document.querySelectorAll('#vPlay .say, #zz')].filter(el => !el.hidden && +getComputedStyle(el).opacity > 0.05 && el.textContent.trim()).length; if (k > mx) { mx = k; at = dh.run.tt } if (dh.run.done) break } return { mx, at } })
  expect(n.mx <= 2, n); return n
})
await t('台詞は12字前後（日本語は14字以内）', async () => {
  const r = await p.evaluate(() => { const L = DH_DATA.lines.ja; const long = []; for (const k in L) for (const s of L[k]) for (const part of s.split('|')) if ([...part].length > 14) long.push(s); return long })
  expect(r.length === 0, r); return { long: r.length }
})
await t('チャットで先生が質問し、口を開けたまま答えさせられる', async () => {
  S = await begin(1000)
  const c = S.blocks.find(b => b.kind === 'chat')
  const r = await p.evaluate(c => { dh.dbg.to(c.a + 0.6); const q = dh.run.say.key; dh.dbg.to(c.a + 2.6); const a = dh.run.say.key + dh.run.say.who; dh.dbg.to(c.a + 4.3); return [q, a, dh.run.say.key] }, c)
  expect(r[0] === 'chatQ' && r[1] === 'chatAp' && r[2] === 'chatR', r); return r
})
await t('院長（レア）は別の顔で、痛みが強い', async () => {
  const r = await p.evaluate(() => { dh.startGame({ seed: 77, tutorial: false, boss: true }); const src = document.querySelector('#doc img').src; const b = dh.run.S.ev.filter(e => e.I).map(s => s.I); dh.startGame({ seed: 77, tutorial: false, boss: false }); const n = dh.run.S.ev.filter(e => e.I).map(s => s.I); const avg = a => a.reduce((x, y) => x + y, 0) / a.length; return { src: /director/.test(src), boss: avg(b), normal: avg(n) } })
  expect(r.src && r.boss > r.normal, r); return r
})
await t('種で虫歯の位置と台本が変わる（毎回くじ）', async () => p.evaluate(() => JSON.stringify(dh.buildScript(1).teeth) !== JSON.stringify(dh.buildScript(2).teeth)))
await t('治療は約2分', async () => { const r = await p.evaluate(() => [1, 2, 3, 4, 5, 6].map(s => Math.round(dh.buildScript(s).end))); expect(r.every(x => x >= 95 && x <= 140), r); return r })
await t('何もしない通しは銀歯だらけで最低の判定（ランク1）', async () => {
  const r = await p.evaluate(() => { const a = []; for (let i = 0; i < 6; i++) a.push(dh.simulate('none', 500 + i)); return a.map(x => [x.rank, x.title, x.silver]) })
  expect(r.every(x => x[0] === 1 && x[2] >= 5), r); return r[0]
})
// ---- 結果
await t('最後まで行くとカルテが出て、TM.end と判定が発表まで伏せられる', async () => {
  S = await begin(1000)
  const r = await p.evaluate(async () => {
    const e = dh.run.S.ev.find(x => x.kind === 'bad' && x.pat === 'A'); dh.dbg.to(e.a0 + 0.7); dh.raise(); dh.dbg.to(1e9)
    await new Promise(r => setTimeout(r, 1000))
    return { view: !document.querySelector('#vResult').hidden, tm: window.__tmLog.filter(x => x.name === 'game_end').length, res: dh.result }
  })
  expect(r.view && r.tm >= 1 && r.res && r.res.raised === 1 && r.res.teeth.length === 14, r); return { title: r.res.title, score: r.res.score, silver: r.res.silver }
})
await t('ハンコ（称号と点）は最後に押される', async () => {
  const a = await variance(p, '#karte'); await p.waitForTimeout(4000); const b = await variance(p, '#karte')
  await p.screenshot({ path: ROOT + '/shots/v-result.png' })
  expect(a > 300 && b !== a, { a, b }); return { a, b }
})
await t('結果に「もう一回」（bAgain）と支援リンク・保存・Xでポスト', async () => p.evaluate(() => !!document.querySelector('#bAgain') && !!document.querySelector('#tmSupport') && /歯ブラシ/.test(document.querySelector('#tmSupport').textContent) && !!document.querySelector('#bSave') && !!document.querySelector('#bPost')))
await t('Xでポスト: x.com/intent/post、本文にURLを入れず url パラメータ', async () => {
  const u = await p.evaluate(() => dh.postUrl()); const q = new URL(u)
  expect(q.origin + q.pathname === 'https://x.com/intent/post' && q.searchParams.get('url') === 'https://tom3games.github.io/dentist-hand/' && !/https?:/.test(q.searchParams.get('text')), u); return q.searchParams.get('text')
})
await t('画像を保存でPNGが落ちてくる', async () => {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.click('#bSave')])
  expect(/\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename()); return dl.suggestedFilename()
})
await t('ポストで TM.share が記録される', async () => {
  const [pop] = await Promise.all([p.context().waitForEvent('page', { timeout: 5000 }), p.click('#bPost')])
  const u = pop.url(); await pop.close()
  const r = await p.evaluate(() => window.__tmLog.filter(x => x.name === 'share').map(x => x.params.method))
  expect(r.includes('x') && r.includes('save') && /x\.com|twitter\.com/.test(u), { r, u }); return r
})
await t('もう一回で遊び直せる', async () => { await p.click('#bAgain'); await p.waitForTimeout(300); return p.evaluate(() => !document.querySelector('#vPlay').hidden && dh.run.tt < 2 && !dh.run.done) })
await t('ミュートボタン（天井のスピーカー）で消せて覚えている', async () => {
  await p.click('#bMute'); const r = await p.evaluate(() => [localStorage.getItem('dh_mute'), Snd.muted]); await p.click('#bMute')
  expect(r[0] === '1' && r[1] === true, r)
})
await t('ここまでエラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- 最初の1回だけのチュートリアル
await t('チュートリアル: 初回だけ出て、ドリルが白い歯へ向かい先生が見る瞬間で止まり、挙げると止めてくれる', async () => {
  const q = await open(browser, {}, { tut: false })
  await q.click('#bStart'); await q.waitForTimeout(200)
  const s1 = await q.evaluate(() => [!document.querySelector('#tut').hidden, document.querySelector('#tutP').textContent])
  await q.screenshot({ path: ROOT + '/shots/v-tut1.png' })
  await q.click('#tutB'); await q.click('#tutB')
  await q.waitForFunction(() => window.dh.dbg.tutStage() === 4, null, { timeout: 30000 })
  await q.waitForTimeout(300); await q.screenshot({ path: ROOT + '/shots/v-tut3.png' })
  const n = await texts(q)
  await q.tap ? null : null
  await q.click('#bHand'); await q.waitForTimeout(300)
  const r = await q.evaluate(() => ({ avoided: dh.run.saved, tut: localStorage.getItem('dh_tut'), hidden: document.querySelector('#tut').hidden }))
  await q.evaluate(() => { dh.dbg.finish(); }); await q.waitForTimeout(900); await q.click('#bAgain'); await q.waitForTimeout(200)
  const again = await q.evaluate(() => document.querySelector('#tut').hidden)
  await q.close()
  expect(s1[0] && r.avoided === 1 && r.tut === '1' && r.hidden && again && n <= 2, { s1, r, again, n }); return { s1: s1[1], n }
})

// ---- 遅い回線でもロード画面は12秒で消える
await t('音が届かなくても12秒でロード画面が消える', async () => {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
  await ctx.route('**/*.mp3', () => {})   // 返事をしない
  const q = await ctx.newPage(); const t0 = Date.now()
  await q.goto(URL0); const mid = await q.evaluate(() => !document.querySelector('#vLoad').hidden)
  await q.waitForFunction(() => window.__dhReady, null, { timeout: 16000 }); const sec = (Date.now() - t0) / 1000
  const err = await q.evaluate(() => !!document.querySelector('#boot-err'))
  await ctx.close(); expect(mid && sec < 13.5 && !err, { mid, sec, err }); return { sec }
})

// ---- 3サイズ × 全画面で一画面に収まる
for (const [w, h, name] of SIZES) {
  for (const locale of ['ja-JP', 'en-US']) {
    const q = await open(browser, { viewport: { width: w, height: h } }, { locale })
    const L = locale === 'ja-JP' ? '' : '-en'
    const views = {}
    views.title = [await fit(q), await overflow(q)]; await q.screenshot({ path: `${ROOT}/shots/fit-${name}${L}-title.png` })
    await q.click('#bHow'); await q.waitForTimeout(150); views.how = [await fit(q), await overflow(q)]; await q.screenshot({ path: `${ROOT}/shots/fit-${name}${L}-how.png` })
    await q.click('#bHowGo'); await q.evaluate(() => { dh.dbg.pause(true); dh.startGame({ seed: 1000, tutorial: false, boss: false }) })
    const S2 = await q.evaluate(() => dh.run.S.ev.find(e => e.kind === 'bad'))
    await q.evaluate(t => dh.dbg.to(t), S2.a0 + 0.5); await q.waitForTimeout(120); views.play = [await fit(q), await overflow(q)]; await q.screenshot({ path: `${ROOT}/shots/fit-${name}${L}-play.png` })
    await q.evaluate(() => { dh.raise(); dh.dbg.step(20) }); await q.waitForTimeout(120); views.raised = [await fit(q), await overflow(q)]; await q.screenshot({ path: `${ROOT}/shots/fit-${name}${L}-raised.png` })
    await q.evaluate(() => { dh.startGame({ seed: 5, tutorial: true, boss: false }) }); await q.waitForTimeout(150); views.tut = [await fit(q), await overflow(q)]
    await q.evaluate(() => { document.querySelector('#tut').hidden = true; dh.dbg.finish({ raised: 6, seen: 4, silver: 1, fixed: 3, bigesa: 0 }) }); await q.waitForTimeout(5200)
    views.result = [await fit(q), await overflow(q)]; await q.screenshot({ path: `${ROOT}/shots/fit-${name}${L}-result.png` })
    for (const [v, [f, o]] of Object.entries(views)) {
      await t(`一画面に収まる・はみ出しなし ${name}${L} ${w}x${h} ${v}`, async () => { expect(!f.over.length && o.sw <= o.W && !o.bad.length, { f, o }) })
    }
    await t(`${name}${L}: エラーなし`, async () => { expect(!q.errs.length, q.errs.join('|')) })
    await q.close()
  }
}
await browser.close()

// ---- WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始めて手を挙げられ、実際には無音', async () => {
  await wp.tap('#bStart'); await wp.waitForTimeout(500)
  await wp.evaluate(() => { dh.dbg.pause(true); dh.startGame({ seed: 1000, tutorial: false, boss: false }); const e = dh.run.S.ev.find(x => x.kind === 'bad' && x.pat === 'A'); dh.dbg.to(e.a0 + 0.7) })
  await wp.tap('#bHand'); await wp.evaluate(() => dh.dbg.step(10))
  const r = await wp.evaluate(() => ({ raised: dh.run.raised, seen: dh.run.seen, calls: window.__soundCalls, ok: window.__muteOk(), ctx: Snd.ctx && Snd.ctx.state }))
  await wp.screenshot({ path: ROOT + '/shots/v-webkit-raised.png' })
  expect(r.raised === 1 && r.seen === 1 && r.calls > 0 && r.ok && r.ctx !== 'running', r); return r
})
await t('WebKit: 結果のカルテが描ける', async () => {
  await wp.evaluate(() => dh.dbg.to(1e9)); await wp.waitForTimeout(5200)
  const v = await variance(wp, '#karte'); await wp.screenshot({ path: ROOT + '/shots/v-webkit-result.png' }); expect(v > 500, v); return v
})
await t('WebKit: 英語', async () => { await wp.evaluate(() => dh.setLang('en')); return wp.evaluate(() => document.querySelector('#bAgain').textContent === 'Again') })
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
