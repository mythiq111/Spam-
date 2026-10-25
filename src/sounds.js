// All sounds are synthesized with the Web Audio API, so there are no audio files to host.
// Browsers only allow audio after a user gesture, so start() must be called from a click.

let ctx = null;
let master = null;
let musicGain = null;
let timer = null;
let nextBar = 0;
let step = 0;
let muted = false;

const NOTE = {
  C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.0, A2: 110.0,
  A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
  G5: 783.99, C6: 1046.5,
};

// Gentle Am - F - C - G loop: [bass, arpeggio notes]
const BARS = [
  [NOTE.A2, [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.C5]],
  [87.31, [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.A4]],
  [NOTE.C3, [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.E5]],
  [98.0, [NOTE.B3, NOTE.D4, NOTE.G4, NOTE.D5]],
];
const BEAT = 0.55;

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();

  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;

  // Simple echo gives the notes some space, like a quiet room.
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.38;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(master);

  const bus = ctx.createGain();
  bus.connect(master);
  bus.connect(delay);
  musicGain = bus;

  master.connect(ctx.destination);
  return true;
}

function tone(freq, when, { dur = 1.2, vol = 0.1, type = "sine", dest } = {}) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g).connect(dest || musicGain);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

function scheduleMusic() {
  // Look ahead ~1.5s so timing stays steady even if the tab is busy.
  while (nextBar < ctx.currentTime + 1.5) {
    const [bass, notes] = BARS[Math.floor(step / 4) % BARS.length];
    const i = step % 4;
    if (i === 0) tone(bass, nextBar, { dur: 2.4, vol: 0.07, type: "triangle" });
    tone(notes[i], nextBar, { dur: 1.6, vol: 0.05 });
    nextBar += BEAT;
    step += 1;
  }
}

export function startMusic() {
  if (!ensure()) return;
  if (ctx.state === "suspended") ctx.resume();
  if (timer) return;
  nextBar = ctx.currentTime + 0.1;
  step = 0;
  scheduleMusic();
  timer = setInterval(scheduleMusic, 400);
}

export function setMuted(value) {
  muted = value;
  if (!ctx) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.1);
}

export function isMuted() {
  return muted;
}

// Soft paper rustle when the letter opens.
export function playPaper() {
  if (!ensure()) return;
  if (ctx.state === "suspended") ctx.resume();
  const len = Math.floor(ctx.sampleRate * 0.45);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2500;
  const g = ctx.createGain();
  g.gain.value = 0.18;
  src.connect(filter).connect(g).connect(master);
  src.start();
}

// Little tap for buttons.
export function playTap() {
  if (!ensure()) return;
  if (ctx.state === "suspended") ctx.resume();
  tone(NOTE.E5, ctx.currentTime, { dur: 0.18, vol: 0.08, dest: master });
}

// Happy rising chime for "yes".
export function playYes() {
  if (!ensure()) return;
  if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime;
  [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => {
    tone(f, t + i * 0.16, { dur: 1.6, vol: 0.12, dest: master });
    tone(f * 2, t + i * 0.16, { dur: 1.0, vol: 0.03, dest: master });
  });
}

// Calm, warm two-note response for "need some time".
export function playGentle() {
  if (!ensure()) return;
  if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime;
  tone(NOTE.A3, t, { dur: 1.8, vol: 0.1, type: "triangle", dest: master });
  tone(NOTE.E4, t + 0.3, { dur: 2.0, vol: 0.08, type: "triangle", dest: master });
}
