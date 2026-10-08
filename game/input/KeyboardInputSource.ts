import { type ControllerControls, type ControllerInputSource } from "./ControllerInputSource";

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const THROTTLE_KEYS = new Set(["ArrowUp", "KeyW"]);
const BRAKE_KEYS = new Set(["ArrowDown", "KeyS"]);
const CONTROL_CODES = new Set([...LEFT_KEYS, ...RIGHT_KEYS, ...THROTTLE_KEYS, ...BRAKE_KEYS, "Space", "ShiftLeft", "ShiftRight"]);

export class KeyboardInputSource implements ControllerInputSource {
  readonly label = "KEYBOARD";
  private readonly pressed = new Set<string>();

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (CONTROL_CODES.has(event.code)) event.preventDefault();
    this.pressed.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => this.pressed.delete(event.code);
  private readonly clear = () => this.pressed.clear();

  start() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clear);
  }

  stop() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clear);
    this.clear();
  }

  read(): ControllerControls {
    const hasAny = (keys: Set<string>) => [...keys].some((key) => this.pressed.has(key));
    return {
      steering: Number(hasAny(RIGHT_KEYS)) - Number(hasAny(LEFT_KEYS)),
      throttle: Number(hasAny(THROTTLE_KEYS)),
      brake: Number(hasAny(BRAKE_KEYS)),
      action1: this.pressed.has("Space"),
      action2: this.pressed.has("ShiftLeft") || this.pressed.has("ShiftRight"),
    };
  }
}