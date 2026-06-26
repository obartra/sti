// Slice 1 invariants as an executable spec: the web app manifest stays valid and
// installable, its icons exist on disk, and index.html links it with a matching
// theme color. A regression here silently breaks "Add to home screen", so it is a
// test, not a doc note (doc 22, section J).
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}
interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
  shortcuts?: { name: string; url: string }[];
  screenshots?: {
    src: string;
    sizes: string;
    type: string;
    form_factor?: string;
    label?: string;
  }[];
  share_target?: {
    action: string;
    method: string;
    enctype: string;
    params: Record<string, string>;
  };
}

// Vitest runs with the passport root as cwd, so resolve repo paths from there.
const root = (p: string): string => resolve(process.cwd(), p);
const manifest = JSON.parse(
  readFileSync(root("public/manifest.webmanifest"), "utf8"),
) as Manifest;
const indexHtml = readFileSync(root("index.html"), "utf8");

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe("web app manifest (PWA slice 1)", () => {
  it("declares the installable basics", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.scope).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toMatch(HEX);
    expect(manifest.background_color).toMatch(HEX);
  });

  it("stays base-agnostic: start_url, scope, and icon srcs are relative", () => {
    expect(manifest.start_url.startsWith("/")).toBe(false);
    expect(manifest.scope.startsWith("/")).toBe(false);
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith("/")).toBe(false);
    }
  });

  it("ships a 192, a 512, and a maskable icon, and the files exist", () => {
    const any = (size: string): ManifestIcon | undefined =>
      manifest.icons.find(
        (i) => i.sizes === size && i.purpose.split(" ").includes("any"),
      );
    expect(any("192x192")).toBeTruthy();
    expect(any("512x512")).toBeTruthy();
    const maskable = manifest.icons.find((i) =>
      i.purpose.split(" ").includes("maskable"),
    );
    expect(maskable).toBeTruthy();
    for (const icon of manifest.icons) {
      expect(existsSync(root(`public/${icon.src}`))).toBe(true);
    }
  });

  it("is linked from index.html with a matching theme color and apple-touch icon", () => {
    expect(indexHtml).toContain('rel="manifest"');
    expect(indexHtml).toContain('href="/manifest.webmanifest"');
    expect(indexHtml).toContain(`content="${manifest.theme_color}"`);
    expect(indexHtml).toContain('rel="apple-touch-icon"');
  });

  it("points its shortcuts at in-scope app routes", () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      expect(shortcut.url.startsWith("./#")).toBe(true);
    }
  });

  it("declares a POST share_target the worker can resolve on-device", () => {
    const target = manifest.share_target;
    expect(target).toBeTruthy();
    // POST + multipart keeps the shared link (and its key) out of the action URL, so
    // the worker reads it from the body and never sends it upstream (doc 22 C).
    expect(target?.method).toBe("POST");
    expect(target?.enctype).toBe("multipart/form-data");
    // Base-agnostic action, like start_url/scope, and a url param to carry the link.
    expect(target?.action.startsWith("/")).toBe(false);
    expect(target?.params.url).toBeTruthy();
  });

  it("ships at least one install screenshot, base-agnostic and on disk", () => {
    const shots = manifest.screenshots ?? [];
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) {
      expect(shot.type).toBe("image/png");
      expect(shot.sizes).toMatch(/^\d+x\d+$/);
      // Relative src like the icons, so it works at any deploy path.
      expect(shot.src.startsWith("/")).toBe(false);
      expect(existsSync(root(`public/${shot.src}`))).toBe(true);
    }
  });
});
