import { describe, it, expect, vi, afterEach } from "vitest";
import {
  initInstallPrompt,
  installAvailable,
  promptInstall,
  subscribeInstall,
  isStandalone,
  isIOS,
} from "./installPrompt.ts";

// Dispatch a beforeinstallprompt-shaped event and return its captured prompt spy.
function fireBeforeInstall(): ReturnType<typeof vi.fn> {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const e = Object.assign(new Event("beforeinstallprompt"), { prompt });
  window.dispatchEvent(e);
  return prompt;
}

// The listeners live for the app's lifetime, so install once for the whole file.
initInstallPrompt();

afterEach(() => {
  // Leave no captured prompt between tests (installed clears it).
  window.dispatchEvent(new Event("appinstalled"));
  vi.restoreAllMocks();
});

describe("install prompt singleton (doc 22 F)", () => {
  it("captures the prompt, notifies subscribers, fires it once, and clears it", async () => {
    expect(installAvailable()).toBe(false);
    const seen = vi.fn();
    const unsub = subscribeInstall(seen);

    const prompt = fireBeforeInstall();
    expect(installAvailable()).toBe(true);
    expect(seen).toHaveBeenCalled();

    await promptInstall();
    expect(prompt).toHaveBeenCalledOnce();
    expect(installAvailable()).toBe(false); // the browser only allows one use
    unsub();
  });

  it("clears the captured prompt once the app is installed", () => {
    fireBeforeInstall();
    expect(installAvailable()).toBe(true);
    window.dispatchEvent(new Event("appinstalled"));
    expect(installAvailable()).toBe(false);
  });

  it("promptInstall is a safe no-op when nothing was captured", async () => {
    expect(installAvailable()).toBe(false);
    await expect(promptInstall()).resolves.toBeUndefined();
  });
});

describe("platform detection", () => {
  it("isStandalone reads the display-mode media query", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    expect(isStandalone()).toBe(true);
  });

  it("isIOS matches an iPhone user agent and not a desktop one", () => {
    const ua = (value: string): void => {
      Object.defineProperty(navigator, "userAgent", {
        value,
        configurable: true,
      });
    };
    ua("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari");
    expect(isIOS()).toBe(true);
    ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome");
    expect(isIOS()).toBe(false);
  });
});
