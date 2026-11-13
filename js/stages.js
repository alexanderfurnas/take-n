'use strict';
/* =====================================================================
   TAKE-N — stages (procedural pixel backgrounds with parallax)
   Each stage: draw(c, camX, t) paints the whole screen behind fighters.
   ===================================================================== */

function vgrad(c, stops) {
  const g = c.createLinearGradient(0, 0, 0, H);
  stops.forEach(([p, col]) => g.addColorStop(p, col));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
const wrapX = (x, span) => ((x % span) + span) % span;

function drawFloor(c, camX, top, base, line, spacing = 48) {
  c.fillStyle = base; c.fillRect(0, top, W, H - top);
  for (let i = 1; i < 7; i++) { const y = top + Math.round(Math.pow(i / 7, 1.7) * (H - top)); c.fillStyle = line; c.fillRect(0, y, W, 1); }
  for (let wx = -spacing * 8; wx < STAGE_W + spacing * 8; wx += spacing) {
    const xb = wx - camX; const xt = W / 2 + (xb - W / 2) * 0.55;
    if (xb < -200 || xb > W + 200) continue;
    seg(c, xt, top, xb, H, 1, line);
  }
}

// ---------------------------------------------------------------- ELECTION NIGHT
const US_TILES = [
  'R.........B',
  '.........BB',
  'BRRRBBPPBBB',
  'BPRRRRRPBB.',
  'BRBRRRRBBB.',
  '.PBRRRPRB..',
  '...RRRRP...',
  'B..R....R..',
];
const TICKER = 'BREAKING: CROSSTABS UNWEIGHTED  ///  SAMPLE SIZE N=412, VIBES=HIGH  ///  LIKELY VOTER SCREEN UNDER REVIEW  ///  ' +
  'MODEL SAYS 50.3%  ///  "IT\'S A COIN FLIP" SAYS EVERYONE  ///  HERDING DETECTED IN SECTOR 7  ///  DO NOT UNSKEW THE POLLS  ///  ';

function drawElection(c, camX, t) {
  vgrad(c, [[0, '#04051a'], [0.7, '#141a44'], [1, '#0a0c22']]);
  c.globalAlpha = 0.07; c.fillStyle = '#9bf';
  for (let i = 0; i < 4; i++) {
    const x = wrapX(i * 170 - camX * 0.2 + Math.sin(t * 0.01 + i) * 40, 700) - 110;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x - 45, 205); c.lineTo(x + 45, 205); c.fill();
  }
  c.globalAlpha = 1;
  const fx = Math.round(-camX * 0.5) + 40;
  // video wall
  c.fillStyle = '#000'; c.fillRect(fx + 10, 16, 600, 146);
  c.fillStyle = '#0b1236'; c.fillRect(fx + 14, 20, 592, 138);
  for (let y = 22; y < 158; y += 3) { c.fillStyle = 'rgba(255,255,255,0.03)'; c.fillRect(fx + 14, y, 592, 1); }
  // tile cartogram
  const mx = fx + 40, my = 34, ts = 13;
  US_TILES.forEach((row, r) => {
    for (let col = 0; col < row.length; col++) {
      const ch = row[col]; if (ch === '.') continue;
      let color = ch === 'R' ? '#d33' : ch === 'B' ? '#36d' : (Math.sin(t * 0.03 + col * 1.7 + r * 2.3) > 0 ? '#d33' : '#36d');
      if (ch === 'P' && (t + col * 13 + r * 7) % 90 < 8) color = '#c6f';
      c.fillStyle = '#000'; c.fillRect(mx + col * ts - 1, my + r * ts - 1, ts - 1, ts - 1);
      c.fillStyle = color; c.fillRect(mx + col * ts, my + r * ts, ts - 3, ts - 3);
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(mx + col * ts, my + r * ts, ts - 3, 1);
    }
  });
  txt('TOSS-UPS', mx + 72, my + 110, 8, '#c6f', 'center');
  // the needle
  const nx = fx + 290, ny = 112;
  c.fillStyle = '#05081c'; c.fillRect(nx - 52, ny - 66, 104, 84);
  for (let i = 0; i < 24; i++) {
    const a = Math.PI + i / 24 * Math.PI;
    c.fillStyle = i < 6 ? '#2a4fc9' : i < 10 ? '#7a9ff0' : i < 14 ? '#dddddd' : i < 18 ? '#f09a9a' : '#c92a2a';
    c.beginPath(); c.moveTo(nx, ny); c.arc(nx, ny, 42, a, a + Math.PI / 24 + 0.02); c.fill();
  }
  c.fillStyle = '#05081c'; c.beginPath(); c.arc(nx, ny, 15, Math.PI, 0); c.fill();
  const na = Math.PI * 1.5 + Math.sin(t * 0.021) * 0.7 + Math.sin(t * 0.37) * 0.08 + (Math.random() - 0.5) * 0.12;
  seg(c, nx, ny, nx + Math.cos(na) * 40, ny + Math.sin(na) * 40, 2, '#fff');
  txt('THE NEEDLE', nx, ny + 4, 8, '#fff', 'center');
  // electoral count
  const ex = fx + 380;
  c.fillStyle = '#05081c'; c.fillRect(ex, 34, 200, 112);
  txt('ELECTORAL VOTES', ex + 100, 42, 8, '#ccc', 'center');
  const swing = Math.round(Math.sin(t * 0.013) * 9);
  txt(String(262 + swing), ex + 50, 64, 16, '#5b8cff', 'center');
  txt(String(276 - swing), ex + 150, 64, 16, '#ff5b5b', 'center');
  txt('270 TO WIN', ex + 100, 92, 8, '#ff0', 'center');
  c.fillStyle = '#36d'; c.fillRect(ex + 12, 110, Math.round(176 * (262 + swing) / 538), 10);
  c.fillStyle = '#d33'; c.fillRect(ex + 188 - Math.round(176 * (276 - swing) / 538), 110, Math.round(176 * (276 - swing) / 538), 10);
  c.fillStyle = '#fff'; c.fillRect(ex + 100, 106, 1, 18);
  if (t % 60 < 40) { c.fillStyle = '#c00'; c.fillRect(ex + 8, 128, 40, 12); txt('LIVE', ex + 12, 130, 8, '#fff', 'left', null); }
  // ticker
  c.fillStyle = '#8a0000'; c.fillRect(0, 164, W, 12);
  const span = TICKER.length * 8;
  const tx = W - wrapX(t * 1.3, span + W);
  txt(TICKER, tx, 166, 8, '#fff', 'left', null);
  c.fillStyle = '#ffcc00'; c.fillRect(0, 164, 68, 12); txt('DECISION', 2, 166, 8, '#000', 'left', null);
  drawFloor(c, camX, 205, '#12152e', '#232a66');
  // crowd
  for (let i = 0; i < 44; i++) {
    const x = wrapX(i * 23 - camX * 0.75, W + 60) - 30;
    const y = 198 + (i % 3) * 4 - Math.round(Math.abs(Math.sin(t * 0.08 + i * 0.7)) * 2);
    c.fillStyle = '#06061a'; c.fillRect(x - 5, y, 10, 18); c.fillRect(x - 3, y - 7, 7, 7);
    if (i % 7 === 0) { c.fillRect(x, y - 12, 1, 6); c.fillStyle = i % 14 ? '#e33' : '#38f'; c.fillRect(x - 18, y - 21, 36, 10); txt(i % 14 ? '±3' : 'N=1K', x, y - 20, 8, '#fff', 'center', null); }
  }
}

// ---------------------------------------------------------------- SUBSTACK HQ
function drawSubstack(c, camX, t) {
  vgrad(c, [[0, '#1a0d06'], [1, '#3d1c0b']]);
  const fx = Math.round(-camX * 0.5) + 10;
  for (let y = 8, row = 0; y < 204; y += 8, row++) {
    for (let x = -20; x < 640; x += 20) {
      const xx = fx + x + (row % 2 ? 10 : 0);
      c.fillStyle = ((x * 7 + row * 13) % 9 === 0) ? '#6e3019' : '#5a2614';
      c.fillRect(xx, y, 18, 6);
    }
  }
  txt('PAYWALL', fx + 120, 26, 16, 'rgba(255,230,200,0.18)', 'center', null);
  txt('NO REFUNDS', fx + 120, 46, 8, 'rgba(255,230,200,0.18)', 'center', null);
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.08);
  c.shadowColor = '#ff6719'; c.shadowBlur = 8 + pulse * 12;
  rrect(c, fx + 300, 54, 200, 40, '#ff6719');
  c.shadowBlur = 0;
  txt('SUBSCRIBE', fx + 400, 66, 16, '#fff', 'center', '#a33a00');
  txt('$8/MONTH · CANCEL ANYTIME', fx + 400, 100, 8, '#ffb38a', 'center');
  // floating notifications
  const msgs = ['+1 PAID', '+1 FREE', 'RESTACK!', '♥ 1.2K', '+1 PAID', 'NEW POST'];
  for (let i = 0; i < 6; i++) {
    const ph = wrapX(t * 0.45 + i * 53, 300);
    const y = Math.round(196 - ph * 0.55), x = fx + 30 + i * 100;
    c.globalAlpha = clamp(Math.min(ph / 30, (300 - ph) / 40), 0, 1) * 0.9;
    rrect(c, x - 32, y, 64, 14, '#fff');
    txt(msgs[i], x, y + 3, 8, '#ff6719', 'center', null);
    c.globalAlpha = 1;
  }
  // desks (mid layer)
  const mx = -camX * 0.8;
  for (let i = 0; i < 10; i++) {
    const x = Math.round(wrapX(i * 110 + mx, 1100) - 100);
    c.fillStyle = '#2a140a'; c.fillRect(x, 178, 70, 6); c.fillRect(x + 4, 184, 4, 22); c.fillRect(x + 62, 184, 4, 22);
    c.fillStyle = '#222'; c.fillRect(x + 20, 162, 30, 16); c.fillStyle = (t + i * 20) % 120 < 100 ? '#ff8a4a' : '#fff'; c.fillRect(x + 22, 164, 26, 12);
    c.fillStyle = '#ffd2b0'; for (let l = 0; l < 3; l++) c.fillRect(x + 24, 166 + l * 3, 12 + ((i + l) * 7) % 10, 1);
    c.fillStyle = '#ffcc66'; c.fillRect(x + 56, 170, 6, 8);
  }
  // floor: planks
  c.fillStyle = '#7a4a26'; c.fillRect(0, 205, W, H - 205);
  for (let r = 0; r < 6; r++) {
    const y = 205 + r * 11; c.fillStyle = '#5e3518'; c.fillRect(0, y, W, 1);
    for (let k = 0; k < 12; k++) { const x = Math.round(wrapX(k * 90 + r * 37 - camX, 1080) - 60); c.fillRect(x, y, 1, 11); }
  }
  c.fillStyle = 'rgba(255,140,60,0.08)'; c.fillRect(0, 205, W, 20);
}

// ---------------------------------------------------------------- IOWA STATE FAIR
function drawFair(c, camX, t) {
  vgrad(c, [[0, '#2b1e5a'], [0.45, '#c8507a'], [0.75, '#ff9a59'], [1, '#ffd27f']]);
  const sx = Math.round(320 - camX * 0.1);
  c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(sx, 150, 34, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(sx, 150, 26, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 5; i++) {
    const x = Math.round(wrapX(i * 140 + t * 0.15 - camX * 0.15, 700) - 100), y = 24 + (i * 37) % 60;
    c.fillStyle = 'rgba(255,220,230,0.7)'; c.fillRect(x, y, 50, 6); c.fillRect(x + 10, y - 5, 26, 5); c.fillRect(x + 6, y + 6, 36, 3);
  }
  const fx = Math.round(-camX * 0.4);
  // ferris wheel
  const wx = fx + 420, wy = 96, wr = 64, rot = t * 0.006;
  seg(c, wx, wy, wx - 40, 205, 3, '#3a2050'); seg(c, wx, wy, wx + 40, 205, 3, '#3a2050');
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5; seg(c, wx, wy, wx + Math.cos(a) * wr, wy + Math.sin(a) * wr, 1, '#5a3a70'); }
  c.strokeStyle = '#5a3a70'; c.lineWidth = 2; c.beginPath(); c.arc(wx, wy, wr, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 10; i++) {
    const a = rot + i * Math.PI / 5, x = Math.round(wx + Math.cos(a) * wr), y = Math.round(wy + Math.sin(a) * wr);
    c.fillStyle = '#111'; c.fillRect(x - 5, y, 10, 8); c.fillStyle = ['#e33', '#fc3', '#3cf', '#3c6', '#f6c'][i % 5]; c.fillRect(x - 4, y + 1, 8, 6);
  }
  c.fillStyle = (t % 40 < 20) ? '#fff' : '#fc3'; c.fillRect(wx - 3, wy - 3, 6, 6);
  // tents
  for (let i = 0; i < 3; i++) {
    const x = fx + 40 + i * 120, y = 150;
    for (let s = 0; s < 8; s++) { c.fillStyle = s % 2 ? '#fff' : '#d22'; c.fillRect(x + s * 10, y, 10, 50); }
    c.fillStyle = '#d22'; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 40, y - 30); c.lineTo(x + 86, y); c.fill();
    c.fillStyle = '#fff'; c.fillRect(x + 39, y - 38, 2, 10); c.fillStyle = '#fc3'; c.fillRect(x + 41, y - 38, 8, 5);
  }
  rrect(c, fx + 54, 126, 100, 16, '#fff3c0');
  txt('STRAW POLL', fx + 104, 130, 8, '#a22', 'center', null);
  rrect(c, fx + 186, 126, 92, 16, '#fff3c0');
  txt('BUTTER COW', fx + 232, 130, 8, '#a60', 'center', null);
  // corn
  const cx = -camX * 0.75;
  for (let i = 0; i < 140; i++) {
    const x = Math.round(wrapX(i * 6 + cx, 840) - 60), h = 22 + ((i * 37) % 14);
    const sway = Math.round(Math.sin(t * 0.03 + i * 0.4));
    c.fillStyle = i % 2 ? '#3e7a1e' : '#2f6418'; c.fillRect(x + sway, 205 - h, 3, h);
    c.fillStyle = '#e8c840'; if (i % 3 === 0) c.fillRect(x + sway + 2, 205 - h + 6, 2, 5);
  }
  // hay
  for (let i = 0; i < 4; i++) { const x = Math.round(wrapX(i * 210 - camX * 0.9 + 40, 840) - 60); c.fillStyle = '#7a5a10'; c.fillRect(x, 190, 34, 18); c.fillStyle = '#d8b040'; c.fillRect(x + 1, 191, 32, 16); c.fillStyle = '#b08a20'; c.fillRect(x + 1, 197, 32, 1); c.fillRect(x + 1, 202, 32, 1); }
  // dirt floor
  c.fillStyle = '#8a5a32'; c.fillRect(0, 205, W, H - 205);
  for (let i = 0; i < 90; i++) {
    const wxp = (i * 97) % STAGE_W, y = 207 + (i * 53) % 60;
    const x = Math.round(wxp - camX); if (x < -2 || x > W) continue;
    c.fillStyle = i % 3 ? '#6e4424' : '#a8743e'; c.fillRect(x, y, 3, 2);
    if (i % 5 === 0) { c.fillStyle = '#5a8a2a'; c.fillRect(x, y - 3, 1, 3); c.fillRect(x + 2, y - 2, 1, 2); }
  }
}

// ---------------------------------------------------------------- THE POKER ROOM
function neon(c, s, x, y, size, col, on = true) {
  c.shadowColor = col; c.shadowBlur = on ? 10 : 0;
  txt(s, x, y, size, on ? col : shade(col, -0.6), 'center', null);
  c.shadowBlur = 0;
}
function drawVegas(c, camX, t) {
  vgrad(c, [[0, '#0d0418'], [1, '#2a0a36']]);
  const fx = Math.round(-camX * 0.45);
  for (let i = 0; i < 30; i++) { c.fillStyle = (t + i * 7) % 50 < 25 ? '#ffd56a' : '#7a5a20'; c.fillRect(fx + 20 + i * 20, 42, 3, 3); }
  neon(c, 'ON THE EDGE', fx + 170, 52, 16, '#3ff', (t % 140) > 6 && (t % 140) < 130 || (t % 4 < 2));
  neon(c, 'EV+', fx + 420, 50, 16, '#f4c');
  neon(c, '♠ ♥ ♣ ♦', fx + 420, 74, 8, '#ff5');
  neon(c, 'NO LIMIT TAKES', fx + 170, 76, 8, '#f84', t % 90 > 10);
  // slot machines
  const mx = -camX * 0.7;
  for (let i = 0; i < 14; i++) {
    const x = Math.round(wrapX(i * 56 + mx, 784) - 60), y = 100;
    c.fillStyle = '#111'; c.fillRect(x - 1, y - 1, 42, 106);
    c.fillStyle = i % 2 ? '#6a1a7a' : '#1a3a7a'; c.fillRect(x, y, 40, 104);
    c.fillStyle = '#fd3'; c.fillRect(x + 2, y + 2, 36, 10);
    txt(i % 3 ? 'SLOTS' : 'POLLS', x + 20, y + 3, 8, '#600', 'center', null);
    c.fillStyle = '#eee'; c.fillRect(x + 4, y + 22, 32, 18);
    const spin = Math.floor((t + i * 11) / 6);
    for (let r = 0; r < 3; r++) txt(['7', '%', '$', '±'][(spin + r * 3 + i) % 4], x + 9 + r * 11, y + 27, 8, '#c00', 'center', null);
    for (let l = 0; l < 4; l++) { c.fillStyle = (t + l * 6 + i * 3) % 24 < 12 ? '#ff5' : '#553'; c.fillRect(x + 6 + l * 8, y + 48, 4, 4); }
    c.fillStyle = '#999'; c.fillRect(x + 40, y + 20, 3, 20); c.fillStyle = '#e22'; c.fillRect(x + 39, y + 16, 5, 5);
  }
  // carpet
  c.fillStyle = '#4a0d1e'; c.fillRect(0, 205, W, H - 205);
  for (let r = 0; r < 6; r++) for (let k = 0; k < 40; k++) {
    const x = Math.round(wrapX(k * 24 + (r % 2) * 12 - camX, 960) - 30), y = 210 + r * 11;
    c.fillStyle = '#c9a227'; c.fillRect(x, y, 2, 2); c.fillStyle = '#7a1a30'; c.fillRect(x - 5, y + 4, 12, 1);
  }
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 205, W, 4);
}

const STAGES = {
  election: { name: 'ELECTION NIGHT HQ', draw: drawElection },
  substack: { name: 'SUBSTACK HQ', draw: drawSubstack },
  fair: { name: 'IOWA STATE FAIR', draw: drawFair },
  vegas: { name: 'THE POKER ROOM', draw: drawVegas },
};
