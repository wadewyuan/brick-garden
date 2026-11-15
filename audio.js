/* Brick Garden · sound effects, all synthesized with WebAudio (no audio files). */
let ac;
const ctx = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());

function tone(f, at, dur, type = 'sine', vol = .2, f2) {
  try {
    const a = ctx(), t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
  } catch { /* no audio available: stay silent */ }
}

const SCALE = [392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319]; // pentatonic, climbs as the model grows

export const sfx = {
  unlock() { try { ctx().resume(); } catch { } },           // call from the first tap
  click(i = 0) { const f = SCALE[i % SCALE.length]; tone(f, 0, .22, 'triangle', .3); tone(f * 2, 0, .06, 'square', .04); },
  pick() { tone(660, 0, .12, 'sine', .2, 900); },
  wrong() { tone(230, 0, .22, 'sine', .2, 170); },
  pop() { tone(300, 0, .16, 'sine', .3, 950); },
  hint() { tone(880, 0, .12, 'sine', .1); tone(1175, .13, .2, 'sine', .1); },
  fanfare() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * .13, .32, 'triangle', .22)); },
  cheep() { tone(2300, 0, .08, 'sine', .12, 3300); tone(2500, .13, .09, 'sine', .12, 3500); },
  oink() { tone(190, 0, .13, 'sawtooth', .1, 120); tone(210, .19, .17, 'sawtooth', .1, 110); },
  baa() { tone(430, 0, .5, 'sawtooth', .07, 370); tone(436, 0, .5, 'square', .03, 366); },
  woof() { tone(320, 0, .11, 'square', .11, 140); tone(300, .2, .14, 'square', .11, 120); },
  beep() { tone(660, 0, .12, 'square', .09); tone(660, .18, .16, 'square', .09); },
  honk() { tone(311, 0, .35, 'sawtooth', .1); tone(392, 0, .35, 'sawtooth', .07); },
  vroom() { tone(70, 0, .6, 'sawtooth', .16, 130); tone(105, .05, .5, 'square', .05, 180); },
  choo() { tone(880, 0, .25, 'sine', .14); tone(1109, 0, .25, 'sine', .1); tone(880, .32, .5, 'sine', .14); tone(1109, .32, .5, 'sine', .1); },
  bell() { tone(1568, 0, .7, 'sine', .14); tone(2093, .02, .5, 'sine', .06); },
  horn() { tone(196, 0, .55, 'sawtooth', .09); tone(294, .05, .5, 'sawtooth', .06); },
  warble() { for (let i = 0; i < 4; i++) tone(700, i * .12, .12, 'sine', .1, i % 2 ? 500 : 1100); },
  whoosh() { tone(90, 0, 1.1, 'sawtooth', .13, 520); tone(140, .1, 1, 'triangle', .07, 900); },
  quack() { tone(540, 0, .15, 'sawtooth', .1, 330); tone(500, .2, .2, 'sawtooth', .1, 290); },
};
