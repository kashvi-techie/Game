import { type ControllerControls, type ControllerInputSource, neutralControls } from "./ControllerInputSource";

export class InputManager {
  private active = false;

  constructor(private readonly source: ControllerInputSource) {}

  get label() {
    return this.source.label;
  }

  start() {
    if (this.active) return;
    this.source.start();
    this.active = true;
  }

  stop() {
    if (!this.active) return;
    this.source.stop();
    this.active = false;
  }

  read(): ControllerControls {
    return this.active ? this.source.read() : neutralControls;
  }
}