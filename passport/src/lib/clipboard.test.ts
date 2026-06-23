import { describe, it, expect, vi, afterEach } from "vitest";
import { copyText } from "./clipboard.ts";

describe("copyText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the async Clipboard API when present and reports success", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(copyText("hello")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("attempts the textarea fallback when the Clipboard API is absent", () => {
    // No clipboard (insecure origin / in-app webview). jsdom has no working
    // execCommand, so the copy can't land here, but the fallback path must run
    // and fail gracefully (false) rather than throw.
    vi.stubGlobal("navigator", {});
    const append = vi.spyOn(document.body, "appendChild");
    expect(copyText("hi")).toBe(false);
    expect(append).toHaveBeenCalled();
  });
});
