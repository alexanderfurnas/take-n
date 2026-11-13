'use strict';
/* =====================================================================
   TAKE-N — the roster. Affectionate parody; all moves are jokes about
   each pundit's newsletter / outlet / famous bit.

   Adding a fighter: copy one entry. Each needs 2 specials
   (input 'qcf' = ↓↘→, 'qcb' = ↓↙←; btn 'p' or 'k') and one super
   ("HOT TAKE"). A move either has a melee `box` or a `spawn(f, opp)`
   that fires projectiles with shoot(f, {...}).
   ===================================================================== */

// ---------------------------------------------------------------- projectile art
function drawTicket(p) {
  const x = Math.round(p.x - 7), y = Math.round(p.y - 4), d = Math.sign(p.vx) || 1;
  for (let i = 1; i < 4; i++) { ctx.fillStyle = p.kind ? `rgba(80,130,255,${0.4 - i * 0.1})` : `rgba(255,70,70,${0.4 - i * 0.1})`; ctx.fillRect(x - d * i * 5 + 3, y + 2, 8, 5); }
  ctx.fillStyle = '#111'; ctx.fillRect(x - 1, y - 1, 16, 11);
  ctx.fillStyle = '#f4ecd0'; ctx.fillRect(x, y, 14, 9);
  ctx.fillStyle = p.kind ? '#2a5bd7' : '#d22f2f'; ctx.fillRect(x + 1, y + 1, 4, 7);
  ctx.fillStyle = '#555'; for (let i = 0; i < 3; i++) ctx.fillRect(x + 7, y + 2 + i * 2, 5, 1);
  ctx.fillStyle = '#aaa'; for (let i = 0; i < 9; i += 2) ctx.fillRect(x + 5, y + i, 1, 1);
}
function drawGlyph(p) {
  ctx.fillStyle = 'rgba(80,255,120,0.18)'; ctx.fillRect(Math.round(p.x - 6), Math.round(p.y - 6), 12, 12);
  txt(p.glyph, Math.round(p.x), Math.round(p.y - 4), 8, p.col || '#6f6', 'center', '#030');
}
function drawStamp(p) {
  const x = Math.round(p.x), y = Math.round(p.y);
  if (!p.landed) {
    const r = 12 + Math.round(Math.sin(p.t * 0.5) * 2);
    ctx.fillStyle = 'rgba(255,40,40,0.7)'; ctx.fillRect(x - r, GROUND - 1, r * 2, 2); ctx.fillRect(x - 1, GROUND - 10, 2, 10);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 26, GROUND - 1, 52, 3);
  ctx.fillStyle = '#111'; ctx.fillRect(x - 9, y - 38, 18, 10); ctx.fillStyle = '#b0602d'; ctx.fillRect(x - 8, y - 37, 16, 8);
  ctx.fillStyle = '#111'; ctx.fillRect(x - 4, y - 29, 8, 12); ctx.fillStyle = '#6b3a1b'; ctx.fillRect(x - 3, y - 29, 6, 12);
  ctx.fillStyle = '#111'; ctx.fillRect(x - 29, y - 18, 58, 22);
  ctx.fillStyle = '#444'; ctx.fillRect(x - 28, y - 17, 56, 10);
  ctx.fillStyle = '#c11'; ctx.fillRect(x - 28, y - 7, 56, 10);
  txt('CALLED', x, y - 16, 8, '#fff', 'center', null);
  txt('✓', x, y - 6, 8, '#fff', 'center', null);
}
function drawBar(p) {
  const x = Math.round(p.x), y = Math.round(p.y);
  ctx.fillStyle = '#111'; ctx.fillRect(x - 8, y - 19, 16, 38);
  ctx.fillStyle = p.col; ctx.fillRect(x - 7, y - 18, 14, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 7, y - 18, 3, 36);
  txt(p.label, x, y - 30, 8, '#fff', 'center');
}
function drawBullet(p) {
  const x = Math.round(p.x), y = Math.round(p.y), d = Math.sign(p.vx) || 1;
  for (let i = 1; i < 7; i++) { ctx.fillStyle = `rgba(220,230,255,${0.55 - i * 0.08})`; ctx.fillRect(x - d * i * 6 - 3, y - 1, 6, 2); }
  ctx.fillStyle = '#111'; ctx.fillRect(x - 7, y - 3, 14, 6);
  ctx.fillStyle = '#c9ced6'; ctx.fillRect(x - 6, y - 2, 12, 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 6, y - 2, 12, 1);
  ctx.fillStyle = '#eef'; ctx.fillRect(d > 0 ? x + 6 : x - 8, y - 1, 2, 2);
}
function drawCard(p) {
  const x = Math.round(p.x), y = Math.round(p.y);
  const w = Math.max(1, Math.round(Math.abs(Math.cos(p.t * 0.25)) * 11));
  ctx.fillStyle = '#111'; ctx.fillRect(x - Math.ceil(w / 2) - 1, y - 9, w + 2, 18);
  ctx.fillStyle = '#fff'; ctx.fillRect(x - Math.ceil(w / 2), y - 8, w, 16);
  if (w > 6) { ctx.fillStyle = '#111'; ctx.fillRect(x - 1, y - 4, 3, 3); ctx.fillRect(x - 2, y - 2, 5, 2); ctx.fillRect(x, y, 1, 3); ctx.fillStyle = '#c00'; ctx.fillRect(x - 4, y - 7, 2, 2); }
}
function drawChipWave(p) {
  const cols = ['#d22', '#22a', '#1a1', '#222', '#eee'];
  for (let i = 0; i < 16; i++) {
    const ox = ((i * 37) % 44) - 22, oy = -((i * 13) % 30) + 12 + Math.sin(p.t * 0.35 + i) * 3;
    const cx = Math.round(p.x + ox), cy = Math.round(p.y + oy);
    ctx.fillStyle = '#000'; ctx.fillRect(cx - 5, cy - 3, 10, 6);
    ctx.fillStyle = cols[i % 5]; ctx.fillRect(cx - 4, cy - 2, 8, 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1, cy - 2, 2, 4);
  }
  if (p.t % 10 < 7) txt('ALL IN', Math.round(p.x), Math.round(p.y - 34), 8, '#ff0', 'center');
}
function drawDime(p) {
  const x = Math.round(p.x), y = Math.round(p.y);
  const w = Math.max(1, Math.round(Math.abs(Math.cos(p.t * 0.3)) * 3));
  ctx.fillStyle = '#333'; ctx.fillRect(x - w - 1, y - 4, w * 2 + 3, 9); ctx.fillRect(x - w - 2, y - 3, w * 2 + 5, 7);
  ctx.fillStyle = '#d6dadf'; ctx.fillRect(x - w, y - 3, w * 2 + 1, 7); ctx.fillRect(x - w - 1, y - 2, w * 2 + 3, 5);
  ctx.fillStyle = '#fff'; ctx.fillRect(x - w, y - 3, 1, 2);
}
function drawFlask(p) {
  const x = Math.round(p.x), y = Math.round(p.y);
  ctx.fillStyle = '#111'; ctx.fillRect(x - 3, y - 8, 6, 6); ctx.fillRect(x - 6, y - 3, 12, 10);
  ctx.fillStyle = '#ddeeff'; ctx.fillRect(x - 2, y - 7, 4, 5);
  ctx.fillStyle = '#4e4'; ctx.fillRect(x - 5, y - 2, 10, 8);
  ctx.fillStyle = '#afa'; ctx.fillRect(x - 3, y, 2, 2); if (p.t % 10 < 5) ctx.fillRect(x + 1, y - 10, 2, 2);
}
function drawPuddle(p) {
  const x = Math.round(p.x), y = Math.round(p.y);
  ctx.globalAlpha = p.life < 20 ? p.life / 20 : 1;
  ctx.fillStyle = '#063'; ctx.fillRect(x - 19, y - 3, 38, 6);
  ctx.fillStyle = '#2c4'; ctx.fillRect(x - 18, y - 2, 36, 4);
  ctx.fillStyle = '#8f8'; ctx.fillRect(x - 14, y - 2, 20, 1);
  for (let i = 0; i < 5; i++) { const by = y - 3 - ((p.t * 0.6 + i * 7) % 16); ctx.fillStyle = '#9f9'; ctx.fillRect(x - 14 + i * 7, Math.round(by), 2, 2); }
  ctx.globalAlpha = 1;
}
function drawBeam(p) {
  const x1 = Math.round(p.x - p.w / 2), y = Math.round(p.y), w = Math.round(p.w);
  const fl = p.t % 4 < 2;
  ctx.fillStyle = 'rgba(80,255,255,0.3)'; ctx.fillRect(x1, y - 9, w, 18);
  ctx.fillStyle = fl ? '#6ff' : '#4dd'; ctx.fillRect(x1, y - 5, w, 10);
  ctx.fillStyle = '#fff'; ctx.fillRect(x1, y - 2, w, 4);
  txt('y = βx + ε', Math.round(p.ox + p.dir * 50), y - 22, 8, '#6ff', 'center');
}
function drawDrill(p) {
  const x = Math.round(p.x), y = Math.round(p.y), d = Math.sign(p.vx) || 1;
  const R = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(d > 0 ? x + dx : x - dx - w, y + dy, w, h); };
  R(-14, -7, 14, 14, '#111'); R(-13, -6, 12, 12, '#e8a317'); R(-13, -6, 12, 2, '#ffd36b');
  R(-10, 6, 5, 8, '#111'); R(-9, 6, 3, 7, '#333');
  for (let i = 0; i < 14; i++) { const h = Math.max(2, Math.round(10 - i * 0.65)); R(-1 + i, -Math.floor(h / 2), 1, h, (i + Math.floor(p.t / 2)) % 4 < 2 ? '#ddd' : '#777'); }
  if (p.t % 30 < 16) txt('BRRR', x, y - 20, 8, '#fff', 'center');
}
function drawTower(p) {
  const th = Math.round(p.th || 0), x0 = Math.round(p.x - 11);
  if (p.t < 10) { ctx.fillStyle = p.t % 4 < 2 ? '#fc3' : '#a60'; ctx.fillRect(x0 - 4, GROUND - 2, 30, 2); return; }
  if (th <= 0) return;
  const top = GROUND - th;
  ctx.fillStyle = '#111'; ctx.fillRect(x0 - 1, top - 1, 24, th + 1);
  ctx.fillStyle = '#d9c7a3'; ctx.fillRect(x0, top, 22, th);
  for (let wy = top + 4; wy < GROUND - 5; wy += 7) {
    ctx.fillStyle = ((wy >> 2) % 3) ? '#ffe66b' : '#4a6a8a'; ctx.fillRect(x0 + 3, wy, 6, 4);
    ctx.fillStyle = ((wy >> 2) % 2) ? '#ffe66b' : '#4a6a8a'; ctx.fillRect(x0 + 13, wy, 6, 4);
  }
  ctx.fillStyle = '#a33'; ctx.fillRect(x0 - 2, top - 3, 26, 3);
  if (th >= 50) txt('YIMBY', x0 + 11, top - 14, 8, '#fc3', 'center');
}
function drawCrowd(p) {
  for (const q of p.people) {
    const x = Math.round(p.x + q.dx), y = Math.round(p.y + q.dy), leg = (p.t * 0.5 + q.ph) % 2 < 1;
    ctx.fillStyle = '#111'; ctx.fillRect(x - 2, y - 9, 5, 12);
    ctx.fillStyle = q.sk; ctx.fillRect(x - 1, y - 8, 3, 3);
    ctx.fillStyle = q.c; ctx.fillRect(x - 1, y - 5, 3, 4);
    ctx.fillStyle = '#223'; ctx.fillRect(x - 1 + (leg ? 0 : 1), y - 1, 1, 3); ctx.fillRect(x + 1 - (leg ? 0 : 1), y - 1, 1, 3);
  }
  if (p.t % 12 < 8) txt('+670,000,000', Math.round(p.x), Math.round(p.y - 30), 8, '#ff0', 'center');
}
function drawWord(p) {
  const x = Math.round(p.x), y = Math.round(p.y), w = p.w, d = Math.sign(p.vx) || 1;
  rrect(ctx, x - w / 2 - 1, y - 8, w + 2, 16, '#111');
  rrect(ctx, x - w / 2, y - 7, w, 14, '#fff');
  ctx.fillStyle = '#fff'; ctx.fillRect(x - d * (w / 2 - 6), y + 6, 4, 3); ctx.fillRect(x - d * (w / 2 - 4), y + 8, 2, 2);
  txt(p.word, x, y - 3, 8, '#b00', 'center', null);
}
function drawDial(p) {
  const x = Math.round(p.x), y = Math.round(p.y - 50);
  ctx.fillStyle = '#111'; ctx.fillRect(x - 32, y - 24, 64, 34);
  ctx.fillStyle = '#2a2a33'; ctx.fillRect(x - 31, y - 23, 62, 32);
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + i / 10 * Math.PI, px = x + Math.cos(a) * 22, py = y + 6 + Math.sin(a) * 22;
    ctx.fillStyle = i < 3 ? '#e33' : i < 7 ? '#ec3' : '#3c5'; ctx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 4, 4);
  }
  const v = p.t < 26 ? 50 + Math.sin(p.t * 0.45) * 35 : Math.max(0, 50 - (p.t - 26) * 5);
  const a = Math.PI + v / 100 * Math.PI;
  seg(ctx, x, y + 6, x + Math.cos(a) * 18, y + 6 + Math.sin(a) * 18, 2, '#fff');
  txt(String(Math.round(v)), x, y - 4, 8, v < 30 ? '#f55' : '#fff', 'center', null);
  txt('DIAL TEST', x, y - 36, 8, '#fc3', 'center');
  if (p.armed && p.t % 6 < 3) {
    let px = x, py = y + 12;
    while (py < GROUND - 8) { const nx = x + rnd(-8, 8), ny = py + 10; seg(ctx, px, py, nx, ny, 2, '#ff5'); px = nx; py = ny; }
  }
}

// ---------------------------------------------------------------- shared custom fx
function fxErrorBars(f) {
  fxCustom(e => {
    const a = 1 - e.t / e.life; ctx.globalAlpha = a;
    for (const s of [-1, 1]) {
      const x = Math.round(e.x + s * 20); ctx.fillStyle = '#ff6';
      ctx.fillRect(x, e.y - 60, 2, 56); ctx.fillRect(x - 4, e.y - 60, 10, 2); ctx.fillRect(x - 4, e.y - 6, 10, 2);
    }
    ctx.globalAlpha = 1;
  }, 30, { x: f.x, y: GROUND - f.y });
}
function fxFocusGroup(def) {
  const cols = ['#e33', '#38f', '#3c6', '#fc3', '#c6f', '#f84'];
  fxCustom(e => {
    ctx.globalAlpha = e.t > e.life - 15 ? (e.life - e.t) / 15 : 1;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + e.t * 0.02, x = Math.round(e.x + Math.cos(a) * 34), y = Math.round(GROUND - 4 + Math.sin(a) * 5);
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 3, y - 6, 6, 2); ctx.fillRect(x - 3, y - 6, 1, 6); ctx.fillRect(x + 2, y - 4, 1, 4);
      ctx.fillStyle = cols[i]; ctx.fillRect(x - 2, y - 12, 4, 6); ctx.fillStyle = '#e0b090'; ctx.fillRect(x - 2, y - 16, 4, 4);
      if ((e.t + i * 5) % 20 < 10) txt('-', x, y - 26, 8, '#f55', 'center', null);
    }
    ctx.globalAlpha = 1;
  }, 60, { x: def.x });
}
function fxScatter(f) {
  const dots = [];
  for (let i = 0; i < 36; i++) { const dx = rnd(20, 300); dots.push({ x: f.x + f.facing * dx, y: GROUND - 44 + rnd(-30, 30) * (1 - dx / 400) + dx * 0.02 * (Math.random() - 0.5) * 10, d: i }); }
  fxCustom(e => {
    for (const q of dots) if (e.t > q.d * 0.8) { ctx.fillStyle = '#111'; ctx.fillRect(Math.round(q.x) - 2, Math.round(q.y) - 2, 4, 4); ctx.fillStyle = '#6ff'; ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2); }
  }, 80, {});
}

// ---------------------------------------------------------------- the pundits
const ROSTER = [
  {
    id: 'jain', name: 'LAKSHYA JAIN', short: 'JAIN', outlet: 'SPLIT TICKET', title: 'THE RACE CALLER', stage: 'election',
    skin: '#a8714a', heads: [{ hair: 'side', hairColor: '#161010' }],
    shirt: '#d22f2f', split: '#2a5bd7', pants: '#2b2b38', shoes: '#eeeeee', build: 11, height: 1.0,
    intro: 'Your crosstabs are showing.', quote: 'Race call: me. Margin: decisive. Next.',
    specials: [
      { name: 'SPLIT TICKET', input: 'qcf', btn: 'p', pose: 'cast', su: 11, ac: 2, rc: 22, special: true,
        desc: 'A red ticket high and a blue ticket low. Good luck blocking both.',
        spawn(f) { for (const k of [0, 1]) shoot(f, { oy: -30, speed: 3.6, w: 14, h: 9, dmg: 5, lvl: k ? 'low' : 'mid', hs: 18, kind: k, draw: drawTicket, update(p) { if (p.t < 14) p.y += p.kind ? 1.4 : -1.3; } }); } },
      { name: 'CROSSTAB DASH', input: 'qcb', btn: 'k', pose: 'knee', su: 9, ac: 10, rc: 16, special: true, vx: 5.5,
        dmg: 11, lvl: 'mid', box: { x: 4, y: -46, w: 24, h: 26 }, hs: 22, bs: 12, kb: 3, knockdown: true,
        desc: 'Rushes in knee-first and sorts you by subgroup.',
        onHitFx(a, d) { popText('n=38 SUBGROUP!', d.x, GROUND - 86, '#6cf'); } },
    ],
    super: { name: 'CALLED IT', pose: 'point', su: 14, ac: 2, rc: 34, special: true, isSuper: true,
      desc: 'A giant decision-desk stamp tracks you down. Projected winner: not you.',
      spawn(f, o) {
        shoot(f, { x: o.x, y: 30, vx: 0, w: 56, h: 40, dmg: 30, lvl: 'mid', life: 110, hs: 40, kb: 3, knockdown: true, isSuper: true, clash: false, armed: false, draw: drawStamp,
          update(p) {
            if (p.t < 30) { p.x += (o.x - p.x) * 0.15; p.armed = false; }
            else if (!p.landed) { p.armed = true; p.vy += 1.3; if (p.y + p.vy > GROUND - 20) { p.y = GROUND - 20; p.vy = 0; p.landed = p.t; G.shake = 10; SFX.play('hitH'); dust(p.x, GROUND, 14); } }
            else if (p.t - p.landed > 5) p.armed = false;
          },
          onHit() { popText('PROJECTED WINNER!', o.x, GROUND - 100, '#ff0', 8, 70); } });
      } },
  },
  {
    id: 'morris', name: 'G. ELLIOTT MORRIS', short: 'MORRIS', outlet: 'STRENGTH IN NUMBERS', title: 'THE MODELER', stage: 'fair',
    skin: '#e8b996', heads: [{ hair: 'short', hairColor: '#6b4a2b', beard: true }],
    shirt: '#2f7a46', pants: '#3a4150', shoes: '#5a3a22', build: 11, height: 1.0,
    intro: "Let's check the averages first.", quote: 'Strength in numbers. Mostly my numbers.',
    specials: [
      { name: 'STRENGTH IN NUMBERS', input: 'qcf', btn: 'p', pose: 'cast', su: 10, ac: 18, rc: 14, special: true,
        desc: 'A stream of five data points. Individually weak. Together? Significant.',
        onFrame(f, fr) { if (fr >= 10 && fr < 30 && (fr - 10) % 4 === 0) shoot(f, { oy: -44 + rndi(-7, 7), speed: 4.6, w: 9, h: 10, dmg: 3, hs: 12, bs: 6, kb: 0.8, glyph: pick(['4', '8', '%', '2', '7', 'σ', 'n', 'μ']), draw: drawGlyph }); } },
      { name: 'MARGIN OF ERROR', input: 'qcb', btn: 'k', pose: 'stance', su: 4, ac: 30, rc: 14, special: true,
        desc: 'Counter stance. Hit him and it was within the margin. Projectiles bounce back.',
        onStart(f) { f.counter = 34; },
        onCounter(f, att, proj) {
          f.invuln = 24; fxErrorBars(f); popText('±3.5 PTS', f.x, GROUND - f.y - 90, '#ff6'); SFX.play('counter');
          if (proj) { shoot(f, { oy: -44, speed: 5.5, w: 10, h: 10, dmg: (proj.dmg || 6) + 4, hs: 18, kb: 2.5, glyph: '±', col: '#ff6', draw: drawGlyph }); f.startMove({ pose: 'cast', su: 2, ac: 2, rc: 12, special: true }, 'moe'); }
          else { f.face(att); f.startMove({ pose: 'straight', su: 3, ac: 5, rc: 18, dmg: 13, lvl: 'mid', unblockable: true, box: { x: 0, y: -60, w: 42, h: 52 }, hs: 24, kb: 3, knockdown: true, special: true }, 'moe'); }
        } },
    ],
    super: { name: 'THE MODEL', pose: 'raise', su: 12, ac: 2, rc: 44, special: true, isSuper: true,
      desc: 'Fifty thousand simulations rain down as a histogram.',
      spawn(f, o) {
        popText('50,000 SIMULATIONS', o.x, 60, '#6f6', 8, 70);
        for (let i = 0; i < 7; i++) {
          shoot(f, { x: o.x + (i - 3) * 18, y: -30 - i * 24, vx: 0, w: 14, h: 36, dmg: 6, life: 160, hs: 20, kb: 1, isSuper: true, clash: false, grav: 0.35,
            col: i % 2 ? '#e33' : '#36f', label: rndi(41, 59) + '%', draw: drawBar,
            update(p) { if (p.y > GROUND - 18) { p.y = GROUND - 18; p.vy = 0; p.grav = 0; if (!p.ld) { p.ld = 1; dust(p.x, GROUND, 4); p.life = Math.min(p.life, 22); } } } });
        }
      } },
  },
  {
    id: 'silver', name: 'NATE SILVER', short: 'SILVER', outlet: 'SILVER BULLETIN', title: 'THE FORECASTER', stage: 'vegas',
    skin: '#e9c3a0', heads: [{ hair: 'receding', hairColor: '#4a4040', glasses: true }],
    shirt: '#f2f2f2', jacket: '#8b929c', tie: '#2a2f6a', pants: '#3b3f48', shoes: '#1d1d1d', build: 11, height: 0.98,
    intro: 'This is a 70/30 fight. Respect the 30.', quote: 'Told you. It was +EV the whole time.',
    specials: [
      { name: 'SILVER BULLET', input: 'qcf', btn: 'p', pose: 'point', su: 12, ac: 2, rc: 20, special: true,
        desc: 'A fast, shiny, extremely confident projectile.',
        spawn(f) { SFX.play('shot'); shoot(f, { oy: -52, speed: 8, w: 12, h: 6, dmg: 9, hs: 18, kb: 3, draw: drawBullet }); } },
      { name: 'RIVER CARD', input: 'qcb', btn: 'k', pose: 'raise', su: 12, ac: 2, rc: 22, special: true,
        desc: 'Lobs an ace over the top. Must be blocked standing.',
        spawn(f) { shoot(f, { oy: -64, speed: 3.3, vy: -4, grav: 0.25, w: 11, h: 16, dmg: 10, hs: 22, kb: 2.5, knockdown: true, ground: true, draw: drawCard, onGround(p) { p.dead = true; spark(p.x, GROUND - 4, '#fff', 6); } }); } },
    ],
    super: { name: 'ALL IN', pose: 'cast', su: 14, ac: 2, rc: 36, special: true, isSuper: true,
      desc: 'Shoves every chip forward. A rolling wall of variance.',
      spawn(f) { shoot(f, { oy: -20, speed: 3.4, w: 44, h: 38, dmg: 5, hits: 6, interval: 7, life: 160, hs: 16, kb: 1.2, isSuper: true, clash: false, draw: drawChipWave, update(p) { p.knockdown = p.hits <= 1; } }); } },
  },
  {
    id: 'bonbach', name: 'BONICA × GRUMBACH', short: 'BON×GRUM', outlet: 'ON DATA & DEMOCRACY', title: 'THE TWO-HEADED REGRESSION', stage: 'substack',
    skin: '#e3b28e', heads: [
      { hair: 'short', hairColor: '#2a2018', glasses: true },
      { hair: 'curly', hairColor: '#3a2a1a', beard: true, skin: '#dcaa84' },
    ],
    shirt: '#4a6fa5', jacket: '#f0f0f0', coat: true, pants: '#2e3440', shoes: '#222222', build: 15, height: 1.02,
    intro: 'We ran the regression. / Twice. You lose.', quote: 'Statistically significant beatdown. (p < 0.001)',
    specials: [
      { name: 'DIME SCORE', input: 'qcf', btn: 'p', pose: 'cast', su: 11, ac: 2, rc: 22, special: true,
        desc: 'Scatters a fan of campaign-finance dimes. Every dime gets an ideology score.',
        spawn(f) { for (const vy of [-1.1, 0, 1.1]) shoot(f, { oy: -42, speed: 4, vy, w: 8, h: 8, dmg: 4, hs: 14, draw: drawDime }); } },
      { name: 'LABORATORIES', input: 'qcb', btn: 'k', pose: 'raise', su: 12, ac: 2, rc: 22, special: true,
        desc: 'Laboratories Against Democracy: a flask that leaves a bubbling low hazard.',
        spawn(f) {
          shoot(f, { oy: -60, speed: 2.6, vy: -3.5, grav: 0.22, w: 9, h: 11, dmg: 6, hs: 16, ground: true, draw: drawFlask,
            onGround(p) { p.dead = true; spark(p.x, GROUND - 4, '#7f7', 10); shoot(p.owner, { x: p.x, y: GROUND - 4, vx: 0, w: 36, h: 8, dmg: 3, lvl: 'low', hits: 5, interval: 22, life: 160, hs: 14, bs: 8, kb: 0.5, clash: false, draw: drawPuddle }); } });
        } },
    ],
    super: { name: 'REGRESSION LINE', pose: 'cast', su: 30, ac: 2, rc: 40, special: true, isSuper: true,
      desc: 'Plots the scatter, then fires the line of best fit straight through you.',
      onStart(f) { fxScatter(f); },
      spawn(f) {
        const ox = f.x + f.facing * 16;
        shoot(f, { x: ox, y: GROUND - 44, vx: 0, w: 1, h: 16, dmg: 4, hits: 8, interval: 5, life: 48, hs: 12, kb: 0.6, isSuper: true, clash: false, ox, draw: drawBeam,
          update(p) { p.w = W * Math.min(1, p.t / 6); p.x = p.ox + p.dir * p.w / 2; p.knockdown = p.hits <= 1; },
          onHit(p) { if (p.hits === 7) popText('p < 0.05', p.owner.opp.x, GROUND - 100, '#6ff', 8, 60); } });
      } },
  },
  {
    id: 'yglesias', name: 'MATT YGLESIAS', short: 'YGLESIAS', outlet: 'SLOW BORING', title: 'THE POLICY WONK', stage: 'substack',
    skin: '#e6bf9c', heads: [{ hair: 'swoop', hairColor: '#2b231d', stubble: true }],
    shirt: '#9cc3e6', jacket: '#24324f', pants: '#5b5b52', shoes: '#3b2414', build: 11, height: 1.08,
    intro: 'Okay, but have you considered abundance?', quote: 'The strong and slow boring of hard opponents.',
    specials: [
      { name: 'SLOW BORING', input: 'qcf', btn: 'p', pose: 'cast', su: 14, ac: 2, rc: 24, special: true,
        desc: 'A painfully slow drill that just keeps boring. Hits five times.',
        spawn(f) { shoot(f, { oy: -36, speed: 1.2, w: 26, h: 14, dmg: 3, hits: 5, interval: 12, life: 260, hs: 14, bs: 8, kb: 0.6, draw: drawDrill, onHit(p) { spark(p.x, p.y, '#c96', 5); } }); } },
      { name: 'BUILD MORE HOUSING', input: 'qcb', btn: 'k', pose: 'raise', su: 14, ac: 2, rc: 26, special: true,
        desc: 'Upzones the ground under you. An apartment tower launches you.',
        spawn(f, o) {
          const px = f.x + f.facing * clamp(Math.abs(o.x - f.x), 40, 110);
          shoot(f, { x: px, y: GROUND - 2, vx: 0, w: 22, h: 4, dmg: 10, life: 52, launch: true, hs: 30, clash: false, armed: false, th: 0, draw: drawTower,
            update(p) { p.th = p.t < 10 ? 0 : p.t < 36 ? Math.min(60, (p.t - 10) * 10) : Math.max(0, 60 - (p.t - 36) * 5); p.h = Math.max(4, p.th); p.y = GROUND - p.h / 2; p.armed = p.t >= 10 && p.t < 22; } });
        } },
    ],
    super: { name: 'ONE BILLION AMERICANS', pose: 'raise', su: 16, ac: 2, rc: 42, special: true, isSuper: true,
      desc: 'Summons the population of a properly ambitious nation. It runs at you.',
      spawn(f) {
        const sk = ['#f1c27d', '#e0ac69', '#8d5524', '#c68642', '#ffdbac', '#5c3a21'], sh = ['#e33', '#38f', '#3c6', '#fc3', '#c6f', '#f84', '#eee'];
        shoot(f, { ox: -70, oy: -16, speed: 4, w: 70, h: 34, dmg: 4, hits: 8, interval: 5, life: 180, hs: 12, kb: 1.6, isSuper: true, clash: false,
          people: Array.from({ length: 44 }, () => ({ dx: rnd(-35, 35), dy: rnd(-12, 16), c: pick(sh), sk: pick(sk), ph: rnd(0, 2) })), draw: drawCrowd,
          update(p) { p.knockdown = p.hits <= 1; } });
      } },
  },
  {
    id: 'luntz', name: 'FRANK LUNTZ', short: 'LUNTZ', outlet: 'WORDS THAT WORK', title: 'THE FOCUS GROUPER', stage: 'fair',
    skin: '#eab89a', heads: [{ hair: 'shaggy', hairColor: '#7a6a5e', glasses: true }],
    shirt: '#dfe6ee', jacket: '#1f2433', scarf: '#8a1c2c', pants: '#2a2e3a', shoes: '#111111', build: 16, height: 1.0,
    intro: "It's not a beating. It's a 'clarity event.'", quote: 'Words that work. Fists that work, too.',
    specials: [
      { name: 'WORDS THAT WORK', input: 'qcf', btn: 'p', pose: 'cast', su: 12, ac: 2, rc: 22, special: true,
        desc: 'Fires a focus-grouped phrase. It tested very well.',
        spawn(f) { const word = pick(['DEATH TAX', 'TAX RELIEF', 'FREEDOM', 'TAKEOVER', 'OWNERSHIP', 'CLARITY']); shoot(f, { oy: -52, speed: 3.3, w: word.length * 8 + 10, h: 14, dmg: 8, hs: 18, kb: 2.5, word, draw: drawWord }); } },
      { name: 'FOCUS GROUP', input: 'qcb', btn: 'k', pose: 'grab', su: 8, ac: 3, rc: 30, special: true,
        dmg: 16, lvl: 'mid', unblockable: true, throwHit: true, box: { x: 4, y: -52, w: 26, h: 42 }, hs: 30, kb: 3,
        desc: 'Command grab. Seats you in a circle of undecided voters. They hate you.',
        onHitFx(a, d) { fxFocusGroup(d); popText('DIAL: -87', d.x, GROUND - 90, '#f55', 8, 60); SFX.play('throw'); } },
    ],
    super: { name: 'THE DIAL TEST', pose: 'raise', su: 12, ac: 2, rc: 46, special: true, isSuper: true,
      desc: 'A live audience dial-tests you in real time. The needle goes to zero.',
      spawn(f, o) {
        shoot(f, { x: o.x, y: GROUND - 36, vx: 0, w: 50, h: 70, dmg: 5, hits: 6, interval: 6, life: 96, hs: 14, kb: 0.8, isSuper: true, clash: false, armed: false, draw: drawDial,
          update(p) { if (p.t < 22) p.x += (o.x - p.x) * 0.2; p.armed = p.t >= 26; p.knockdown = p.hits <= 1; },
          onHit(p) { if (p.hits === 0) popText('FOCUS GROUP HATES YOU', o.x, GROUND - 110, '#f55', 8, 70); } });
      } },
  },
];

function altDef(d) {
  return Object.assign({}, d, {
    id: d.id + '_alt',
    shirt: shade(d.shirt, d.jacket ? 0.3 : -0.45), jacket: d.jacket ? shade(d.jacket, 0.35) : null,
    pants: shade(d.pants, 0.4), split: d.split ? '#7a2ad7' : null, scarf: d.scarf ? '#1c5a8a' : null,
  });
}
