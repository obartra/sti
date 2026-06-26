import { useEffect, useState } from "react";
import {
  installAvailable,
  subscribeInstall,
  promptInstall,
  isStandalone,
} from "./installPrompt.ts";

/**
 * The Chromium install affordance for the Settings row (doc 22 section F):
 * `canInstall` is true only when the browser has offered a prompt AND the app is
 * not already installed, and `install` fires it. Absent on iOS and once installed,
 * so the row that uses this simply renders nothing there.
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  install: () => void;
} {
  const [available, setAvailable] = useState(installAvailable());
  useEffect(() => subscribeInstall(() => setAvailable(installAvailable())), []);
  return {
    canInstall: available && !isStandalone(),
    install: () => void promptInstall(),
  };
}
