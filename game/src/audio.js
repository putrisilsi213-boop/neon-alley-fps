// Procedural WebAudio sounds: no audio files, no network. Every sound is a
// short oscillator or filtered-noise burst built on the first user gesture;
// before that (and in ?shot= captures) every call is a silent no-op.
export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function noiseBuffer(duration) {
    const c = ensure();
    if (!c) return null;
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function burst(filterFreq, duration, gainValue, type) {
    const c = ensure();
    if (!c) return;
    try {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(duration);
      const filter = c.createBiquadFilter();
      filter.type = type || 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = c.createGain();
      gain.gain.setValueAtTime(gainValue, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
      src.stop(c.currentTime + duration);
    } catch { /* audio is decoration, never fatal */ }
  }

  function tone(freq, duration, gainValue, type, slideTo) {
    const c = ensure();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + duration);
      const gain = c.createGain();
      gain.gain.setValueAtTime(gainValue, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(c.currentTime + duration);
    } catch { /* audio is decoration, never fatal */ }
  }

  return {
    unlock() { ensure(); },
    shot(kind) {
      if (kind === 'sniper') { burst(900, 0.28, 0.9); tone(140, 0.16, 0.35, 'sawtooth', 60); }
      else if (kind === 'smg') burst(1600, 0.08, 0.5);
      else if (kind === 'pistol') { burst(1200, 0.1, 0.55); tone(220, 0.06, 0.2, 'square', 110); }
      else burst(1100, 0.14, 0.7);
    },
    distantShot() { burst(500, 0.12, 0.25); },
    reload() { tone(900, 0.05, 0.25, 'square'); setTimeout(() => tone(620, 0.05, 0.25, 'square'), 140); },
    dryClick() { tone(1400, 0.03, 0.2, 'square'); },
    hit() { tone(1250, 0.05, 0.3, 'sine'); },
    kill() { tone(1250, 0.05, 0.3, 'sine'); setTimeout(() => tone(1650, 0.07, 0.3, 'sine'), 70); },
    step() { burst(300, 0.05, 0.12); },
    plantBeep() { tone(1050, 0.09, 0.35, 'sine'); },
    defuseTick() { tone(880, 0.05, 0.25, 'sine'); },
    explosion() { burst(220, 1.1, 1.0); tone(70, 0.9, 0.5, 'sine', 32); },
    roundWin() { tone(523, 0.12, 0.3, 'sine'); setTimeout(() => tone(659, 0.12, 0.3, 'sine'), 120); setTimeout(() => tone(784, 0.2, 0.3, 'sine'), 240); },
    roundLose() { tone(392, 0.15, 0.3, 'sine'); setTimeout(() => tone(311, 0.25, 0.3, 'sine'), 160); },
    buy() { tone(980, 0.06, 0.25, 'sine'); setTimeout(() => tone(1318, 0.08, 0.25, 'sine'), 80); },
    denied() { tone(220, 0.12, 0.3, 'square', 160); },
  };
}
