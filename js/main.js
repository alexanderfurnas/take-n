'use strict';
/* =====================================================================
   TAKE-N — scenes, HUD, CPU AI, main loop
   ===================================================================== */

const G = {
  scene: 'title', t: 0, mode: '', menu: 0, idle: 0, help: false,
  fighters: [], projs: [], fx: [], camX: (STAGE_W - W) / 2, shake: 0, hitstop: 0, slow: 0, superFreeze: null,
  fightActive: false, phase: '', phaseT: 0, round: 1, timer: 60, timerF: 0, stage: 'election',
  sel: [0, 1], selLock: [false, false], selStep: 0, infoIdx: 0, sceneT: 0,
  arcade: null, cpuLevel: 4, diff: 0, cpuDmg: 1, showKeys: true, paused: false, pauseIdx: 0, vs: null, result: null, inp: [blankInput(), blankInput()],
};
const ok = ip => ip.lp || ip.start;
// EASY is the default: friends picking this up cold should be able to win
const DIFFS = [
  { name: 'EASY', base: 0.4, step: 0.5, vscpu: 1.2, dmg: 0.7 },
  { name: 'NORMAL', base: 2, step: 1.3, vscpu: 4.5, dmg: 1 },
  { name: 'HARD', base: 4.5, step: 1.1, vscpu: 7.5, dmg: 1.1 },
];
function go(scene) {
  G.scene = scene; G.sceneT = 0;
  const music = { title: 'title', select: 'select', vs: 'select', result: 'win', ending: 'win', cont: null }[scene];
  if (music !== undefined && SFX.songName !== music) SFX.music(music);
}

// ---------------------------------------------------------------- CPU AI
function cpuInput(f, o) {
  const inp = blankInput();
  if (!G.fightActive) return inp;
  const ai = f.ai, L = f.cpuLevel || 4;
  ai.cd = (ai.cd || 0) - 1;
  const dist = Math.abs(o.x - f.x), F = f.facing > 0 ? 'r' : 'l', B = f.facing > 0 ? 'l' : 'r';
  const can = f.state === 'idle' || f.state === 'crouch' || f.state === 'dash';
  if (f.state === 'jump') { if (!f.airAttacked && dist < 60 && f.vy < 1 && Math.random() < 0.35) inp.rk = true; return inp; }
  if (f.state === 'attack') {
    if (f.hasHit && f.move && f.move.normal && !f.move.air && Math.random() < 0.06 * L) {
      if (f.meter >= 100 && Math.random() < 0.5) inp.sup = true; else if (Math.random() < 0.5) inp.special = 0; else inp.rk = true;
    }
    return inp;
  }
  if (!can && f.state !== 'block') return inp;
  if (f.meter >= 100 && can && dist < 200 && Math.random() < 0.008 * L) { inp.sup = true; return inp; }
  // threats
  let threat = null;
  if (o.state === 'attack' && o.move && o.move.box && o.mf < o.move.su + o.move.ac && dist < 90) threat = { lvl: o.move.lvl, id: 'm' + o.moveId, unbl: o.move.unblockable };
  if (!threat) for (const p of G.projs) {
    if (p.owner !== o || p.dead) continue;
    const dx = f.x - p.x;
    if (Math.abs(dx) < 120 && (p.vx === 0 || Math.sign(dx) === Math.sign(p.vx))) { threat = { lvl: p.lvl, id: 'p' + p.id, proj: true }; break; }
  }
  if (threat) {
    if (ai.tid !== threat.id) { ai.tid = threat.id; ai.react = Math.random() < 0.12 + L * 0.11; ai.jump = threat.proj && Math.random() < 0.2; }
    if (ai.react && !threat.unbl) {
      if (ai.jump && can) { inp.u = true; inp[F] = true; ai.react = false; return inp; }
      inp[B] = true; if (threat.lvl === 'low') inp.d = true; ai.hold = 8; ai.holdLow = threat.lvl === 'low'; return inp;
    }
  }
  if (ai.hold > 0) { ai.hold--; inp[B] = true; if (ai.holdLow) inp.d = true; return inp; }
  if (!can) return inp;
  // juggle / punish
  if (o.state === 'air' && dist < 55 && o.y < 70 && Math.random() < 0.12 * L) { inp[pick(['lp', 'rp', 'rk'])] = true; return inp; }
  if (o.state === 'attack' && o.move && o.mf >= o.move.su + o.move.ac && dist < 50 && Math.random() < 0.05 * L) { inp.d = true; inp.rp = true; return inp; }
  if (ai.cd > 0) {
    if (ai.plan === 'fwd') inp[F] = true; else if (ai.plan === 'back' || ai.plan === 'guard') inp[B] = true;
    if (ai.plan === 'guard' && Math.random() < 0.3) inp.d = true;
    return inp;
  }
  ai.cd = Math.max(5, rndi(10, 34) - L * 2);
  const wait = Math.max(0, 5 - L * 1.5);
  let opts;
  if (dist > 150) opts = [['fwd', 5], ['proj', 1 + L * 0.5], ['dash', 2], ['jump', 0.6], ['wait', wait]];
  else if (dist > 62) opts = [['fwd', 4], ['proj', 0.5 + L * 0.2], ['dash', 2.5], ['jump', 0.9], ['sp1', 0.3 + L * 0.15], ['rk', 0.5], ['guard', 1], ['wait', wait]];
  else opts = [['lp', 3], ['rp', 2], ['lk', 2], ['rk', 2], ['dlk', 1.2], ['drk', 1.2], ['drp', 0.3 + L * 0.15], ['throw', 0.3 + L * 0.2], ['sp1', 0.3 + L * 0.2], ['back', 1], ['guard', 1.2 + L * 0.2], ['jump', 0.3], ['wait', wait * 1.5]];
  const act = weighted(opts);
  ai.plan = null;
  switch (act) {
    case 'fwd': case 'back': case 'guard': ai.plan = act; inp[act === 'fwd' ? F : B] = true; break;
    case 'dash': inp.dash = 1; break;
    case 'wait': ai.cd += rndi(10, 30); break;
    case 'jump': inp.u = true; inp[F] = true; break;
    case 'proj': inp.special = 0; break;
    case 'sp1': inp.special = 1; break;
    case 'throw': inp.thr = true; break;
    case 'dlk': inp.d = true; inp.lk = true; break;
    case 'drk': inp.d = true; inp.rk = true; break;
    case 'drp': inp.d = true; inp.rp = true; break;
    default: inp[act] = true;
  }
  return inp;
}

// ---------------------------------------------------------------- match flow
function startMatch(d1, d2, c1, c2, stage) {
  if (d1 === d2) d2 = altDef(d2);
  const a = new Fighter(d1, 0, c1), b = new Fighter(d2, 1, c2);
  a.opp = b; b.opp = a;
  a.cpuLevel = b.cpuLevel = G.cpuLevel;
  G.fighters = [a, b]; G.stage = stage || d2.stage; G.round = 1; G.paused = false;
  G.cpuDmg = G.mode === 'demo' ? 1 : DIFFS[G.diff].dmg;
  startRound(); go('fight'); SFX.music(pick(['fight', 'fight2']));
}
function startRound() {
  for (const f of G.fighters) { f.resetRound(); f.state = 'intro'; }
  G.projs = []; G.fx = []; G.phase = 'intro'; G.phaseT = 0; G.timer = 60; G.timerF = 0;
  G.fightActive = false; G.superFreeze = null; G.hitstop = 0; G.slow = 0; G.shake = 0; G.camX = (STAGE_W - W) / 2;
}
function endRound(kind) {
  const [a, b] = G.fighters;
  G.phase = 'end'; G.phaseT = 0; G.fightActive = false; G.superFreeze = null;
  let w = null; if (a.hp > b.hp) w = a; else if (b.hp > a.hp) w = b;
  G.roundWinner = w;
  if (w) w.wins++; else if (a.wins < 1 || b.wins < 1) { a.wins++; b.wins++; }
  G.endText = kind === 'ko' ? (a.hp <= 0 && b.hp <= 0 ? 'DOUBLE RATIO' : "RATIO'D!") : 'TIME!';
  G.perfect = !!(w && w.hp === MAXHP);
  if (kind === 'time') SFX.play('round');
}
function finishMatch() {
  const [a, b] = G.fighters;
  const w = a.wins >= 2 ? a : b;
  G.result = { winner: w, loser: w.opp };
  if (G.mode === 'demo') { go('title'); return; }
  go('result');
}

function updateFight() {
  const ins = G.inp;
  const humans = G.fighters.filter(f => f.ctrl !== 'cpu');
  if (G.mode === 'demo') { if (ins[0].start || ins[0].lp || ins[1].start || ins[0].back) { go('title'); return; } }
  else if (G.paused) {
    const ip = ins[0].pu || ins[0].pd || ok(ins[0]) || ins[0].back || ins[0].start ? ins[0] : ins[1];
    if (ip.pu || ip.pd) { G.pauseIdx = 1 - G.pauseIdx; SFX.play('select'); }
    if (ip.back || (ip.start && G.pauseIdx === 0)) { G.paused = false; return; }
    if (ok(ip)) { SFX.play('confirm'); if (G.pauseIdx === 0) G.paused = false; else { G.paused = false; go('title'); } }
    return;
  } else if ((ins[0].start || ins[0].back || (humans.some(f => f.ctrl === 'p2') && ins[1].start))) { G.paused = true; G.pauseIdx = 0; return; }

  G.phaseT++;
  if (G.phase === 'intro') {
    const T0 = G.round === 1 ? 110 : 0;
    if (G.phaseT === T0 + 1) SFX.play('round');
    if (G.phaseT === T0 + 60) SFX.play('take');
    if (G.phaseT >= T0 + 95) { G.phase = 'fight'; G.fightActive = true; for (const f of G.fighters) f.state = 'idle'; }
  }
  if (G.shake > 0) G.shake--;
  if (G.superFreeze) { if (++G.superFreeze.t >= G.superFreeze.len) G.superFreeze = null; return; }
  if (G.hitstop > 0) { G.hitstop--; return; }
  if (G.slow > 0) { G.slow--; if (G.slow % 3) return; }

  for (const f of G.fighters) {
    if (f.ctrl === 'cpu') f.inp = cpuInput(f, f.opp);
    else if (f.ctrl === 'dummy') f.inp = blankInput();
    else if (G.fightActive) { const ip = ins[f.ctrl === 'p1' ? 0 : 1]; f.inp = Object.assign(blankInput(), ip, { start: false }); }
    else f.inp = blankInput();
  }
  const [a, b] = G.fighters;
  a.update(b); b.update(a);
  // collision / camera
  for (let k = 0; k < 2; k++) {
    if (Math.abs(a.y - b.y) < 45 && a.state !== 'down' && b.state !== 'down') {
      const minD = ((a.def.build || 11) + (b.def.build || 11)) / 2 + 8, d = b.x - a.x, ad = Math.abs(d);
      if (ad < minD) { const p = (minD - ad) / 2, s = d === 0 ? (a.facing > 0 ? 1 : -1) : Math.sign(d); a.x -= p * s; b.x += p * s; }
    }
    const cam = clamp((a.x + b.x) / 2 - W / 2, 0, STAGE_W - W);
    for (const f of G.fighters) f.x = clamp(f.x, Math.max(14, cam + 14), Math.min(STAGE_W - 14, cam + W - 14));
    G.camX = Math.round(cam);
  }
  updateProjs();
  updateFx();
  for (const f of G.fighters) if (f.dispHp > f.hp && f.state !== 'hit' && f.state !== 'air') f.dispHp = Math.max(f.hp, f.dispHp - 0.7);

  if (G.mode === 'practice' && G.phase === 'fight') {
    for (const f of G.fighters) {
      if (f.hp < MAXHP && ['idle', 'crouch'].includes(f.state) && f.opp.state !== 'attack') { f.hp = Math.min(MAXHP, f.hp + 2); f.dispHp = Math.max(f.dispHp, f.hp); }
      if (f.ctrl !== 'dummy' && !G.superFreeze && f.state !== 'attack') f.meter = Math.min(100, f.meter + 1);
    }
    G.timer = 60;
  } else if (G.phase === 'fight') {
    if (++G.timerF >= 60) { G.timerF = 0; G.timer--; }
    if (a.hp <= 0 || b.hp <= 0) endRound('ko');
    else if (G.timer <= 0) endRound('time');
  } else if (G.phase === 'end') {
    const w = G.roundWinner;
    if (G.phaseT > 100) for (const f of G.fighters) {
      if (f.y > 0 || ['air', 'ko', 'down', 'getup', 'win', 'lose'].includes(f.state)) continue;
      if (f === w) { f.state = 'win'; f.move = null; f.vx = 0; }
      else if (w && f.hp > 0) { f.state = 'lose'; f.move = null; f.vx = 0; }
    }
    if (G.phaseT === 250) {
      if (a.wins >= 2 || b.wins >= 2) finishMatch();
      else { G.round++; startRound(); }
    }
  }
}

// ---------------------------------------------------------------- fight rendering
function drawHpBar(f, x, y, flip) {
  const w = 190, h = 10;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#3a0a0a'; ctx.fillRect(x, y, w, h);
  const dw = Math.round(f.dispHp / MAXHP * w), hw = Math.round(f.hp / MAXHP * w);
  const rage = f.hp < MAXHP * 0.25;
  const fillX = (ww) => flip ? x : x + w - ww;
  ctx.fillStyle = '#e02020'; ctx.fillRect(fillX(dw), y, dw, h);
  ctx.fillStyle = rage ? (G.t % 20 < 10 ? '#ff4040' : '#ff9900') : '#f0d000'; ctx.fillRect(fillX(hw), y, hw, h);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(fillX(hw), y + 1, hw, 2);
  if (rage) txt('RAGE BAIT', flip ? x + 2 : x + w - 2, y + 1, 8, '#fff', flip ? 'left' : 'right', '#600');
}
function drawHUD() {
  const [a, b] = G.fighters;
  drawHpBar(a, 14, 12, false); drawHpBar(b, W - 14 - 190, 12, true);
  ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 18, 6, 36, 24);
  ctx.fillStyle = '#222'; ctx.fillRect(W / 2 - 16, 8, 32, 20);
  if (G.mode === 'practice') txt('∞', W / 2, 10, 16, '#fff', 'center');
  else txt(String(Math.max(0, G.timer)).padStart(2, '0'), W / 2, 10, 16, G.timer <= 10 ? '#f44' : '#fff', 'center');
  if (G.showKeys && G.mode !== 'demo' && !G.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - 108, 238, 216, 31);
    txt('Z/X PUNCH · C/V KICK', W / 2, 240, 8, '#fff', 'center');
    txt('A/S SPECIALS · D HOT TAKE', W / 2, 250, 8, '#ff0', 'center');
    txt('HOLD BACK=BLOCK · H:HIDE', W / 2, 260, 8, '#9cf', 'center');
  }
  txt(a.def.short, 14, 27, 8, '#fff'); txt(b.def.short, W - 14, 27, 8, '#fff', 'right');
  const tag = f => f.ctrl === 'cpu' ? 'CPU' : f.ctrl === 'dummy' ? 'DUMMY' : f.ctrl === 'p1' ? '1P' : '2P';
  txt(tag(a), 14 + a.def.short.length * 8 + 8, 27, 8, '#f66'); txt(tag(b), W - 22 - b.def.short.length * 8 - 8, 27, 8, '#6af', 'right');
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 34 - i * 10, 33, 8, 8); ctx.fillRect(W / 2 + 26 + i * 10, 33, 8, 8);
    ctx.fillStyle = a.wins > i ? '#fc0' : '#333'; ctx.fillRect(W / 2 - 33 - i * 10, 34, 6, 6);
    ctx.fillStyle = b.wins > i ? '#fc0' : '#333'; ctx.fillRect(W / 2 + 27 + i * 10, 34, 6, 6);
  }
  const meter = (f, x, flip) => {
    const w = 110, y = H - 14;
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 8);
    ctx.fillStyle = '#1a1a3a'; ctx.fillRect(x, y, w, 6);
    const mw = Math.round(f.meter / 100 * w), full = f.meter >= 100;
    ctx.fillStyle = full ? (G.t % 8 < 4 ? '#ff4' : '#f80') : '#38f';
    ctx.fillRect(flip ? x + w - mw : x, y, mw, 6);
    txt(full ? 'HOT TAKE READY!' : 'TAKE METER', flip ? x + w : x, y - 11, 8, full ? '#ff4' : '#9ab', flip ? 'right' : 'left');
  };
  meter(a, 14, false); meter(b, W - 14 - 110, true);
  for (const f of G.fighters) if (f.callout) {
    const left = f === a; ctx.globalAlpha = Math.min(1, f.callout.t / 10);
    txt(f.callout.s, left ? 14 : W - 14, 44, 8, '#ffb38a', left ? 'left' : 'right'); ctx.globalAlpha = 1;
  }
  for (const f of G.fighters) if (f.comboShow > 0 && f.comboN >= 2) {
    const left = f === a;
    txt(f.comboN + ' HITS', left ? 14 : W - 14, 58, 16, '#ff0', left ? 'left' : 'right');
    if (f.comboN >= 4) txt(['', '', '', '', 'HOT!', 'SPICY!', 'DISCOURSE!', 'MAIN CHARACTER!'][Math.min(7, f.comboN)], left ? 14 : W - 14, 78, 8, '#f84', left ? 'left' : 'right');
  }
}
function drawSuperBanner() {
  const sf = G.superFreeze, f = sf.f, k = Math.min(1, sf.t / 8);
  const y = 96, left = f.side === 0;
  ctx.fillStyle = '#000'; ctx.fillRect(0, y, W, 50);
  for (let i = -2; i < 26; i++) { ctx.fillStyle = '#f5c400'; const x = Math.round((i * 22 + sf.t * 3) % (W + 44)) - 22; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y); ctx.lineTo(x - 2, y + 4); ctx.lineTo(x - 10, y + 4); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, y + 46); ctx.lineTo(x + 8, y + 46); ctx.lineTo(x - 2, y + 50); ctx.lineTo(x - 10, y + 50); ctx.fill(); }
  const sp = sprite(f.def, 'stance');
  const sx = left ? lerp(-300, -60, k) : lerp(W + 10, W - 228, k);
  ctx.save(); ctx.beginPath(); ctx.rect(0, y + 5, W, 40); ctx.clip();
  drawSprite(sp, Math.round(sx), y + 25 - 37 * 3, 3, !left);
  ctx.restore();
  const tx = left ? W - 20 : 20, al = left ? 'right' : 'left';
  txt('HOT TAKE!', tx, y + 8, 16, G.t % 6 < 3 ? '#ff4' : '#f80', al);
  txt(f.def.super.name, tx, y + 28, 8, '#fff', al);
}
function drawFight() {
  const st = STAGES[G.stage] || STAGES.election;
  const sx = G.shake > 0 ? Math.round(rnd(-G.shake, G.shake) / 2) : 0, sy = G.shake > 0 ? Math.round(rnd(-G.shake, G.shake) / 2) : 0;
  ctx.save(); ctx.translate(sx, sy);
  st.draw(ctx, G.camX, G.t);
  if (G.superFreeze) {
    ctx.fillStyle = 'rgba(0,0,10,0.7)'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) { ctx.fillStyle = 'rgba(255,220,80,0.25)'; const yy = (i * 37 + G.t * 9) % H; ctx.fillRect(0, yy, W, 1); }
  }
  ctx.translate(-G.camX, 0);
  const order = [...G.fighters].sort((p, q) => (p.state === 'attack') - (q.state === 'attack'));
  for (const f of order) drawFighter(f);
  for (const p of G.projs) p.draw(p);
  drawFx();
  ctx.restore();
  if (G.superFreeze && G.superFreeze.t < G.superFreeze.len - 6) drawSuperBanner();
  drawHUD();
  // phase overlays
  if (G.phase === 'intro') {
    const T0 = G.round === 1 ? 110 : 0, t = G.phaseT;
    if (G.round === 1 && t < T0) {
      G.fighters.forEach((f, i) => {
        const show = i === 0 ? t > 5 && t < 60 : t > 55 && t < 108; if (!show) return;
        const x = clamp(f.x - G.camX, 90, W - 90), y = 120;
        const lines = f.def.intro.split(' / ');
        const wmax = Math.min(200, Math.max(...lines.map(l => l.length)) * 8 + 12);
        rrect(ctx, x - wmax / 2 - 1, y - 1, wmax + 2, 14 + 0 + Math.ceil(lines.join(' ').length * 8 / (wmax - 12)) * 12, '#111');
        rrect(ctx, x - wmax / 2, y, wmax, 12 + Math.ceil(lines.join(' ').length * 8 / (wmax - 12)) * 12, '#fff');
        wrapTxt(lines.join(' '), x, y + 5, Math.floor((wmax - 12) / 8), 8, '#111', 'center', 12);
      });
    } else if (t < T0 + 60) {
      bigTxt('ROUND ' + G.round, W / 2, 104, 24, '#fff', '#000', 'center', 2);
      txt((STAGES[G.stage] || {}).name || '', W / 2, 136, 8, '#ccc', 'center');
    } else {
      const s = 1 + Math.max(0, (T0 + 70 - t)) * 0.08;
      bigTxt('TAKE!', W / 2, 96, Math.round(40 * s), '#ff3b2f', '#000', 'center', 3);
    }
  }
  if (G.phase === 'end') {
    const t = G.phaseT;
    if (t < 120) bigTxt(G.endText, W / 2, 100, 32, G.t % 6 < 3 ? '#fff' : '#ff3b2f', '#000', 'center', 3);
    else {
      const w = G.roundWinner;
      bigTxt(w ? w.def.short + ' WINS' : 'DRAW', W / 2, 100, 16, '#ffd400', '#000', 'center', 2);
      if (G.perfect) bigTxt('PERFECT TAKE', W / 2, 126, 16, '#6ff', '#000', 'center', 2);
    }
  }
  if (G.mode === 'demo' && G.t % 60 < 40) bigTxt('DEMO · PRESS START', W / 2, H - 40, 8, '#fff');
  if (G.paused) drawPause();
}
function drawMoveList(d, x, y, keys = ['A', 'S', 'D']) {
  d.specials.forEach((s, i) => { txt(keys[i], x, y, 8, '#ff0'); txt('or', x + 14, y, 8, '#888'); inputTxt(s.input, s.btn.toUpperCase(), x + 36, y, '#ff0'); txt(s.name, x + 92, y, 8, '#ddd'); y += 11; });
  txt(keys[2], x, y, 8, '#f84'); txt('HOT TAKE: ' + d.super.name, x + 36, y, 8, '#ddd');
  return y + 11;
}
function drawPause() {
  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
  bigTxt('PAUSED', W / 2, 28, 16, '#fff');
  ['RESUME', 'QUIT TO TITLE'].forEach((s, i) => txt((G.pauseIdx === i ? '► ' : '  ') + s, W / 2, 60 + i * 14, 8, G.pauseIdx === i ? '#ff0' : '#aaa', 'center'));
  let y = 106;
  for (const f of G.fighters) {
    txt(f.def.name + ' — ' + f.def.outlet, 30, y, 8, '#ff6719'); y += 12;
    if (f.ctrl === 'p1') y = drawMoveList(f.def, 40, y) + 8;
    else y += 4;
  }
}

// ---------------------------------------------------------------- title
const MENU = ['ARCADE', 'VS CPU', 'PRACTICE', 'DIFFICULTY', 'HOW TO PLAY'];
const TOPLINES = ['D+2.1', 'R+0.4', '±3.2', 'n=1,204', 'LV', 'RV', 'A+', 'TIED', 'D+0.3', 'R+5', 'MOE', 'CROSSTAB', 'WEIGHTED', '538?', 'HERDING'];
function updateTitle() {
  const ip = G.inp[0]; G.idle++;
  if (G.help) { if (ok(ip) || ip.back || ip.start) { G.help = false; SFX.play('select'); } return; }
  if (ip.pu) { G.menu = (G.menu + MENU.length - 1) % MENU.length; SFX.play('select'); G.idle = 0; }
  if (ip.pd) { G.menu = (G.menu + 1) % MENU.length; SFX.play('select'); G.idle = 0; }
  if (G.menu === 3 && (ip.pl || ip.pr || ok(ip))) { G.diff = (G.diff + (ip.pl ? 2 : 1)) % 3; SFX.play('select'); G.idle = 0; return; }
  if (ok(ip)) {
    SFX.play('confirm'); G.idle = 0;
    if (G.menu === 4) { G.help = true; return; }
    G.mode = ['arcade', 'vscpu', 'practice'][G.menu];
    G.selLock = [false, false]; G.selStep = 0; G.sel = [G.sel[0] || 0, 1]; G.infoIdx = 0;
    go('select');
  }
  if (G.idle > 60 * 25) {
    G.idle = 0; G.mode = 'demo'; G.cpuLevel = 6;
    const i = rndi(0, ROSTER.length - 1); let j = rndi(0, ROSTER.length - 2); if (j >= i) j++;
    startMatch(ROSTER[i], ROSTER[j], 'cpu', 'cpu');
  }
}
function drawTitleBg() {
  vgrad(ctx, [[0, '#14000a'], [0.6, '#3a0612'], [1, '#090004']]);
  ctx.globalAlpha = 0.16;
  for (let r = 0; r < 14; r++) {
    const off = (G.t * (r % 2 ? 0.4 : -0.3) + r * 50);
    for (let k = 0; k < 9; k++) txt(TOPLINES[(r * 3 + k) % TOPLINES.length], Math.round(wrapX(k * 70 + off, 630) - 70), r * 20, 8, r % 3 ? '#f66' : '#fc9', 'left', null);
  }
  ctx.globalAlpha = 1;
}
function drawLogo(y) {
  const g = ctx.createLinearGradient(0, y, 0, y + 44);
  g.addColorStop(0, '#fff7c0'); g.addColorStop(0.45, '#ffc400'); g.addColorStop(0.55, '#ff6a00'); g.addColorStop(1, '#a00000');
  bigTxt('TAKE-N', W / 2, y, 44, '#600', '#600', 'center', 5);
  bigTxt('TAKE-N', W / 2, y, 44, g, '#000', 'center', 3);
  const gl = (G.t * 4) % 600 - 60;
  if (gl > 0 && gl < 300) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(W / 2 - 132 + gl * 0.9, y + 2, 3, 40); }
}
function drawTitle() {
  drawTitleBg();
  drawLogo(22);
  txt('THE KING OF IRON TAKES TOURNAMENT', W / 2, 76, 8, '#ffd9a0', 'center');
  ROSTER.forEach((d, i) => {
    const x = 40 + i * 80, sp = sprite(d, (G.t + i * 40) % 300 < 30 ? 'raise' : 'stance');
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - 12, 262, 24, 3);
    drawSprite(sp, x - 48, 262 - 92 + Math.round(Math.sin(G.t * 0.1 + i) * 1), 1, i >= 3);
  });
  if (G.help) { drawHelp(); return; }
  MENU.forEach((m, i) => {
    const sel = G.menu === i, label = i === 3 ? 'DIFFICULTY: ' + DIFFS[G.diff].name : m;
    if (sel) { ctx.fillStyle = 'rgba(255,60,40,0.25)'; ctx.fillRect(W / 2 - 100, 93 + i * 13, 200, 12); }
    txt((sel ? '► ' : '') + label + (sel ? ' ◄' : ''), W / 2, 95 + i * 13, 8, sel ? '#fff' : i === 3 ? '#fc6' : '#c99', 'center');
  });
  if (G.t % 70 < 45) txt('INSERT TAKE', W / 2, 176, 8, '#ff0', 'center');
  txt('ARROWS + ENTER TO PICK · M: MUTE', W / 2, 188, 8, '#a77', 'center', null);
}
function drawHelp() {
  ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(10, 86, W - 20, 180);
  const L = [
    ['HOW TO TAKE', '#ff0'],
    ['MOVE: ARROWS    PUNCH: Z X    KICK: C V', '#fff'],
    ['SPECIALS: A S   HOT TAKE: D   THROW: Z+C', '#fff'],
    ['PAD: X/Y PUNCH A/B KICK LB/LT SPECIAL RB SUPER', '#fff'],
    ['', ''],
    ['', ''],
    ['HOLD BACK TO BLOCK · DOWN-BACK BLOCKS LOWS', '#fc9'],
    ['HIGHS (PUNCHES) WHIFF ON CROUCHERS', '#fc9'],
    ['DOWN+X = LAUNCHER, THEN JUGGLE THEM', '#fc9'],
    ['ALSO:', '#fc9'],
    ['DOUBLE-TAP FORWARD/BACK = DASH', '#fc9'],
    ['FILL THE TAKE METER, THEN UNLEASH A HOT TAKE', '#fc9'],
    ['BELOW 25% HP: RAGE BAIT (+15% DAMAGE)', '#fc9'],
    ['ESC: PAUSE (MOVE LIST) · M: MUTE · H: KEYS', '#9ab'],
  ];
  L.forEach(([s, c], i) => txt(s, 24, 93 + i * 12, 8, c, 'left'));
  const yy = 93 + 9 * 12; inputTxt('qcf', 'P', 24 + 48, yy, '#ff0'); txt('/', 24 + 100, yy, 8, '#fc9'); inputTxt('qcb', 'K', 24 + 116, yy, '#ff0'); txt('(OLD-SCHOOL)', 24 + 170, yy, 8, '#888');
}

// ---------------------------------------------------------------- select
function updateSelect() {
  const n = ROSTER.length, cols = 3;
  const move = (i, ip) => {
    let c = G.sel[i];
    if (ip.pl) c = (c + n - 1) % n; if (ip.pr) c = (c + 1) % n; if (ip.pu || ip.pd) c = (c + cols) % n;
    if (c !== G.sel[i]) { SFX.play('select'); G.infoIdx = i; }
    G.sel[i] = c;
  };
  if (G.mode === 'versus') {
    for (let i = 0; i < 2; i++) {
      const ip = G.inp[i];
      if (!G.selLock[i]) { move(i, ip); if (ok(ip)) { G.selLock[i] = true; G.infoIdx = i; SFX.play('confirm'); } }
      else if (ip.back || ip.lk) { G.selLock[i] = false; }
    }
    if (G.inp[0].back && !G.selLock[0]) { go('title'); return; }
    if (G.selLock[0] && G.selLock[1]) { if (!G.lockT) G.lockT = G.t; if (G.t - G.lockT > 30) { G.lockT = 0; setupVs(ROSTER[G.sel[0]], ROSTER[G.sel[1]], 'p1', 'p2'); } }
    return;
  }
  const ip = G.inp[0];
  if (G.selStep === 0) {
    move(0, ip);
    if (ip.back) { go('title'); return; }
    if (ok(ip)) {
      SFX.play('confirm'); G.selLock[0] = true;
      if (G.mode === 'arcade') {
        const others = shuffle(ROSTER.map((_, i) => i).filter(i => i !== G.sel[0]));
        G.arcade = { queue: others, idx: 0 };
        nextArcade();
      } else { G.selStep = 1; G.sel[1] = (G.sel[0] + 1) % n; G.infoIdx = 1; }
    }
  } else {
    move(1, ip);
    if (ip.back || ip.lk) { G.selStep = 0; G.selLock[0] = false; G.infoIdx = 0; return; }
    if (ok(ip)) {
      SFX.play('confirm'); G.cpuLevel = DIFFS[G.diff].vscpu;
      if (G.mode === 'practice') startMatch(ROSTER[G.sel[0]], ROSTER[G.sel[1]], 'p1', 'dummy');
      else setupVs(ROSTER[G.sel[0]], ROSTER[G.sel[1]], 'p1', 'cpu');
    }
  }
}
function drawSelect() {
  drawTitleBg();
  bigTxt('SELECT YOUR PUNDIT', W / 2, 8, 16, '#fff', '#000', 'center', 2);
  const cw = 74, ch = 46, x0 = W / 2 - cw * 1.5, y0 = 32;
  ROSTER.forEach((d, i) => {
    const x = x0 + (i % 3) * cw, y = y0 + Math.floor(i / 3) * ch;
    ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
    ctx.fillStyle = ['#3a1020', '#10203a', '#203a10'][i % 3]; ctx.fillRect(x + 3, y + 3, cw - 6, ch - 6);
    drawSprite(headSprite(d), x + 12, y + 1, 1.6, false);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 3, y + ch - 13, cw - 6, 10);
    txt(d.short, x + cw / 2, y + ch - 12, 8, '#fff', 'center', null);
  });
  const cursor = (i, col, label) => {
    const c = G.sel[i], x = x0 + (c % 3) * cw, y = y0 + Math.floor(c / 3) * ch;
    const on = G.selLock[i] || G.t % 20 < 14;
    if (!on) return;
    ctx.fillStyle = col; ctx.fillRect(x, y, cw, 2); ctx.fillRect(x, y + ch - 2, cw, 2); ctx.fillRect(x, y, 2, ch); ctx.fillRect(x + cw - 2, y, 2, ch);
    rrect(ctx, i === 0 ? x - 2 : x + cw - 26, y - 6, 28, 11, col); txt(label, i === 0 ? x + 12 : x + cw - 12, y - 4, 8, '#fff', 'center', null);
  };
  const p2 = G.mode === 'versus' || G.selStep === 1;
  cursor(0, '#e02828', '1P');
  if (p2) cursor(1, '#2860e0', G.mode === 'versus' ? '2P' : G.mode === 'practice' ? 'DUM' : 'CPU');
  // big sprites
  const d1 = ROSTER[G.sel[0]];
  drawSprite(sprite(d1, G.selLock[0] ? 'win' : 'stance'), -18, H - 8 - 184, 2, false);
  if (p2) { const d2 = ROSTER[G.sel[1]]; drawSprite(sprite(G.sel[1] === G.sel[0] ? altDef(d2) : d2, G.selLock[1] ? 'win' : 'stance'), W - 174, H - 8 - 184, 2, true); }
  // info panel
  const d = ROSTER[G.sel[G.infoIdx]];
  const px = 140, pw = 200, py = 146;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(px - 6, py - 4, pw + 12, 122);
  txt(d.name, W / 2, py, 8, '#fff', 'center');
  txt(d.outlet, W / 2, py + 12, 8, '#ff6719', 'center');
  txt(d.title, W / 2, py + 24, 8, '#9ab', 'center');
  let y = py + 40;
  const keys = ['A', 'S', 'D'];
  d.specials.forEach((s, i) => { txt(keys[i], px, y, 8, '#ff0'); txt(s.name, px + 32, y, 8, '#fff'); y += 12; });
  txt(keys[2], px, y, 8, '#f84'); txt(d.super.name, px + 32, y, 8, '#f84'); y += 16;
  const desc = G.t % 360 < 120 ? d.specials[0].desc : G.t % 360 < 240 ? d.specials[1].desc : d.super.desc;
  ctx.globalAlpha = 0.85; wrapTxt(desc, W / 2, y, 25, 8, '#cde', 'center', 10); ctx.globalAlpha = 1;
  const help = G.mode === 'versus' ? 'BOTH PLAYERS PICK' : G.selStep === 1 ? (G.mode === 'practice' ? 'PICK A PRACTICE DUMMY' : 'PICK YOUR OPPONENT') : G.mode === 'arcade' ? 'ARCADE: BEAT ALL 5' : 'PICK YOUR PUNDIT';
  txt(help, W / 2, 130, 8, G.t % 40 < 30 ? '#ff0' : '#fa0', 'center');
}

// ---------------------------------------------------------------- arcade / vs / result
function nextArcade() {
  const a = G.arcade, opp = ROSTER[a.queue[a.idx]];
  const df = DIFFS[G.diff]; G.cpuLevel = Math.min(9, df.base + a.idx * df.step);
  setupVs(ROSTER[G.sel[0]], opp, 'p1', 'cpu');
}
function setupVs(d1, d2, c1, c2) { G.vs = { d1, d2, c1, c2 }; go('vs'); }
function updateVs() {
  G.sceneT++;
  if (G.sceneT > 170 || (G.sceneT > 30 && (ok(G.inp[0]) || G.inp[0].start))) startMatch(G.vs.d1, G.vs.d2, G.vs.c1, G.vs.c2);
}
function drawVs() {
  const t = G.sceneT, k = Math.min(1, t / 20);
  ctx.fillStyle = '#7a0010'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W / 2 + 40, 0); ctx.lineTo(W / 2 - 40, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillStyle = '#0a2a7a'; ctx.beginPath(); ctx.moveTo(W / 2 + 40, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W / 2 - 40, H); ctx.fill();
  for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, (i * 29 + t * 6) % H, W, 2); }
  const { d1, d2 } = G.vs, d2v = d1 === d2 ? altDef(d2) : d2;
  drawSprite(sprite(d1, 'stance'), Math.round(lerp(-220, -10, k)), H - 196, 2, false);
  drawSprite(sprite(d2v, 'stance'), Math.round(lerp(W + 30, W - 182, k)), H - 196, 2, true);
  txt(d1.name, 14, 18, 8, '#fff'); txt(d1.outlet, 14, 30, 8, '#ffb38a');
  txt(d2.name, W - 14, 18, 8, '#fff', 'right'); txt(d2.outlet, W - 14, 30, 8, '#ffb38a', 'right');
  const s = t < 30 ? 1 + (30 - t) * 0.1 : 1;
  bigTxt('VS', W / 2, 100, Math.round(40 * s), '#ffd400', '#000', 'center', 3);
  txt('STAGE: ' + STAGES[d2.stage].name, W / 2, 160, 8, '#fff', 'center');
  if (G.mode === 'arcade') txt('STAGE ' + (G.arcade.idx + 1) + ' / ' + G.arcade.queue.length, W / 2, 174, 8, '#ff0', 'center');
}
function updateResult() {
  G.sceneT++;
  if (G.sceneT < 40) return;
  if (!(ok(G.inp[0]) || G.inp[0].start || G.inp[1].start || G.sceneT > 60 * 12)) return;
  SFX.play('confirm');
  const human = G.result.winner.ctrl === 'p1';
  if (G.mode === 'arcade') {
    if (human) { G.arcade.idx++; if (G.arcade.idx >= G.arcade.queue.length) go('ending'); else nextArcade(); }
    else { G.contT = 10 * 60; go('cont'); }
  } else go('select'), (G.selLock = [false, false], G.selStep = 0);
}
function drawResult() {
  drawTitleBg();
  const w = G.result.winner, d = w.def;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 30, W, 210);
  bigTxt('WINNER', W / 2, 10, 16, '#ffd400');
  drawSprite(sprite(d, 'win'), 0, H - 8 - 184, 2, false);
  txt(d.name, 200, 52, 8, '#fff'); txt(d.outlet.toUpperCase(), 200, 64, 8, '#ff6719');
  rrect(ctx, 196, 84, 270, 70, '#111'); rrect(ctx, 197, 85, 268, 68, '#fff');
  wrapTxt('"' + d.quote + '"', 206, 94, 31, 8, '#111', 'left', 12);
  if (G.sceneT > 40 && G.t % 50 < 35) txt('PRESS START', 330, 200, 8, '#ff0', 'center');
}
function updateCont() {
  if (--G.contT <= 0) { go('title'); return; }
  if (ok(G.inp[0]) || G.inp[0].start) { SFX.play('confirm'); nextArcade(); }
  else if (G.inp[0].lk || G.inp[0].rp) G.contT = Math.floor(G.contT / 60) * 60 - 1;
}
function drawCont() {
  drawTitleBg();
  bigTxt('CONTINUE?', W / 2, 60, 24, '#fff');
  bigTxt(String(Math.floor(G.contT / 60)), W / 2, 110, 40, '#ff3b2f');
  txt('YOUR TAKE WAS RATIO\'D. TRY AGAIN?', W / 2, 180, 8, '#fc9', 'center');
  drawSprite(sprite(ROSTER[G.sel[0]], 'lose'), W / 2 - 48, 170, 1, false);
}
function updateEnding() { G.sceneT++; if (G.sceneT > 90 && (ok(G.inp[0]) || G.inp[0].start)) go('title'); if (G.sceneT > 60 * 40) go('title'); }
function drawEnding() {
  drawTitleBg();
  const d = ROSTER[G.sel[0]];
  drawSprite(sprite(d, G.t % 60 < 30 ? 'win' : 'raise'), W / 2 - 96, 30, 2, false);
  const lines = ['CONGRATULATIONS!', '', d.name, 'IS THE KING OF IRON TAKES', '', 'THE DISCOURSE WILL NEVER RECOVER.', '', '"' + d.quote + '"', '', 'NO CROSSTABS WERE HARMED', 'IN THE MAKING OF THIS GAME.', '', 'THANKS FOR PLAYING  ·  TAKE-N'];
  const y0 = H - G.sceneT * 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  lines.forEach((l, i) => { const y = Math.max(20 + i * 14, y0 + i * 14); if (y < H) txt(l, W / 2, y, 8, i === 0 ? '#ff0' : i === 2 ? '#ff6719' : '#fff', 'center'); });
}

// ---------------------------------------------------------------- loop
function update() {
  G.t++;
  G.inp = [readPlayer(0, false), readPlayer(1, false)];
  SFX.tick();
  switch (G.scene) {
    case 'title': updateTitle(); break;
    case 'select': updateSelect(); break;
    case 'vs': updateVs(); break;
    case 'fight': updateFight(); break;
    case 'result': updateResult(); break;
    case 'cont': updateCont(); break;
    case 'ending': updateEnding(); break;
  }
  for (const k in Tapped) delete Tapped[k];
}
function render() {
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  switch (G.scene) {
    case 'title': drawTitle(); break;
    case 'select': drawSelect(); break;
    case 'vs': drawVs(); break;
    case 'fight': drawFight(); break;
    case 'result': drawResult(); break;
    case 'cont': drawCont(); break;
    case 'ending': drawEnding(); break;
  }
}
let acc = 0, last = performance.now();
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(frame);
}
go('title');
requestAnimationFrame(frame);
