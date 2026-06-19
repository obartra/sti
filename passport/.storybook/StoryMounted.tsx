import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Signals lost-pixel that the story is fully on screen and acts as an error
 * boundary. lost-pixel waits for `body[data-story-mounted]` before capturing.
 *
 * On mount it awaits every in-tree <img> decode, then sets the attribute, so a
 * capture never races image painting (e.g. the logo wordmark). On a render
 * error it renders a deterministic, readable fallback and still signals mounted,
 * so an errored story produces a captured <pre> instead of a blank screenshot.
 *
 * Animation determinism is handled separately by lost-pixel's beforeScreenshot
 * hook emulating prefers-reduced-motion against the reset in visual-reset.css.
 */
export class StoryMounted extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  async componentDidMount(): Promise<void> {
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
    // Signal only after the browser has actually painted the committed tree.
    // img.decode() guarantees decodability, not that React's commit has been
    // painted; under concurrent headless captures that race produced blank
    // screenshots. A double rAF waits for a real paint frame before signaling.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.setAttribute("data-story-mounted", "true");
      });
    });
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    document.body.setAttribute("data-story-error", "true");
    document.body.setAttribute("data-story-mounted", "true");
    console.error("StoryMounted caught an error:", error, info);
  }

  componentWillUnmount(): void {
    document.body.removeAttribute("data-story-mounted");
    document.body.removeAttribute("data-story-error");
  }

  render() {
    if (this.state.error) {
      return (
        <pre
          data-testid="story-error-fallback"
          style={{
            padding: "1rem",
            background: "#fee",
            color: "#900",
            border: "2px solid #900",
            borderRadius: 4,
            whiteSpace: "pre-wrap",
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
          }}
        >
          Story error: {this.state.error.message}
        </pre>
      );
    }
    return this.props.children;
  }
}
