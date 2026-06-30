import { Card, Segmented } from "../../design/components/index.ts";

// The Settings control for which face Home opens on (the breakdown of where you
// stand, or the mirror of what a viewer sees). Persisted as a preference; the Home
// toggle still switches freely after open. Defaults to "criteria" (doc 31).
const COPY = {
  title: "Home opens on",
  sub: "Which view your home screen starts with. You can still switch any time.",
} as const;

const OPTIONS = [
  { value: "criteria" as const, label: "Your criteria" },
  { value: "shared" as const, label: "What others see" },
];

export function HomeViewCard({
  value,
  onChange,
}: {
  value: "criteria" | "shared";
  onChange: (view: "criteria" | "shared") => void;
}) {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div>
        <div
          style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {COPY.title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {COPY.sub}
        </div>
      </div>
      <Segmented
        aria-label="Home default view"
        value={value}
        onChange={onChange}
        options={OPTIONS}
      />
    </Card>
  );
}
