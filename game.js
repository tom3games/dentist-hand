// 痛かったら手を挙げてください（dentist-hand） v2
// 目的: 天井の「口の中カメラ」に映る健康な歯（白）を守り切る。黒い虫歯は削らせると治る。
// おっちょこちょいの先生のドリルが、時々健康な歯へ向かう。先生か助手がこっちを見ている瞬間に手を挙げると止まる。
// 止められないと銀歯になる。虫歯の上で止めると虫歯が残り、大げさと思われる。
// 台本（どの歯に向かうか・誰がいつ見るか）は種から決まる。乱数で当たり外れを決めない。
window.__jsUp = true
;(function () {
'use strict'
const D = window.DH_DATA
const $ = s => document.querySelector(s)
const DT = 1 / 60
const N_TEETH = 14
const HAND_UP = 1.1, HAND_CD = 0.45, HAND_TIRED = 1.6, CATCH = 0.6   // 気づかれるのは挙げる動きの間（CATCH 秒）だけ。気づかれないと腕が疲れて次まで長い
const MOVE_CAV = 1.5, DRILL_CAV = 2.8, MOVE_BAD = 2.2, GRIND = 1.2
let lang = (() => { try { return localStorage.getItem('dh_lang') || (/^ja/i.test(navigator.language) ? 'ja' : 'en') } catch (e) { return 'ja' } })()
const T = k => D.ui[lang][k]

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

// ---------------------------------------------------------------- 歯の位置（モニターの中の 0..1 座標）。上7本・下7本
const TOOTH = []
for (let i = 0; i < N_TEETH; i++) {
  const up = i < 7, k = up ? i : i - 7, u = (k - 3) / 3
  TOOTH.push({ x: 0.5 + u * 0.4, y: up ? 0.36 - u * u * 0.07 : 0.68 + u * u * 0.07, up })
}

// ---------------------------------------------------------------- 台本
function buildScript(seed, o = {}) {
  const R = rng(seed), pick = a => a[Math.floor(R() * a.length)]
  const boss = o.boss != null ? o.boss : R() < 0.15
  const S = { seed, boss, blocks: [], ev: [], dLook: [], aPose: [], lines: [], sfx: [], drill: [], end: 0, teeth: [] }
  // 虫歯をくじで3〜4本
  const idx = [...Array(N_TEETH).keys()]
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] }
  const C = R() < 0.5 ? 3 : 4, cav = idx.slice(0, C), healthy = idx.slice(C)
  for (let i = 0; i < N_TEETH; i++) S.teeth.push(cav.includes(i) ? 'cav' : 'ok')
  const W = 6 + Math.floor(R() * 3)   // 健康な歯へ向かう回数 6〜8
  const wrongTargets = healthy.slice(0, W)
  // 出来事の並び（虫歯と間違いを混ぜる。チュートリアルは最初が間違い）
  const list = cav.map(t => ({ kind: 'cav', tooth: t })).concat(wrongTargets.map(t => ({ kind: 'bad', tooth: t })))
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [list[i], list[j]] = [list[j], list[i]] }
  if (o.tutorial) { const k = list.findIndex(x => x.kind === 'bad'); const [x] = list.splice(k, 1); list.unshift(x) }
  const line = (t, who, key, i) => S.lines.push({ t, who, key, i: i != null ? i : Math.floor(R() * 8) })
  const look = (a, b, pose) => S.dLook.push({ a, b, pose })
  const apose = (a, b, pose) => S.aPose.push({ a, b, pose })
  S.blocks.push({ a: 0, b: 4.2, kind: 'intro' }); look(0.3, 3.6, 'look'); line(0.5, 'd', boss ? 'introBoss' : 'intro')
  let t = 4.2
  const plan = ['drill', 'rinse', 'drill', 'chat', 'drill', 'rinse', 'drill', 'outro']
  const nBlocks = 4, per = []; for (let b = 0; b < nBlocks; b++) per.push(Math.floor(list.length / nBlocks) + (b < list.length % nBlocks ? 1 : 0))
  let nb = 0, li = 0, chatIdx = Math.floor(R() * 3), first = true
  for (const kind of plan) {
    if (kind === 'drill') {
      const a = t
      look(a, a + 1.5, 'away'); line(a + 0.1, 'd', 'tray'); S.sfx.push({ t: a + 0.25, k: 'tray' })
      line(a + 1.6, 'd', 'startDrill'); S.sfx.push({ t: a + 1.7, k: 'drillStart' })
      let s = a + 2.6
      for (let k = 0; k < per[nb]; k++) {
        const e = { ...list[li++], a0: s }
        if (e.kind === 'cav') {
          e.contact = s + MOVE_CAV; e.end = e.contact + DRILL_CAV; e.I = (boss ? 1.45 : 1) * pick([1, 1.5, 2])
          {   // 削っている最中の「見る」（罠: ここで挙げると虫歯が残る）
            const m = e.contact + 0.5 + R() * 0.6
            if (R() < 0.65) { look(m, m + 1.4, 'look'); line(m + 0.05, 'd', boss ? 'bossHum' : 'checkSafe') } else apose(m, m + 1.4, 'look')
          }
          s = e.end + 2.2 + R() * 1.8
        } else {
          e.contact = s + MOVE_BAD; e.end = e.contact + GRIND
          let pat
          if (o.tutorial && first) pat = 'A'
          else { const r = R(), wA = boss ? 0.42 : 0.35, wB = boss ? 0.33 : 0.3, wC = boss ? 0.15 : 0.22; pat = r < wA ? 'A' : r < wA + wB ? 'B' : r < wA + wB + wC ? 'C' : 'D' }
          e.pat = pat
          if (pat === 'A') { look(s + 0.5, s + 1.9, 'look'); line(s + 0.55, 'd', 'checkWarn') }
          else if (pat === 'B') { apose(s + 0.1, s + 1.0, 'glare'); line(s + 0.1, 'a', boss ? 'scoldBoss' : 'scold'); apose(s + 1.2, s + 2.8, 'look') }
          else if (pat === 'C') { look(e.contact + 0.1, e.contact + 1.3, 'look'); line(e.contact + 0.15, 'd', 'checkLate') }
          s = e.end + 2.6 + R() * 1.8
          first = false
        }
        S.ev.push(e)
      }
      const b = s + 0.4
      S.blocks.push({ a, b, kind }); S.drill.push({ a: a + 1.7, b })
      nb++; t = b
    } else if (kind === 'rinse') {
      const a = t; S.blocks.push({ a, b: a + 5.2, kind })
      look(a, a + 5.2, 'away'); line(a + 0.2, 'a', 'rinse'); apose(a + 0.4, a + 2.9, 'look')
      S.sfx.push({ t: a + 1.5, k: 'gargle' }, { t: a + 2.1, k: 'gargle' }, { t: a + 3.0, k: 'spit' })
      if (!S.kidDone) { line(a + 3.4, 'k', 'kid'); S.sfx.push({ t: a + 3.4, k: 'giggle' }); S.kidDone = true }
      t = a + 5.2
    } else if (kind === 'chat') {
      const a = t; S.blocks.push({ a, b: a + 7, kind })
      look(a + 0.3, a + 5.6, 'look'); line(a + 0.4, 'd', 'chatQ', chatIdx); line(a + 2.4, 'p', 'chatA'); line(a + 4.1, 'd', 'chatR', chatIdx)
      t = a + 7
    } else if (kind === 'outro') {
      const a = t; S.blocks.push({ a, b: a + 3.4, kind }); look(a + 0.2, a + 3.4, 'look'); line(a + 0.3, 'd', 'outro'); t = a + 3.4
    }
  }
  S.end = t
  S.lines.sort((x, y) => x.t - y.t); S.sfx.sort((x, y) => x.t - y.t)
  return S
}

// ---------------------------------------------------------------- 1回の治療（描画と切り離した中身）
function newRun(seed, o = {}) {
  const S = buildScript(seed, o)
  return {
    S, seed, clock: 0, tt: 0, pauseUntil: 0, lineIdx: 0, sfxIdx: 0, teeth: S.teeth.slice(),
    hand: { up: false, t0: 0, seen: false, cdUntil: 0 },
    ignore: false, bigesa: 0, raised: 0, seen: 0, saved: 0, silver: 0, fixed: 0, cavStops: 0, painNow: 0,
    pos: { x: 0.5, y: 0.52 }, lastTooth: -1,
    force: { d: null, a: null }, say: null, humQuiet: 0, events: [], done: false, out: [], tutorial: !!o.tutorial,
  }
}
const inIv = (arr, t) => { for (const x of arr) if (t >= x.a && t < x.b) return x; return null }
function blockAt(run, t) { return inIv(run.S.blocks, t) }
function drillOn(run) { return run.clock >= run.pauseUntil && !!inIv(run.S.drill, run.tt) }
function activeEv(run) {
  for (const e of run.S.ev) { if (e.done || e.canceled) continue; if (run.tt >= e.a0 && run.tt < e.end) return e; if (e.a0 > run.tt) break }
  return null
}
function dentistPose(run) {
  if (run.force.d && run.clock < run.force.d.until) return run.force.d.pose
  const l = inIv(run.S.dLook, run.tt); if (l) return l.pose
  return 'down'
}
function assistPose(run) {
  if (run.force.a && run.clock < run.force.a.until) return run.force.a.pose
  const l = inIv(run.S.aPose, run.tt); if (l) return l.pose
  return 'away'
}
// 鼻歌: ドリル中で、うつむいていて、0.8秒以内に顔を上げる予定が無く、叱られた直後でない
function humming(run) {
  if (!drillOn(run) || dentistPose(run) !== 'down' || run.clock < run.humQuiet) return false
  for (const l of run.S.dLook) if (l.a > run.tt && l.a - run.tt < 0.8) return false
  for (const l of run.S.aPose) if (l.pose === 'glare' && run.tt >= l.a && run.tt < l.b + 3) return false
  return true
}
function pitch(run) {
  if (!drillOn(run)) return 0
  const e = activeEv(run)
  if (!e) return 0.25
  if (run.tt < e.contact) return 0.25 + 0.75 * (run.tt - e.a0) / (e.contact - e.a0)
  return 1
}
function say(run, who, key, idx) {
  const arr = D.lines[lang][key]; if (!arr) return
  const text = arr[(idx != null ? idx : Math.floor(Math.random() * arr.length)) % arr.length]
  const n = text.replace(/\|/g, '').length
  run.say = { who, key, text, until: run.clock + Math.max(1.4, 0.9 + 0.09 * n) }
  run.events.push({ t: run.clock, ev: 'say', who, key })
}
function out(run, k) { run.out.push(k) }

function raise(run) {
  const h = run.hand
  if (run.done || h.up || run.clock < h.cdUntil) return false
  h.up = true; h.t0 = run.clock; h.seen = false; run.raised++
  run.events.push({ t: run.clock, ev: 'raise', tt: run.tt })
  out(run, 'raise')
  return true
}
function notice(run, by) {
  run.hand.seen = true; run.seen++
  run.events.push({ t: run.clock, ev: 'seen', by })
  if (by === 'a') {
    say(run, 'a', 'seenByA'); run.force.a = { pose: 'glare', until: run.clock + 0.9 }
    run.pending = { at: run.clock + 0.5, fn: () => dentistReact(run, true) }
  } else dentistReact(run, false)
}
function falseAlarm(run, chat) {
  run.bigesa++; out(run, 'bigesa')
  if (run.bigesa === 1) say(run, 'd', chat ? 'faChat' : 'fa1')
  else if (run.bigesa === 2) { say(run, 'd', chat ? 'faChat' : 'fa2'); run.pending = { at: run.clock + 1.6, fn: () => say(run, 'd', 'faRough') } }
  else say(run, 'd', chat ? 'faChat' : 'fa3')
}
function dentistReact(run, viaA) {
  const e = activeEv(run), blk = blockAt(run, run.tt)
  if (run.ignore) { say(run, 'd', viaA ? 'ignoreA' : 'fa3'); return }
  if (e && drillOn(run)) {
    e.canceled = true
    run.pauseUntil = run.clock + 2.2
    run.force.d = { pose: 'look', until: run.clock + 2.0 }
    if (e.kind === 'bad') {
      run.saved++; say(run, 'd', 'sorry'); out(run, 'stop')
      run.events.push({ t: run.clock, ev: 'saved', tooth: e.tooth })
    } else {
      // 虫歯の上で止めた: 虫歯は残る。大げさ
      run.cavStops++; out(run, 'stop')
      say(run, 'd', 'cavStop')
      run.pending = { at: run.clock + 1.3, fn: () => falseAlarm(run, false) }
    }
  } else falseAlarm(run, blk && blk.kind === 'chat')
}

function tick(run) {
  if (run.done) return
  run.clock += DT
  const paused = run.clock < run.pauseUntil
  if (!paused) run.tt += DT
  if (run.pending && run.clock >= run.pending.at) { const f = run.pending.fn; run.pending = null; f() }
  const S = run.S
  while (run.lineIdx < S.lines.length && S.lines[run.lineIdx].t <= run.tt) {
    const l = S.lines[run.lineIdx++]
    if (run.say && run.say.until > run.clock && ['sorry', 'cavStop', 'gari', 'fa1', 'fa2', 'fa3', 'faRough', 'seenByA', 'fixed'].includes(run.say.key)) continue   // 反応の台詞を上書きしない
    say(run, l.who, l.key, l.i)
    if (l.key.startsWith('scold')) run.humQuiet = run.clock + 4
  }
  while (run.sfxIdx < S.sfx.length && S.sfx[run.sfxIdx].t <= run.tt) out(run, S.sfx[run.sfxIdx++].k)
  // ドリルの位置と、歯の結果
  run.painNow = 0
  for (const e of S.ev) {
    if (e.done) continue
    if (e.a0 > run.tt) break
    if (e.canceled) { e.done = true; continue }
    if (paused) break
    const from = run.lastTooth >= 0 ? TOOTH[run.lastTooth] : { x: 0.5, y: 0.52 }, to = TOOTH[e.tooth]
    const k = Math.min(1, (run.tt - e.a0) / (e.contact - e.a0)), ease = k * k * (3 - 2 * k)
    run.pos = { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease }
    if (run.tt >= e.contact && run.tt < e.end) run.painNow = e.kind === 'cav' ? e.I : 2.4
    if (run.tt >= e.end) {
      e.done = true; run.lastTooth = e.tooth
      if (e.kind === 'cav') { run.teeth[e.tooth] = 'fixed'; run.fixed++; out(run, 'fixed'); say(run, 'd', 'fixed') }
      else { run.teeth[e.tooth] = 'silver'; run.silver++; out(run, 'gari'); say(run, 'd', 'gari') }
      run.events.push({ t: run.clock, ev: e.kind === 'cav' ? 'fixed' : 'silver', tooth: e.tooth })
    }
    break
  }
  // 手
  const h = run.hand
  if (h.up) {
    if (!h.seen && run.clock - h.t0 <= CATCH) {
      if (dentistPose(run) === 'look') notice(run, 'd')
      else if (assistPose(run) === 'look') notice(run, 'a')
    }
    if (run.clock - h.t0 >= HAND_UP) {
      h.up = false; h.cdUntil = run.clock + (h.seen ? HAND_CD : HAND_TIRED)
      if (!h.seen && activeEv(run) && drillOn(run)) say(run, 'd', 'notSeen')
    }
  }
  if (run.say && run.say.until <= run.clock) run.say = null
  if (run.tt >= S.end && !paused) finish(run)
}
function tally(run) {
  const C = run.S.teeth.filter(x => x === 'cav').length, H = N_TEETH - C
  return { C, H, kept: H - run.silver, silver: run.silver, fixed: run.fixed, left: C - run.fixed }
}
function finish(run) {
  run.done = true
  const c = tally(run)
  run.score = Math.max(0, Math.min(100, Math.round(100 - c.silver * 10 - c.left * 9)))
  let tk
  if (run.raised === 0) tk = c.silver >= 5 ? 'bling' : 'stone'
  else if (run.bigesa >= 3) tk = 'wolf'
  else if (c.silver >= 5) tk = 'bling'
  else if (c.silver === 0 && c.left === 0) tk = 'guard'
  else if (run.score >= 75) tk = 'good'
  else if (c.left >= 2) tk = 'leftover'
  else if (c.silver >= 3) tk = 'collector'
  else tk = 'mid'
  run.titleKey = tk
  run.rank = run.score >= 85 ? 5 : run.score >= 70 ? 4 : run.score >= 50 ? 3 : run.score >= 30 ? 2 : 1
  if (run.raised === 0) run.rank = 1
  out(run, 'end')
}
// 見て分かることだけを返す（bot と検証用）。tgt=ドリルが向かう歯、tstate=その歯の今の色
function obs(run) {
  const e = activeEv(run)
  return {
    pitch: +pitch(run).toFixed(3), drill: drillOn(run), d: dentistPose(run), a: assistPose(run), hum: humming(run),
    tgt: e && drillOn(run) ? e.tooth : -1, tstate: e && drillOn(run) ? run.teeth[e.tooth] : null, contact: !!(e && run.tt >= e.contact),
    say: run.say && run.say.who, handUp: run.hand.up, ready: !run.hand.up && run.clock >= run.hand.cdUntil, clock: run.clock,
  }
}

// ---------------------------------------------------------------- bot（sim と検証用。人の反応速度 0.4 秒）
const BOTS = {
  none: () => () => false,
  spam: () => o => o.ready,
  random: seed => { const R = rng(seed ^ 0x9e37); let next = 0; return o => { if (o.clock < next) return false; next = o.clock + 1; return R() < 0.3 } },
  // ドリルの行き先だけ見る（視線を読まない）
  dest: () => o => o.ready && o.tstate === 'ok',
  // ドリルの行き先と視線を読む
  reader: () => {
    let humWas = -9, glareAt = -9
    return o => {
      if (o.hum) humWas = o.clock
      if (o.a === 'glare') glareAt = o.clock
      if (!o.ready || o.tstate !== 'ok') return false   // 白い歯へ向かっている時だけ
      const lookNow = o.d === 'look' || o.a === 'look'
      if (o.clock - glareAt < 3 && !lookNow) return false   // 助手が叱った後は、助手がこっちを向くのを待つ
      const cue = o.d === 'down' && !o.hum && o.clock - humWas < 1.2   // 鼻歌が止まった＝もうすぐ顔を上げる
      return lookNow || cue
    }
  },
}
function simulate(botName, seed, o = {}) {
  const run = newRun(seed, o), decide = BOTS[botName](seed), q = []
  let n = 0
  while (!run.done && n++ < 60 * 600) {
    const ob = obs(run)
    if (decide(ob)) q.push(run.clock + 0.4)
    while (q.length && q[0] <= run.clock) { q.shift(); raise(run) }
    tick(run)
  }
  const c = tally(run)
  return { bot: botName, seed, score: run.score, rank: run.rank, title: run.titleKey, raised: run.raised, seen: run.seen, saved: run.saved, bad: run.S.ev.filter(e => e.kind === 'bad').length, pats: run.S.ev.filter(e => e.kind === 'bad').map(e => e.pat + (e.canceled ? '+' : '-')).join(' '), ...c, bigesa: run.bigesa, boss: run.S.boss, len: +run.clock.toFixed(1) }
}

// ---------------------------------------------------------------- 口の中の絵（モニター・カルテ・OG で共通）
function drawMouth(g, x0, y0, w, h, teeth, o = {}) {
  g.save(); g.translate(x0, y0)
  // カメラの映像の地
  const bg = g.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, w * 0.62)
  bg.addColorStop(0, '#5a2a30'); bg.addColorStop(1, '#1d0d10'); g.fillStyle = bg; g.fillRect(0, 0, w, h)
  // 歯ぐき
  g.fillStyle = '#c96a72'
  for (const up of [true, false]) {
    g.beginPath()
    for (let i = 0; i <= 20; i++) { const u = i / 10 - 1, x = w * (0.5 + u * 0.47), y = h * ((up ? 0.36 : 0.68) + (up ? -1 : 1) * u * u * 0.07) + (up ? -h * 0.13 : h * 0.13); i ? g.lineTo(x, y) : g.moveTo(x, y) }
    for (let i = 20; i >= 0; i--) { const u = i / 10 - 1, x = w * (0.5 + u * 0.47), y = h * ((up ? 0.36 : 0.68) + (up ? -1 : 1) * u * u * 0.07) + (up ? h * 0.02 : -h * 0.02); g.lineTo(x, y) }
    g.closePath(); g.fill()
  }
  const tw = w * 0.118, th = h * 0.24
  teeth.forEach((s, i) => {
    const T0 = TOOTH[i], cx = T0.x * w, cy = T0.y * h, x = cx - tw / 2, y = cy - th / 2
    let fill
    if (s === 'silver') { fill = g.createLinearGradient(x, y, x + tw, y + th); fill.addColorStop(0, '#f4f6f8'); fill.addColorStop(0.35, '#9aa3ab'); fill.addColorStop(0.6, '#dfe4e8'); fill.addColorStop(1, '#6f7880') }
    else { fill = g.createLinearGradient(x, y, x, y + th); fill.addColorStop(0, '#fffdf4'); fill.addColorStop(1, '#e8dfc6') }
    g.fillStyle = fill; g.strokeStyle = 'rgba(60,30,30,.55)'; g.lineWidth = Math.max(1, w / 300)
    g.beginPath(); g.roundRect(x, y, tw, th, tw * 0.32); g.fill(); g.stroke()
    if (s === 'cav') { g.fillStyle = '#231510'; g.beginPath(); g.ellipse(cx + tw * 0.05, cy + (T0.up ? th * 0.12 : -th * 0.12), tw * 0.22, th * 0.17, 0.4, 0, 7); g.fill(); g.fillStyle = '#5a3a20'; g.beginPath(); g.arc(cx - tw * 0.16, cy - th * 0.05, tw * 0.07, 0, 7); g.fill() }
    if (s === 'fixed') { g.fillStyle = '#d9e3e6'; g.beginPath(); g.ellipse(cx, cy, tw * 0.2, th * 0.14, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = Math.max(1.2, w / 220); const sx = cx + tw * 0.28, sy = cy - th * 0.32, r = tw * 0.16; g.beginPath(); g.moveTo(sx - r, sy); g.lineTo(sx + r, sy); g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke() }
    if (s === 'silver') { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(cx - tw * 0.18, cy - th * 0.22, tw * 0.08, th * 0.12, -0.5, 0, 7); g.fill() }
    if (o.target === i) {
      const p = 0.5 + 0.5 * Math.sin((o.t || 0) * 12)
      g.strokeStyle = s === 'ok' ? `rgba(255,214,64,${0.55 + p * 0.45})` : `rgba(140,220,200,${0.4 + p * 0.4})`; g.lineWidth = Math.max(2, w / 110)
      g.setLineDash([w / 70, w / 110]); g.beginPath(); g.roundRect(x - tw * 0.14, y - th * 0.12, tw * 1.28, th * 1.24, tw * 0.4); g.stroke(); g.setLineDash([])
    }
  })
  // ドリル（上から差し込まれる）
  if (o.drill) {
    const jx = (o.jit || 0) * Math.sin((o.t || 0) * 90) * w / 200, dx = o.drill.x * w + jx, dy = o.drill.y * h
    g.strokeStyle = '#d7dce0'; g.lineWidth = w / 40; g.lineCap = 'round'
    g.beginPath(); g.moveTo(dx + w * 0.16, -h * 0.05); g.lineTo(dx + w * 0.03, dy - h * 0.06); g.stroke()
    g.strokeStyle = '#8b949b'; g.lineWidth = w / 90; g.beginPath(); g.moveTo(dx + w * 0.03, dy - h * 0.06); g.lineTo(dx, dy); g.stroke()
    g.fillStyle = '#c8b27a'; g.beginPath(); g.arc(dx, dy, w / 85, 0, 7); g.fill()
    if (o.spark) { g.strokeStyle = 'rgba(255,255,230,.9)'; g.lineWidth = w / 260; for (let k = 0; k < 5; k++) { const a = (o.t * 40 + k * 1.3) % 6.28; g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx + Math.cos(a) * w * 0.03, dy + Math.sin(a) * w * 0.03); g.stroke() } }
  }
  // 走査線
  if (o.scan) { g.fillStyle = 'rgba(255,255,255,.035)'; for (let yy = 0; yy < h; yy += 3) g.fillRect(0, yy, w, 1) }
  g.restore()
}

// ================================================================ 画面
const views = ['vLoad', 'vTitle', 'vHow', 'vPlay', 'vResult']
function show(id) { for (const v of views) $('#' + v).hidden = v !== id; if (id === 'vResult') fitKarte() }
function applyLang() {
  document.documentElement.lang = lang
  document.querySelectorAll('[data-t]').forEach(el => { const v = T(el.dataset.t); if (typeof v === 'string') el.textContent = v })
  $('#howList').innerHTML = T('howRows').map(([a, b]) => `<li><i></i><b>${a}</b><span>${b}</span></li>`).join('')
  $('#howWho').innerHTML = lang === 'ja' ? 'おっちょこちょいの先生・厳しい助手<br>たまに院長（やさしいが一番痛い）' : 'Clumsy humming dentist, strict nurse<br>rare head dentist (kindest, hurts most)'
  sndLabel(); drawHowMouth()
}
let muted = (() => { try { return localStorage.getItem('dh_mute') === '1' } catch (e) { return false } })()
function sndLabel() { $('#bSnd').textContent = `${T('sound')}: ${muted ? T('off') : T('on')}`; $('#bMute').textContent = muted ? '×' : T('mute'); $('#bMute').classList.toggle('off', muted) }
function setMute(m) { muted = m; try { localStorage.setItem('dh_mute', m ? '1' : '0') } catch (e) {} Snd.setMute(m); sndLabel() }
function drawHowMouth() {
  const c = $('#howMouth'); if (!c) return; const g = c.getContext('2d')
  const teeth = Array(N_TEETH).fill('ok'); teeth[2] = 'cav'; teeth[10] = 'cav'; teeth[5] = 'silver'; teeth[12] = 'fixed'
  drawMouth(g, 0, 0, c.width, c.height, teeth, { target: 4, t: 0.15, drill: { x: TOOTH[4].x, y: TOOTH[4].y } })
}

// 音
Snd.def({
  drillStart: 'snd/drill_start.mp3', tray: ['snd/tray1.mp3', 'snd/tray2.mp3', 'snd/tray3.mp3'], air: 'snd/air.mp3',
  gargle: ['snd/gargle1.mp3', 'snd/gargle2.mp3'], spit: ['snd/spit1.mp3', 'snd/spit2.mp3'], grunt: ['snd/grunt1.mp3', 'snd/grunt2.mp3', 'snd/grunt3.mp3'],
  gari: ['snd/gari1.mp3', 'snd/gari2.mp3'], fixed: 'snd/fixed.mp3',
  paper: ['snd/paper1.mp3', 'snd/paper2.mp3'], stamp: 'snd/stamp.mp3', good: 'snd/jingle_good.mp3', mid: 'snd/jingle_mid.mp3', bad: 'snd/jingle_bad.mp3', ok: 'snd/ok.mp3', giggle: 'snd/giggle.mp3',
})
let drillSrc = null, drillGain = null
function drillSound(p, on) {
  if (!Snd.ctx || muted) { if (drillSrc) { try { drillSrc.stop() } catch (e) {} drillSrc = null } return }
  const buf = Snd.bufs['snd/drill_loop.mp3']
  if (on && !drillSrc && buf && buf !== 'loading') {
    const c = Snd.ctx; drillSrc = c.createBufferSource(); drillSrc.buffer = buf; drillSrc.loop = true; drillGain = c.createGain(); drillGain.gain.value = 0
    drillSrc.connect(drillGain); drillGain.connect(Snd.sfxBus); drillSrc.start()
  }
  if (!on && drillSrc) { const s = drillSrc; drillGain.gain.setTargetAtTime(0, Snd.ctx.currentTime, 0.05); setTimeout(() => { try { s.stop() } catch (e) {} }, 300); drillSrc = null; return }
  if (drillSrc) { const t = Snd.ctx.currentTime; drillSrc.playbackRate.setTargetAtTime(0.82 + p * 0.42, t, 0.06); drillGain.gain.setTargetAtTime(0.25 + p * 0.45, t, 0.06) }
}
Snd.files.__loop = ['snd/drill_loop.mp3', 'snd/suction.mp3', 'snd/amb_room.mp3', 'snd/bgm_clinic.mp3']
function startAmbience() { Snd.loop('amb', 'snd/amb_room.mp3', 0.22); Snd.loop('bgm', 'snd/bgm_clinic.mp3', 0.12) }

// ---------------------------------------------------------------- 読み込み（本物の数で進む）
const IMGS = ['bg', 'dentist_down', 'dentist_look', 'dentist_away', 'director_down', 'director_look', 'director_away', 'assistant_look', 'assistant_glare', 'assistant_away', 'hand_rest', 'hand_fist', 'hand_up', 'feet_rest', 'feet_curl', 'drill'].map(n => `img/${n}.webp?v=2`)
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
let run = null, raf = 0, last = 0, acc = 0, paused = false, tutStage = 0
const docEl = $('#doc'), asstEl = $('#asst')
function setPeople(boss) {
  const who = boss ? 'director' : 'dentist'
  docEl.querySelectorAll('img').forEach(im => { im.src = `img/${who}_${im.dataset.k}.webp?v=2` })
}
function tutDone() { try { return localStorage.getItem('dh_tut') === '1' } catch (e) { return false } }
function startGame(o = {}) {
  Snd.init(); startAmbience()
  const seed = o.seed != null ? o.seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0
  const tutorial = o.tutorial != null ? o.tutorial : !tutDone()
  run = newRun(seed, { tutorial, boss: o.boss })
  setPeople(run.S.boss)
  $('#stage').classList.remove('up')
  show('vPlay'); sizeMon()
  if (window.TM) TM.start()
  tutStage = 0; paused = false; $('#tut').hidden = true; $('#hint').hidden = true
  if (tutorial) { tutStage = 1; showTut(T('tut1'), true) }
  last = performance.now(); acc = 0; monPos = null
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop)
  render()
}
function showTut(text, btn) {
  $('#tutP').innerHTML = text.split('|').join('<br>')
  $('#tutB').textContent = T('tutNext'); $('#tutB').hidden = !btn
  $('#tut').hidden = false; $('#tut').classList.toggle('live', !btn); $('#hint').hidden = btn && tutStage === 1
  paused = true
  $('#say').hidden = true
}
$('#tutB').onclick = () => {
  if (tutStage === 1) { tutStage = 2; showTut(T('tut2'), true); return }
  $('#tut').hidden = true; $('#hint').hidden = true; paused = false; tutStage = 3; last = performance.now()
}
function loop(now) {
  raf = requestAnimationFrame(loop)
  const dt = Math.min(0.25, (now - last) / 1000); last = now
  if (paused || !run || dbgPaused) { render(); return }
  acc += dt
  while (acc >= DT) { acc -= DT; step1() }
  render()
}
function step1() {
  if (!run || run.done) return
  // チュートリアル: 最初に先生が白い歯へ向かい、こっちを見た瞬間で止めて教える
  if (tutStage === 3) {
    const e = activeEv(run)
    if (e && e.kind === 'bad' && e.pat === 'A' && dentistPose(run) === 'look' && run.tt < e.contact) { tutStage = 4; showTut(T('tut3'), false); return }
  }
  tick(run)
  for (const k of run.out.splice(0)) cue(k)
  if (run.done) endGame()
}
function cue(k) {
  if (k === 'tray') Snd.play('tray', { vol: 0.7 })
  else if (k === 'drillStart') Snd.play('drillStart', { vol: 0.5, jitter: 0 })
  else if (k === 'gargle') Snd.play('gargle', { vol: 0.8 })
  else if (k === 'spit') Snd.play('spit', { vol: 0.8 })
  else if (k === 'giggle') Snd.play('giggle', { vol: 0.35 })
  else if (k === 'raise') Snd.play('air', { vol: 0.25, rate: 1.4 })
  else if (k === 'stop') { Snd.play('air', { vol: 0.6 }); Snd.duck(0.5, 1.2) }
  else if (k === 'bigesa') Snd.play('tray', { vol: 0.5, rate: 0.8 })
  else if (k === 'gari') { Snd.play('gari', { vol: 1 }); Snd.play('grunt', { vol: 0.6, delay: 0.08 }); flash('gari') }
  else if (k === 'fixed') { Snd.play('fixed', { vol: 0.45 }); flash('fixed') }
}
let flashUntil = 0, flashKind = ''
function flash(kind) { flashKind = kind; flashUntil = run ? run.clock + 0.6 : 0 }
function onHand(e) {
  if (e) e.preventDefault()
  if (!run || run.done) return false
  Snd.init()
  if (tutStage === 4) { $('#tut').hidden = true; $('#hint').hidden = true; paused = false; tutStage = 5; last = performance.now(); try { localStorage.setItem('dh_tut', '1') } catch (e) {} }
  if (paused) return false
  const ok = raise(run)
  if (!ok) { const h = $('#hand'); h.classList.remove('tired'); void h.offsetWidth; h.classList.add('tired') }
  for (const k of run.out.splice(0)) cue(k)
  render()
  return ok
}
$('#bHand').addEventListener('pointerdown', onHand)
window.addEventListener('keydown', e => { if ((e.code === 'Space' || e.key === 'Enter') && !$('#vPlay').hidden) onHand(e) })

// 天井のモニター（口の中カメラ）
const monC = $('#monC')
function sizeMon() { const r = monC.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); if (r.width) { monC.width = Math.round(r.width * dpr); monC.height = Math.round(r.height * dpr) } }
window.addEventListener('resize', () => { if (!$('#vPlay').hidden) sizeMon() })
let monPos = null
function drawMon(r, o) {
  const g = monC.getContext('2d'), w = monC.width, h = monC.height; if (!w) return
  const e = activeEv(r)
  const tgt = e && o.drill ? e.tooth : -1
  // 止められた時はドリルが前の歯へ戻る（見た目だけ滑らかに）
  const home = r.lastTooth >= 0 ? TOOTH[r.lastTooth] : { x: 0.5, y: 0.52 }
  const src = r.clock < r.pauseUntil || !(e && r.tt >= e.a0) ? home : r.pos, want = { x: src.x, y: src.y }
  if (!monPos) monPos = { ...want }
  monPos.x += (want.x - monPos.x) * 0.25; monPos.y += (want.y - monPos.y) * 0.25
  drawMouth(g, 0, 0, w, h, r.teeth, { target: tgt, t: r.clock, drill: inIv(r.S.drill, r.tt) ? monPos : null, jit: o.pitch * 3, spark: o.contact && o.drill, scan: true })
  // 銀歯になった・治った瞬間の光
  if (r.clock < flashUntil) { g.fillStyle = flashKind === 'gari' ? `rgba(230,236,240,${(flashUntil - r.clock) * 0.9})` : `rgba(160,240,210,${(flashUntil - r.clock) * 0.5})`; g.fillRect(0, 0, w, h) }
  // 画面の隅の文字（DOM の文字数には数えない）
  const fs = Math.round(h * 0.085)
  g.font = `700 ${fs}px ui-monospace,Menlo,monospace`; g.fillStyle = '#9fe3cf'; g.textBaseline = 'top'
  g.fillText(T('cam'), w * 0.03, h * 0.04)
  const rem = Math.max(0, r.S.end - r.tt), mm = Math.floor(rem / 60), ss = Math.floor(rem % 60)
  g.textAlign = 'right'; g.fillText(`${T('remain')} ${mm}:${String(ss).padStart(2, '0')}`, w * 0.97, h * 0.04); g.textAlign = 'left'
  g.fillStyle = '#ff5a4a'; g.beginPath(); g.arc(w * 0.03 + g.measureText(T('cam')).width + fs * 0.7, h * 0.04 + fs * 0.5, fs * 0.28 * (Math.sin(r.clock * 4) > 0 ? 1 : 0.4), 0, 7); g.fill()
}

// 描画
const sweats = []
for (let i = 0; i < 4; i++) { const s = document.createElement('div'); s.className = 'sweat'; $('#stage').appendChild(s); sweats.push({ el: s, x: [1, 94, 3, 96][i], y: 0, v: 0 }) }
function setOn(box, k) { box.querySelectorAll('img').forEach(im => im.classList.toggle('on', im.dataset.k === k)) }
let lastSay = '', painVis = 0, gruntAt = 0, lastPose = '', suckOn = false
function render() {
  if (!run) return
  const r = run, o = obs(r), t = r.clock
  if (o.d !== lastPose) { setOn(docEl, o.d); lastPose = o.d }
  docEl.classList.toggle('look', o.d === 'look')
  setOn(asstEl, o.a)
  const dr = $('#drill'); dr.classList.toggle('on', o.drill)
  const jit = o.drill ? (0.8 + o.pitch * 2.6) : 0
  dr.style.transform = `translate(${(Math.sin(t * 91) * jit).toFixed(1)}px,${(Math.cos(t * 77) * jit).toFixed(1)}px)`
  drillSound(o.pitch, o.drill && !paused)
  const suck = !!(o.drill && !paused)
  if (Snd.ctx && suck !== suckOn) { suckOn = suck; Snd.loop('suck', suck ? 'snd/suction.mp3' : null, 0.16, 0.3) }
  // 痛み（演出だけ。勝ち負けはモニターの歯で決まる）
  const target = Math.min(1, r.painNow / 1.8)
  const rdt = Math.max(0, Math.min(1, t - (render.lt || 0))); render.lt = t
  painVis += (target - painVis) * (1 - Math.exp(-rdt * (target > painVis ? 25 : 4)))
  const pv = painVis, tense = Math.max(pv, o.drill ? (o.pitch - 0.25) * 0.4 : 0)
  setOn($('#hand'), r.hand.up ? 'up' : pv > 0.12 ? 'fist' : 'rest')
  $('#hand').classList.toggle('up', r.hand.up)
  $('#hand').style.transform = !r.hand.up && pv > 0.12 ? `translate(${(Math.sin(t * 60) * pv * 3).toFixed(1)}px,0)` : ''
  setOn($('#feet'), pv > 0.3 ? 'curl' : 'rest')
  const c = $('#ceilP')
  c.style.transform = `translate(-50%,-50%) scale(${(1.04 + pv * 0.05).toFixed(3)}) rotate(${(Math.sin(t * 7) * pv * 1.8).toFixed(2)}deg) skewX(${(Math.sin(t * 11) * pv * 2.5).toFixed(2)}deg)`
  c.style.filter = pv > 0.02 ? `blur(${(pv * 1.8).toFixed(2)}px)` : ''
  $('#glow').style.opacity = (0.14 + tense * 0.35 + pv * 0.25 * (0.6 + 0.4 * Math.sin(t * 23))).toFixed(3)
  $('#vig').style.opacity = (pv * 0.85).toFixed(3)
  $('#stage').style.translate = o.drill ? `${(Math.sin(t * 83) * o.pitch * 0.9).toFixed(1)}px 0` : ''
  for (const s of sweats) {
    if (pv > 0.35 && s.y === 0 && Math.random() < 0.02) { s.y = 2 + Math.random() * 6; s.v = 0 }
    if (s.y > 0) { s.v += 0.004; s.y += s.v; if (s.y > 40) s.y = 0 }
    s.el.style.opacity = s.y > 0 ? 0.9 : 0; s.el.style.left = s.x + '%'; s.el.style.top = s.y + '%'
  }
  if (pv > 0.5 && t > gruntAt && !paused) { Snd.play('grunt', { vol: 0.5 }); gruntAt = t + 1.2 + Math.random() }
  // 白い歯へ向かっている時はモニターの縁が光る（見た物で判断できるように）
  $('#mon').classList.toggle('alert', o.tstate === 'ok')
  drawMon(r, o)
  // 台詞（1つ）とドリルの音（1つ）。同時に2つまで
  const sEl = $('#say')
  let sk = '', html = '', cls = ''
  if (!paused || tutStage === 0) {
    if (r.say) { sk = r.say.text + r.say.who; cls = r.say.who; html = (r.say.who === 'k' ? `<small>${lang === 'ja' ? 'となりの子' : 'kid next door'}</small>` : '') + r.say.text.split('|').join('<br>') }
    else if (o.hum) { const hl = D.lines[lang][r.S.boss ? 'bossHum' : 'hum']; const tx = hl[Math.floor(t / 2.6) % hl.length]; sk = 'hum' + tx; cls = 'd hum'; html = tx }
  }
  if (sk !== lastSay) { lastSay = sk; sEl.hidden = !sk; sEl.className = 'say ' + cls; sEl.innerHTML = html }
  const zz = $('#zz')
  if (o.drill && !paused) {
    const w = D.drillWords[lang], i = o.pitch < 0.3 ? 0 : o.pitch < 0.6 ? 1 : o.pitch < 0.99 ? 2 : 3
    if (zz.textContent !== w[i]) zz.textContent = w[i]
    zz.style.opacity = 0.75 + o.pitch * 0.25
    zz.style.fontSize = (14 + o.pitch * 12).toFixed(0) + 'px'
    zz.style.transform = `rotate(${(-8 + Math.sin(t * 40) * o.pitch * 3).toFixed(1)}deg)`
  } else zz.style.opacity = 0
  const blk = blockAt(r, r.tt); $('#stage').classList.toggle('up', !!blk && blk.kind === 'rinse')
}

// ---------------------------------------------------------------- 結果: カルテ（口の中の写真が主役）
let result = null
function endGame() {
  cancelAnimationFrame(raf); drillSound(0, false); Snd.loop('suck', null); suckOn = false
  const r = run, c = tally(r)
  const tt = D.titles[lang][r.titleKey]
  result = { score: r.score, rank: r.rank, raised: r.raised, seen: r.seen, saved: r.saved, ...c, bigesa: r.bigesa, boss: r.S.boss, title: tt[0], note: tt[1], key: r.titleKey, teeth: r.teeth.slice() }
  if (window.TM) TM.end(r.score, true)
  setTimeout(() => { show('vResult'); reveal() }, 700)
}
let revealT = 0, revealRaf = 0
function reveal() {
  const t0 = performance.now(); cancelAnimationFrame(revealRaf)
  let lastStage = -1
  const fr = now => {
    const s = (now - t0) / 1000, stage = s < 0.5 ? 0 : s < 0.9 ? 1 : s < 1.3 ? 2 : s < 1.7 ? 3 : s < 2.1 ? 4 : s < 3.0 ? 5 : 6
    if (stage !== lastStage) {
      lastStage = stage
      if (stage >= 1 && stage <= 4) Snd.play('paper', { vol: 0.7 })
      if (stage === 5) Snd.duck(0.3, 2)
      if (stage === 6) { Snd.play('stamp', { vol: 1, jitter: 0 }); Snd.play(result.rank >= 4 ? 'good' : result.rank >= 3 ? 'mid' : 'bad', { vol: 0.8, delay: 0.15, jitter: 0 }) }
    }
    drawKarte(stage, s)
    revealT = stage
    if (s < 4.0) revealRaf = requestAnimationFrame(fr)
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
function wrapText(g, text, x, y, maxW, lh) {
  const chars = lang === 'ja' ? [...text] : text.split(/(?<= )/)
  let line = '', yy = y
  for (const ch of chars) { if (g.measureText(line + ch).width > maxW && line) { g.fillText(line, x, yy); line = ch.trimStart(); yy += lh } else line += ch }
  if (line) g.fillText(line, x, yy)
}
function drawKarte(stage, s) {
  const cv = $('#karte'), g = cv.getContext('2d'), W = cv.width, H = cv.height, R = result
  const ui = '"BIZ UDPGothic","Hiragino Sans",sans-serif', hand = '"Klee One","Hiragino Mincho ProN",serif'
  g.setTransform(1, 0, 0, 1, 0, 0)
  if (stage === 6 && s < 3.4) { const k = (3.4 - s) * 14; g.translate(Math.sin(s * 90) * k, Math.cos(s * 70) * k * 0.6) }
  g.fillStyle = '#d2cbbb'; g.fillRect(-40, -40, W + 80, H + 80)
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H)
  g.strokeStyle = '#3d8f86'; g.lineWidth = 3; g.strokeRect(28, 28, W - 56, H - 56)
  g.fillStyle = '#245e58'; g.font = `700 46px ${ui}`; g.textBaseline = 'alphabetic'
  g.fillText(T('karte'), 56, 100)
  g.font = `400 24px ${ui}`; g.fillStyle = '#5d6467'; g.textAlign = 'right'; g.fillText(T('clinic') + '  2026.11.07', W - 56, 96); g.textAlign = 'left'
  g.strokeStyle = '#3d8f86'; g.lineWidth = 2; g.beginPath(); g.moveTo(56, 124); g.lineTo(W - 56, 124); g.stroke()
  g.font = `400 26px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(T('kPatient'), 56, 170); g.fillText(T('kDoc'), 420, 170)
  const lw1 = g.measureText(T('kPatient')).width, lw2 = g.measureText(T('kDoc')).width
  g.font = `600 34px ${hand}`; g.fillStyle = '#1f2a44'; g.fillText(T('kYou'), 56 + lw1 + 22, 172); g.fillText(D.names[lang][R.boss ? 'boss' : 'd'], 420 + lw2 + 22, 172, W - 56 - (420 + lw2 + 22))
  // 口の中の写真（主役）
  const mx = 56, my = 196, mw = W - 112, mh = 340
  drawMouth(g, mx, my, mw, mh, R.teeth, {})
  g.strokeStyle = '#2a2f31'; g.lineWidth = 6; g.strokeRect(mx, my, mw, mh)
  // 担当の写真を写真の角に
  const ph = imgCache[`img/${R.boss ? 'director' : 'dentist'}_look.webp?v=2`]
  if (ph && ph.complete && ph.naturalWidth) { const px = W - 56 - 120, py = my + mh - 130; g.save(); g.beginPath(); g.rect(px, py, 112, 124); g.clip(); g.fillStyle = '#e7e1d4'; g.fillRect(px, py, 112, 124); g.drawImage(ph, px - 6, py + 4, 124, 124 * ph.naturalHeight / ph.naturalWidth); g.restore(); g.strokeStyle = '#fbfaf6'; g.lineWidth = 4; g.strokeRect(px, py, 112, 124) }
  // 記録（1行ずつ書かれる）
  const rows = [[T('kKept'), `${R.kept}/${R.H}`], [T('kSilver'), R.silver], [T('kFixed'), R.fixed], [T('kLeft'), R.left]]
  let y = 598
  g.strokeStyle = '#cfc7b7'; g.lineWidth = 1.5
  rows.forEach(([k, v], i) => {
    g.beginPath(); g.moveTo(56, y + 20); g.lineTo(W - 56, y + 20); g.stroke()
    g.font = `400 30px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(k, 64, y)
    if (stage >= i + 1) { g.font = `600 48px ${hand}`; g.fillStyle = i === 1 && R.silver ? '#56606a' : '#1f2a44'; g.textAlign = 'right'; g.fillText(v + T('kTimes'), W - 80, y + 4); g.textAlign = 'left' }
    y += 60
  })
  g.font = `400 26px ${ui}`; g.fillStyle = '#7a6d4a'; g.fillText(T('kKid'), 64, y - 8)
  y += 40
  g.font = `400 26px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(T('kNote'), 56, y)
  if (stage >= 5) { g.font = `600 34px ${hand}`; g.fillStyle = '#1f2a44'; wrapText(g, R.note, 56, y + 48, W - 112 - 290, 46) }
  const sy = H - 158
  g.font = `400 26px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(T('kScore'), 56, sy)
  if (stage >= 6) {
    g.font = `600 84px ${hand}`; g.fillStyle = '#1f2a44'; g.fillText(String(R.score), 56, sy + 80)
    const k = Math.max(1, 1.8 - (s - 3.0) * 4), cx = W - 200, cy = H - 175
    g.save(); g.translate(cx, cy); g.rotate(-0.16); g.scale(k, k)
    g.globalAlpha = 0.88; g.strokeStyle = '#c8322b'; g.fillStyle = '#c8322b'; g.lineWidth = 7
    g.beginPath(); g.arc(0, 0, 135, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 122, 0, 7); g.stroke()
    g.textAlign = 'center'; g.font = `700 24px ${ui}`; g.fillText(T('kTitle'), 0, -70)
    const tl = R.title, long = lang === 'ja' ? tl.length > 6 : tl.length > 12, fs = lang === 'ja' ? (tl.length > 8 ? 34 : tl.length > 6 ? 42 : 52) : (tl.length > 14 ? 28 : 34)
    g.font = `700 ${fs}px ${ui}`
    if (lang === 'ja' && long) { const h2 = Math.ceil(tl.length / 2); g.fillText(tl.slice(0, h2), 0, -4); g.fillText(tl.slice(h2), 0, fs + 2) }
    else if (lang === 'en' && tl.includes(' ')) { const ws = tl.split(' '), h2 = Math.ceil(ws.length / 2); g.fillText(ws.slice(0, h2).join(' '), 0, -4); g.fillText(ws.slice(h2).join(' '), 0, fs + 2) }
    else g.fillText(tl, 0, 18)
    g.restore(); g.textAlign = 'left'; g.globalAlpha = 1
  }
  g.font = `400 22px ${ui}`; g.fillStyle = '#7b8486'; g.fillText('tom3games.github.io/dentist-hand', 56, H - 44)
}
function toast(msg) { const m = $('#rMsg'); m.textContent = msg; m.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { m.hidden = true }, 1600) }
$('#bSave').onclick = async () => {
  drawKarte(6, 9)
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
$('#bHow').onclick = () => { Snd.init(); show('vHow'); drawHowMouth() }
$('#bHowBack').onclick = () => show('vTitle')
$('#bHowGo').onclick = () => { Snd.init(); Snd.play('ok', { vol: 0.5 }); startGame() }
$('#bLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('dh_lang', lang) } catch (e) {} applyLang() }
$('#bSnd').onclick = () => { Snd.init(); setMute(!muted) }
$('#bMute').onclick = e => { e.stopPropagation(); Snd.init(); setMute(!muted) }
document.addEventListener('visibilitychange', () => { if (document.hidden) { drillSound(0, false); last = performance.now() } else last = performance.now() })

// ---------------------------------------------------------------- 検証用の窓口
let dbgPaused = false
window.dh = {
  buildScript, newRun, simulate, obs: () => run && obs(run), BOTS: Object.keys(BOTS), TOOTH, drawMouth, tally: () => run && tally(run),
  get run() { return run }, get result() { return result }, startGame, endGame, show, postUrl, drawKarte,
  setLang: l => { lang = l; applyLang() }, raise: () => onHand(),
  dbg: {
    pause: v => { dbgPaused = v !== false },
    step: n => { for (let i = 0; i < n; i++) { if (paused || !run || run.done) break; step1() } render() },
    to: tt => { let n = 0; while (run && !run.done && run.tt < tt && n++ < 60 * 400) step1(); render() },
    finish: (o = {}) => { const r = run; Object.assign(r, o); finish(r); for (const k of r.out.splice(0)) cue(k); endGame() },
    tutStage: () => tutStage,
  },
}

applyLang(); Snd.setMute(muted)
preload().then(() => {
  setPeople(false)
  show('vTitle')
  window.__dhReady = true
})
})()
