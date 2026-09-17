import { Engine } from '../../src/game/engine';

export interface HandlingSample {
  time: number;
  y: number;
  z: number;
  speed: number;
  pitch: number;
  yaw: number;
  slip: number;
  lean: number;
  armed: boolean;
}

declare global {
  interface Window {
    handlingTest: {
      setup(scenario: 'flight' | 'drift'): void;
      run(seconds: number): Promise<HandlingSample>;
    };
  }
}

const canvas = document.querySelector('canvas');
if (!canvas) throw new Error('Handling fixture requires a canvas');
const engine = new Engine(canvas);
Object.assign(engine.track, {
  wave: 0,
  waveZones: [],
  shore: undefined,
  land: [],
  ramps: [],
  obstacles: [],
});
engine.state = 'paused';

window.handlingTest = {
  setup(scenario) {
    engine.start('trial');
    engine.state = 'paused';
    Object.assign(engine.player, {
      x: 0,
      z: 0,
      y: scenario === 'flight' ? 4 : 0.6,
      vx: 0,
      vz: scenario === 'flight' ? 20 : 22,
      vy: scenario === 'flight' ? 3 : 0,
      yaw: 0,
      pitch: 0,
      wet: scenario === 'flight' ? 0 : 1,
    });
  },
  run(seconds) {
    const until = engine.time + seconds;
    return new Promise((resolve) => {
      engine.onFrame = () => {
        if (engine.time < until) return;
        engine.state = 'paused';
        engine.onFrame = () => {};
        const r = engine.player;
        const slip = Math.atan2(r.vx, r.vz) - r.yaw;
        resolve({
          time: engine.time,
          y: r.y,
          z: r.z,
          speed: Math.hypot(r.vx, r.vz),
          pitch: r.pitch,
          yaw: r.yaw,
          slip: Math.abs(Math.atan2(Math.sin(slip), Math.cos(slip))),
          lean: r.lean,
          armed: r.air.armed,
        });
      };
      engine.state = 'racing';
    });
  },
};
