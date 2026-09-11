/** A subdued motor bed with water rush, rather than a constant bright oscillator. */
export class EngineAudio {
  private motor: OscillatorNode;
  private motorGain: GainNode;
  private water: AudioBufferSourceNode;
  private waterFilter: BiquadFilterNode;
  private waterGain: GainNode;
  constructor(
    private context: BaseAudioContext,
    destination: AudioNode,
    noise: AudioBuffer,
  ) {
    this.motor = context.createOscillator();
    this.motor.type = 'triangle';
    this.motorGain = context.createGain();
    this.motorGain.gain.value = 0;
    this.motor.connect(this.motorGain).connect(destination);
    this.motor.start();
    this.water = context.createBufferSource();
    this.water.buffer = noise;
    this.water.loop = true;
    this.waterFilter = context.createBiquadFilter();
    this.waterFilter.type = 'lowpass';
    this.waterFilter.Q.value = 0.5;
    this.waterGain = context.createGain();
    this.waterGain.gain.value = 0;
    this.water.connect(this.waterFilter).connect(this.waterGain).connect(destination);
    this.water.start();
  }
  update(speed: number, throttle: number, active: boolean, contact: number, boost: number) {
    const t = this.context.currentTime;
    const pace = Math.min(Math.max(speed, 0) / 30, 1);
    const load = Math.max(0, Math.min(1, throttle));
    const wet = Math.max(0, Math.min(1, contact));
    const surge = Math.max(0, Math.min(1, boost));
    this.motor.frequency.setTargetAtTime(
      38 + pace * 58 + load * 12 + (1 - wet) * load * 14,
      t,
      0.18,
    );
    this.motorGain.gain.setTargetAtTime(active ? 0.003 + load * 0.012 + pace * 0.007 : 0, t, 0.16);
    this.waterFilter.frequency.setTargetAtTime(350 + pace * 950 + surge * 650, t, 0.18);
    this.waterGain.gain.setTargetAtTime(
      active ? wet * (pace * 0.035 + load * 0.012 + surge * 0.065) : 0,
      t,
      0.12,
    );
  }
}
