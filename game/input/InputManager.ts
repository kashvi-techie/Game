import { type ControllerControls, type ControllerInputSource, neutralControls } from "./ControllerInputSource";

export class InputManager {
  private active = false;
  private smoothedSteering = 0;
  private lastTime = 0;

  constructor(private readonly keyboardSource: ControllerInputSource) {}

  get label() {
    return this.keyboardSource.label;
  }

  start() {
    if (this.active) return;
    this.keyboardSource.start();
    this.smoothedSteering = 0;
    this.lastTime = performance.now();
    this.active = true;
  }

  stop() {
    if (!this.active) return;
    this.keyboardSource.stop();
    this.smoothedSteering = 0;
    this.active = false;
  }

  private readGamepad(): ControllerControls | null {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return null;

    for (let i = 0; i < gamepads.length; i += 1) {
      const pad = gamepads[i];
      if (!pad || !pad.connected) continue;

      // Axis 0 is horizontal steering on standard gamepads / ESP32 HID
      const rawSteer = pad.axes[0] ?? 0;
      const steerDeadzone = 0.12;
      let steering = 0;
      if (Math.abs(rawSteer) > steerDeadzone) {
        steering = (rawSteer - Math.sign(rawSteer) * steerDeadzone) / (1 - steerDeadzone);
      }

      // Triggers or face buttons for throttle / brake
      const rightTrigger = pad.buttons[7]?.value ?? (pad.buttons[0]?.pressed ? 1 : 0);
      const leftTrigger = pad.buttons[6]?.value ?? (pad.buttons[1]?.pressed ? 1 : 0);
      const action1 = Boolean(pad.buttons[0]?.pressed || pad.buttons[2]?.pressed); // Nitro
      const action2 = Boolean(pad.buttons[1]?.pressed || pad.buttons[5]?.pressed); // Drift
      const reset = Boolean(pad.buttons[8]?.pressed || pad.buttons[9]?.pressed);
      const horn = Boolean(pad.buttons[3]?.pressed || pad.buttons[10]?.pressed || pad.buttons[11]?.pressed);
      const recenter = Boolean(pad.buttons[4]?.pressed);
      const pitch = -(pad.axes[1] ?? 0);

      return {
        steering: Math.max(-1, Math.min(1, steering)),
        throttle: Math.max(0, Math.min(1, rightTrigger)),
        brake: Math.max(0, Math.min(1, leftTrigger)),
        pitch: Math.max(-1, Math.min(1, pitch)),
        flightThrottle: Math.max(0, Math.min(1, rightTrigger)),
        flightBrake: Math.max(0, Math.min(1, leftTrigger)),
        action1,
        action2,
        reset,
        horn,
        recenter,
        interact: Boolean(pad.buttons[12]?.pressed),
        toggleGear: Boolean(pad.buttons[13]?.pressed),
      };
    }
    return null;
  }

  read(): ControllerControls {
    if (!this.active) return neutralControls;

    const now = performance.now();
    const dt = Math.min((now - (this.lastTime || now)) / 1000, 0.05);
    this.lastTime = now;

    const kb = this.keyboardSource.read();
    const pad = this.readGamepad();

    // Raw combined input (keyboard has priority if actively pressed, otherwise gamepad)
    let rawSteer = kb.steering;
    let throttle = kb.throttle;
    let brake = kb.brake;
    let pitch = kb.pitch;
    let flightThrottle = kb.flightThrottle;
    let flightBrake = kb.flightBrake;
    let action1 = kb.action1;
    let action2 = kb.action2;
    let reset = kb.reset;
    let horn = kb.horn;
    let recenter = kb.recenter;
    let interact = Boolean(kb.interact);
    let toggleGear = Boolean(kb.toggleGear);

    if (pad) {
      if (Math.abs(rawSteer) < 0.05 && Math.abs(pad.steering) >= 0.05) {
        rawSteer = pad.steering;
      }
      throttle = Math.max(throttle, pad.throttle);
      brake = Math.max(brake, pad.brake);
      if (Math.abs(pitch) < 0.05) pitch = pad.pitch;
      flightThrottle = Math.max(flightThrottle, pad.flightThrottle);
      flightBrake = Math.max(flightBrake, pad.flightBrake);
      action1 = action1 || pad.action1;
      action2 = action2 || pad.action2;
      reset = reset || pad.reset;
      horn = horn || pad.horn;
      recenter = recenter || pad.recenter;
      interact = interact || Boolean(pad.interact);
      toggleGear = toggleGear || Boolean(pad.toggleGear);
    }

    // High-responsiveness steering filter: smooths keyboard digital snaps
    // while reaching full steering lock in ~0.10s
    const filterRate = rawSteer !== 0 ? 14.0 : 18.0;
    this.smoothedSteering += (rawSteer - this.smoothedSteering) * (1 - Math.exp(-dt * filterRate));
    if (Math.abs(this.smoothedSteering) < 0.01 && rawSteer === 0) {
      this.smoothedSteering = 0;
    }

    return {
      steering: Math.max(-1, Math.min(1, this.smoothedSteering)),
      throttle,
      brake,
      pitch,
      flightThrottle,
      flightBrake,
      action1,
      action2,
      reset,
      horn,
      recenter,
      interact,
      toggleGear,
    };
  }
}