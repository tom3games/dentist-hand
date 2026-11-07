// 痛かったら手を挙げてください（dentist-hand）
// 仕組み: 治療の台本（ドリル・痛みの波・誰がいつこっちを見るか）は種から決まる。乱数で当たり外れを決めない。
// 痛みの前にはドリルの音が上がる。先生がこっちを見る前には鼻歌が止まる。助手は先生を叱った後にこっちを見る。
// 誰かが見ている間に手が上がっていれば気づかれる。痛い時なら止めてくれる。痛くない時なら「大げさ」。
window.__jsUp = true
;(function () {
'use strict'
const D = window.DH_DATA
const $ = s => document.querySelector(s)
const DT = 1 / 60
const WARN = 1.5, PAIN = 2.6, HAND_UP = 1.1, HAND_CD = 0.45, HAND_TIRED = 1.6, CATCH = 0.6   // 気づかれるのは挙げる動きの間（CATCH 秒）だけ。気づかれないと腕が疲れて次まで長い
let lang = (() => { try { return localStorage.getItem('dh_lang') || (/^ja/i.test(navigator.language) ? 'ja' : 'en') } catch (e) { return 'ja' } })()
const T = k => D.ui[lang][k]

// ---------------------------------------------------------------- 乱数
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

// ---------------------------------------------------------------- 台本
// 返す物: blocks（区切り）, spikes（痛みの波）, dLook（先生の向き）, aPose（助手の向き）, lines（台詞）, sfx, end
function buildScript(seed, o = {}) {
  const R = rng(seed), pick = a => a[Math.floor(R() * a.length)]
  const boss = o.boss != null ? o.boss : R() < 0.15
  const S = { seed, boss, blocks: [], spikes: [], dLook: [], aPose: [], lines: [], sfx: [], drill: [], end: 0 }
  const line = (t, who, key, idx) => S.lines.push({ t, who, key, i: idx != null ? idx : Math.floor(R() * 8) })
  const look = (a, b, pose) => S.dLook.push({ a, b, pose })
  const apose = (a, b, pose) => S.aPose.push({ a, b, pose })
  let t = 0
  S.blocks.push({ a: 0, b: 4.2, kind: 'intro' }); look(0.3, 3.6, 'look'); line(0.5, 'd', boss ? 'introBoss' : 'intro')
  t = 4.2
  const plan = ['drill', 'rinse', 'drill', 'chat', 'drill', 'rinse', 'drill', 'outro']
  let nDrill = 0, chatIdx = Math.floor(R() * 3)
  for (const kind of plan) {
    if (kind === 'drill') {
      const L = 19 + R() * 5, a = t, b = t + L
      S.blocks.push({ a, b, kind })
      look(a, a + 1.5, 'away'); line(a + 0.1, 'd', 'tray'); S.sfx.push({ t: a + 0.25, k: 'tray' })
      line(a + 1.6, 'd', 'startDrill')
      S.drill.push({ a: a + 1.7, b: b - 0.6 }); S.sfx.push({ t: a + 1.7, k: 'drillStart' })
      // 痛みの波
      let s = a + 4.2 + R() * 1.5, first = true
      const gaps = []; let lastEnd = a + 2.2
      while (s + WARN + PAIN < b - 1.6) {
        const w0 = s, p0 = s + WARN, p1 = p0 + PAIN
        const I = (boss ? 1.45 : 1) * pick([1, 1.5, 2])
        let pat
        if (o.tutorial && nDrill === 0 && first) pat = 'A'
        else { const r = R(), wA = boss ? 0.36 : 0.28, wB = boss ? 0.3 : 0.27, wC = boss ? 0.14 : 0.27; pat = r < wA ? 'A' : r < wA + wB ? 'B' : r < wA + wB + wC ? 'C' : 'D' }
        S.spikes.push({ w0, p0, p1, I, pat })
        gaps.push([lastEnd, w0 - 1.6])
        if (pat === 'A') { look(w0 + 0.35, w0 + 1.95, 'look'); line(w0 + 0.4, 'd', 'checkWarn') }
        else if (pat === 'B') { apose(p0 - 1.35, p0 - 0.15, 'glare'); line(p0 - 1.35, 'a', boss ? 'scoldBoss' : 'scold'); apose(p0 + 0.25, p0 + 1.85, 'look') }
        else if (pat === 'D') { look(p1 + 0.4, p1 + 2.0, 'look'); line(p1 + 0.45, 'd', 'checkLate') }
        lastEnd = pat === 'D' ? p1 + 2.6 : p1 + 0.8
        s = Math.max(p1 + 3.2, lastEnd + 1.2) + R() * 3
        first = false
      }
      gaps.push([lastEnd, b - 1])
      // 何もない時の「見る」（罠）。痛みの前後1.6秒は避ける
      for (const [g0, g1] of gaps) {
        if (g1 - g0 < 3.4 || R() < 0.35) continue
        const m = g0 + 0.9 + R() * (g1 - g0 - 3.2)
        if (R() < (boss ? 0.75 : 0.6)) { look(m, m + 1.6, 'look'); line(m + 0.05, 'd', boss ? 'bossHum' : 'checkSafe') }
        else apose(m, m + 1.6, 'look')
      }
      nDrill++; t = b
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
    S, seed, clock: 0, tt: 0, pauseUntil: 0, lineIdx: 0, sfxIdx: 0,
    hand: { up: false, t0: 0, seen: false, cdUntil: 0 },
    anes: 1, escal: 1, ignore: false, bigesa: 0, raised: 0, seen: 0, hurt: 0, avoided: 0, stops: 0, pain: 0, painNow: 0,
    force: { d: null, a: null }, say: null, sayQ: [], humQuiet: 0, events: [], done: false, out: [], tutorial: !!o.tutorial,
  }
}
const inIv = (arr, t) => { for (const x of arr) if (t >= x.a && t < x.b) return x; return null }
function blockAt(run, t) { return inIv(run.S.blocks, t) }
function drillOn(run) { return run.clock >= run.pauseUntil && !!inIv(run.S.drill, run.tt) }
function activeSpike(run) {
  for (const sp of run.S.spikes) { if (sp.canceled || sp.done) continue; if (run.tt >= sp.w0 && run.tt < sp.p1) return sp; if (sp.w0 > run.tt) break }
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
  for (const l of run.S.aPose) if (l.pose === 'glare' && run.tt >= l.a - 0.1 && run.tt < l.b + 4) return false
  return true
}
function pitch(run) {
  if (!drillOn(run)) return 0
  const sp = activeSpike(run)
  if (!sp) return 0.25
  if (run.tt < sp.p0) return 0.25 + 0.75 * (run.tt - sp.w0) / WARN
  return 1
}
function say(run, who, key, idx) {
  const arr = D.lines[lang][key]; if (!arr) return
  const text = arr[(idx != null ? idx : Math.floor(Math.random() * arr.length)) % arr.length]
  const n = text.replace(/\|/g, '').length
  run.say = { who, key, text, until: run.clock + Math.max(1.4, 0.9 + 0.09 * n) }
  run.events.push({ t: run.clock, ev: 'say', who, key })
}
function out(run, k) { run.out.push(k) }   // 音などの合図（描画側が拾う）

function raise(run) {
  const h = run.hand
  if (run.done || h.up || run.clock < h.cdUntil) return false
  h.up = true; h.t0 = run.clock; h.seen = false; run.raised++
  const sp = activeSpike(run); if (sp) sp.raisedDuring = true
  run.events.push({ t: run.clock, ev: 'raise', tt: run.tt, spike: !!sp })
  out(run, 'raise')
  return true
}
// 気づいた時の反応
function notice(run, by) {
  const h = run.hand; h.seen = true; run.seen++
  run.events.push({ t: run.clock, ev: 'seen', by })
  if (by === 'a') {
    say(run, 'a', 'seenByA'); run.force.a = { pose: 'glare', until: run.clock + 0.9 }
    run.pending = { at: run.clock + 0.55, fn: () => dentistReact(run, true) }
  } else dentistReact(run, false)
}
function dentistReact(run, viaA) {
  const sp = activeSpike(run), blk = blockAt(run, run.tt)
  if (sp && drillOn(run)) {
    if (run.ignore) { say(run, 'd', viaA ? 'ignoreA' : 'fa3'); return }
    const warn = run.tt < sp.p0
    sp.canceled = true; run.stops++; if (warn) run.avoided++
    run.pauseUntil = run.clock + 2.6
    run.force.d = { pose: 'look', until: run.clock + 2.4 }
    say(run, 'd', warn ? 'stopWarn' : 'stopPain')
    run.anes = Math.max(0.5, run.anes * 0.8)
    run.pending = { at: run.clock + 1.5, fn: () => say(run, 'd', 'anes') }
    out(run, 'stop')
  } else {
    // 痛くないのに挙げた
    run.bigesa++
    out(run, 'bigesa')
    const chat = blk && blk.kind === 'chat'
    if (run.bigesa === 1) say(run, 'd', chat ? 'faChat' : 'fa1')
    else if (run.bigesa === 2) { say(run, 'd', chat ? 'faChat' : 'fa2'); run.anes = Math.min(1.8, run.anes * 1.3); run.pending = { at: run.clock + 1.6, fn: () => say(run, 'd', 'faRough') } }
    else { say(run, 'd', chat ? 'faChat' : 'fa3'); if (!run.S.boss) run.ignore = true; else run.anes = Math.min(1.8, run.anes * 1.1) }
  }
}

// 1コマ進める（固定 1/60 秒）
function tick(run) {
  if (run.done) return
  run.clock += DT
  const paused = run.clock < run.pauseUntil
  if (!paused) run.tt += DT
  if (run.pending && run.clock >= run.pending.at) { const f = run.pending.fn; run.pending = null; f() }
  // 台本の台詞と音
  const S = run.S
  while (run.lineIdx < S.lines.length && S.lines[run.lineIdx].t <= run.tt) {
    const l = S.lines[run.lineIdx++]
    if (run.say && run.say.until > run.clock && ['stopPain', 'stopWarn', 'anes', 'fa2', 'faRough', 'seenByA'].includes(run.say.key)) continue   // 反応の台詞を上書きしない
    say(run, l.who, l.key, l.i)
    if (l.key.startsWith('scold')) run.humQuiet = run.clock + 5
  }
  while (run.sfxIdx < S.sfx.length && S.sfx[run.sfxIdx].t <= run.tt) out(run, S.sfx[run.sfxIdx++].k)
  // 痛み
  run.painNow = 0
  if (!paused) {
    for (const sp of S.spikes) {
      if (sp.done || sp.canceled) continue
      if (sp.w0 > run.tt) break
      if (run.tt >= sp.p0 && run.tt < sp.p1) { const v = sp.I * run.anes * run.escal; run.painNow = v; run.pain += v * DT; sp.acc = (sp.acc || 0) + v * DT }
      if (run.tt >= sp.p1) {
        sp.done = true
        if ((sp.acc || 0) >= 1) run.hurt++
        if (!sp.raisedDuring) { run.escal = Math.min(2.6, run.escal * 1.16); if (!run.say || run.say.until < run.clock) say(run, 'd', 'escal') }
      }
    }
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
      if (!h.seen && activeSpike(run) && drillOn(run)) say(run, 'd', 'notSeen')
    }
  }
  if (run.say && run.say.until <= run.clock) run.say = null
  if (run.tt >= S.end && !paused) finish(run)
}
function finish(run) {
  run.done = true
  const pain = run.pain
  run.score = Math.max(0, Math.min(100, Math.round(100 - pain * 1.5 - Math.min(3, run.bigesa) * 5 + run.avoided * 2)))
  let tk
  if (run.raised === 0) tk = 'stone'
  else if (run.bigesa >= 3) tk = 'wolf'
  else if (run.score >= 85) tk = run.avoided >= 3 ? 'seer' : 'top'
  else if (run.score >= 70) tk = run.avoided >= 3 ? 'seer' : 'good'
  else if (run.score >= 55) tk = 'mid'
  else if (run.score >= 35) tk = 'endure'
  else tk = 'ceiling'
  run.titleKey = tk
  run.rank = run.score >= 85 ? 5 : run.score >= 70 ? 4 : run.score >= 55 ? 3 : run.score >= 35 ? 2 : 1
  if (run.raised === 0) run.rank = Math.min(run.rank, 1)
  out(run, 'end')
}
// 見て分かることだけを返す（bot と検証用）
function obs(run) {
  return { pitch: +pitch(run).toFixed(3), drill: drillOn(run), d: dentistPose(run), a: assistPose(run), hum: humming(run), say: run.say && run.say.who, handUp: run.hand.up, ready: !run.hand.up && run.clock >= run.hand.cdUntil, clock: run.clock }
}

// ---------------------------------------------------------------- bot（sim と検証用。人の反応速度 0.4 秒）
const BOTS = {
  none: () => () => false,
  spam: () => o => o.ready,
  random: seed => { const R = rng(seed ^ 0x9e37); let next = 0; return o => { if (o.clock < next) return false; next = o.clock + 1; return R() < 0.3 } },
  looker: () => o => o.ready && (o.d === 'look' || o.a === 'look'),
  painOnly: () => o => o.ready && o.drill && o.pitch > 0.5,
  reader: () => {
    let humWas = -9, painSince = -1, glareAt = -9
    return o => {
      if (o.hum) humWas = o.clock
      if (o.a === 'glare') glareAt = o.clock
      const danger = o.drill && o.pitch > 0.5
      if (o.pitch >= 0.99) { if (painSince < 0) painSince = o.clock } else painSince = -1
      if (!danger || !o.ready) return false
      const lookNow = o.d === 'look' || o.a === 'look'
      // 鼻歌が止まった＝もうすぐ顔を上げる。ただし助手に叱られて止まった時は、助手がこっちを向くのを待つ
      const cue = o.d === 'down' && !o.hum && o.clock - humWas < 1.2 && o.clock - glareAt > 4
      if (o.clock - glareAt < 3 && !lookNow) return false
      if (lookNow || cue) return true
      return painSince > 0 && o.clock - painSince > 1.4   // 見られないまま痛い時は、黙って耐えない
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
  return { bot: botName, seed, score: run.score, rank: run.rank, title: run.titleKey, raised: run.raised, seen: run.seen, hurt: run.hurt, avoided: run.avoided, bigesa: run.bigesa, pain: +run.pain.toFixed(1), boss: run.S.boss, len: +run.clock.toFixed(1) }
}

// ================================================================ 画面
const views = ['vLoad', 'vTitle', 'vHow', 'vPlay', 'vResult']
function show(id) { for (const v of views) $('#' + v).hidden = v !== id; if (id === 'vResult') fitKarte() }
function applyLang() {
  document.documentElement.lang = lang
  document.querySelectorAll('[data-t]').forEach(el => { const v = T(el.dataset.t); if (typeof v === 'string') el.textContent = v })
  $('#howList').innerHTML = T('howRows').map(([a, b]) => `<li><i></i><b>${a}</b><span>${b}</span></li>`).join('')
  $('#howWho').innerHTML = lang === 'ja' ? '鼻歌の先生・厳しい助手<br>たまに院長（やさしいが一番痛い）' : 'Humming dentist, strict nurse<br>rare head dentist (kindest, hurts most)'
  $('#monL').textContent = T('remain')
  sndLabel()
}
let muted = (() => { try { return localStorage.getItem('dh_mute') === '1' } catch (e) { return false } })()
function sndLabel() { $('#bSnd').textContent = `${T('sound')}: ${muted ? T('off') : T('on')}`; $('#bMute').textContent = muted ? '×' : T('mute'); $('#bMute').classList.toggle('off', muted) }
function setMute(m) { muted = m; try { localStorage.setItem('dh_mute', m ? '1' : '0') } catch (e) {} Snd.setMute(m); sndLabel() }

// 音
Snd.def({
  drillStart: 'snd/drill_start.mp3', tray: ['snd/tray1.mp3', 'snd/tray2.mp3', 'snd/tray3.mp3'], air: 'snd/air.mp3',
  gargle: ['snd/gargle1.mp3', 'snd/gargle2.mp3'], spit: ['snd/spit1.mp3', 'snd/spit2.mp3'], grunt: ['snd/grunt1.mp3', 'snd/grunt2.mp3', 'snd/grunt3.mp3'],
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
const IMGS = ['bg', 'dentist_down', 'dentist_look', 'dentist_away', 'director_down', 'director_look', 'director_away', 'assistant_look', 'assistant_glare', 'assistant_away', 'hand_rest', 'hand_fist', 'hand_up', 'feet_rest', 'feet_curl', 'drill'].map(n => `img/${n}.webp?v=1`)
const SNDS = Object.values(Snd.files).flat()
const imgCache = {}
function preload() {
  let done = 0; const total = IMGS.length + SNDS.length
  const bump = () => { done++; $('#loadBar i').style.width = Math.round(done / total * 100) + '%' }
  const ps = IMGS.map(u => new Promise(ok => { const im = new Image(); im.onload = im.onerror = () => { bump(); ok() }; im.src = u; imgCache[u] = im }))
  const ss = SNDS.map(u => fetch(u).then(r => r.arrayBuffer()).catch(() => {}).then(bump))
  return Promise.race([Promise.all(ps.concat(ss)), new Promise(ok => setTimeout(ok, 12000))])
}

// ---------------------------------------------------------------- 遊ぶ
let run = null, raf = 0, last = 0, acc = 0, paused = false, tutStage = 0
const docEl = $('#doc'), asstEl = $('#asst')
function setPeople(boss) {
  const who = boss ? 'director' : 'dentist'
  docEl.querySelectorAll('img').forEach(im => { im.src = `img/${who}_${im.dataset.k}.webp?v=1` })
}
function tutDone() { try { return localStorage.getItem('dh_tut') === '1' } catch (e) { return false } }
function startGame(o = {}) {
  Snd.init(); startAmbience()
  const seed = o.seed != null ? o.seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0
  const tutorial = o.tutorial != null ? o.tutorial : !tutDone()
  run = newRun(seed, { tutorial, boss: o.boss })
  setPeople(run.S.boss)
  $('#stage').classList.remove('up')
  show('vPlay')
  if (window.TM) TM.start()
  tutStage = 0; paused = false; $('#tut').hidden = true; $('#hint').hidden = true
  if (tutorial) { tutStage = 1; showTut(T('tut1'), true) }
  last = performance.now(); acc = 0
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop)
  render()
}
function showTut(text, btn) {
  $('#tutP').innerHTML = text.split('|').join('<br>')
  $('#tutB').textContent = T('tutNext'); $('#tutB').hidden = !btn
  $('#tut').hidden = false; $('#tut').classList.toggle('live', !btn); $('#hint').hidden = false
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
  // チュートリアル: 最初の「痛みの前に先生が見る」瞬間で止めて教える
  if (tutStage === 3) {
    const sp = activeSpike(run)
    if (sp && sp.pat === 'A' && dentistPose(run) === 'look' && run.tt < sp.p0) { tutStage = 4; showTut(T('tut3'), false); return }
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
}
// 手を挙げる
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

// 描画
const sweats = []
for (let i = 0; i < 4; i++) { const s = document.createElement('div'); s.className = 'sweat'; $('#stage').appendChild(s); sweats.push({ el: s, x: [1, 94, 3, 96][i], y: 0, v: 0 }) }
function setOn(box, k) { box.querySelectorAll('img').forEach(im => im.classList.toggle('on', im.dataset.k === k)) }
let lastSay = '', painVis = 0, gruntAt = 0, lastPose = '', suckOn = false
function render() {
  if (!run) return
  const r = run, o = obs(r), t = r.clock
  // 人
  if (o.d !== lastPose) { setOn(docEl, o.d); lastPose = o.d }
  docEl.classList.toggle('look', o.d === 'look')
  setOn(asstEl, o.a)
  // ドリル
  const dr = $('#drill'); dr.classList.toggle('on', o.drill)
  const jit = o.drill ? (0.8 + o.pitch * 2.6) : 0
  dr.style.transform = `translate(${(Math.sin(t * 91) * jit).toFixed(1)}px,${(Math.cos(t * 77) * jit).toFixed(1)}px)`
  drillSound(o.pitch, o.drill && !paused)
  const suck = !!(o.drill && !paused)
  if (Snd.ctx && suck !== suckOn) { suckOn = suck; Snd.loop('suck', suck ? 'snd/suction.mp3' : null, 0.16, 0.3) }
  // 痛み（バーにしない: 手・足の指・天井・汗・明かり）
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
  // 天井のモニター: のこり時間
  const rem = Math.max(0, r.S.end - r.tt), mm = Math.floor(rem / 60), ss = Math.floor(rem % 60)
  $('#monT').textContent = `${mm}:${String(ss).padStart(2, '0')}`
  // うがいの時は椅子が起きる
  const blk = blockAt(r, r.tt); $('#stage').classList.toggle('up', !!blk && blk.kind === 'rinse')
}

// ---------------------------------------------------------------- 結果: カルテ
let result = null
function endGame() {
  cancelAnimationFrame(raf); drillSound(0, false); Snd.loop('suck', null); suckOn = false
  const r = run
  const tt = D.titles[lang][r.titleKey]
  result = { score: r.score, rank: r.rank, raised: r.raised, seen: r.seen, hurt: r.hurt, avoided: r.avoided, bigesa: r.bigesa, boss: r.S.boss, title: tt[0], note: tt[1], key: r.titleKey }
  if (window.TM) TM.end(r.score, true)
  setTimeout(() => { show('vResult'); reveal() }, 700)
}
let revealT = 0, revealRaf = 0
function reveal() {
  const t0 = performance.now(); cancelAnimationFrame(revealRaf)
  let lastStage = -1
  const fr = now => {
    const s = (now - t0) / 1000, stage = s < 0.5 ? 0 : s < 1.1 ? 1 : s < 1.7 ? 2 : s < 2.3 ? 3 : s < 3.3 ? 4 : 5
    if (stage !== lastStage) {
      lastStage = stage
      if (stage >= 1 && stage <= 3) Snd.play('paper', { vol: 0.7 })
      if (stage === 4) Snd.duck(0.3, 2)
      if (stage === 5) { Snd.play('stamp', { vol: 1, jitter: 0 }); Snd.play(result.rank >= 4 ? 'good' : result.rank >= 3 ? 'mid' : 'bad', { vol: 0.8, delay: 0.15, jitter: 0 }) }
    }
    drawKarte(stage, s)
    revealT = stage
    if (s < 4.2) revealRaf = requestAnimationFrame(fr)
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
  // ハンコの衝撃で少し揺れる
  if (stage === 5 && s < 3.6) { const k = (3.6 - s) * 14; g.translate(Math.sin(s * 90) * k, Math.cos(s * 70) * k * 0.6) }
  g.fillStyle = '#d2cbbb'; g.fillRect(-40, -40, W + 80, H + 80)
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H)
  // 罫線
  g.strokeStyle = '#3d8f86'; g.lineWidth = 3; g.strokeRect(28, 28, W - 56, H - 56)
  g.fillStyle = '#245e58'; g.font = `700 46px ${ui}`; g.textBaseline = 'alphabetic'
  g.fillText(T('karte'), 56, 100)
  g.font = `400 24px ${ui}`; g.fillStyle = '#5d6467'; g.textAlign = 'right'; g.fillText(T('clinic') + '  2026.11.07', W - 56, 96); g.textAlign = 'left'
  g.strokeStyle = '#3d8f86'; g.lineWidth = 2; g.beginPath(); g.moveTo(56, 124); g.lineTo(W - 56, 124); g.stroke()
  g.font = `400 26px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(T('kPatient'), 56, 170); g.fillText(T('kDoc'), 420, 170)
  const lw1 = g.measureText(T('kPatient')).width, lw2 = g.measureText(T('kDoc')).width
  g.font = `600 34px ${hand}`; g.fillStyle = '#1f2a44'; g.fillText(T('kYou'), 56 + lw1 + 22, 172); g.fillText(D.names[lang][R.boss ? 'boss' : 'd'], 420 + lw2 + 22, 172, W - 56 - (420 + lw2 + 22))
  // 担当の写真
  const ph = imgCache[`img/${R.boss ? 'director' : 'dentist'}_look.webp?v=1`]
  if (ph && ph.complete && ph.naturalWidth) { g.save(); g.beginPath(); g.rect(W - 196, 190, 140, 160); g.clip(); g.fillStyle = '#e7e1d4'; g.fillRect(W - 196, 190, 140, 160); g.drawImage(ph, W - 196 - 8, 196, 156, 156 * ph.naturalHeight / ph.naturalWidth); g.restore(); g.strokeStyle = '#9aa4a6'; g.lineWidth = 2; g.strokeRect(W - 196, 190, 140, 160) }
  // 歯式（上下8本ずつ）
  const tx = 56, ty = 205, cw = 34, chh = 52
  g.strokeStyle = '#7b8486'; g.lineWidth = 1.5; g.font = `400 20px ${ui}`; g.fillStyle = '#5d6467'; g.textAlign = 'center'
  for (let row = 0; row < 2; row++) for (let i = 0; i < 16; i++) {
    const x = tx + i * cw + (i >= 8 ? 10 : 0), y = ty + row * chh
    g.strokeRect(x, y, cw, chh); g.fillText(String(i < 8 ? 8 - i : i - 7), x + cw / 2, y + 34)
  }
  // 治療した歯に印
  g.strokeStyle = '#c8322b'; g.lineWidth = 3; const bx = tx + 3 * cw, by = ty + chh; g.beginPath(); g.arc(bx + cw / 2, by + chh / 2, 20, 0, 7); g.stroke()
  g.textAlign = 'left'
  // 記録（1行ずつ書かれる）
  const rows = [[T('kRaised'), R.raised], [T('kSeen'), R.seen], [T('kHurt'), R.hurt]]
  let y = 410
  g.strokeStyle = '#cfc7b7'; g.lineWidth = 1.5
  rows.forEach(([k, v], i) => {
    g.beginPath(); g.moveTo(56, y + 22); g.lineTo(W - 56, y + 22); g.stroke()
    g.font = `400 30px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(k, 64, y)
    if (stage >= i + 1) { g.font = `600 52px ${hand}`; g.fillStyle = '#1f2a44'; g.textAlign = 'right'; g.fillText(v + T('kTimes'), W - 80, y + 4); g.textAlign = 'left' }
    y += 92
  })
  // となりの子との比較（小さく）
  g.font = `400 27px ${ui}`; g.fillStyle = '#7a6d4a'; g.fillText(T('kKid'), 64, y - 18)
  // 所見（先生の一言）
  y += 30
  g.font = `400 26px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(T('kNote'), 56, y)
  if (stage >= 4) { g.font = `600 36px ${hand}`; g.fillStyle = '#1f2a44'; wrapText(g, R.note, 56, y + 56, W - 120, 50) }
  // 伝わり度とハンコ（最後に発表）
  const sy = H - 250
  g.font = `400 26px ${ui}`; g.fillStyle = '#5d6467'; g.fillText(T('kScore'), 56, sy)
  if (stage >= 5) {
    g.font = `600 110px ${hand}`; g.fillStyle = '#1f2a44'; g.fillText(String(R.score), 56, sy + 112); const sw = g.measureText(String(R.score)).width
    g.font = `600 40px ${hand}`; g.fillText('%', 64 + sw, sy + 110)
    // ハンコ
    const k = Math.max(1, 1.8 - (s - 3.3) * 4), cx = W - 220, cy = H - 200
    g.save(); g.translate(cx, cy); g.rotate(-0.16); g.scale(k, k)
    g.globalAlpha = 0.88; g.strokeStyle = '#c8322b'; g.fillStyle = '#c8322b'; g.lineWidth = 7
    g.beginPath(); g.arc(0, 0, 150, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 136, 0, 7); g.stroke()
    g.textAlign = 'center'; g.font = `700 26px ${ui}`; g.fillText(T('kTitle'), 0, -78)
    const tl = R.title, fs = lang === 'ja' ? (tl.length > 6 ? 46 : 58) : (tl.length > 12 ? 30 : 38)
    g.font = `700 ${fs}px ${ui}`
    if (lang === 'ja' && tl.length > 5) { const h = Math.ceil(tl.length / 2); g.fillText(tl.slice(0, h), 0, -4); g.fillText(tl.slice(h), 0, fs + 2) }
    else { const ws = tl.split(' '); if (ws.length > 1 && lang === 'en') { const h = Math.ceil(ws.length / 2); g.fillText(ws.slice(0, h).join(' '), 0, -4); g.fillText(ws.slice(h).join(' '), 0, fs + 2) } else g.fillText(tl, 0, 20) }
    g.restore(); g.textAlign = 'left'; g.globalAlpha = 1
  }
  g.font = `400 24px ${ui}`; g.fillStyle = '#7b8486'; g.fillText('tom3games.github.io/dentist-hand', 56, H - 44)
}
// 保存・ポスト
function toast(msg) { const m = $('#rMsg'); m.textContent = msg; m.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { m.hidden = true }, 1600) }
$('#bSave').onclick = async () => {
  drawKarte(5, 9)
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

// ---------------------------------------------------------------- タイトル・遊び方
$('#bStart').onclick = () => { Snd.init(); Snd.play('ok', { vol: 0.5 }); startGame() }
$('#bHow').onclick = () => { Snd.init(); show('vHow') }
$('#bHowBack').onclick = () => show('vTitle')
$('#bHowGo').onclick = () => { Snd.init(); Snd.play('ok', { vol: 0.5 }); startGame() }
$('#bLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('dh_lang', lang) } catch (e) {} applyLang() }
$('#bSnd').onclick = () => { Snd.init(); setMute(!muted) }
$('#bMute').onclick = e => { e.stopPropagation(); Snd.init(); setMute(!muted) }
document.addEventListener('visibilitychange', () => { if (document.hidden) { drillSound(0, false); last = performance.now() } else last = performance.now() })

// ---------------------------------------------------------------- 検証用の窓口
let dbgPaused = false
window.dh = {
  buildScript, newRun, simulate, obs: () => run && obs(run), BOTS: Object.keys(BOTS),
  get run() { return run }, get result() { return result }, startGame, endGame, show, postUrl, drawKarte,
  setLang: l => { lang = l; applyLang() }, raise: () => onHand(),
  dbg: {
    pause: v => { dbgPaused = v !== false },
    step: n => { for (let i = 0; i < n; i++) { if (paused || !run || run.done) break; step1() } render() },
    // 台本の時間 tt まで進める（チュートリアルは飛ばす）
    to: tt => { let n = 0; while (run && !run.done && run.tt < tt && n++ < 60 * 400) step1(); render() },
    finish: (o = {}) => { const r = run; Object.assign(r, o); finish(r); for (const k of r.out.splice(0)) cue(k); endGame() },
    tutStage: () => tutStage,
  },
}

// ---------------------------------------------------------------- 起動
applyLang(); Snd.setMute(muted)
preload().then(() => {
  setPeople(false)
  show('vTitle')
  window.__dhReady = true
})
})()
