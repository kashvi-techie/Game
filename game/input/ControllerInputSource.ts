export type ControllerControls = {
  steering: number;
  throttle: number;
  brake: number;
  pitch: number;
  flightThrottle: number;
  flightBrake: number;
  action1: boolean;
  action2: boolean;
  reset?: boolean;
  horn?: boolean;
  recenter?: boolean;
  interact?: boolean;
  toggleGear?: boolean;
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
  pitch: 0,
  flightThrottle: 0,
  flightBrake: 0,
  action1: false,
  action2: false,
  reset: false,
  horn: false,
  recenter: false,
  interact: false,
  toggleGear: false,
};