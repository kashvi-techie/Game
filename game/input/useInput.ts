"use client";

import { useEffect, useState } from "react";
import { InputManager } from "./InputManager";
import { KeyboardInputSource } from "./KeyboardInputSource";

export function useInput(enabled: boolean) {
  const [manager] = useState(() => new InputManager(new KeyboardInputSource()));

  useEffect(() => {
    if (!enabled) {
      manager.stop();
      return;
    }

    manager.start();
    return () => manager.stop();
  }, [enabled, manager]);

  return manager;
}