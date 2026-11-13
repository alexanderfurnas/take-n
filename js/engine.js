'use strict';
/* =====================================================================
   TAKE-N — engine: constants, utils, input, audio, fighters,
   projectiles, hit resolution, effects, pixel-body rendering
   ===================================================================== */

const W = 480, H = 270, GROUND = 240, STAGE_W = 760, MAXHP = 120;
const FONT = '"Press Start 2P", "Courier New", monospace';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  const si = s >= 1 && (s - Math.floor(s)) < 0.35 ? Math.floor(s) : s;
  canvas.style.width = Math.floor(W * si) + 'px';
  canvas.style.height = Math.floor(H * si) + 'px';
}
addEventListener('resize', fitCanvas);
fitCanvas();

// ---------------------------------------------------------------- utils
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
function weighted(opts) {
  let tot = 0; for (const o of opts) tot += o[1];
  let r = Math.random() * tot;
  for (const o of opts) { r -= o[1]; if (r <= 0) return o[0]; }
  return opts[opts.length - 1][0];
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const _shade = new Map();
function shade(hex, amt) {
  const key = hex + amt; let v = _shade.get(key); if (v) return v;
  const c = parseInt(hex.slice(1), 16);
  const f = x => clamp(Math.round(amt < 0 ? x * (1 + amt) : x + (255 - x) * amt), 0, 255);
  v = '#' + (0x1000000 | (f(c >> 16 & 255) << 16) | (f(c >> 8 & 255) << 8) | f(c & 255)).toString(16).slice(1);
  _shade.set(key, v); return v;
}

function txt(s, x, y, size = 8, col = '#fff', align = 'left', sh = '#000') {
  ctx.font = size + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (sh) { ctx.fillStyle = sh; const o = size >= 16 ? 2 : 1; ctx.fillText(s, x + o, y + o); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function bigTxt(s, x, y, size, col, ol = '#000', align = 'center', thick = 2) {
  ctx.font = size + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'top';
  ctx.fillStyle = ol;
  for (let dx = -thick; dx <= thick; dx++) for (let dy = -thick; dy <= thick + 1; dy++) ctx.fillText(s, x + dx, y + dy);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function wrapTxt(s, x, y, maxChars, size = 8, col = '#fff', align = 'left', lh) {
  const words = s.split(' '); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }
  if (cur.trim()) lines.push(cur.trim());
  lines.forEach((l, i) => txt(l, x, y + i * (lh || size + 4), size, col, align));
  return lines.length;
}
function rrect(c, x, y, w, h, col) {
  c.fillStyle = col; c.fillRect(x + 2, y, w - 4, h); c.fillRect(x + 1, y + 1, w - 2, h - 2); c.fillRect(x, y + 2, w, h - 4);
}
// chunky pixel line: stamps t*t squares along the segment
function seg(c, x1, y1, x2, y2, t, col) {
  c.fillStyle = col;
  const dx = x2 - x1, dy = y2 - y1, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))), h = t / 2;
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x1 + dx * i / n - h), Math.round(y1 + dy * i / n - h), t, t);
}

// ---------------------------------------------------------------- input
const Keys = {}, Tapped = {};
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Quote', 'Slash', 'Backspace', 'Backslash'].includes(e.code)) e.preventDefault();
  if (!Keys[e.code]) Tapped[e.code] = true;
  Keys[e.code] = true;
  SFX.init();
  if (e.code === 'KeyM' && !e.repeat) SFX.setMuted(!SFX.muted);
});
addEventListener('keyup', e => { Keys[e.code] = false; });
addEventListener('blur', () => { for (const k in Keys) Keys[k] = false; });
addEventListener('pointerdown', () => SFX.init());

const KEYMAP = [
  { u: ['KeyW'], d: ['KeyS'], l: ['KeyA'], r: ['KeyD'], lp: ['KeyU'], rp: ['KeyI'], lk: ['KeyJ'], rk: ['KeyK'],
    sup: ['KeyO', 'KeyL'], thr: ['KeyH'], start: ['Enter', 'Space'], back: ['Escape', 'Backspace'] },
  { u: ['ArrowUp'], d: ['ArrowDown'], l: ['ArrowLeft'], r: ['ArrowRight'], lp: ['BracketLeft', 'Numpad4'], rp: ['BracketRight', 'Numpad5'],
    lk: ['Semicolon', 'Numpad1'], rk: ['Quote', 'Numpad2'], sup: ['Backslash', 'Numpad6'], thr: ['Slash', 'Numpad3'], start: ['NumpadEnter'], back: [] },
];
const BTN = ['u', 'd', 'l', 'r', 'lp', 'rp', 'lk', 'rk', 'sup', 'thr', 'start', 'back'];
const prevHeld = [{}, {}];

function rawHeld(pi) {
  const m = KEYMAP[pi], h = {};
  for (const b of BTN) h[b] = (m[b] || []).some(c => Keys[c] || Tapped[c]);
  const pads = navigator.getGamepads ? navigator.getGamepads() : null;
  const gp = pads && pads[pi];
  if (gp && gp.connected) {
    const B = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes || [];
    h.u = h.u || B(12) || ax[1] < -0.5; h.d = h.d || B(13) || ax[1] > 0.5;
    h.l = h.l || B(14) || ax[0] < -0.5; h.r = h.r || B(15) || ax[0] > 0.5;
    h.lp = h.lp || B(2); h.rp = h.rp || B(3); h.lk = h.lk || B(0); h.rk = h.rk || B(1);
    h.sup = h.sup || B(5) || B(7); h.thr = h.thr || B(4) || B(6); h.start = h.start || B(9); h.back = h.back || B(8);
  }
  return h;
}
// call exactly once per tick per player
function readPlayer(pi, mergeOther) {
  const h = rawHeld(pi);
  if (mergeOther) { const o = rawHeld(1); for (const b of BTN) h[b] = h[b] || o[b]; }
  const p = prevHeld[pi], e = {};
  for (const b of BTN) e[b] = h[b] && !p[b];
  prevHeld[pi] = h;
  return { u: h.u, d: h.d, l: h.l, r: h.r, lp: e.lp, rp: e.rp, lk: e.lk, rk: e.rk, sup: e.sup, thr: e.thr,
    start: e.start, back: e.back, pu: e.u, pd: e.d, pl: e.l, pr: e.r };
}
function blankInput() { return { u: false, d: false, l: false, r: false, lp: false, rp: false, lk: false, rk: false, sup: false, thr: false, special: null, dash: 0 }; }

// ---------------------------------------------------------------- audio
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const SONGS = {
  title: { bpm: 108, chords: [[60, 0], [55, 0], [57, 1], [53, 0]], hats: false, busy: false },
  select: { bpm: 128, chords: [[62, 1], [58, 0], [60, 0], [57, 1]], hats: true, busy: false },
  fight: { bpm: 152, chords: [[57, 1], [53, 0], [55, 0], [52, 1]], hats: true, busy: true },
  fight2: { bpm: 160, chords: [[52, 1], [52, 1], [48, 0], [50, 0]], hats: true, busy: true },
  win: { bpm: 120, chords: [[60, 0], [65, 0], [67, 0], [60, 0]], hats: true, busy: false },
};
const LEAD = [{ 0: 3, 3: 2, 6: 1, 8: 2, 10: 4, 12: 2, 14: 1 }, { 0: 2, 2: 3, 4: 2, 7: 1, 8: 0, 11: 1, 12: 2 }];

const SFX = {
  ac: null, master: null, mg: null, muted: false, noiseBuf: null, song: null, step: 0, next: 0,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.45; this.master.connect(this.ac.destination);
    this.mg = this.ac.createGain(); this.mg.gain.value = 0.3; this.mg.connect(this.master);
    const len = this.ac.sampleRate * 0.5; this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.next = this.ac.currentTime + 0.05;
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.45; },
  tone(t, f, dur, type = 'square', vol = 0.15, slide = null, dest = null) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(t, dur, vol, freq = 2000, type = 'highpass', dest = null) {
    const s = this.ac.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = this.ac.createBiquadFilter(); fl.type = type; fl.frequency.value = freq;
    const g = this.ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.master); s.start(t); s.stop(t + dur + 0.02);
  },
  play(name) {
    if (!this.ac || this.muted) return;
    const n = this.ac.currentTime;
    switch (name) {
      case 'hitL': this.noise(n, 0.08, 0.35, 1500); this.tone(n, 190, 0.08, 'square', 0.12, 60); break;
      case 'hitH': this.noise(n, 0.2, 0.5, 700); this.tone(n, 150, 0.2, 'sawtooth', 0.2, 40); break;
      case 'block': this.tone(n, 950, 0.05, 'square', 0.07, 600); this.noise(n, 0.04, 0.15, 4000); break;
      case 'whiff': this.noise(n, 0.07, 0.07, 2500, 'bandpass'); break;
      case 'jump': this.tone(n, 300, 0.1, 'square', 0.05, 620); break;
      case 'special': this.tone(n, 380, 0.22, 'square', 0.09, 1200); this.tone(n + 0.05, 600, 0.18, 'triangle', 0.1, 1800); break;
      case 'super': for (let i = 0; i < 7; i++) this.tone(n + i * 0.06, 260 + i * 110, 0.14, 'square', 0.1); this.noise(n, 0.7, 0.25, 500, 'lowpass'); break;
      case 'ko': this.tone(n, 220, 1.0, 'sawtooth', 0.22, 40); this.noise(n, 0.9, 0.45, 300, 'lowpass'); break;
      case 'select': this.tone(n, 660, 0.05, 'square', 0.07); break;
      case 'confirm': this.tone(n, 523, 0.08, 'square', 0.1); this.tone(n + 0.08, 784, 0.16, 'square', 0.1); break;
      case 'round': [523, 659, 784, 1046].forEach((f, i) => this.tone(n + i * 0.07, f, 0.14, 'square', 0.09)); break;
      case 'take': this.tone(n, 220, 0.4, 'sawtooth', 0.15, 880); this.noise(n, 0.3, 0.2, 1200); break;
      case 'land': this.noise(n, 0.07, 0.15, 400, 'lowpass'); break;
      case 'counter': this.tone(n, 1200, 0.15, 'square', 0.1, 2400); break;
      case 'throw': this.noise(n, 0.25, 0.4, 300, 'lowpass'); this.tone(n, 110, 0.25, 'square', 0.15, 40); break;
      case 'shot': this.noise(n, 0.12, 0.4, 3000); this.tone(n, 900, 0.1, 'square', 0.08, 200); break;
    }
  },
  music(name) { this.song = name ? SONGS[name] : null; this.songName = name; this.step = 0; if (this.ac) this.next = this.ac.currentTime + 0.06; },
  tick() {
    if (!this.ac || !this.song || this.muted) return;
    const s = this.song, spb = 60 / s.bpm / 4;
    if (this.next < this.ac.currentTime) this.next = this.ac.currentTime + 0.02;
    while (this.next < this.ac.currentTime + 0.15) { this.playStep(s, this.step, this.next); this.next += spb; this.step++; }
  },
  playStep(s, i, t) {
    const bar = Math.floor(i / 16) % s.chords.length, st = i % 16;
    const [root, minor] = s.chords[bar];
    const tones = [0, minor ? 3 : 4, 7, 12, (minor ? 3 : 4) + 12];
    const g = this.mg;
    if (st % 2 === 0) this.tone(t, mf(root - 24 + (st % 4 === 2 ? 12 : 0)), 0.12, 'triangle', 0.4, null, g);
    this.tone(t, mf(root + 12 + tones[[0, 1, 2, 3, 2, 1, 0, 1][st % 8]]), 0.06, 'square', 0.035, null, g);
    const L = LEAD[bar % 2][st];
    if (L !== undefined) this.tone(t, mf(root + 12 + tones[L]), s.busy ? 0.13 : 0.22, 'square', 0.06, null, g);
    if (st === 0 || st === 8 || (s.busy && (st === 10 || st === 14))) this.tone(t, 150, 0.12, 'sine', 0.55, 40, g);
    if (st === 4 || st === 12) this.noise(t, 0.12, 0.25, 1500, 'highpass', g);
    if (s.hats && st % 2 === 0) this.noise(t, 0.03, 0.08, 7000, 'highpass', g);
  },
};

// ---------------------------------------------------------------- poses
// joints in local space, facing right, feet at (0,0), y up = negative
const J0 = { hip: [0, -25], neck: [2, -46], head: [3, -55], fK: [8, -13], fF: [11, 0], bK: [-5, -13], bF: [-10, 0],
  fE: [10, -37], fH: [16, -45], bE: [6, -37], bH: [12, -43] };
const P = (...o) => Object.assign({}, J0, ...o);
const CR = { hip: [0, -15], neck: [5, -33], head: [7, -41], fK: [11, -12], fF: [10, 0], bK: [-3, -10], bF: [-10, 0],
  fE: [13, -25], fH: [17, -32], bE: [9, -24], bH: [14, -30] };
const JU = { hip: [0, -30], neck: [1, -51], head: [2, -60], fK: [9, -24], fF: [5, -14], bK: [-3, -22], bF: [-8, -12],
  fE: [10, -43], fH: [15, -50], bE: [5, -43], bH: [10, -49] };
const POSES = {
  idle: P(),
  crouch: P(CR),
  jump: P(JU),
  jab: P({ neck: [4, -46], head: [5, -55], fE: [18, -45], fH: [28, -47] }),
  straight: P({ hip: [2, -25], neck: [7, -45], head: [8, -54], fF: [14, 0], fK: [11, -13], bF: [-12, 0], bE: [17, -44], bH: [30, -46], fE: [8, -38], fH: [12, -44] }),
  lowkick: P({ hip: [-1, -26], neck: [-3, -47], head: [-3, -56], fK: [14, -11], fF: [28, -4] }),
  highkick: P({ hip: [-2, -27], neck: [-9, -45], head: [-11, -53], fK: [14, -35], fF: [29, -46], bK: [-5, -13], bF: [-7, 0], fE: [2, -38], fH: [6, -44], bE: [-14, -40], bH: [-18, -34] }),
  crouchjab: P(CR, { fE: [17, -27], fH: [26, -29] }),
  crouchkick: P(CR, { fK: [14, -6], fF: [29, -3] }),
  sweep: P(CR, { hip: [-3, -12], neck: [-4, -30], head: [-4, -38], fK: [14, -5], fF: [31, -2], bK: [-8, -8], bF: [-14, 0], bE: [-8, -18], bH: [-10, -3], fE: [4, -24], fH: [8, -30] }),
  uppercut: P({ hip: [2, -28], neck: [5, -50], head: [7, -59], fE: [13, -60], fH: [15, -73], bE: [0, -40], bH: [4, -34], fK: [10, -15], fF: [12, 0], bK: [-6, -14], bF: [-12, 0] }),
  jumppunch: P(JU, { fE: [14, -43], fH: [24, -38] }),
  jumpkick: P(JU, { fK: [12, -26], fF: [24, -18], bK: [-3, -24], bF: [-6, -12] }),
  grab: P({ neck: [5, -46], head: [6, -55], fE: [16, -42], fH: [25, -43], bE: [14, -40], bH: [23, -39] }),
  cast: P({ neck: [5, -46], head: [6, -55], fE: [16, -44], fH: [26, -45], bE: [14, -42], bH: [25, -42], fF: [13, 0], bF: [-12, 0] }),
  raise: P({ fE: [8, -58], fH: [12, -70], bE: [0, -56], bH: [2, -68] }),
  point: P({ neck: [3, -46], head: [4, -55], fE: [14, -52], fH: [24, -60], bE: [0, -36], bH: [2, -28] }),
  dashpose: P({ hip: [2, -24], neck: [8, -44], head: [10, -52] }),
  knee: P({ hip: [2, -27], neck: [3, -48], head: [4, -57], fK: [14, -30], fF: [10, -14], bE: [0, -38], bH: [-4, -32], fE: [12, -40], fH: [16, -46] }),
  hit: P({ hip: [-2, -25], neck: [-7, -45], head: [-10, -53], fE: [0, -36], fH: [5, -31], bE: [-8, -38], bH: [-12, -32], fF: [9, 0], bF: [-12, 0] }),
  crouchhit: P(CR, { neck: [-2, -33], head: [-4, -41] }),
  block: P({ neck: [0, -46], head: [0, -55], fE: [12, -43], fH: [11, -55], bE: [9, -40], bH: [8, -52] }),
  crouchblock: P(CR, { fE: [13, -30], fH: [13, -40], bE: [10, -28], bH: [10, -38] }),
  air: P({ hip: [0, -14], neck: [-17, -20], head: [-25, -23], fK: [10, -18], fF: [20, -13], bK: [8, -9], bF: [19, -6], fE: [-13, -28], fH: [-6, -33], bE: [-20, -12], bH: [-14, -7] }),
  down: P({ hip: [0, -4], neck: [-21, -4], head: [-29, -6], fK: [10, -6], fF: [21, -2], bK: [9, -3], bF: [21, 0], fE: [-14, -8], fH: [-6, -5], bE: [-23, -2], bH: [-31, -2] }),
  win: P({ neck: [0, -47], head: [0, -56], fE: [8, -58], fH: [11, -70], bE: [-6, -58], bH: [-9, -70], fF: [10, 0], bF: [-10, 0] }),
  lose: P({ hip: [0, -23], neck: [3, -42], head: [6, -49], fE: [5, -32], fH: [7, -22], bE: [0, -32], bH: [1, -22] }),
  stance: P({ neck: [3, -46], head: [4, -55], fE: [14, -40], fH: [14, -50], bE: [4, -36], bH: [16, -40] }),
};
function lerpPose(a, b, k) {
  const o = {};
  for (const j in a) o[j] = [a[j][0] + (b[j][0] - a[j][0]) * k, a[j][1] + (b[j][1] - a[j][1]) * k];
  return o;
}
function bobPose(p, t) {
  const b = Math.round(Math.sin(t * 0.12));
  if (!b) return p;
  const o = Object.assign({}, p);
  for (const j of ['hip', 'neck', 'head', 'fE', 'fH', 'bE', 'bH']) o[j] = [p[j][0], p[j][1] + b];
  return o;
}
function walkPose(t, dir) {
  const s = Math.sin(t * 0.22 * dir), c = Math.cos(t * 0.22 * dir);
  return P({ fF: [11 + s * 5, -Math.max(0, c) * 3], bF: [-10 - s * 5, -Math.max(0, -c) * 3],
    fK: [8 + s * 3, -13 - Math.max(0, c) * 2], bK: [-5 - s * 3, -13 - Math.max(0, -c) * 2],
    hip: [0, -25 + Math.abs(s)], neck: [3, -46 + Math.abs(s)], head: [4, -55 + Math.abs(s)] });
}

// ---------------------------------------------------------------- body renderer
function drawHead(c, hd, d, hx, hy, fc, fl) {
  const R = (dx, dy, w, h, col) => { c.fillStyle = col; c.fillRect(fc > 0 ? hx + dx : hx - dx - w, hy + dy, w, h); };
  const OL = '#121212';
  const sk0 = hd.skin || d.skin;
  const skin = fl ? '#ffffff' : sk0, skD = fl ? '#dddddd' : shade(sk0, -0.22);
  const hair = fl ? '#ffffff' : hd.hairColor, hairD = fl ? '#cccccc' : shade(hd.hairColor, -0.3);
  R(-7, -8, 14, 15, OL); R(-6, -7, 12, 13, skin);
  switch (hd.hair) {
    case 'side': R(-7, -9, 14, 4, OL); R(-6, -8, 12, 3, hair); R(-1, -9, 7, 1, hair); R(-7, -6, 4, 7, OL); R(-6, -5, 3, 6, hair); R(3, -5, 3, 1, hair); break;
    case 'short': R(-7, -9, 14, 4, OL); R(-6, -8, 12, 3, hair); R(-7, -6, 4, 7, OL); R(-6, -5, 3, 5, hair); R(4, -5, 2, 1, hair); break;
    case 'swoop': R(-7, -10, 15, 5, OL); R(-6, -9, 13, 4, hair); R(2, -10, 5, 1, hair); R(-7, -6, 4, 8, OL); R(-6, -5, 3, 7, hair); R(4, -5, 3, 2, hair); break;
    case 'receding': R(-7, -7, 5, 9, OL); R(-6, -6, 3, 7, hair); R(-5, -8, 6, 2, hairD); break;
    case 'shaggy': R(-9, -11, 17, 7, OL); R(-8, -10, 15, 5, hair); R(-9, -6, 6, 12, OL); R(-8, -5, 4, 10, hair); R(3, -5, 4, 2, hair);
      R(-4, -11, 2, 1, hair); R(1, -11, 3, 1, hair); R(6, -8, 2, 2, hair); break;
    case 'curly': R(-8, -11, 16, 6, OL);
      for (const [x, y] of [[-7, -10], [-4, -11], [-1, -10], [2, -11], [5, -9], [-8, -7], [-8, -4], [-8, -1]]) R(x, y, 3, 3, hair);
      R(-6, -8, 12, 3, hair); R(-7, -6, 4, 8, hair); break;
    case 'buzz': R(-6, -8, 12, 2, hairD); R(-6, -6, 2, 5, hairD); break;
  }
  R(-2, -2, 2, 3, skD);                       // ear
  R(2, -2, 2, 2, OL);                         // eye
  R(1, -4, 4, 1, hairD);                      // brow
  R(6, -1, 1, 3, skD);                        // nose
  R(2, 3, 3, 1, shade(sk0, -0.45));           // mouth
  if (hd.stubble) { c.globalAlpha = 0.25; R(-2, 1, 8, 5, hair); c.globalAlpha = 1; }
  if (hd.beard) { R(-3, 1, 10, 6, OL); R(-2, 1, 8, 5, hair); R(2, 3, 3, 1, shade(sk0, -0.5)); }
  if (hd.glasses) {
    const fr = hd.glassesColor || OL;
    R(0, -3, 6, 4, fr); R(1, -2, 4, 2, '#cfe8ff'); R(2, -2, 2, 2, OL); R(-3, -2, 3, 1, fr);
  }
}

function drawBody(c, d, J, ox, oy, fc, o = {}) {
  const s = d.height || 1;
  const Pt = k => [ox + J[k][0] * fc * s, oy + J[k][1] * s];
  const fl = o.flash, OL = o.ol || '#121212';
  const C = v => fl ? '#ffffff' : v;
  const top = d.jacket || d.shirt;
  const sl = C(top), slD = C(shade(top, -0.28)), pa = C(d.pants), paD = C(shade(d.pants, -0.3));
  const T = d.limb || 5, B = d.build || 11;
  const hip = Pt('hip'), nk = Pt('neck');
  const shld = [lerp(hip[0], nk[0], 0.86), lerp(hip[1], nk[1], 0.86)];
  const J2 = (a, b, e, t, col) => {
    seg(c, a[0], a[1], b[0], b[1], t + 2, OL); seg(c, b[0], b[1], e[0], e[1], t + 2, OL);
    seg(c, a[0], a[1], b[0], b[1], t, col); seg(c, b[0], b[1], e[0], e[1], t, col);
  };
  const hand = (p, col) => { c.fillStyle = OL; c.fillRect(Math.round(p[0] - 3), Math.round(p[1] - 3), 6, 6); c.fillStyle = col; c.fillRect(Math.round(p[0] - 2), Math.round(p[1] - 2), 4, 4); };
  const shoe = (p, col) => { const x = Math.round(p[0]), y = Math.round(p[1]); c.fillStyle = OL; c.fillRect(fc > 0 ? x - 4 : x - 6, y - 4, 11, 5); c.fillStyle = col; c.fillRect(fc > 0 ? x - 3 : x - 5, y - 3, 9, 3); };

  // back arm & leg
  J2(shld, Pt('bE'), Pt('bH'), T - 1, slD); hand(Pt('bH'), C(shade(d.skin, -0.2)));
  J2(hip, Pt('bK'), Pt('bF'), T, paD); shoe(Pt('bF'), C(shade(d.shoes, -0.3)));
  // torso (+ coat tail)
  const tdx = hip[0] - nk[0], tdy = hip[1] - nk[1], tl = Math.hypot(tdx, tdy) || 1;
  const tail = [hip[0] + tdx / tl * 9, hip[1] + tdy / tl * 9];
  seg(c, hip[0], hip[1], shld[0], shld[1], B + 2, OL);
  if (d.coat) seg(c, hip[0], hip[1], tail[0], tail[1], B + 2, OL);
  seg(c, hip[0], hip[1], shld[0], shld[1], B, C(top));
  if (d.coat) seg(c, hip[0], hip[1], tail[0], tail[1], B, C(top));
  if (d.split) seg(c, hip[0] + fc * B / 4, hip[1], shld[0] + fc * B / 4, shld[1], Math.floor(B / 2), C(d.split));
  if (d.jacket) {
    const mid = [lerp(hip[0], shld[0], 0.4), lerp(hip[1], shld[1], 0.4)];
    seg(c, mid[0] + fc * 2, mid[1], shld[0] + fc * 2, shld[1] + 1, 3, C(d.shirt));
    if (d.tie) seg(c, mid[0] + fc * 2, mid[1] + 2, shld[0] + fc * 2, shld[1] + 2, 1, C(d.tie));
  }
  if (d.scarf) seg(c, shld[0] - fc * 2, shld[1] + 1, shld[0] + fc * 3, shld[1] + 1, 4, C(d.scarf));
  // front leg
  J2(hip, Pt('fK'), Pt('fF'), T, pa); shoe(Pt('fF'), C(d.shoes));
  // head(s)
  const hd = Pt('head'), heads = d.heads;
  const spots = heads.length === 1 ? [[hd[0], hd[1]]] : [[hd[0] - fc * 6, hd[1] + 1], [hd[0] + fc * 6, hd[1] - 1]];
  spots.forEach(sp => { seg(c, shld[0], shld[1], sp[0], sp[1], 6, OL); seg(c, shld[0], shld[1], sp[0], sp[1], 4, C(d.skin)); });
  spots.forEach((sp, i) => drawHead(c, heads[i], d, Math.round(sp[0]), Math.round(sp[1]), fc, fl));
  // front arm
  J2(shld, Pt('fE'), Pt('fH'), T - 1, sl); hand(Pt('fH'), C(d.skin));
}

const _spr = new Map();
function sprite(def, pose = 'idle') {
  const k = def.id + '|' + pose; if (_spr.has(k)) return _spr.get(k);
  const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96;
  drawBody(cv.getContext('2d'), def, POSES[pose], 48, 92, 1, {});
  _spr.set(k, cv); return cv;
}
function headSprite(def) {
  const k = def.id + '|head'; if (_spr.has(k)) return _spr.get(k);
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 26; const c = cv.getContext('2d');
  if (def.heads.length === 1) drawHead(c, def.heads[0], def, 15, 14, 1, false);
  else { drawHead(c, def.heads[0], def, 9, 15, 1, false); drawHead(c, def.heads[1], def, 22, 13, 1, false); }
  _spr.set(k, cv); return cv;
}
function drawSprite(cv, x, y, scale, flip) {
  ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(cv, -x - cv.width * scale, y, cv.width * scale, cv.height * scale); ctx.restore(); }
  else ctx.drawImage(cv, x, y, cv.width * scale, cv.height * scale);
}

// ---------------------------------------------------------------- moves
const MOTIONS = { qcf: [2, 3, 6], qcb: [2, 1, 4], dp: [6, 2, 3] };
const DIRV = { 1: [-1, 1], 2: [0, 1], 3: [1, 1], 4: [-1, 0], 6: [1, 0], 7: [-1, -1], 8: [0, -1], 9: [1, -1] };
// pixel arrow icon (the pixel font has no diagonal arrows)
function drawDir(d, x, y, col) {
  const [dx, dy] = DIRV[d], n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n, cx = x + 4, cy = y + 4;
  const tx = cx + ux * 3, ty = cy + uy * 3;
  seg(ctx, cx - ux * 3, cy - uy * 3, tx, ty, 2, col);
  const a = Math.atan2(uy, ux);
  for (const s of [-1, 1]) { const b = a + Math.PI + s * 0.8; seg(ctx, tx, ty, tx + Math.cos(b) * 3, ty + Math.sin(b) * 3, 2, col); }
}
// draws e.g. [↓][↘][→]+P, returns width
function inputTxt(input, btn, x, y, col) {
  const seq = MOTIONS[input];
  seq.forEach((d, i) => drawDir(d, x + i * 10, y, col));
  txt('+' + btn, x + seq.length * 10, y, 8, col);
  return seq.length * 10 + 16;
}
const TIER = { lp: 1, dlp: 1, lk: 2, dlk: 2, rp: 3, rk: 4, drk: 4, drp: 5 };
const NORMALS = {
  lp: { pose: 'jab', su: 5, ac: 3, rc: 8, dmg: 4, lvl: 'high', box: { x: 6, y: -54, w: 24, h: 12 }, hs: 13, bs: 8, kb: 1.5, normal: true },
  rp: { pose: 'straight', su: 8, ac: 3, rc: 13, dmg: 7, lvl: 'high', box: { x: 6, y: -52, w: 28, h: 12 }, hs: 16, bs: 10, kb: 2.5, vx: 1, normal: true },
  lk: { pose: 'lowkick', su: 8, ac: 3, rc: 15, dmg: 6, lvl: 'low', box: { x: 6, y: -14, w: 26, h: 14 }, hs: 15, bs: 10, kb: 1.5, normal: true },
  rk: { pose: 'highkick', su: 12, ac: 4, rc: 18, dmg: 10, lvl: 'mid', box: { x: 6, y: -52, w: 30, h: 22 }, hs: 20, bs: 12, kb: 3.5, normal: true },
  dlp: { pose: 'crouchjab', su: 5, ac: 3, rc: 9, dmg: 3, lvl: 'low', box: { x: 6, y: -34, w: 24, h: 10 }, hs: 11, bs: 7, kb: 1, crouch: true, normal: true },
  drp: { pose: 'uppercut', su: 13, ac: 4, rc: 26, dmg: 9, lvl: 'mid', box: { x: 4, y: -72, w: 24, h: 46 }, hs: 30, bs: 14, kb: 1, launch: true, normal: true },
  dlk: { pose: 'crouchkick', su: 7, ac: 3, rc: 12, dmg: 5, lvl: 'low', box: { x: 6, y: -10, w: 28, h: 10 }, hs: 13, bs: 8, kb: 1.5, crouch: true, normal: true },
  drk: { pose: 'sweep', su: 12, ac: 4, rc: 26, dmg: 9, lvl: 'low', box: { x: 4, y: -10, w: 36, h: 10 }, hs: 20, bs: 12, kb: 2, knockdown: true, crouch: true, normal: true },
  jp: { pose: 'jumppunch', su: 4, ac: 10, rc: 0, dmg: 7, lvl: 'mid', box: { x: 4, y: -50, w: 24, h: 16 }, hs: 16, bs: 10, kb: 2, air: true, normal: true },
  jk: { pose: 'jumpkick', su: 5, ac: 12, rc: 0, dmg: 9, lvl: 'mid', box: { x: 2, y: -28, w: 30, h: 22 }, hs: 18, bs: 12, kb: 2.5, air: true, normal: true },
  throw: { pose: 'grab', su: 6, ac: 3, rc: 30, dmg: 14, lvl: 'high', box: { x: 4, y: -52, w: 22, h: 30 }, hs: 30, kb: 2.6, unblockable: true, throwHit: true,
    onHitFx(a, d) { popText('TAKEDOWN!', d.x, GROUND - 80, '#fc3'); SFX.play('throw'); } },
};

// ---------------------------------------------------------------- fighter
let MOVE_ID = 0;
class Fighter {
  constructor(def, side, ctrl) {
    this.def = def; this.side = side; this.ctrl = ctrl; this.wins = 0; this.meter = 0; this.cpuLevel = 4;
    this.resetRound();
  }
  resetRound() {
    this.x = STAGE_W / 2 + (this.side === 0 ? -70 : 70); this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = this.side === 0 ? 1 : -1; this.hp = MAXHP; this.dispHp = MAXHP;
    this.state = 'idle'; this.st = 0; this.stun = 0; this.move = null; this.moveKey = null; this.mf = 0; this.hasHit = false;
    this.buf = []; this.combo = 0; this.comboShow = 0; this.comboN = 0; this.anim = 0; this.flash = 0; this.airHits = 0;
    this.invuln = 0; this.counter = 0; this.bounced = false; this.airAttacked = false; this.lowBlock = false; this.crouchHit = false;
    this.inp = blankInput(); this.ai = {}; this.holdBack = false; this.holdDown = false; this.callout = null;
  }
  get crouching() {
    return this.state === 'crouch' || (this.state === 'attack' && this.move && this.move.crouch) ||
      (this.state === 'block' && this.lowBlock) || (this.state === 'hit' && this.crouchHit) || this.state === 'getup';
  }
  face(o) { if (Math.abs(o.x - this.x) > 1) this.facing = o.x > this.x ? 1 : -1; }
  hurtbox() {
    if (this.state === 'down') return null;
    const fy = GROUND - this.y;
    if (this.state === 'air' || this.state === 'ko') return { x1: this.x - 18, x2: this.x + 18, y1: fy - 34, y2: fy - 2 };
    const h = this.crouching ? 38 : 60 * (this.def.height || 1), w = (this.def.build || 11) + 10;
    return { x1: this.x - w / 2, x2: this.x + w / 2, y1: fy - h, y2: fy };
  }
  boxWorld(b) {
    const s = this.def.height || 1, fy = GROUND - this.y;
    const x1 = this.facing > 0 ? this.x + b.x : this.x - b.x - b.w;
    return { x1, x2: x1 + b.w, y1: fy + b.y * s, y2: fy + (b.y + b.h) * s };
  }
  motion(name) {
    const S = MOTIONS[name], b = this.buf; let i = S.length - 1;
    for (let k = b.length - 1; k >= Math.max(0, b.length - 18) && i >= 0; k--) if (b[k] === S[i]) i--;
    return i < 0;
  }
  dashCheck(d) {
    const b = this.buf, n = b.length;
    if (n < 4 || b[n - 1] !== d || b[n - 2] === d) return false;
    let gap = false;
    for (let k = n - 2; k >= Math.max(0, n - 14); k--) { if (b[k] !== d) gap = true; else if (gap) { this.buf.length = 0; return true; } }
    return false;
  }
  startMove(m, key) {
    this.state = 'attack'; this.move = m; this.moveKey = key; this.mf = 0; this.hasHit = false; this.spawned = false; this.moveId = ++MOVE_ID;
    if (m.onStart) m.onStart(this, this.opp);
    SFX.play(m.special ? 'special' : 'whiff');
    if (m.special && m.name && !m.isSuper) this.callout = { s: m.name, t: 70 };
  }
  doSuper() {
    this.meter = 0; const s = this.def.super;
    this.startMove(s, 'super'); this.invuln = s.su + 8;
    G.superFreeze = { f: this, t: 0, len: 62 }; SFX.play('super');
  }
  tryActions() {
    const inp = this.inp;
    if ((inp.sup || (inp.rp && inp.rk)) && this.meter >= 100) { this.doSuper(); return true; }
    if (inp.special != null && this.def.specials[inp.special]) { this.startMove(this.def.specials[inp.special], 'sp' + inp.special); return true; }
    if (this.checkSpecials()) return true;
    if (inp.thr || (inp.lp && inp.lk)) { this.startMove(NORMALS.throw, 'throw'); return true; }
    for (const b of ['rk', 'rp', 'lk', 'lp']) if (inp[b]) { const k = (inp.d ? 'd' : '') + b; this.startMove(NORMALS[k], k); return true; }
    return false;
  }
  checkSpecials() {
    const inp = this.inp, Pn = inp.lp || inp.rp, K = inp.lk || inp.rk;
    if (!Pn && !K) return false;
    const sps = this.def.specials;
    for (let i = 0; i < sps.length; i++) {
      const s = sps[i];
      if (((s.btn === 'p' && Pn) || (s.btn === 'k' && K)) && this.motion(s.input)) { this.buf.length = 0; this.startMove(s, 'sp' + i); return true; }
    }
    return false;
  }
  update(opp) {
    this.anim++;
    if (this.flash > 0) this.flash--; if (this.invuln > 0) this.invuln--; if (this.counter > 0) this.counter--; if (this.comboShow > 0) this.comboShow--;
    if (this.callout && --this.callout.t <= 0) this.callout = null;
    const inp = this.inp, fc = this.facing;
    const fwd = fc > 0 ? inp.r : inp.l, back = fc > 0 ? inp.l : inp.r;
    this.holdBack = back && !fwd; this.holdDown = !!inp.d;
    const dir = inp.d ? (back ? 1 : fwd ? 3 : 2) : inp.u ? (back ? 7 : fwd ? 9 : 8) : (back ? 4 : fwd ? 6 : 5);
    this.buf.push(dir); if (this.buf.length > 24) this.buf.shift();
    const act = G.fightActive;
    switch (this.state) {
      case 'idle': case 'crouch': {
        this.face(opp);
        if (!act) { this.vx = 0; this.state = 'idle'; break; }
        if (this.tryActions()) break;
        if (inp.u) { this.state = 'jump'; this.vy = 7.4; this.y = 0.01; this.vx = fwd ? 2.4 * fc : back ? -2.1 * fc : 0; this.airAttacked = false; SFX.play('jump'); break; }
        if (inp.dash > 0 || this.dashCheck(6)) { this.state = 'dash'; this.st = 14; this.vx = 4.8 * fc; break; }
        if (inp.dash < 0 || this.dashCheck(4)) { this.state = 'dash'; this.st = 14; this.vx = -4.4 * fc; break; }
        if (inp.d) { this.state = 'crouch'; this.vx = 0; break; }
        this.state = 'idle'; this.vx = fwd ? 1.7 * fc : back ? -1.25 * fc : 0;
        break;
      }
      case 'dash':
        this.vx *= 0.88; this.st--;
        if (act && this.st < 9 && this.tryActions()) break;
        if (this.st <= 0) { this.state = 'idle'; this.vx = 0; }
        break;
      case 'jump':
        if (act && !this.airAttacked && (inp.lp || inp.rp || inp.lk || inp.rk)) {
          const k = (inp.lp || inp.rp) ? 'jp' : 'jk'; this.airAttacked = true; this.startMove(NORMALS[k], k);
        }
        break;
      case 'attack': this.updateAttack(opp); break;
      case 'hit': case 'block':
        this.vx *= 0.82;
        if (--this.stun <= 0) { this.state = this.holdDown ? 'crouch' : 'idle'; this.vx = 0; }
        break;
      case 'down': this.vx *= 0.8; if (this.hp > 0 && --this.st <= 0) { this.state = 'getup'; this.st = 16; this.invuln = 20; } break;
      case 'getup': if (--this.st <= 0) this.state = 'idle'; break;
      case 'air': case 'ko': break;
      default: this.vx = 0;
    }
    this.physics();
  }
  updateAttack(opp) {
    const m = this.move, inp = this.inp, fr = this.mf;
    if (G.fightActive) {
      if (fr <= 3 && m.normal) {
        if ((this.moveKey === 'lp' && inp.lk) || (this.moveKey === 'lk' && inp.lp)) { this.startMove(NORMALS.throw, 'throw'); return; }
        if (((this.moveKey === 'rp' && inp.rk) || (this.moveKey === 'rk' && inp.rp)) && this.meter >= 100) { this.doSuper(); return; }
      }
      if (this.hasHit && m.normal && !m.air) {
        if (inp.sup && this.meter >= 100) { this.doSuper(); return; }
        if (inp.special != null && this.def.specials[inp.special]) { this.startMove(this.def.specials[inp.special], 'sp' + inp.special); return; }
        if (this.checkSpecials()) return;
        if (fr >= m.su + m.ac - 1) {
          for (const b of ['rk', 'rp', 'lk', 'lp']) if (inp[b]) {
            const k = (inp.d ? 'd' : '') + b;
            if ((TIER[k] || 0) > (TIER[this.moveKey] || 0)) { this.startMove(NORMALS[k], k); return; }
          }
        }
      }
    }
    if (m.vx != null && fr < m.su + m.ac) this.vx = m.vx * this.facing; else if (this.y <= 0) this.vx *= 0.7;
    if (m.onFrame) m.onFrame(this, fr, opp);
    if (m.spawn && !this.spawned && fr === (m.spawnAt != null ? m.spawnAt : m.su)) { this.spawned = true; m.spawn(this, opp); }
    if (m.box && fr >= m.su && fr < m.su + m.ac && !this.hasHit) {
      const hb = this.boxWorld(m.box), hu = opp.hurtbox();
      if (hu && overlap(hb, hu)) {
        const r = applyHit(this, opp, m, null, (Math.max(hb.x1, hu.x1) + Math.min(hb.x2, hu.x2)) / 2, (Math.max(hb.y1, hu.y1) + Math.min(hb.y2, hu.y2)) / 2);
        if (r) this.hasHit = true;
      }
    }
    if (this.move !== m) return; // something replaced the move (e.g. a counter)
    this.mf++;
    if (!m.air && this.mf >= m.su + m.ac + m.rc) { this.move = null; this.state = this.inp.d ? 'crouch' : 'idle'; this.vx = 0; }
  }
  physics() {
    if (this.y > 0 || this.vy > 0) {
      const air = this.state === 'air' || this.state === 'ko';
      this.vy -= air ? 0.34 : 0.42; this.y += this.vy; this.x += this.vx;
      if (this.y <= 0) { this.y = 0; this.land(); }
    } else { this.y = 0; this.x += this.vx; }
  }
  land() {
    const vy = this.vy; this.vy = 0;
    if (this.state === 'air' || this.state === 'ko') {
      if (!this.bounced && vy < -4.5) { this.bounced = true; this.vy = 2.6; this.y = 0.5; dust(this.x, GROUND, 6); SFX.play('land'); G.shake = Math.max(G.shake, 3); return; }
      this.state = 'down'; this.st = 34; this.vx *= 0.4; dust(this.x, GROUND, 10); SFX.play('land'); G.shake = Math.max(G.shake, 4);
    } else if (this.state === 'attack' && this.move && this.move.air) { this.move = null; this.state = 'idle'; this.vx = 0; dust(this.x, GROUND, 3); }
    else if (this.state === 'jump') { this.state = 'idle'; this.vx = 0; dust(this.x, GROUND, 3); }
  }
}

// ---------------------------------------------------------------- hit resolution
function applyHit(att, def, h, proj, px, py) {
  if (G.phase === 'end') return false;
  if (def.invuln > 0 || def.state === 'down' || def.state === 'getup' || def.state === 'ko') return false;
  const airborne = def.state === 'air' || def.y > 0;
  const crouch = def.crouching;
  if (h.lvl === 'high' && crouch && !airborne) return false;
  if (h.throwHit && (airborne || def.state === 'hit' || def.state === 'block')) return false;
  if (def.counter > 0 && def.state === 'attack' && def.move && def.move.onCounter && !h.throwHit && !h.isSuper) {
    def.counter = 0; att.hasHit = true; def.move.onCounter(def, att, proj); return 'countered';
  }
  const dir = proj ? (Math.sign(proj.vx) || Math.sign(def.x - proj.x) || att.facing) : att.facing;
  if (px == null) { px = def.x; py = GROUND - def.y - 40; }
  const canBlock = !h.unblockable && G.fightActive && def.holdBack && !airborne &&
    (['idle', 'crouch', 'block'].includes(def.state) || (def.state === 'dash' && def.vx * def.facing < 0));
  if (canBlock && ((h.lvl === 'low') === def.holdDown)) {
    def.state = 'block'; def.lowBlock = def.holdDown; def.stun = h.bs || 10; def.vx = dir * (h.kb || 2) * 1.1; def.move = null;
    const chip = Math.round((h.dmg || 0) * (h.isSuper ? 0.25 : h.special ? 0.1 : 0));
    if (chip > 0 && def.hp > chip) def.hp -= chip;
    att.meter = Math.min(100, att.meter + 2); def.meter = Math.min(100, def.meter + 3);
    G.hitstop = Math.max(G.hitstop, 4); spark(px, py, '#6cf', 6); SFX.play('block');
    return 'block';
  }
  const wasCounter = !proj && def.state === 'attack' && def.move && def.mf < def.move.su;
  if (!(def.state === 'hit' || def.state === 'air')) att.combo = 0;
  att.combo++;
  let dmg = h.dmg || 0;
  if (wasCounter) dmg *= 1.25;
  dmg *= Math.max(0.3, 1 - (att.combo - 1) * 0.1);
  if (att.hp < MAXHP * 0.25) dmg *= 1.15;   // rage
  dmg = Math.max(1, Math.round(dmg));
  def.hp = Math.max(0, def.hp - dmg);
  if (!h.isSuper) att.meter = Math.min(100, att.meter + dmg * 1.4);
  def.meter = Math.min(100, def.meter + dmg * 0.9);
  def.flash = 8; def.move = null; def.counter = 0;
  if (att.combo >= 2) { att.comboShow = 90; att.comboN = att.combo; }
  const heavy = dmg >= 10 || h.launch || h.knockdown || h.isSuper;
  if (def.hp <= 0) {
    def.state = 'ko'; def.vy = 6.5; def.vx = dir * 2.6; def.y = Math.max(def.y, 1); def.bounced = false;
    G.hitstop = 20; G.shake = 14; G.slow = 72; spark(px, py, '#fff', 26, true); SFX.play('ko');
  } else if (airborne && !h.knockdown && !h.throwHit) {
    def.state = 'air'; def.airHits++; def.vy = Math.max(1.4, 4.4 - def.airHits * 0.55); def.vx = dir * 1.1;
  } else if (h.launch) {
    def.state = 'air'; def.airHits = 0; def.vy = 7.6; def.vx = dir * 0.9; def.bounced = false; def.y = Math.max(def.y, 1);
  } else if (h.knockdown || h.throwHit || airborne) {
    def.state = 'air'; def.airHits = 9; def.vy = h.throwHit ? 5.4 : 3.8; def.vx = dir * (h.kb || 2.5) * 1.1; def.bounced = true; def.y = Math.max(def.y, 1);
  } else {
    def.state = 'hit'; def.crouchHit = crouch; def.stun = (h.hs || 14) + (wasCounter ? 10 : 0); def.vx = dir * (h.kb || 2);
  }
  G.hitstop = Math.max(G.hitstop, heavy ? 10 : 6); G.shake = Math.max(G.shake, heavy ? 6 : 2);
  spark(px, py, wasCounter ? '#f44' : '#ff6', heavy ? 14 : 8, heavy);
  SFX.play(heavy ? 'hitH' : 'hitL');
  if (wasCounter) { popText('COUNTER!', px, py - 18, '#f44', 8, 40); SFX.play('counter'); }
  if (h.onHitFx) h.onHitFx(att, def, proj);
  return 'hit';
}

// ---------------------------------------------------------------- projectiles
let PID = 0;
class Proj {
  constructor(owner, o) {
    Object.assign(this, { owner, id: ++PID, x: 0, y: 0, vx: 0, vy: 0, w: 12, h: 10, grav: 0, dmg: 6, lvl: 'mid', hits: 1, interval: 10, cd: 0,
      life: 150, t: 0, hs: 16, bs: 10, kb: 2, clash: true, dead: false, special: true }, o);
  }
  rect() { return { x1: this.x - this.w / 2, x2: this.x + this.w / 2, y1: this.y - this.h / 2, y2: this.y + this.h / 2 }; }
}
function shoot(f, o) {
  const p = new Proj(f, o);
  if (o.x === undefined) p.x = f.x + f.facing * (o.ox != null ? o.ox : 22);
  if (o.y === undefined) p.y = GROUND - f.y + (o.oy != null ? o.oy : -44);
  if (o.vx === undefined) p.vx = f.facing * (o.speed != null ? o.speed : 4);
  if (o.dir === undefined) p.dir = f.facing;
  G.projs.push(p); return p;
}
function updateProjs() {
  const ps = G.projs;
  for (const p of ps) {
    if (p.dead) continue;
    p.t++;
    if (p.update) p.update(p);
    p.vy += p.grav; p.x += p.vx; p.y += p.vy;
    if (p.cd > 0) p.cd--;
    if (--p.life <= 0 || p.x < -80 || p.x > STAGE_W + 80) { p.dead = true; continue; }
    if (p.ground && p.y + p.h / 2 >= GROUND) { p.y = GROUND - p.h / 2; if (p.onGround) p.onGround(p); if (p.dead) continue; }
    if (p.armed === false || p.cd > 0) continue;
    const target = p.owner.opp, hu = target.hurtbox();
    if (hu && overlap(p.rect(), hu)) {
      const r = applyHit(p.owner, target, p, p, clamp(p.x, hu.x1, hu.x2), clamp(p.y, hu.y1, hu.y2));
      if (r) { p.hits--; p.cd = p.interval; if (p.onHit) p.onHit(p, r); if (p.hits <= 0 || r === 'countered') p.dead = true; }
    }
  }
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j];
    if (a.dead || b.dead || a.owner === b.owner || a.armed === false || b.armed === false) continue;
    if (!overlap(a.rect(), b.rect())) continue;
    if (a.clash && b.clash) {
      a.hits--; b.hits--; spark((a.x + b.x) / 2, (a.y + b.y) / 2, '#fff', 8); SFX.play('block');
      if (a.hits <= 0) a.dead = true; if (b.hits <= 0) b.dead = true;
    } else if (a.isSuper && b.clash && !b.isSuper) b.dead = true;
    else if (b.isSuper && a.clash && !a.isSuper) a.dead = true;
  }
  G.projs = ps.filter(p => !p.dead);
}

// ---------------------------------------------------------------- effects
function spark(x, y, col, n = 8, big = false) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rnd(1, big ? 5 : 3);
    G.fx.push({ k: 'p', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: rndi(10, 22), t: 0, col, sz: rndi(1, big ? 3 : 2), g: 0.12 });
  }
  G.fx.push({ k: 'burst', x, y, t: 0, life: big ? 12 : 8, col, r: big ? 22 : 12 });
}
function dust(x, y, n = 6) {
  for (let i = 0; i < n; i++) G.fx.push({ k: 'p', x: x + rnd(-10, 10), y: y - 2, vx: rnd(-1.5, 1.5), vy: -rnd(0.3, 1.4), life: rndi(14, 26), t: 0, col: pick(['#bbb', '#999', '#ddd']), sz: 2, g: 0.03 });
}
function popText(s, x, y, col = '#ff0', size = 8, life = 50) { G.fx.push({ k: 'txt', s, x, y, col, size, life, t: 0 }); }
function fxCustom(draw, life, data) { G.fx.push(Object.assign({ k: 'c', draw, life, t: 0 }, data)); }
function updateFx() {
  for (const e of G.fx) { e.t++; if (e.k === 'p') { e.vy += e.g; e.x += e.vx; e.y += e.vy; } else if (e.k === 'txt') e.y -= 0.4; }
  G.fx = G.fx.filter(e => e.t < e.life);
}
function drawFx() {
  for (const e of G.fx) {
    switch (e.k) {
      case 'p': ctx.fillStyle = e.col; ctx.fillRect(Math.round(e.x), Math.round(e.y), e.sz, e.sz); break;
      case 'burst': {
        const r = e.r * (0.4 + 0.6 * e.t / e.life);
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + 0.2, r1 = r * 0.4, r2 = r * (i % 2 ? 0.7 : 1);
          seg(ctx, e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1, e.x + Math.cos(a) * r2, e.y + Math.sin(a) * r2, 2, i % 2 ? '#fff' : e.col);
        }
        if (e.t < 3) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(e.x) - 4, Math.round(e.y) - 4, 8, 8); }
        break;
      }
      case 'txt': {
        const half = e.s.length * e.size / 2 + 4;
        ctx.globalAlpha = e.t > e.life - 10 ? (e.life - e.t) / 10 : 1;
        txt(e.s, Math.round(clamp(e.x, G.camX + half, G.camX + W - half)), Math.round(Math.max(36, e.y)), e.size, e.col, 'center');
        ctx.globalAlpha = 1; break;
      }
      case 'c': e.draw(e); break;
    }
  }
}

// ---------------------------------------------------------------- fighter drawing
function poseOf(f) {
  switch (f.state) {
    case 'idle': return Math.abs(f.vx) > 0.1 ? walkPose(f.anim, Math.sign(f.vx) * f.facing) : bobPose(POSES.idle, f.anim);
    case 'dash': return POSES.dashpose;
    case 'crouch': return POSES.crouch;
    case 'jump': return POSES.jump;
    case 'attack': {
      const m = f.move; if (!m) return POSES.idle;
      const tgt = POSES[m.pose] || POSES.cast, base = m.air ? POSES.jump : m.crouch ? POSES.crouch : POSES.idle;
      const fr = f.mf; let k;
      if (fr < m.su) k = (fr + 1) / m.su; else if (fr < m.su + m.ac) k = 1; else k = 1 - (fr - m.su - m.ac) / Math.max(1, m.rc);
      return lerpPose(base, tgt, clamp(k * 1.25, 0, 1));
    }
    case 'hit': return f.crouchHit ? POSES.crouchhit : POSES.hit;
    case 'block': return f.lowBlock ? POSES.crouchblock : POSES.block;
    case 'air': case 'ko': return POSES.air;
    case 'down': return POSES.down;
    case 'getup': return POSES.crouch;
    case 'win': return (f.anim % 50) < 25 ? POSES.win : lerpPose(POSES.win, POSES.idle, 0.35);
    case 'lose': return POSES.lose;
    case 'intro': return bobPose(POSES.stance, f.anim);
  }
  return POSES.idle;
}
function drawFighter(f) {
  const J = poseOf(f);
  let ox = Math.round(f.x), oy = Math.round(GROUND - f.y);
  if (f.flash > 0 && G.hitstop > 0) ox += (G.t % 2 ? 1 : -1);
  const sw = Math.max(8, 26 - f.y / 5);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(Math.round(f.x - sw / 2), GROUND - 1, Math.round(sw), 3);
  if (f.state === 'getup' && f.anim % 4 < 2) ctx.globalAlpha = 0.6;
  let ol;
  if (G.superFreeze && G.superFreeze.f === f) ol = G.t % 4 < 2 ? '#ffee55' : '#ff8800';
  else if (f.hp > 0 && f.hp < MAXHP * 0.25) ol = (G.t % 30 < 15) ? '#aa0000' : '#121212';
  drawBody(ctx, f.def, J, ox, oy, f.facing, { flash: f.flash > 0 && f.flash % 4 < 2, ol });
  ctx.globalAlpha = 1;
}
