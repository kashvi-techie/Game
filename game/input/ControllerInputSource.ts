export type ControllerControls = {
  steering: number;
  throttle: number;
  brake: number;
  action1: boolean;
  action2: boolean;
};

export interface ControllerInputSource {
  readonly label: string;
  start(): void;
  stop(): void;
  read(): ControllerControls;
}

export const neutralControls: ControllerControls = {
  steering: 0,
  throttle: 0,
  brake: 0,
  action1: false,
  action2: false,
};