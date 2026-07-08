// The camera fixture's browser (doc 38 §3): Chromium launched with its fake media
// stack playing a given Y4M file as the camera. The capture file is a LAUNCH-TIME
// input, so scenarios launch this browser only after the content to be "scanned"
// exists (write the file with support/qrVideo.ts first). Note the switch names:
// the device/UI fakes end in "-for-media-stream"; only the file switch is
// "-video-capture". A misspelled Chromium switch is silently ignored, which here
// would mean prompting for the REAL camera.
import { chromium, type Browser, type BrowserContext } from "@playwright/test";

export async function launchScannerBrowser(
  videoFile: string,
): Promise<Browser> {
  return chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${videoFile}`,
    ],
  });
}

// A context whose pages may open the fake camera without a prompt: Playwright's
// permission layer sits in front of the browser's fake-UI switch, so the camera
// permission must also be granted here.
export async function scannerContext(
  browser: Browser,
  origin: string,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.grantPermissions(["camera"], { origin });
  return context;
}
