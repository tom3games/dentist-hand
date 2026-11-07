// 口を開けたまま、同意しました（dentist-hand v3）
// 治療中、先生は世間話をやめない。返事は口を開けたままの4つの音（あが・おが・んー・えあ）だけ。
// 先生は好きなように解釈し、話は結婚式のスピーチから借金の保証人までふくらむ。最後に「本日の同意書」。
// 音ごとのくせ: あが≒はい / んー≒いいえ（聞き間違いあり）/ おが≒え？（頼みが大きくなる）/ えあ≒先生しだい / だまる＝はい
// 台本（話題と出来事の並び）と聞き間違いは種から決まる。同じ種・同じ返事なら同じ結果
window.__jsUp = true
;(function () {
'use strict'
const D = window.DH_DATA
const $ = s => document.querySelector(s)
const DT = 1 / 60
const REPLY_T = 3.8          // 返事を待つ秒数（質問を読む時間を含む）
const PSAY_T = 1.2           // 自分の返事の吹き出し
let lang = (() => { try { return localStorage.getItem('dh_lang') || (/^ja/i.test(navigator.language) ? 'ja' : 'en') } catch (e) { return 'ja' } })()
const T = k => D.ui[lang][k]
const readT = s => Math.max(1.3, 0.9 + 0.09 * s.replace(/\|/g, '').length * (lang === 'en' ? 0.55 : 1))

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const byId = id => D.topics.find(x => x.id === id) || D.events.find(x => x.id === id)
const TIER = { 1: ['wedding', 'moving', 'dog'], 2: ['onsen', 'band', 'ring', 'marathon', 'armband'], 3: ['mascot', 'sub', 'loan'] }
const NORMAL_EV = ['boss', 'fight', 'phone', 'music', 'ball'], RARE_EV = ['heir', 'fly', 'bday']
const RARE_P = 0.12

// ---------------------------------------------------------------- 台本（話題6つ＋出来事3つ。ふつう→ありえないへ）
function buildDeck(seed, o = {}) {
  const R = rng(seed ^ 0x51ed)
  const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
  let topics, events
  if (o.topics) topics = o.topics.slice()
  else {
    const t3 = R() < 0.7 ? [shuf(['mascot', 'sub'])[0], 'loan'] : shuf(['mascot', 'sub'])   // 借金の保証人（足でハンコ）は7割で最後
    topics = [...shuf(TIER[1]).slice(0, 2), ...shuf(TIER[2]).slice(0, 2), ...t3]
  }
  if (o.events) events = o.events.slice()
  else {
    events = shuf(NORMAL_EV).slice(0, 3)
    if (R() < RARE_P) events[1 + Math.floor(R() * 2)] = RARE_EV[Math.floor(R() * RARE_EV.length)]
  }
  // 並び: 話 話 出来事 話 話 出来事 話 出来事 話（最後の話はいちばんありえない頼み）
  const seq = [{ k: 'intro' }], after = new Set([1, 3, 4])
  let ei = 0
  topics.forEach((id, i) => { seq.push({ k: 'topic', id }); if ((o.events ? i % 2 === 1 || i === topics.length - 2 : after.has(i)) && ei < events.length && i < topics.length - 1) seq.push({ k: 'event', id: events[ei++] }) })
  while (ei < events.length) seq.splice(seq.length - 1, 0, { k: 'event', id: events[ei++] })
  seq.push({ k: 'outro' })
  return seq
}

// ---------------------------------------------------------------- 1回の診察（描画と切り離した中身）
function freshVis() {
  return { d: 'look', a: 'away', boss: 0, bossPose: 'look', docOff: 0, lean: -9, say: null, psay: null, prop: null, tag: null, drill: false, drillStuck: false, flyT: -1,
    music: false, ball: false, ballT: -1, dim: false, hand: -1, handOff: -1, shake: -9, flash: -9, hoseT: -1, hoseOff: -1, bob: false, peek: false }
}
function newRun(seed, o = {}) {
  const deck = buildDeck(seed, o)
  return { seed, R: rng(seed ^ 0xa5a5), deck, segI: -1, gen: null, wait: null, clock: 0, done: false, out: [], asks: [], replies: [], log: [],
    vis: freshVis(), tutorial: !!o.tutorial, silentHandUsed: false, nReplyWin: 0, tray: [] }
}
const Lg = (run, key) => { const a = D.lines[lang][key]; return a[Math.floor(run.R() * a.length)] }
function sayNow(run, who, text, o = {}) { run.vis.say = { who, text, until: run.clock + (o.hold || readT(text)), big: !!o.big }; run.log.push({ t: +run.clock.toFixed(2), who, text }) }
function* line(run, who, text, o = {}) { sayNow(run, who, text, o); yield { t: o.hold || readT(text) } }
function out(run, k) { run.out.push(k) }
function showProp(run, k, o = {}) { run.vis.prop = { k, t0: run.clock, mode: 'in', noimg: !!o.noimg, suckT: -1, footT: -1 }; run.vis.tag = null; out(run, 'swish') }

// 返事の解釈。r=null はだまっていた
function interp1(run, r) {
  if (r == null) return 'silent'
  if (r === 'aga') return 'yes'
  if (r === 'nn') return 'no'
  if (r === 'oga') return 'huh'
  return run.R() < 0.6 ? 'wild' : 'yes'
}
function interp2(run, r, allowHuh) {
  if (r == null) return 'silent'
  const x = run.R()
  if (r === 'aga') return x < 0.85 ? 'yes' : 'wild'
  if (r === 'nn') return x < 0.58 ? 'no' : x < 0.85 ? 'mis' : 'wild'
  if (r === 'oga') return allowHuh ? 'huh' : x < 0.5 ? 'yes' : 'wild'
  return x < 0.5 ? 'wild' : x < 0.75 ? 'yes' : 'no'   // えあ
}

function* segGen(run, s) {
  const V = run.vis
  if (s.k === 'intro') {
    V.d = 'look'; V.a = 'away'
    yield { t: 0.5 }
    yield* line(run, 'd', Lg(run, 'intro'))
    V.hand = run.clock; out(run, 'air')
    yield* line(run, 'd', Lg(run, 'intro2'))
    V.handOff = run.clock; V.d = 'down'
    out(run, 'drillStart'); V.drill = true
    yield { t: 0.8 }
    return
  }
  if (s.k === 'outro') {
    V.drill = false; V.d = 'look'; V.a = 'look'; out(run, 'bgm:clinic')
    yield* line(run, 'd', Lg(run, 'outro'))
    showProp(run, 'p_form')
    yield* line(run, 'a', Lg(run, 'outro2'))
    out(run, 'stamp'); V.flash = run.clock; V.shake = run.clock
    yield { t: 0.9 }
    return
  }
  if (s.k === 'topic') { yield* topicSeg(run, byId(s.id)); return }
  yield* eventSeg(run, byId(s.id))
}

function* topicSeg(run, tp) {
  const V = run.vis, L = tp[lang], who = tp.who
  V.d = who === 'd' ? 'look' : 'down'; V.a = who === 'a' ? 'look' : 'away'
  V.drill = !V.drillStuck
  sayNow(run, who, L.q1, { hold: REPLY_T })
  const r = yield { reply: REPLY_T }
  const i1 = interp1(run, r)
  if (r) yield { t: 0.5 }
  const t1 = i1 === 'yes' || i1 === 'silent' ? L.yes : i1 === 'no' ? L.no : i1 === 'wild' ? L.wild1 : Lg(run, 'huh1')
  if (i1 === 'wild') { out(run, 'squeak'); V.lean = run.clock }
  yield* line(run, who, t1)
  // 頼みごと。物が飛んでくる
  showProp(run, tp.prop, { noimg: tp.prop === 'drill' && V.drillStuck })
  if (tp.boss) V.peek = true
  if (tp.sfx === 'onsen') out(run, 'bgm:onsen')
  V.drill = !V.drillStuck && who === 'd'
  sayNow(run, who, L.q2, { hold: REPLY_T })
  yield* askCommit(run, tp, who, L)
  V.peek = false
  if (tp.sfx === 'onsen') out(run, 'bgm:clinic')
}

// 頼みごとへの返事 → 同意 or 辞退。o.always=断っても同意になる（cn の文）
function* askCommit(run, tp, who, L) {
  const V = run.vis
  let r = yield { reply: REPLY_T }
  let res = interp2(run, r, true), big = false
  V.drill = false
  if (res === 'huh') {
    yield { t: 0.5 }
    out(run, 'squeak'); V.lean = run.clock
    yield* line(run, who, Lg(run, 'huh'))
    big = true; if (V.prop) V.prop.mode = 'big'
    out(run, 'pop')
    sayNow(run, who, L.q2b, { hold: REPLY_T, big: true })
    r = yield { reply: REPLY_T }
    res = interp2(run, r, false)
  }
  if (r) yield { t: 0.5 }
  const ask = { id: tp.id, prop: tp.prop, how: res, big, text: '' }
  run.asks.push(ask)
  let committed = res !== 'no' || !!L.cn
  // 解釈の一言（大げさに）
  if (res === 'mis') { out(run, 'squeak'); V.lean = run.clock; V.psay = { text: D.ui[lang].misHeard, until: run.clock + 1.5, mis: true }; yield* line(run, who, Lg(run, 'mis')) }
  else if (res === 'silent') {
    if (!run.silentHandUsed) { run.silentHandUsed = true; V.hand = run.clock; out(run, 'air'); yield* line(run, who, Lg(run, 'silentHand')); V.handOff = run.clock }
    else yield* line(run, who, Lg(run, 'silent'))
  } else if (res === 'wild') { out(run, 'squeak'); out(run, 'giggle'); V.lean = run.clock; yield* line(run, who, L.w) }
  else if (res === 'no' && committed) { const nl = L.no || (tp.id === 'fight' ? L.winA : null); if (nl) yield* line(run, tp.id === 'fight' ? 'a' : who, nl) }
  if (tp.id === 'fight' && (res === 'yes' || res === 'silent' || res === 'mis')) { V.a = 'glare'; yield* line(run, 'd', L.winD) }
  if (!committed) {
    ask.text = L.c; ask.how = 'no'
    V.tag = { text: L.c, how: 'no', t0: run.clock }
    out(run, 'stamp')
    sayNow(run, who, Lg(run, 'dodge'))
    yield { t: 1.0 }
    if (V.prop) { V.prop.mode = 'out'; V.prop.tO = run.clock }
    out(run, 'swish')
    yield { t: 1.0 }
    V.tag = null; V.prop = null
    return
  }
  const text = res === 'wild' ? L.cw : res === 'no' ? L.cn : big ? L.cb : L.c
  ask.text = text; ask.agreed = true
  if (res === 'no') { ask.how = 'over'; res = 'over' }
  if (tp.id === 'loan') { V.prop.footT = run.clock; out(run, 'thwack'); yield { t: 0.45 } }
  V.tag = { text, how: res, t0: run.clock }
  sayNow(run, who, Lg(run, 'commit'))
  out(run, 'stamp'); out(run, 'commit:' + (tp.sfx || '')); V.flash = run.clock; V.shake = run.clock
  yield { t: 1.9 }
  if (V.prop) { V.prop.mode = 'tray'; V.prop.tT = run.clock }
  V.tag = null
  run.tray.push(tp.prop)
  out(run, 'tray')
  yield { t: 0.55 }
  V.prop = null
}

function* eventSeg(run, ev) {
  const V = run.vis, L = ev[lang]
  if (ev.id === 'boss' || ev.id === 'heir') {
    out(run, 'door'); V.drill = false; V.docOff = 1; V.d = 'away'; V.boss = 1; V.bossPose = 'look'
    yield { t: 0.8 }
    yield* line(run, 'b', L.a)
    showProp(run, ev.prop)
    sayNow(run, 'b', L.q2, { hold: REPLY_T })
    yield* askCommit(run, ev, 'b', L)
    yield* line(run, 'b', L.bye)
    V.boss = 0; V.docOff = 0; V.d = 'look'; out(run, 'door')
    yield { t: 0.7 }
  } else if (ev.id === 'fight') {
    V.drill = false; V.a = 'glare'; V.d = 'down'; out(run, 'thwack'); V.shake = run.clock
    yield* line(run, 'a', L.a)
    V.d = 'look'; V.lean = run.clock
    yield* line(run, 'd', L.d)
    V.a = 'glare'
    showProp(run, ev.prop)
    sayNow(run, 'd', L.q2, { hold: REPLY_T })
    yield* askCommit(run, ev, 'd', L)
    V.a = 'away'
  } else if (ev.id === 'phone') {
    V.drill = false; V.a = 'look'
    showProp(run, 'p_phone'); out(run, 'pop')
    yield* line(run, 'a', L.a)
    V.hoseT = run.clock; out(run, 'slurp')
    yield { t: 0.7 }
    V.prop.suckT = run.clock; out(run, 'slurp'); out(run, 'bubble'); V.shake = run.clock
    yield { t: 0.9 }
    V.d = 'look'; V.lean = run.clock
    yield* line(run, 'd', L.d)
    V.prop = { k: 'p_hose', t0: run.clock, mode: 'in', suckT: -1, footT: -1 }
    V.hoseOff = run.clock
    sayNow(run, 'd', L.q2, { hold: REPLY_T })
    yield* askCommit(run, { ...ev, prop: 'p_phone' }, 'd', L)
    V.a = 'away'
  } else if (ev.id === 'music') {
    V.music = true; V.bob = true; V.drill = true; out(run, 'bgm:funk')
    yield* line(run, 'd', L.d)
    V.a = 'look'
    yield* line(run, 'a', L.a)
    showProp(run, 'drill', { noimg: true })
    sayNow(run, 'd', L.q2, { hold: REPLY_T })
    yield* askCommit(run, ev, 'd', L)
    V.music = false; V.bob = false; V.drill = false; V.a = 'away'; out(run, 'bgm:clinic')
  } else if (ev.id === 'ball') {
    V.ball = true; V.ballT = run.clock; V.bob = true; V.drill = false; out(run, 'bgm:funk'); out(run, 'pop')
    yield { t: 0.6 }
    V.a = 'look'
    yield* line(run, 'a', L.a)
    yield* line(run, 'd', L.d)
    showProp(run, 'p_mirrorball', { noimg: true })
    sayNow(run, 'd', L.q2, { hold: REPLY_T })
    yield* askCommit(run, ev, 'd', L)
    V.ball = false; V.bob = false; V.a = 'away'; out(run, 'bgm:clinic')
  } else if (ev.id === 'fly') {
    V.drill = true; out(run, 'drillStart')
    yield { t: 0.4 }
    V.flyT = run.clock; V.drillStuck = true
    yield { t: 0.55 }
    out(run, 'thwack'); V.shake = run.clock; V.drill = false
    yield { t: 0.5 }
    V.d = 'look'
    yield* line(run, 'd', L.d)
    V.a = 'look'
    yield* line(run, 'a', L.a)
    showProp(run, 'drill', { noimg: true })
    sayNow(run, 'd', L.q2, { hold: REPLY_T })
    yield* askCommit(run, ev, 'd', L)
    V.a = 'away'
  } else if (ev.id === 'bday') {
    V.drill = false; V.dim = true
    yield { t: 0.7 }
    showProp(run, 'p_cake'); out(run, 'applause'); V.a = 'look'
    yield* line(run, 'a', L.a)
    V.lean = run.clock
    yield* line(run, 'd', L.d)
    sayNow(run, 'd', L.q2, { hold: REPLY_T })
    yield* askCommit(run, ev, 'd', L)
    V.dim = false; V.a = 'away'
  }
}

// ---------------------------------------------------------------- 進める
function resume(run, val) {
  const r = run.gen.next(val)
  if (r.done) { run.gen = null; return }
  const y = r.value
  if (y.reply) { run.wait = { kind: 'reply', t0: run.clock, until: run.clock + y.reply, dur: y.reply, got: undefined }; run.nReplyWin++ }
  else run.wait = { kind: 't', until: run.clock + (y.t || 0) }
}
function advance(run) {
  let guard = 0
  while (!run.done && guard++ < 60) {
    if (!run.gen) {
      run.segI++
      if (run.segI >= run.deck.length) { finish(run); return }
      run.gen = segGen(run, run.deck[run.segI]); run.wait = null
      resume(run, undefined); continue
    }
    const w = run.wait
    if (!w) { resume(run, undefined); continue }
    if (w.kind === 't') { if (run.clock >= w.until - 1e-9) { run.wait = null; resume(run, undefined); continue } return }
    if (w.got !== undefined) { const g = w.got; run.wait = null; resume(run, g); continue }
    if (run.clock >= w.until - 1e-9) { run.wait = null; run.replies.push(null); run.vis.psay = { text: '……', until: run.clock + 1.0, quiet: true }; resume(run, null); continue }
    return
  }
}
function tick(run) {
  if (run.done) return
  run.clock += DT
  if (run.vis.say && run.vis.say.until <= run.clock) run.vis.say = null
  if (run.vis.psay && run.vis.psay.until <= run.clock) run.vis.psay = null
  advance(run)
}
function replyOpen(run) { return !!(run && run.wait && run.wait.kind === 'reply' && run.wait.got === undefined) }
function reply(run, k) {
  if (!replyOpen(run)) return false
  run.wait.got = k; run.replies.push(k)
  run.vis.psay = { text: D.ui[lang].replies[k] + (k === 'nn' ? '' : '…'), until: run.clock + PSAY_T }
  out(run, 'voice:' + k)
  advance(run)
  return true
}
function finish(run) {
  run.done = true
  const A = run.asks.length, ag = run.asks.filter(a => a.agreed), n = ag.length
  const silent = run.asks.filter(a => a.how === 'silent').length, wild = run.asks.filter(a => a.how === 'wild').length
  let tk
  if (ag.some(a => a.id === 'heir')) tk = 'heir'
  else if (n === 0) tk = 'zero'
  else if (silent >= A - 1 && n >= A - 1) tk = 'silent'
  else if (wild >= 3) tk = 'wild'
  else if (n >= A - 1) tk = 'all'
  else if (n >= A * 0.6) tk = 'many'
  else if (n >= A * 0.35) tk = 'some'
  else tk = 'few'
  run.titleKey = tk; run.n = n; run.A = A
  out(run, 'end')
}

// ---------------------------------------------------------------- bot（sim と検証用。返事は窓が開いて0.9秒後）
const BOTS = {
  none: () => null, aga: () => 'aga', nn: () => 'nn', oga: () => 'oga', ea: () => 'ea',
  random: R => ['aga', 'oga', 'nn', 'ea', null][Math.floor(R() * 5)],
}
function simulate(bot, seed, o = {}) {
  const run = newRun(seed, o), R = rng(seed ^ 0x77), pick = BOTS[bot]
  let n = 0, win = -1, plan = null
  while (!run.done && n++ < 60 * 900) {
    if (replyOpen(run) && run.nReplyWin !== win) { win = run.nReplyWin; plan = { at: run.clock + 0.9, k: pick(R) } }
    if (plan && replyOpen(run) && run.clock >= plan.at) { if (plan.k) reply(run, plan.k); plan = null }
    tick(run)
  }
  return { bot, seed, n: run.n, A: run.A, title: run.titleKey, len: +run.clock.toFixed(1), deck: run.deck.map(s => s.id || s.k).join(','), hows: run.asks.map(a => a.how).join(',') }
}

// ================================================================ 画面
const views = ['vLoad', 'vTitle', 'vHow', 'vPlay', 'vResult']
function show(id) { for (const v of views) $('#' + v).hidden = v !== id; if (id === 'vResult') fitKarte() }
function mouthSvg(k) { return `<svg viewBox="0 0 80 60"><use href="#m-${k}"/></svg>` }
function applyLang() {
  document.documentElement.lang = lang
  document.querySelectorAll('[data-t]').forEach(el => { const v = T(el.dataset.t); if (typeof v === 'string') el.textContent = v })
  const icons = [null, null, 'aga', 'nn', 'oga', 'ea', null]
  $('#howList').innerHTML = T('howRows').map(([a, b], i) => `<li><i>${icons[i] ? mouthSvg(icons[i]) : ''}</i><div><b>${a}</b><span>${b}</span></div></li>`).join('')
  $('#howWho').innerHTML = T('howWho')
  document.querySelectorAll('.mb').forEach(b => { b.querySelector('b').textContent = T('replies')[b.dataset.r]; b.setAttribute('aria-label', T('replies')[b.dataset.r]) })
  const d = new Date(); $('#appt').innerHTML = `${d.getMonth() + 1}/${d.getDate()}<br>14:30`
  sndLabel()
}
let muted = (() => { try { return localStorage.getItem('dh_mute') === '1' } catch (e) { return false } })()
function sndLabel() { $('#bSnd').textContent = `${T('sound')}: ${muted ? T('off') : T('on')}`; $('#bMute').textContent = muted ? '×' : T('mute'); $('#bMute').classList.toggle('off', muted) }
function setMute(m) { muted = m; try { localStorage.setItem('dh_mute', m ? '1' : '0') } catch (e) {} Snd.setMute(m); sndLabel() }

// 音（全部録音の素材）
Snd.def({
  drillStart: 'snd/drill_start.mp3', tray: ['snd/tray1.mp3', 'snd/tray2.mp3', 'snd/tray3.mp3'], air: 'snd/air.mp3',
  grunt: ['snd/grunt1.mp3', 'snd/grunt2.mp3', 'snd/grunt3.mp3'], g1: 'snd/grunt1.mp3', g2: 'snd/grunt2.mp3', g3: 'snd/grunt3.mp3',
  paper: ['snd/paper1.mp3', 'snd/paper2.mp3'], stamp: 'snd/stamp.mp3', ok: 'snd/ok.mp3', giggle: 'snd/giggle.mp3',
  bell: 'snd/bell.mp3', coin: 'snd/coin.mp3', pop: ['snd/pop1.mp3', 'snd/pop2.mp3'], squeak: ['snd/squeak1.mp3', 'snd/squeak2.mp3'], swish: ['snd/swish1.mp3', 'snd/swish2.mp3'],
  thwack: 'snd/thwack.mp3', door: 'snd/door.mp3', applause: 'snd/applause.mp3', slurp: ['snd/slurp1.mp3', 'snd/slurp2.mp3'], bubble: 'snd/bubble.mp3',
  sax1: 'snd/jingle_sax1.mp3', sax2: 'snd/jingle_sax2.mp3', sax3: 'snd/jingle_sax3.mp3', good: 'snd/jingle_good.mp3', bad: 'snd/jingle_bad.mp3',
})
Snd.files.__loop = ['snd/drill_loop.mp3', 'snd/suction.mp3', 'snd/amb_room.mp3', 'snd/bgm_clinic.mp3', 'snd/onsen.mp3', 'snd/funk.mp3']
let drillSrc = null, drillGain = null
function drillSound(rate, vol, on) {
  if (!Snd.ctx || muted) { if (drillSrc) { try { drillSrc.stop() } catch (e) {} drillSrc = null } return }
  const buf = Snd.bufs['snd/drill_loop.mp3']
  if (on && !drillSrc && buf && buf !== 'loading') {
    const c = Snd.ctx; drillSrc = c.createBufferSource(); drillSrc.buffer = buf; drillSrc.loop = true; drillGain = c.createGain(); drillGain.gain.value = 0
    drillSrc.connect(drillGain); drillGain.connect(Snd.sfxBus); drillSrc.start()
  }
  if (!on && drillSrc) { const s = drillSrc; drillGain.gain.setTargetAtTime(0, Snd.ctx.currentTime, 0.05); setTimeout(() => { try { s.stop() } catch (e) {} }, 300); drillSrc = null; return }
  if (drillSrc) { const t = Snd.ctx.currentTime; drillSrc.playbackRate.setTargetAtTime(rate, t, 0.03); drillGain.gain.setTargetAtTime(vol, t, 0.05) }
}
function startAmbience() { Snd.loop('amb', 'snd/amb_room.mp3', 0.22); Snd.loop('bgm', 'snd/bgm_clinic.mp3', 0.12) }
// 口を開けたままの声（うめき声の録音を2つ重ねて、音ごとに高さを変える）
const VOICE = { aga: [['g1', 1.0], ['g2', 0.86, 0.17]], oga: [['g3', 1.05], ['g2', 1.4, 0.16]], nn: [['g3', 0.66], ['g3', 0.6, 0.12]], ea: [['g2', 1.2], ['g1', 0.78, 0.15]] }
function cue(k) {
  if (k.startsWith('voice:')) { for (const [n, rate, delay] of VOICE[k.slice(6)]) Snd.play(n, { vol: 0.9, rate, delay: delay || 0, jitter: 0.03 }); return }
  if (k.startsWith('bgm:')) { const m = k.slice(4); Snd.loop('bgm', m === 'onsen' ? 'snd/onsen.mp3' : m === 'funk' ? 'snd/funk.mp3' : 'snd/bgm_clinic.mp3', m === 'clinic' ? 0.12 : 0.2, 0.5); return }
  if (k.startsWith('commit:')) {
    const s = k.slice(7)
    const m = { bell: 'bell', thwack: 'thwack', squeak: 'squeak', onsen: 'bell', coin: 'coin', pop: 'pop', applause: 'applause', swish: 'applause', drill: 'drillStart', slurp: 'slurp', door: 'bell', funk: 'applause' }[s]
    if (m) Snd.play(m, { vol: m === 'applause' ? 0.55 : 0.8, delay: 0.12 })
    Snd.duck(0.35, 1.6)
    return
  }
  const vol = { stamp: 1, swish: 0.5, tray: 0.5, squeak: 0.8, pop: 0.7, thwack: 0.9, door: 0.8, slurp: 0.9, bubble: 0.6, giggle: 0.35, applause: 0.55, air: 0.4, drillStart: 0.5 }[k]
  if (vol != null) Snd.play(k, { vol, jitter: k === 'stamp' ? 0 : 0.06 })
}

// ---------------------------------------------------------------- 読み込み（本物の数で進む）
const PROPS = ['p_invite', 'p_box', 'p_dog', 'p_bucket', 'p_mic', 'p_ring', 'p_form', 'p_hose', 'p_phone', 'p_omiai', 'p_mirrorball', 'p_cake', 'p_footseal', 'p_bib', 'p_mascot', 'p_armband', 'p_key', 'p_inkpad']
const propUrl = k => k === 'drill' ? 'img/drill.webp?v=2' : `img/${k}.webp?v=3`
const IMGS = ['bg', 'dentist_down', 'dentist_look', 'dentist_away', 'director_down', 'director_look', 'director_away', 'assistant_look', 'assistant_glare', 'assistant_away', 'hand_up', 'drill', 'feet_rest', 'feet_curl'].map(n => `img/${n}.webp?v=2`).concat(PROPS.map(propUrl))
const SNDS = Object.values(Snd.files).flat()
const imgCache = {}
function preload() {
  let done = 0; const total = IMGS.length + SNDS.length
  const bump = () => { done++; $('#loadBar i').style.width = Math.round(done / total * 100) + '%' }
  const ps = IMGS.map(u => new Promise(ok => { const im = new Image(); im.onload = im.onerror = () => { bump(); ok() }; im.src = u; imgCache[u] = im }))
  const ss = SNDS.map(u => fetch(u).then(r => r.arrayBuffer()).catch(() => {}).then(bump))
  return Promise.race([Promise.all(ps.concat(ss)), new Promise(ok => setTimeout(ok, 11000))])
}

// ---------------------------------------------------------------- 遊ぶ
let run = null, raf = 0, last = 0, acc = 0, paused = false, tutStage = 0, dbgPaused = false
function tutDone() { try { return localStorage.getItem('dh_tut') === '1' } catch (e) { return false } }
function startGame(o = {}) {
  Snd.init(); startAmbience()
  const seed = o.seed != null ? o.seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0
  const tutorial = o.tutorial != null ? o.tutorial : !tutDone()
  run = newRun(seed, { tutorial, topics: o.topics, events: o.events })
  cancelAnimationFrame(revealRaf); clearTimeout(endGame.to); result = null
  show('vPlay'); sizeMon()
  if (window.TM) TM.start()
  tutStage = 0; paused = false; $('#tut').hidden = true
  if (tutorial) { tutStage = 1; showTut(T('tut1'), true) }
  last = performance.now(); acc = 0
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop)
  render()
}
function showTut(text, btn) {
  $('#tutP').innerHTML = text.split('|').join('<br>')
  $('#tutB').textContent = T('tutNext'); $('#tutB').hidden = !btn
  $('#tut').hidden = false; $('#tut').classList.toggle('live', !btn)
  paused = true
}
$('#tutB').onclick = () => { $('#tut').hidden = true; paused = false; tutStage = 2; last = performance.now() }
function loop(now) {
  raf = requestAnimationFrame(loop)
  const dt = Math.min(0.25, (now - last) / 1000); last = now
  if (paused || !run || dbgPaused) { render(); return }
  acc += dt
  while (acc >= DT) { acc -= DT; step1(); if (paused) { acc = 0; break } }
  render()
}
function step1() {
  if (!run || run.done) return
  // チュートリアル: 最初の返事の窓で止めて、口のボタンを教える（押すとそのまま返事になる）
  if (tutStage === 2 && replyOpen(run)) { tutStage = 3; showTut(T('tut2'), false); return }
  tick(run)
  for (const k of run.out.splice(0)) cue(k)
  if (run.done) endGame()
}
function onReply(k, e) {
  if (e) e.preventDefault()
  if (!run || run.done) return false
  Snd.init()
  if (tutStage === 1) return false
  if (tutStage === 3) { $('#tut').hidden = true; paused = false; tutStage = 4; last = performance.now(); try { localStorage.setItem('dh_tut', '1') } catch (e) {} }
  if (paused && tutStage !== 4) return false
  const ok = reply(run, k)
  const b = document.querySelector(`.mb[data-r="${k}"]`)
  if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 160) }
  for (const x of run.out.splice(0)) cue(x)
  render()
  return ok
}
document.querySelectorAll('.mb').forEach(b => b.addEventListener('pointerdown', e => onReply(b.dataset.r, e)))
window.addEventListener('keydown', e => { const i = ['1', '2', '3', '4'].indexOf(e.key); if (i >= 0 && !$('#vPlay').hidden) onReply(['aga', 'oga', 'nn', 'ea'][i], e) })

// 天井のモニター: 本日の同意（件数・物）と、治療の進み（歯の並び）
const monC = $('#monC')
function sizeMon() { const r = monC.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); if (r.width) { monC.width = Math.round(r.width * dpr); monC.height = Math.round(r.height * dpr) } }
window.addEventListener('resize', () => { if (!$('#vPlay').hidden) sizeMon() })
function drawMon(r) {
  const g = monC.getContext('2d'), w = monC.width, h = monC.height; if (!w) return
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#132024'); bg.addColorStop(1, '#0b1215'); g.fillStyle = bg; g.fillRect(0, 0, w, h)
  const fs = Math.round(h * 0.11)
  g.font = `700 ${fs}px ui-monospace,Menlo,monospace`; g.fillStyle = '#9fe3cf'; g.textBaseline = 'top'; g.textAlign = 'left'
  g.fillText(T('mon'), w * 0.05, h * 0.06)
  g.textAlign = 'right'; g.font = `700 ${Math.round(h * 0.2)}px ui-monospace,Menlo,monospace`; g.fillStyle = r.tray.length ? '#ffb3a8' : '#9fe3cf'
  g.fillText(r.tray.length + T('monN'), w * 0.95, h * 0.03); g.textAlign = 'left'
  // 同意した物（小さい写真）
  const cell = h * 0.3, x0 = w * 0.05, y0 = h * 0.3, per = Math.max(1, Math.floor((w * 0.9) / (cell * 0.78)))
  r.tray.forEach((k, i) => {
    const im = imgCache[propUrl(k)]; if (!im || !im.naturalWidth) return
    const row = Math.floor(i / per), col = i % per; if (row > 1) return
    const s = cell * 0.9, ar = im.naturalWidth / im.naturalHeight, iw = ar > 1 ? s : s * ar, ih = ar > 1 ? s / ar : s
    g.drawImage(im, x0 + col * cell * 0.78 + (s - iw) / 2, y0 + row * cell * 0.95 + (s - ih) / 2, iw, ih)
  })
  // 治療の進み: 話題と出来事の数だけ歯を並べる
  const segs = r.deck.filter(s => s.k === 'topic' || s.k === 'event'), n = segs.length, cur = r.deck[r.segI]
  const curI = cur ? segs.indexOf(cur) : -1, doneN = curI >= 0 ? curI : (r.segI >= r.deck.length - 1 ? n : 0)
  const tw = Math.min(w * 0.9 / n * 0.8, h * 0.1), gap = (w * 0.9 - tw * n) / Math.max(1, n - 1), ty = h * 0.86
  for (let i = 0; i < n; i++) {
    const x = w * 0.05 + i * (tw + gap)
    g.fillStyle = i < doneN ? '#f4efe0' : i === curI ? (Math.sin(r.clock * 6) > 0 ? '#f4efe0' : '#4a6a6a') : '#2f4448'
    g.beginPath(); if (g.roundRect) g.roundRect(x, ty, tw, tw * 1.1, tw * 0.3); else g.rect(x, ty, tw, tw * 1.1); g.fill()
  }
  g.fillStyle = 'rgba(255,255,255,.035)'; for (let yy = 0; yy < h; yy += 3) g.fillRect(0, yy, w, 1)
}

// 描画
const docEl = $('#doc'), asstEl = $('#asst'), bossEl = $('#boss')
function setOn(box, k) { box.querySelectorAll('img').forEach(im => im.classList.toggle('on', im.dataset.k === k)) }
let lastSayKey = '', lastPsay = '', bossX = -1.2, docX = 0, poses = {}
const ease = k => k * k * (3 - 2 * k), back = k => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2) }
const clamp01 = x => Math.max(0, Math.min(1, x))
function render() {
  if (!run) return
  const r = run, V = r.vis, t = r.clock
  if (poses.d !== V.d) { setOn(docEl, V.d); poses.d = V.d }
  if (poses.a !== V.a) { setOn(asstEl, V.a); poses.a = V.a }
  if (poses.b !== V.bossPose) { setOn(bossEl, V.bossPose); poses.b = V.bossPose }
  const bob = V.bob ? Math.sin(t * 9.4) : 0
  const leanK = clamp01(1 - (t - V.lean) / 0.9), lean = leanK > 0 ? Math.sin(Math.min(1, (t - V.lean) / 0.18) * Math.PI / 2) * leanK : 0
  docX += ((V.docOff ? -0.75 : 0) - docX) * 0.12
  docEl.style.transform = `translate(${(docX * 100).toFixed(1)}%,${(bob * 2.2 + lean * 3).toFixed(2)}%) scale(${(1 + lean * 0.14).toFixed(3)}) rotate(${(bob * 3).toFixed(2)}deg)`
  asstEl.style.transform = `translateY(${(bob * -2).toFixed(2)}%) rotate(${(bob * -3).toFixed(2)}deg)` + (V.a === 'glare' ? ` translateX(${(Math.sin(t * 40) * 0.6).toFixed(2)}%)` : '')
  const bossTarget = V.boss ? 0 : V.peek ? -0.55 : -1.2
  bossX += (bossTarget - bossX) * 0.12
  bossEl.style.transform = `translateX(${(bossX * 100).toFixed(1)}%)`
  // ドリル（音楽の時はリズムに合わせて跳ねる。飛んだら天井に刺さったまま）
  const dr = $('#drill')
  const beat = Math.floor(t * 4) % 8, PAT = [1, 1.26, 1.5, 1.26, 1, 0.84, 1.12, 1.5]
  if (V.drillStuck) {
    const k = clamp01((t - V.flyT) / 0.55)
    dr.style.opacity = 1
    dr.style.left = (8 + (38 - 8) * ease(k)) + '%'; dr.style.top = (58 + (5 - 58) * ease(k)) + '%'
    dr.style.transform = `rotate(${(k * 560 + (k >= 1 ? Math.sin(t * 30) * Math.max(0, 1 - (t - V.flyT - 0.55) * 1.5) * 6 : 0)).toFixed(1)}deg)`
  } else {
    dr.style.left = ''; dr.style.top = ''
    dr.style.opacity = V.drill ? 1 : 0
    const jit = V.drill ? 1.6 : 0
    dr.style.transform = V.music ? `translateY(${(-Math.abs(Math.sin(t * Math.PI * 2)) * 18).toFixed(1)}px) rotate(${(Math.sin(t * Math.PI * 2) * 10).toFixed(1)}deg)` : `translate(${(Math.sin(t * 91) * jit).toFixed(1)}px,${(Math.cos(t * 77) * jit).toFixed(1)}px)`
  }
  const drOn = V.drill && !V.drillStuck && !paused && !dbgPaused
  drillSound(V.music ? 0.9 * PAT[beat] : 0.95, V.music ? 0.55 : 0.32, drOn)
  if (Snd.ctx && drOn !== render.suck) { render.suck = drOn; Snd.loop('suck', drOn ? 'snd/suction.mp3' : null, 0.14, 0.3) }
  // 天井（ミラーボールで回る・誕生日で暗くなる）
  const c = $('#ceilP'), disco = $('#disco'), ball = $('#ball')
  const ballK = V.ball ? clamp01((t - V.ballT) / 0.8) : 0
  render.ballV = (render.ballV || 0) + (ballK - (render.ballV || 0)) * 0.15
  const bv = render.ballV
  c.style.transform = `translate(-50%,-50%) scale(${(1.04 + bv * 0.1).toFixed(3)}) rotate(${(bv * t * 38).toFixed(1)}deg)`
  disco.style.opacity = (bv * 0.42).toFixed(3); disco.style.transform = `rotate(${(t * 140).toFixed(0)}deg)`
  ball.style.transform = `translateY(${(-110 + bv * 135).toFixed(1)}%) rotate(${(Math.sin(t * 2.2) * 10 * bv).toFixed(1)}deg)`
  render.dimV = (render.dimV || 0) + ((V.dim ? 1 : 0) - (render.dimV || 0)) * 0.08
  $('#vig').style.opacity = (render.dimV * 0.9).toFixed(3)
  $('#glow').style.opacity = (0.15 + (V.ball ? 0.2 + 0.2 * Math.sin(t * 13) : 0)).toFixed(3)
  // ゆれ・光
  const sh = clamp01(1 - (t - V.shake) / 0.35)
  $('#stage').style.translate = sh > 0 ? `${(Math.sin(t * 90) * sh * 9).toFixed(1)}px ${(Math.cos(t * 70) * sh * 6).toFixed(1)}px` : ''
  $('#flash').style.opacity = (clamp01(1 - (t - V.flash) / 0.25) * 0.5).toFixed(3)
  // 自分の足（同意のたびに指が丸まる）
  const curl = V.tag && V.tag.how !== 'no' && t - V.tag.t0 < 1.4
  if (poses.f !== curl) { setOn($('#feet'), curl ? 'curl' : 'rest'); poses.f = curl }
  $('#feet').style.transform = curl ? `translateY(${(-Math.abs(Math.sin(t * 22)) * 6).toFixed(1)}px)` : ''
  // 手（勝手に挙がる）
  const hk = V.hand >= 0 ? (V.handOff >= V.hand ? 1 - clamp01((t - V.handOff) / 0.3) : clamp01((t - V.hand) / 0.3)) : 0
  $('#hand').style.transform = `translateY(${(130 - 130 * ease(hk)).toFixed(1)}%) rotate(${(Math.sin(t * 8) * 4 * hk).toFixed(1)}deg)`
  // 吸引のホース
  const hose = $('#hose')
  const hoseK = V.hoseT >= 0 ? (V.hoseOff >= V.hoseT ? 1 - clamp01((t - V.hoseOff) / 0.4) : clamp01((t - V.hoseT) / 0.4)) : 0
  hose.style.opacity = hoseK > 0.01 ? 1 : 0; hose.style.transform = `translateX(${(100 - 100 * ease(hoseK)).toFixed(1)}%) rotate(${(Math.sin(t * 20) * 3 * hoseK).toFixed(1)}deg)`
  // 頼みごとの物
  renderProp(V, t)
  // 吹き出し（先生か助手か院長の1つ＋自分の返事1つ。ハンコの紙が出ている時は自分の返事を消す）
  const sEl = $('#say')
  const sk = V.say ? V.say.who + V.say.text + V.say.big : ''
  if (sk !== lastSayKey) {
    lastSayKey = sk; sEl.hidden = !V.say
    if (V.say) { sEl.className = 'say ' + V.say.who + (V.say.big ? ' big' : ''); sEl.innerHTML = V.say.text.split('|').map(x => x.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>') }
  }
  const pEl = $('#psay'), pk = V.psay && !V.tag ? V.psay.text : ''
  if (pk !== lastPsay) { lastPsay = pk; pEl.hidden = !pk; pEl.textContent = pk; pEl.className = 'say' + (V.psay && V.psay.mis ? ' mis' : V.psay && V.psay.quiet ? ' quiet' : '') }
  // 返事の窓（エプロンの上の導火線が縮む）
  const open = replyOpen(r) && !(paused && tutStage !== 3)
  $('#vPlay').classList.toggle('open', open)
  const fuse = $('#fuse')
  if (open) { const k = clamp01((r.wait.until - t) / r.wait.dur); fuse.style.opacity = 1; fuse.style.transform = `scaleX(${k.toFixed(3)})` } else fuse.style.opacity = 0
  drawMon(r)
}
function renderProp(V, t) {
  const pr = $('#prop'), img = $('#propImg'), foot = $('#footImg'), tag = $('#tag')
  const P = V.prop
  if (!P) { pr.style.opacity = 0 } else {
    const u = propUrl(P.k)
    if (img.dataset.k !== P.k) { img.dataset.k = P.k; img.src = u }
    img.style.visibility = P.noimg ? 'hidden' : ''
    const k = clamp01((t - P.t0) / 0.5), kb = back(k)
    let x = (-70 + 70 * kb), y = (-40 + 40 * kb), s = 0.25 + 0.75 * kb, rot = -40 + 36 * kb + Math.sin(t * 2.6) * 3, op = 1
    if (P.mode === 'big') s *= 1.22 + Math.sin(t * 7) * 0.03
    if (P.suckT >= 0) { const q = clamp01((t - P.suckT) / 0.7); x += 34 * q; y += 2 * q; s *= 1 - 0.92 * q; rot += 200 * q; op = 1 - q }
    if (P.mode === 'out') { const q = clamp01((t - P.tO) / 0.6); x += 120 * q * q; y -= 20 * q; rot += 120 * q; op = 1 - q }
    if (P.mode === 'tray') { const q = ease(clamp01((t - P.tT) / 0.5)); x += 26 * q; y -= 44 * q; s *= 1 - 0.85 * q; op = 1 - q * 0.9 }
    pr.style.opacity = op.toFixed(3)
    pr.style.transform = `translate(${x.toFixed(1)}vw,${y.toFixed(1)}vh) scale(${s.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`
    // 足でハンコ（借金の保証人）
    if (P.footT >= 0) { const q = clamp01((t - P.footT) / 0.25), up = clamp01((t - P.footT - 1.1) / 0.4); foot.style.opacity = 1 - up; foot.style.transform = `translateY(${(-160 + 190 * ease(q) - 120 * up).toFixed(0)}%) rotate(-8deg)` }
    else foot.style.opacity = 0
  }
  const G = V.tag, hkEl = $('#bigHk')
  if (!G) { tag.style.opacity = 0; hkEl.style.opacity = 0 }
  else {
    const tt = $('#tagT')
    if (tt.textContent !== G.text) { tt.textContent = G.text; const st = T('stamps')[G.how] || T('stamps').yes; hkEl.textContent = st; hkEl.classList.toggle('l3', st.length >= 3); hkEl.classList.toggle('no', G.how === 'no'); tag.classList.toggle('no', G.how === 'no') }
    const q = clamp01((t - G.t0) / 0.18)
    tag.style.opacity = q.toFixed(3)
    // 長い文は縮めて1行に収める
    const maxW = Math.min(innerWidth * 0.9, 420), wNow = tag.scrollWidth || 1
    const sc = Math.min(1, maxW / wNow)
    tag.style.transform = `translateX(-50%) rotate(-2deg) scale(${sc.toFixed(3)})`
    // 大きいハンコが物の上にドン
    const sq = clamp01((t - G.t0 - 0.1) / 0.14)
    hkEl.style.opacity = sq > 0 ? 0.9 : 0
    hkEl.style.transform = `scale(${(3.2 - 2.2 * ease(sq)).toFixed(3)}) rotate(${G.how === 'no' ? 10 : -16}deg)`
  }
}

// ---------------------------------------------------------------- 結果: 本日の同意書
let result = null
function endGame() {
  cancelAnimationFrame(raf); drillSound(1, 0, false); Snd.loop('suck', null); render.suck = false; Snd.loop('bgm', 'snd/bgm_clinic.mp3', 0.12)
  const r = run
  const tt = D.titles[lang][r.titleKey]
  result = { n: r.n, A: r.A, key: r.titleKey, title: tt[0], last: tt[1], asks: r.asks.map(a => ({ ...a })), seed: r.seed, replies: r.replies.slice() }
  if (window.TM) TM.end(r.n, true)
  clearTimeout(endGame.to); endGame.to = setTimeout(() => { show('vResult'); reveal() }, 600)
}
let revealRaf = 0
function reveal() {
  const t0 = performance.now(); cancelAnimationFrame(revealRaf)
  let lastStage = -1
  const N = result.asks.length, ROW = 0.22, rowAt = i => 0.5 + i * ROW, titleAt = rowAt(N) + 0.5
  const fr = now => {
    if (!result || $('#vResult').hidden) return
    const s = (now - t0) / 1000
    const stage = s < rowAt(0) ? 0 : s < titleAt ? 1 + Math.min(N, Math.floor((s - rowAt(0)) / ROW) + 1) : 99
    if (stage !== lastStage) {
      if (stage >= 1 && stage <= N && stage > lastStage) Snd.play(result.asks[stage - 1].agreed ? 'stamp' : 'paper', { vol: 0.7, jitter: 0.08 })
      if (stage === 99) { Snd.play('stamp', { vol: 1, jitter: 0 }); Snd.play(result.key === 'zero' ? 'good' : result.n >= result.A - 1 ? 'sax3' : 'sax1', { vol: 0.8, delay: 0.15, jitter: 0 }); Snd.duck(0.3, 2) }
      lastStage = stage
    }
    drawForm(stage === 99 ? N : Math.max(0, stage - 1), stage === 99, s - titleAt)
    if (s < titleAt + 1.2) revealRaf = requestAnimationFrame(fr)
  }
  revealRaf = requestAnimationFrame(fr)
}
function fitKarte() {
  const w = $('#kWrap'), cv = $('#karte'), W = w.clientWidth, H = w.clientHeight
  if (!W || !H) return
  const k = Math.min(W / cv.width, H / cv.height)
  cv.style.width = Math.floor(cv.width * k) + 'px'; cv.style.height = Math.floor(cv.height * k) + 'px'
}
window.addEventListener('resize', () => { if (!$('#vResult').hidden) fitKarte() })
function wrapText(g, text, x, y, maxW, lh, maxLines = 3) {
  const chars = lang === 'ja' ? [...text] : text.split(' ').map((w, i, a) => i < a.length - 1 ? w + ' ' : w)
  let line = '', yy = y, n = 0
  for (const ch of chars) { if (g.measureText(line + ch).width > maxW && line) { g.fillText(line, x, yy); line = ch.trimStart(); yy += lh; if (++n >= maxLines) return } else line += ch }
  if (line) g.fillText(line, x, yy)
}
function hanko(g, x, y, rad, text, color, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = 0.9
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = Math.max(2.5, rad * 0.09)
  g.beginPath(); g.arc(0, 0, rad, 0, 7); g.stroke()
  const fs = text.length >= 3 ? rad * 0.62 : rad * 0.78
  g.font = `700 ${fs}px "BIZ UDPGothic","Hiragino Sans",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 0, rad * 0.04, rad * 1.7)
  g.restore()
}
function drawForm(rows, showTitle, ts) {
  const cv = $('#karte'), g = cv.getContext('2d'), W = cv.width, H = cv.height, R = result
  const ui = '"BIZ UDPGothic","Hiragino Sans",sans-serif', hand = '"Klee One","Hiragino Mincho ProN",serif'
  g.setTransform(1, 0, 0, 1, 0, 0)
  if (showTitle && ts < 0.4) { const k = (0.4 - ts) * 30; g.translate(Math.sin(ts * 90) * k, Math.cos(ts * 70) * k * 0.6) }
  g.fillStyle = '#d2cbbb'; g.fillRect(-40, -40, W + 80, H + 80)
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H)
  g.strokeStyle = '#3d8f86'; g.lineWidth = 3; g.strokeRect(26, 26, W - 52, H - 52)
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'
  g.font = `700 26px ${ui}`; g.fillStyle = '#245e58'; g.fillText(T('clinic'), 56, 82)
  g.font = `400 24px ${ui}`; g.fillStyle = '#5d6467'; g.textAlign = 'right'; g.fillText(T('date')(), W - 56, 82)
  g.textAlign = 'center'; g.font = `700 ${lang === 'ja' ? 58 : 52}px ${ui}`; g.fillStyle = '#22272b'; g.fillText(T('form'), W / 2, 158)
  g.font = `400 ${lang === 'ja' ? 24 : 22}px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(T('formLead'), W / 2, 200, W - 112)
  g.textAlign = 'left'
  g.strokeStyle = '#3d8f86'; g.lineWidth = 2; g.beginPath(); g.moveTo(56, 222); g.lineTo(W - 56, 222); g.stroke()
  // 同意した事の一覧（1行ずつハンコが押される）
  const N = R.asks.length, top = 236, avail = 560, rh = Math.min(72, avail / Math.max(1, N)), fs = Math.min(31, rh * 0.5)
  R.asks.forEach((a, i) => {
    const y = top + i * rh, cy = y + rh / 2
    g.strokeStyle = '#e2dccd'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(56, y + rh); g.lineTo(W - 56, y + rh); g.stroke()
    g.font = `400 ${fs * 0.8}px ${ui}`; g.fillStyle = '#9a9488'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 62, cy)
    if (i >= rows) return
    g.font = `600 ${fs}px ${hand}`; g.fillStyle = a.agreed ? '#1f2a44' : '#9aa0a3'
    const tx = 100, maxW = W - 56 - rh * 1.25 - tx - 10
    g.fillText(a.text, tx, cy + 1, maxW)
    if (!a.agreed) { const tw = Math.min(maxW, g.measureText(a.text).width); g.strokeStyle = '#8a8f92'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(tx, cy + 1); g.lineTo(tx + tw, cy + 1); g.stroke() }
    const sx = W - 56 - rh * 0.6, rad = Math.min(30, rh * 0.42), rot = -0.25 + ((i * 37) % 10) / 20
    const foot = imgCache[propUrl('p_footseal')]
    if (a.id === 'loan' && a.agreed && foot && foot.naturalWidth) { g.save(); g.translate(sx, cy); g.rotate(-0.5); const fh = rh * 1.05, fw = fh * foot.naturalWidth / foot.naturalHeight; g.drawImage(foot, -fw / 2, -fh / 2, fw, fh); g.restore() }
    else hanko(g, sx, cy, rad, T('stamps')[a.how] || T('stamps').yes, a.agreed ? '#c8322b' : '#56606a', rot)
  })
  g.textBaseline = 'alphabetic'
  // 合計
  const by = top + avail + 30
  g.font = `400 26px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(T('formTotal'), 56, by + 26)
  const lw = g.measureText(T('formTotal')).width
  g.font = `600 64px ${hand}`; g.fillStyle = '#c8322b'; g.fillText(String(rows >= N ? R.n : R.asks.slice(0, rows).filter(a => a.agreed).length), 56 + lw + 14, by + 34)
  const nw = g.measureText(String(R.n)).width
  g.font = `400 26px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(`${T('formOf')}${N}${T('formAsk')}`, 56 + lw + 14 + nw + 10, by + 26)
  // 担当の写真と最後の一言
  const py = by + 70
  const ph = imgCache['img/dentist_look.webp?v=2']
  if (ph && ph.complete && ph.naturalWidth) { g.save(); g.beginPath(); g.arc(56 + 62, py + 62, 62, 0, 7); g.clip(); g.fillStyle = '#e7e1d4'; g.fillRect(56, py, 124, 124); g.drawImage(ph, 56 - 14, py + 2, 152, 152 * ph.naturalHeight / ph.naturalWidth); g.restore() }
  g.font = `400 22px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(T('formLast'), 200, py + 26)
  if (showTitle) { g.font = `600 30px ${hand}`; g.fillStyle = '#1f2a44'; wrapText(g, R.last, 200, py + 68, W - 112 - 290 - 144, 40, 3) }
  // 称号のハンコ
  if (showTitle) {
    const k = Math.max(1, 1.8 - Math.max(0, ts) * 4), cx = W - 180, cy = py + 40
    g.save(); g.translate(cx, cy); g.rotate(-0.16); g.scale(k, k)
    g.globalAlpha = 0.9; g.strokeStyle = '#c8322b'; g.fillStyle = '#c8322b'; g.lineWidth = 7
    g.beginPath(); g.arc(0, 0, 128, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 115, 0, 7); g.stroke()
    g.textAlign = 'center'; g.font = `700 22px ${ui}`; g.fillText(T('formTitle'), 0, -64)
    const tl = R.title
    let lines
    if (lang === 'ja') { const n = tl.length; lines = n <= 6 ? [tl] : n <= 12 ? [tl.slice(0, Math.ceil(n / 2)), tl.slice(Math.ceil(n / 2))] : [tl.slice(0, Math.ceil(n / 3)), tl.slice(Math.ceil(n / 3), Math.ceil(n * 2 / 3)), tl.slice(Math.ceil(n * 2 / 3))] }
    else { const ws = tl.split(' '); lines = []; let cur = ''; for (const w of ws) { if ((cur + ' ' + w).trim().length > 11 && cur) { lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim() } if (cur) lines.push(cur) }
    const lf = lang === 'ja' ? (lines.length === 1 ? 50 : lines.length === 2 ? 40 : 34) : (lines.length <= 2 ? 30 : 26)
    g.font = `700 ${lf}px ${ui}`
    lines.forEach((l, i) => g.fillText(l, 0, -6 + (i - (lines.length - 1) / 2) * (lf + 4) + lf * 0.4, 200))
    g.restore(); g.textAlign = 'left'; g.globalAlpha = 1
  }
  g.font = `400 22px ${ui}`; g.fillStyle = '#7b8486'; g.fillText('tom3games.github.io/dentist-hand', 56, H - 46)
}
function toast(msg) { const m = $('#rMsg'); m.textContent = msg; m.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { m.hidden = true }, 1600) }
$('#bSave').onclick = async () => {
  drawForm(result.asks.length, true, 9)
  const cv = $('#karte'); if (window.TM) TM.share('save')
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'))
  const file = new File([blob], 'dentist-hand.png', { type: 'image/png' })
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return } } catch (e) { if (e && e.name === 'AbortError') return }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dentist-hand.png'; document.body.appendChild(a); a.click(); a.remove(); toast(T('saved'))
}
const SHARE_URL = 'https://tom3games.github.io/dentist-hand/'
function postUrl() { return 'https://x.com/intent/post?text=' + encodeURIComponent(T('shareText')(result)) + '&url=' + encodeURIComponent(SHARE_URL) }
$('#bPost').onclick = () => { if (window.TM) TM.share('x'); window.open(postUrl(), '_blank', 'noopener') }
$('#bAgain').onclick = () => { Snd.play('ok', { vol: 0.5 }); startGame() }
$('#bTitle').onclick = () => show('vTitle')

$('#bStart').onclick = () => { Snd.init(); Snd.play('ok', { vol: 0.5 }); startGame() }
$('#bHow').onclick = () => { Snd.init(); show('vHow') }
$('#bHowBack').onclick = () => show('vTitle')
$('#bHowGo').onclick = () => { Snd.init(); Snd.play('ok', { vol: 0.5 }); startGame() }
$('#bLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('dh_lang', lang) } catch (e) {} applyLang() }
$('#bSnd').onclick = () => { Snd.init(); setMute(!muted) }
$('#bMute').onclick = e => { e.stopPropagation(); Snd.init(); setMute(!muted) }
document.addEventListener('visibilitychange', () => { if (document.hidden) drillSound(1, 0, false); last = performance.now() })

// ---------------------------------------------------------------- 検証用の窓口
window.dh = {
  buildDeck, newRun, simulate, BOTS: Object.keys(BOTS), interp2, D,
  get run() { return run }, get result() { return result }, startGame, endGame, show, postUrl, drawForm,
  setLang: l => { lang = l; applyLang() }, reply: k => onReply(k), replyOpen: () => replyOpen(run),
  // 返事のボタンの画面上の中心（本物の指で押すテスト用）
  mouthXY: k => { const b = document.querySelector(`.mb[data-r="${k}"]`).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height } },
  dbg: {
    pause: v => { dbgPaused = v !== false },
    step: n => { for (let i = 0; i < n; i++) { if (paused || !run || run.done) break; step1() } render() },
    to: clock => { let n = 0; while (run && !run.done && run.clock < clock && n++ < 60 * 900) { if (paused) break; step1() } render() },
    // 次の返事の窓まで進める（開いたら止まる）
    toReply: (max = 60) => { let n = 0; while (run && !run.done && !replyOpen(run) && n++ < 60 * max) { if (paused) break; step1() } render(); return replyOpen(run) },
    // だまって窓を閉じるまで進める
    skipReply: () => { let n = 0; while (run && !run.done && replyOpen(run) && n++ < 60 * 10) step1(); render() },
    finish: () => { let n = 0; while (run && !run.done && n++ < 60 * 900) { if (paused) break; step1() } render() },
    tutStage: () => tutStage,
  },
}

applyLang(); Snd.setMute(muted)
preload().then(() => {
  show('vTitle')
  window.__dhReady = true
})
})()
