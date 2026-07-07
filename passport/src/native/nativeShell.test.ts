import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The native app shells (doc 26) wrap the same web build, and the in-person
// connect scans a code with getUserMedia in the WebView (QrScanner.tsx). That
// camera access is denied on device unless each shell declares it, so a `cap
// sync` or a project regen that dropped the declaration would silently break
// scanning on the store apps while every web gate stayed green. Pin it here.

// The native projects sit at the passport root, which is the cwd for the test
// run (CI and the Makefile both invoke vitest from passport/).
function readNative(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("native shells declare camera access for the in-person scan", () => {
  it("iOS Info.plist carries a non-empty NSCameraUsageDescription", () => {
    const plist = readNative("ios/App/App/Info.plist");
    const reason =
      /<key>NSCameraUsageDescription<\/key>\s*<string>([^<]+)<\/string>/.exec(
        plist,
      );
    expect(reason?.[1]?.trim()).toBeTruthy();
  });

  it("Android manifest requests the CAMERA permission", () => {
    const manifest = readNative("android/app/src/main/AndroidManifest.xml");
    expect(manifest).toContain('android:name="android.permission.CAMERA"');
  });
});
