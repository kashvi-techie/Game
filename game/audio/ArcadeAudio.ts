import type { ControllerControls } from "@/game/input/ControllerInputSource";

type VehicleAudio = ControllerControls & {
  speed: number;
  nitro: number;
  enabled: boolean;
};

export type AudioCue = "countdown" | "start" | "lap" | "finish" | "impact";

export class ArcadeAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineLow: OscillatorNode | null = null;
  private engineHigh: OscillatorNode | null = null;
  private skidGain: GainNode | null = null;
  private brakeGain: GainNode | null = null;
  private boostGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private brakeFilter: BiquadFilterNode | null = null;
  private boostOscillator: OscillatorNode | null = null;
  private ambienceLow: OscillatorNode | null = null;
  private ambienceHigh: OscillatorNode | null = null;
  private volume = 0.45;
  private muted = false;
  private graphCreated = false;
  private lastImpactTime = -Infinity;
  private ambienceActive: boolean | null = null;

  async resumeFromGesture() {
    let context: AudioContext;
    try {
      context = this.ensureGraph();
    } catch {
      return;
    }
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return;
      }
    }
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    this.updateMasterGain();
  }

  setMuted(value: boolean) {
    this.muted = value;
    this.updateMasterGain();
  }

  updateVehicle({ speed, throttle, brake, steering, action1, action2, nitro, enabled }: VehicleAudio) {
    if (!this.context || !this.graphCreated) return;
    const now = this.context.currentTime;
    const normalizedSpeed = Math.max(0, Math.min(1, speed / 47));
    const skid = enabled ? Math.max(action2 ? 0.9 : 0, Math.max(0, Math.abs(steering) - 0.35) * normalizedSpeed * 1.5) : 0;
    const braking = enabled ? brake * Math.max(0.25, normalizedSpeed) : 0;
    const boosting = enabled && action1 && nitro > 0 ? 1 : 0;
    const engine = enabled ? 0.018 + normalizedSpeed * 0.055 + throttle * 0.018 : 0;

    this.engineLow?.frequency.setTargetAtTime(42 + normalizedSpeed * 92 + throttle * 14, now, 0.08);
    this.engineHigh?.frequency.setTargetAtTime(83 + normalizedSpeed * 156 + throttle * 22, now, 0.08);
    this.engineGain?.gain.setTargetAtTime(engine, now, 0.1);
    this.skidGain?.gain.setTargetAtTime(skid * 0.075, now, 0.06);
    this.brakeGain?.gain.setTargetAtTime(braking * 0.045, now, 0.06);
    this.boostGain?.gain.setTargetAtTime(boosting * 0.045, now, 0.08);
    this.boostOscillator?.frequency.setTargetAtTime(70 + normalizedSpeed * 95 + nitro * 0.3, now, 0.12);
  }

  setIntroAmbience(active: boolean) {
    if (!this.context || !this.graphCreated || this.ambienceActive === active) return;
    this.ambienceActive = active;
    this.ambienceGain?.gain.setTargetAtTime(active ? 0.026 : 0, this.context.currentTime, 0.35);
  }

  playCue(cue: AudioCue) {
    if (!this.context || !this.graphCreated || this.context.state !== "running") return;
    const now = this.context.currentTime;
    if (cue === "impact") {
      if (now - this.lastImpactTime < 0.24) return;
      this.lastImpactTime = now;
    }

    const notes = cue === "countdown" ? [660] : cue === "start" ? [880, 1175] :
      cue === "lap" ? [740] : cue === "finish" ? [523, 659, 784] : [110];
    const spacing = cue === "start" || cue === "finish" ? 0.14 : 0;

    notes.forEach((frequency, index) => {
      const start = now + index * spacing;
      const oscillator = this.context!.createOscillator();
      const envelope = this.context!.createGain();
      oscillator.type = cue === "impact" ? "sawtooth" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      if (cue === "impact") oscillator.frequency.exponentialRampToValueAtTime(48, start + 0.19);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(cue === "impact" ? 0.22 : 0.12, start + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + (cue === "impact" ? 0.2 : 0.14));
      oscillator.connect(envelope);
      envelope.connect(this.master!);
      oscillator.start(start);
      oscillator.stop(start + (cue === "impact" ? 0.22 : 0.16));
    });
  }

  private ensureGraph() {
    if (this.context) return this.context;
    const context = new AudioContext();
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(context.destination);

    this.engineGain = context.createGain();
    this.engineGain.gain.value = 0;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 620;
    this.engineLow = context.createOscillator();
    this.engineLow.type = "sawtooth";
    this.engineHigh = context.createOscillator();
    this.engineHigh.type = "triangle";
    this.engineLow.connect(engineFilter);
    this.engineHigh.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineLow.start();
    this.engineHigh.start();

    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
    this.noiseSource = context.createBufferSource();
    this.noiseSource.buffer = noise;
    this.noiseSource.loop = true;

    this.skidFilter = context.createBiquadFilter();
    this.skidFilter.type = "bandpass";
    this.skidFilter.frequency.value = 1250;
    this.skidGain = context.createGain();
    this.skidGain.gain.value = 0;
    this.noiseSource.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.master);

    this.brakeFilter = context.createBiquadFilter();
    this.brakeFilter.type = "lowpass";
    this.brakeFilter.frequency.value = 430;
    this.brakeGain = context.createGain();
    this.brakeGain.gain.value = 0;
    this.noiseSource.connect(this.brakeFilter);
    this.brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(this.master);
    this.noiseSource.start();

    this.boostOscillator = context.createOscillator();
    this.boostOscillator.type = "square";
    this.boostOscillator.frequency.value = 80;
    this.boostGain = context.createGain();
    this.boostGain.gain.value = 0;
    this.boostOscillator.connect(this.boostGain);
    this.boostGain.connect(this.master);
    this.boostOscillator.start();

    this.ambienceGain = context.createGain();
    this.ambienceGain.gain.value = 0;
    this.ambienceLow = context.createOscillator();
    this.ambienceLow.type = "sine";
    this.ambienceLow.frequency.value = 55;
    this.ambienceHigh = context.createOscillator();
    this.ambienceHigh.type = "sine";
    this.ambienceHigh.frequency.value = 82.4;
    this.ambienceLow.connect(this.ambienceGain);
    this.ambienceHigh.connect(this.ambienceGain);
    this.ambienceGain.connect(this.master);
    this.ambienceLow.start();
    this.ambienceHigh.start();

    this.graphCreated = true;
    return context;
  }

  private updateMasterGain() {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.04);
  }
}

export const arcadeAudio = new ArcadeAudio();