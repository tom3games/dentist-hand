import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 検証 v3。node verify.mjs（音は出さない。スマホ縦3サイズ × 全画面、Chromium と WebKit）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
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
// 横のはみ出し（人物・天井は画面の外まで描くので、押せる物と文字と物だけを見る）
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) :is(button,a,p,h1,h2,li,span,small,.say,#mon,canvas,#tag,#prop,#bigHk)')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) :is(button,canvas,a,.card,.sheet,.say,#tag)')) { if (el.closest('[hidden]')) continue; if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true })) continue; const r = el.getBoundingClientRect(); if (!r.height) continue; if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
// 同時に出ている文字のかたまり（先生たちの吹き出し・自分の返事・同意の紙・案内）。ハンコ（2文字の判子）は絵として数えない
const texts = p => p.evaluate(() => {
  const vis = el => el && !el.hidden && el.offsetParent !== null && +getComputedStyle(el).opacity > 0.05 && el.textContent.trim()
  return [...document.querySelectorAll('#vPlay .say, #tag, #tut:not([hidden]) p')].filter(vis).map(el => el.id || el.className)
})
const variance = (p, sel) => p.evaluate(sel => {
  const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
}, sel)
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]
const ALL_T = ['wedding', 'moving', 'dog', 'onsen', 'band', 'ring', 'marathon', 'armband', 'mascot', 'sub', 'loan']
const ALL_E = ['boss', 'fight', 'phone', 'music', 'ball', 'heir', 'fly', 'bday']

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
await t('OGP 一式があり og:image が 1200x630 の png（?v=3）', async () => {
  const r = await p.evaluate(async () => {
    const m = k => (document.querySelector(`meta[property="${k}"]`) || document.querySelector(`meta[name="${k}"]`) || {}).content
    const img = new Image(); img.src = 'og.png?v=3x'; await img.decode().catch(() => {})
    return { title: m('og:title'), desc: m('og:description'), image: m('og:image'), url: m('og:url'), card: m('twitter:card'), w: img.naturalWidth, h: img.naturalHeight }
  })
  expect(r.title === '口を開けたまま、同意しました' && r.desc && /og\.png\?v=3$/.test(r.image) && r.url === 'https://tom3games.com/play/dentist-hand/' && r.card === 'summary_large_image' && r.w === 1200 && r.h === 630, r)
})
await t('画面に「AI」「画像生成」の文字が無い（全画面・日英）', async () => {
  const s = await p.evaluate(() => { const D = dh.D; return JSON.stringify(D) + document.body.innerText })
  expect(!/\bAI\b|画像生成|生成AI/.test(s), 'found')
})
await t('台詞は2行まで・1行16字まで（日本語）。同意の紙も16字まで', async () => {
  const bad = await p.evaluate(() => {
    const D = dh.D, out = [], chk = (s, src) => { if (typeof s !== 'string') return; const ls = s.split('|'); if (ls.length > 2 || ls.some(l => [...l].length > 16)) out.push(src + ':' + s) }
    for (const k in D.lines.ja) D.lines.ja[k].forEach(s => chk(s, k))
    for (const x of D.topics.concat(D.events)) for (const k in x.ja) chk(x.ja[k], x.id + '.' + k)
    return out
  })
  expect(bad.length === 0, bad.join(' / ')); return { checked: 'ok' }
})
await t('English に切り替えると英語、戻すと日本語', async () => {
  await p.click('#bLang'); const en = await p.evaluate(() => [document.querySelector('.card h1').textContent, document.querySelector('#bStart').textContent, document.querySelector('.mb b').textContent])
  await p.click('#bLang'); const ja = await p.evaluate(() => [document.querySelector('#bStart').textContent, document.querySelector('.mb b').textContent])
  expect(/My Mouth Open/.test(en[0]) && en[1] === 'Check in' && en[2] === 'Aga' && ja[0] === '受付する' && ja[1] === 'あが', { en, ja }); return en
})
await t('遊び方（問診票）に口の形と作者名、プライバシーのリンク（38px以上）', async () => {
  await p.click('#bHow')
  const r = await p.evaluate(() => { const a = document.querySelector('#vHow a[href="privacy.html"]'); const b = a.getBoundingClientRect(); return { h: b.height, credit: document.querySelector('#vHow .foot').textContent.includes('Work With Sounds'), mouths: document.querySelectorAll('#howList svg').length, rows: document.querySelectorAll('#howList li').length } })
  await p.click('#bHowBack'); expect(r.h >= 38 && r.credit && r.mouths === 4 && r.rows === 7, r); return r
})
await t('privacy.html が開ける', async () => { const r = await p.request.get(URL0 + 'privacy.html'); expect(r.status() === 200, r.status()) })

// ---- 遊びの中身
await t('受付すると TM.start と音（呼ばれた回数）が記録され、実際には無音', async () => {
  await p.click('#bStart'); await p.waitForTimeout(500)
  const r = await p.evaluate(() => ({ tm: window.__tmLog.map(x => x.name), calls: window.__soundCalls, ok: window.__muteOk(), play: !document.querySelector('#vPlay').hidden }))
  expect(r.tm.includes('game_start') && r.calls > 0 && r.ok && r.play, r); return r
})
const begin = (seed, o = {}) => p.evaluate(({ seed, o }) => { dh.dbg.pause(true); dh.startGame({ seed, tutorial: false, ...o }); return dh.run.deck.map(s => s.id || s.k) }, { seed, o })
await t('台本: 話6つ＋出来事3つ、最後は話。2000回で全部の話・出来事（まれな3つも）が出る。まれは約12%', async () => {
  const r = await p.evaluate(() => {
    const seen = {}; let rare = 0, bad = 0
    for (let s = 0; s < 2000; s++) {
      const d = dh.buildDeck(s * 7 + 1), ids = d.filter(x => x.id).map(x => x.id)
      ids.forEach(i => seen[i] = (seen[i] || 0) + 1)
      if (ids.some(i => ['heir', 'fly', 'bday'].includes(i))) rare++
      const tp = d.filter(x => x.k === 'topic').length, ev = d.filter(x => x.k === 'event').length
      if (tp !== 6 || ev !== 3 || d[d.length - 2].k !== 'topic' || d[0].k !== 'intro') bad++
    }
    return { seen, rare: rare / 2000, bad, loanLast: (() => { let n = 0; for (let s = 0; s < 500; s++) { const d = dh.buildDeck(s); if (d[d.length - 2].id === 'loan') n++ } return n / 500 })() }
  })
  const all = ['wedding', 'moving', 'dog', 'onsen', 'band', 'ring', 'marathon', 'armband', 'mascot', 'sub', 'loan', 'boss', 'fight', 'phone', 'music', 'ball', 'heir', 'fly', 'bday']
  expect(r.bad === 0 && all.every(i => r.seen[i] > 0) && r.rare > 0.08 && r.rare < 0.16, r); return { rare: r.rare, loanLast: r.loanLast, min: Math.min(...all.map(i => r.seen[i])) }
})
await t('返事のくせ: だまる・あが=全部同意 / んー=6割断れる / おが・えあ=称号も変わる（bot 40回ずつ）', async () => {
  const r = await p.evaluate(() => {
    const s = {}
    for (const b of ['none', 'aga', 'nn', 'oga', 'ea', 'random']) { const a = []; for (let i = 0; i < 40; i++) a.push(dh.simulate(b, 1000 + i * 7919)); s[b] = { n: a.reduce((x, y) => x + y.n, 0) / 40, A: a[0].A, len: [Math.min(...a.map(x => x.len)), Math.max(...a.map(x => x.len))], titles: [...new Set(a.map(x => x.title))].join(',') } }
    return s
  })
  expect(r.none.n === r.none.A && r.none.titles === 'silent' && r.aga.n === r.aga.A && r.nn.n < r.aga.n - 2.5 && r.nn.n > 2 && r.none.len[1] <= 160 && r.aga.len[0] >= 60 && r.oga.titles === 'big' && r.ea.titles === 'wild', r)
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, `${v.n.toFixed(1)}/${v.A} ${v.len.join('-')}s ${v.titles}`]))
})
await t('同じ種・同じ返事なら同じ結果', async () => {
  const r = await p.evaluate(() => [dh.simulate('random', 42), dh.simulate('random', 42), dh.simulate('random', 43)])
  expect(r[0].hows === r[1].hows && r[0].n === r[1].n, r); return r[0].hows
})
await t('だまっていると「はい」。最初の沈黙で手が勝手に挙がり、おまけの頼みが足される', async () => {
  await begin(9, { topics: ['dog'], events: [] })
  const r = await p.evaluate(() => {
    dh.dbg.toReply(); dh.dbg.skipReply(); dh.dbg.toReply(); dh.dbg.skipReply(); dh.dbg.step(30)
    const hand = dh.run.vis.hand >= 0 && document.querySelector('#hand').getBoundingClientRect().top < innerHeight
    dh.dbg.step(600)
    return { hand, ask: dh.run.asks[0] }
  })
  expect(r.hand && r.ask.how === 'silent' && r.ask.agreed && r.ask.bonus, r); return r.ask.text + '＋' + r.ask.bonus
})
await t('同じ話でも返事で同意書の中身が変わる（あが=そのまま/おが=盛った頼み/えあ=別の話・別の物/だまる=そのまま＋おまけ/んー=断るか聞き間違い）', async () => {
  const out = {}
  for (const k of ['aga', 'oga', 'ea', null, 'nn']) {
    await begin(5, { topics: ['moving'], events: [] })
    out[k || 'none'] = await p.evaluate(k => {
      dh.dbg.toReply(); dh.reply('aga'); dh.dbg.toReply()
      if (k) dh.reply(k); else dh.dbg.skipReply()
      let n = 0, react = null, pk = null; while (!dh.run.done && n++ < 900) { dh.dbg.step(1); const V = dh.run.vis; if (V.react) { react = V.react.kind; pk = V.react.k } }
      const a = dh.run.asks[0]
      return { prop: pk, text: a.text, v: a.v, how: a.how, bonus: a.bonus || '', react, pts: a.pts }
    }, k)
  }
  const texts = new Set([out.aga.text, out.oga.text, out.ea.text, out.none.text + out.none.bonus])
  expect(texts.size === 4 && out.aga.v === 'c' && out.oga.v === 'cb' && out.ea.v === 'cw' && out.ea.prop === 'p_key' && out.none.bonus && out.aga.react === 'facepalm' && ['no', 'mis'].includes(out.nn.how), out)
  return Object.fromEntries(Object.entries(out).map(([k, x]) => [k, x.text + (x.bonus ? '＋' + x.bonus : '') + ' ' + x.pts + '点']))
})
await t('同意した直後に話ごとの反応が出る（物が降る・うれし泣き・助手があきれる・院長がのぞく・踊る）', async () => {
  const seen = {}
  for (const id of ['dog', 'ring', 'sub', 'onsen', 'band']) {
    await begin(6, { topics: [id], events: [] })
    seen[id] = await p.evaluate(() => {
      dh.dbg.toReply(); dh.reply('aga'); dh.dbg.toReply(); dh.reply('aga')
      let n = 0; while (!dh.run.vis.react && n++ < 600) dh.dbg.step(1); dh.dbg.step(30)
      const vis = sel => [...document.querySelectorAll(sel)].filter(e => +getComputedStyle(e).opacity > 0.05).length
      return { kind: dh.run.vis.react && dh.run.vis.react.kind, rain: vis('#rain img'), tears: vis('#tears i'), asst: document.querySelector('#asst img.on').dataset.k, boss: document.querySelector('#boss').getBoundingClientRect().right > 0 }
    })
    if (id === 'dog' || id === 'ring') await p.screenshot({ path: ROOT + `/shots/v-react-${id}.png` })
  }
  expect(seen.dog.kind === 'rain' && seen.dog.rain >= 3 && seen.ring.kind === 'cry' && seen.ring.tears >= 2 && seen.sub.asst === 'glare' && seen.onsen.boss && seen.band.kind === 'dance', seen)
  return Object.fromEntries(Object.entries(seen).map(([k, x]) => [k, x.kind]))
})
await t('全部の話・出来事を通せる（11話＋8出来事を1回で。返事はばらばら）・物と絵の仕掛けが動く', async () => {
  await begin(77, { topics: ALL_T, events: ALL_E })
  const r = await p.evaluate(() => {
    const seen = new Set(), fx = {}, ks = ['aga', 'nn', 'oga', 'ea', null]
    let i = 0, n = 0
    while (!dh.run.done && n++ < 60 * 900) {
      if (dh.replyOpen()) { const k = ks[i++ % ks.length]; if (k) dh.reply(k); else dh.dbg.skipReply() }
      dh.dbg.step(1)
      const V = dh.run.vis, seg = dh.run.deck[dh.run.segI]
      if (seg && seg.id) seen.add(seg.id)
      if (V.drillStuck) fx.fly = 1; if (V.ball) fx.ball = 1; if (V.dim) fx.bday = 1; if (V.boss === 1) fx.boss = 1; if (V.peek) fx.peek = 1; if (V.music) fx.music = 1; if (V.hoseT >= 0) fx.hose = 1
      if (V.prop && V.prop.footT >= 0) fx.foot = 1; if (V.a === 'glare') fx.glare = 1
    }
    return { seen: [...seen], fx, asks: dh.run.asks.length, done: dh.run.done }
  })
  const need = ALL_T.concat(ALL_E)
  expect(r.done && need.every(x => r.seen.includes(x)) && r.asks >= 19 && Object.keys(r.fx).length >= 9, r)
  return { asks: r.asks, fx: Object.keys(r.fx).join(',') }
})
await t('何もしない通し: 全部に同意して称号「沈黙の契約王」、同意書が1画面に収まる', async () => {
  await begin(2024)
  await p.evaluate(() => { dh.dbg.pause(false) })
  await p.evaluate(() => { dh.dbg.pause(true); dh.dbg.finish() })
  await p.waitForTimeout(4600)
  const r = await p.evaluate(() => ({ view: !document.querySelector('#vResult').hidden, n: dh.result.n, A: dh.result.A, key: dh.result.key, title: dh.result.title }))
  const f = await fit(p)
  await p.screenshot({ path: ROOT + '/shots/v-nothing-result.png' })
  expect(r.view && r.n === r.A && r.A === 9 && r.key === 'silent' && f.over.length === 0, { r, f }); return r
})
await t('結果: 同意書が描けていて、保存・Xでポスト（文に件数と称号とハッシュタグ）・支援リンク', async () => {
  const v = await variance(p, '#karte')
  const post = await p.evaluate(() => decodeURIComponent(dh.postUrl()))
  const dl = p.waitForEvent('download', { timeout: 4000 }).catch(() => null)
  await p.click('#bSave'); const d = await dl
  const sup = await p.evaluate(() => !!document.querySelector('#tmSupport'))
  const zk = await p.evaluate(() => [dh.result.sev, dh.result.zk, dh.result.zkTotal, document.querySelector('#tGoal').textContent])
  expect(zk[0] > 0 && zk[1] >= 9 && zk[2] === 61 && /図鑑/.test(zk[3]) && /ひどさ\d+点/.test(post) && v > 400 && /9件に同意/.test(post) && /沈黙の契約王/.test(post) && /#口を開けたまま同意しました/.test(post) && /tom3games\.github\.io\/dentist-hand/.test(post) && d && sup, { v, post, d: !!d, sup }); return { v, file: d && d.suggestedFilename() }
})

// ---- 本物の指（マウス）で口のボタンを押す
await t('口のボタン4つを本物のクリックで押すと返事になる（窓が閉じている時は何も起きない）', async () => {
  await begin(11, { topics: ['wedding', 'moving', 'dog', 'ring'], events: [] })
  const got = []
  for (const k of ['aga', 'nn', 'oga', 'ea']) {
    await p.evaluate(() => dh.dbg.toReply())
    const xy = await p.evaluate(k => dh.mouthXY(k), k)
    await p.mouse.click(xy.x, xy.y)
    got.push(await p.evaluate(() => dh.run.replies[dh.run.replies.length - 1]))
    await p.evaluate(() => dh.dbg.step(30))
  }
  // 窓が閉じている時
  await p.evaluate(() => { while (dh.replyOpen()) dh.dbg.step(1); dh.dbg.step(5) })
  const before = await p.evaluate(() => [dh.replyOpen(), dh.run.replies.length])
  const xy = await p.evaluate(() => dh.mouthXY('aga')); await p.mouse.click(xy.x, xy.y)
  const after = await p.evaluate(() => dh.run.replies.length)
  expect(got.join() === 'aga,nn,oga,ea' && (before[0] || after === before[1]), { got, before, after }); return got
})
await t('口のボタンは3サイズとも画面内で、押せる大きさ（44px以上）', async () => {
  const out = []
  for (const [w, h, name] of SIZES) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(80)
    const r = await p.evaluate(() => ['aga', 'oga', 'nn', 'ea'].map(k => dh.mouthXY(k)))
    for (const b of r) if (b.x < 0 || b.x > w || b.y < 0 || b.y > h || b.w < 44 || b.h < 44) out.push(name + JSON.stringify(b))
  }
  await p.setViewportSize({ width: 390, height: 844 })
  expect(out.length === 0, out); return 'ok'
})

// ---- 文字の数（通しで6フレームごとに数える）
await t('通しで同時に出る文字は2つまで（吹き出し・返事・同意の紙）', async () => {
  await begin(31337, { topics: ALL_T.slice(0, 6), events: ['boss', 'fight', 'phone', 'heir'] })
  let max = 0, worst = null, frames = 0
  const ks = ['aga', 'nn', 'oga', 'ea', null]; let i = 0
  for (let n = 0; n < 2000; n++) {
    const st = await p.evaluate(ks => { if (dh.run.done) return 'done'; if (dh.replyOpen() && Math.random() < 0.3) { const k = ks[Math.floor(Math.random() * ks.length)]; if (k) dh.reply(k) } dh.dbg.step(6); return 'ok' }, ks)
    if (st === 'done') break
    const tx = await texts(p); frames++
    if (tx.length > max) { max = tx.length; worst = tx }
    i++
  }
  expect(max <= 2, { max, worst }); return { frames, max }
})

// ---- 3サイズ × 全画面が一画面に収まり、横にはみ出さない（日英）
for (const lang of ['ja', 'en']) {
  for (const [w, h, name] of SIZES) {
    await t(`${lang} ${name} ${w}x${h}: タイトル・遊び方・診察中（物と同意の紙）・同意書が一画面`, async () => {
      const q = await open(browser, { viewport: { width: w, height: h } }, { locale: lang === 'ja' ? 'ja-JP' : 'en-US' })
      const bad = []
      const check = async v => { const f = await fit(q), o = await overflow(q); if (f.over.length || o.sw > w || o.bad.length) bad.push({ v, f: f.over, o: o.bad, sw: o.sw }); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-${lang}-${v}.png` }) }
      await check('title')
      await q.click('#bHow'); await check('how'); await q.click('#bHowBack')
      await q.evaluate(() => { dh.dbg.pause(true); dh.startGame({ seed: 3, tutorial: false, topics: ['ring', 'loan', 'sub'], events: ['phone'] }) })
      await q.evaluate(() => { dh.dbg.toReply(); dh.reply('aga'); dh.dbg.toReply(); dh.dbg.step(40) }); await check('ask')
      await q.evaluate(() => { dh.reply('aga'); let n = 0; while (!dh.run.vis.tag && n++ < 600) dh.dbg.step(1); dh.dbg.step(20) }); await check('stamp')
      await q.evaluate(() => { dh.dbg.finish() }); await q.waitForTimeout(4200); await check('result')
      await q.context().close()
      expect(bad.length === 0, bad); return 'ok'
    })
  }
}

// ---- 初回のチュートリアル（本物のクリックで）
await t('初回: 問いかけの札 → 最初の返事の窓で口のボタンを教える → 押すと返事になって消える。2回目は出ない', async () => {
  const q = await open(browser, {}, { tut: false })
  await q.click('#bStart'); await q.waitForTimeout(300)
  const s1 = await q.evaluate(() => ({ tut: !document.querySelector('#tut').hidden, btn: !document.querySelector('#tutB').hidden, n: document.querySelectorAll('#tut p').length }))
  await q.click('#tutB')
  await q.waitForFunction(() => dh.dbg.tutStage() === 3, null, { timeout: 15000 })
  const tx = await texts(q)
  await q.screenshot({ path: ROOT + '/shots/v-tut2.png' })
  const xy = await q.evaluate(() => dh.mouthXY('nn')); await q.mouse.click(xy.x, xy.y)
  const s2 = await q.evaluate(() => ({ hidden: document.querySelector('#tut').hidden, reply: dh.run.replies[0], saved: localStorage.getItem('dh_tut') }))
  await q.evaluate(() => dh.startGame()); const s3 = await q.evaluate(() => document.querySelector('#tut').hidden)
  await q.context().close()
  expect(s1.tut && s1.btn && tx.length <= 2 && s2.hidden && s2.reply === 'nn' && s2.saved === '1' && s3, { s1, tx, s2, s3 }); return { tx }
})
await t('Chromium: エラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })

// ---- WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.dispatchEvent(e); return e.defaultPrevented })
  expect(r === true, r)
})
await t('WebKit: タップで受付 → 口のボタンを本物のタップで押して返事 → 実際には無音', async () => {
  await wp.tap('#bStart'); await wp.waitForTimeout(400)
  await wp.evaluate(() => { dh.dbg.pause(true); dh.startGame({ seed: 8, tutorial: false, topics: ['wedding', 'loan'], events: ['ball'] }); dh.dbg.toReply() })
  const xy = await wp.evaluate(() => dh.mouthXY('ea'))
  await wp.touchscreen.tap(xy.x, xy.y)
  const r = await wp.evaluate(() => ({ reply: dh.run.replies[0], ok: window.__muteOk(), calls: window.__soundCalls }))
  await wp.evaluate(() => dh.dbg.step(40)); await wp.screenshot({ path: ROOT + '/shots/v-webkit-play.png' })
  expect(r.reply === 'ea' && r.ok && r.calls > 0, r); return r
})
await t('WebKit: 最後まで → 同意書が描ける', async () => {
  await wp.evaluate(() => dh.dbg.finish()); await wp.waitForTimeout(4000)
  const v = await variance(wp, '#karte'); await wp.screenshot({ path: ROOT + '/shots/v-webkit-result.png' })
  const ok = await wp.evaluate(() => window.__muteOk())
  expect(v > 400 && ok, { v, ok }); return v
})
await t('WebKit: 英語', async () => { await wp.evaluate(() => dh.setLang('en')); return wp.evaluate(() => document.querySelector('#bAgain').textContent === 'Again') })
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()

await browser.close(); server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
