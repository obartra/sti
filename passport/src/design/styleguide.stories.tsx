import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

// Living styleguide for the design system tokens (the source of truth that the
// comps were built from). These render straight off the CSS custom properties,
// so a token change shows up here and in visual-regression snapshots.

const meta: Meta = { title: "Design System/Tokens" };
export default meta;
type Story = StoryObj;

function Swatch({ token, dark }: { token: string; dark?: boolean }) {
  return (
    <div style={{ width: 132 }}>
      <div
        style={{
          height: 56,
          borderRadius: "var(--radius-md)",
          background: `var(${token})`,
          border: "1px solid var(--border-card)",
        }}
      />
      <code
        style={{
          display: "block",
          marginTop: 6,
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-2xs)",
          color: dark ? "var(--text-on-accent)" : "var(--text-muted)",
        }}
      >
        {token}
      </code>
    </div>
  );
}

function Group({ title, tokens }: { title: string; tokens: string[] }) {
  return (
    <section style={{ marginBottom: "var(--space-8)" }}>
      <h3 style={{ font: "var(--text-h3)", fontFamily: "var(--font-display)", color: "var(--text-strong)", marginBottom: "var(--space-4)" }}>
        {title}
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)" }}>
        {tokens.map((t) => (
          <Swatch key={t} token={t} />
        ))}
      </div>
    </section>
  );
}

const card: CSSProperties = {
  background: "var(--surface-card)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border-card)",
  padding: "var(--space-8)",
  maxWidth: 760,
  color: "var(--text-body)",
};

export const Colors: Story = {
  render: () => (
    <div style={card}>
      <Group title="Surfaces" tokens={["--surface-app", "--surface-card", "--surface-sunken", "--surface-tint"]} />
      <Group title="Accent (brand teal = blue badge)" tokens={["--accent", "--accent-hover", "--accent-press", "--accent-soft", "--accent-ring"]} />
      <Group title="Ink scale" tokens={["--ink-900", "--ink-700", "--ink-500", "--ink-400", "--ink-300", "--ink-200", "--ink-100"]} />
    </div>
  ),
};

const TYPE: { token: string; label: string }[] = [
  { token: "--text-display", label: "Display" },
  { token: "--text-h1", label: "Heading 1" },
  { token: "--text-h2", label: "Heading 2" },
  { token: "--text-h3", label: "Heading 3" },
  { token: "--text-lg", label: "Large" },
  { token: "--text-base", label: "Body" },
  { token: "--text-sm", label: "Small" },
  { token: "--text-xs", label: "Extra small" },
];

export const Typography: Story = {
  render: () => (
    <div style={card}>
      {TYPE.map(({ token, label }) => (
        <div key={token} style={{ display: "flex", alignItems: "baseline", gap: "var(--space-5)", marginBottom: "var(--space-4)" }}>
          <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", color: "var(--text-muted)", width: 110, flexShrink: 0 }}>
            {token}
          </code>
          <span style={{ font: `var(${token})`, fontFamily: "var(--font-display)", color: "var(--text-strong)" }}>
            {label}, the honest one
          </span>
        </div>
      ))}
    </div>
  ),
};

export const SpacingAndRadii: Story = {
  render: () => (
    <div style={card}>
      <Group title="Spacing scale" tokens={[]} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-3)", marginTop: "calc(-1 * var(--space-6))", marginBottom: "var(--space-8)" }}>
        {["--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6", "--space-7", "--space-8"].map((t) => (
          <div key={t} style={{ textAlign: "center" }}>
            <div style={{ width: `var(${t})`, height: `var(${t})`, background: "var(--accent)", borderRadius: "var(--radius-xs)" }} />
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>{t.replace("--space-", "")}</code>
          </div>
        ))}
      </div>
      <h3 style={{ fontFamily: "var(--font-display)", color: "var(--text-strong)", marginBottom: "var(--space-4)" }}>Radii</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)" }}>
        {["--radius-xs", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl", "--radius-pill"].map((t) => (
          <div key={t} style={{ textAlign: "center" }}>
            <div style={{ width: 72, height: 56, background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: `var(${t})` }} />
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>{t.replace("--radius-", "")}</code>
          </div>
        ))}
      </div>
    </div>
  ),
};
