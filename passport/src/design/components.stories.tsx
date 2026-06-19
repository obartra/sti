import { useState } from "react";
import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, IconButton, Card, Avatar, Badge, Input, Field, Switch, Segmented, Row } from "./components/index.ts";

// Living styleguide for the design-system primitives. Each story shows a
// component family's variants so a CSS/token change is caught in snapshots.
const meta: Meta = { title: "Design System/Components" };
export default meta;
type Story = StoryObj;

function Stack({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap }}>{children}</div>;
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--space-8)", maxWidth: 720 }}>
      <h3 style={{ fontFamily: "var(--font-display)", color: "var(--text-strong)", marginBottom: "var(--space-4)" }}>{title}</h3>
      {children}
    </section>
  );
}

// Minimal placeholder glyph (the DS pairs status with an icon; no emoji in UI).
const Dot = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="5" fill="currentColor" />
  </svg>
);

export const Buttons: Story = {
  render: () => (
    <div>
      <Panel title="Variants">
        <Stack>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="danger">Danger</Button>
        </Stack>
      </Panel>
      <Panel title="Sizes / block / icon / disabled">
        <Stack>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button icon={<Dot />}>With icon</Button>
          <Button disabled>Disabled</Button>
        </Stack>
        <div style={{ marginTop: "var(--space-4)", maxWidth: 280 }}>
          <Button block>Full width</Button>
        </div>
      </Panel>
      <Panel title="Icon buttons">
        <Stack>
          <IconButton aria-label="default"><Dot /></IconButton>
          <IconButton aria-label="accent" variant="accent"><Dot /></IconButton>
          <IconButton aria-label="filled" variant="filled"><Dot /></IconButton>
        </Stack>
      </Panel>
    </div>
  ),
};

export const Cards: Story = {
  render: () => (
    <Stack gap={20}>
      <Card style={{ width: 200 }}>Default</Card>
      <Card variant="flat" style={{ width: 200 }}>Flat</Card>
      <Card variant="raised" style={{ width: 200 }}>Raised</Card>
      <Card variant="tint" style={{ width: 200 }}>Tint</Card>
      <Card variant="interactive" style={{ width: 200 }}>Interactive (hover)</Card>
    </Stack>
  ),
};

export const AvatarsAndBadges: Story = {
  render: () => (
    <div>
      <Panel title="Avatars">
        <Stack>
          <Avatar size="sm" initials="RB" />
          <Avatar size="md" initials="KA" />
          <Avatar size="lg" initials="SM" />
        </Stack>
      </Panel>
      <Panel title="Badges">
        <Stack>
          <Badge>Default</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="count">3</Badge>
        </Stack>
      </Panel>
    </div>
  ),
};

export const Forms: Story = {
  render: function FormsStory() {
    const [on, setOn] = useState(true);
    const [seg, setSeg] = useState<"always" | "sometimes" | "never">("always");
    return (
      <Card variant="flat" pad="lg" style={{ maxWidth: 380, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <Field label="Display handle" hint="Shown inside your encrypted card, not in any URL." htmlFor="h">
          <Input id="h" placeholder="robin" defaultValue="robin" />
        </Field>
        <Field label="Recovery phrase" error="That phrase doesn't match." htmlFor="r">
          <Input id="r" error defaultValue="wrong words" />
        </Field>
        <Switch checked={on} onChange={setOn} label="Make my card public" />
        <Segmented
          aria-label="Condom preference"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "always", label: "Always" },
            { value: "sometimes", label: "Sometimes" },
            { value: "never", label: "Never" },
          ]}
        />
      </Card>
    );
  },
};

export const Rows: Story = {
  render: () => (
    <Card pad="sm" style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 4 }}>
      <Row lead={<Avatar size="sm" initials="KA" />} title="Kai" sub="Linked 3 days ago" trail={<Dot />} />
      <Row lead={<Avatar size="sm" initials="SM" />} title="Sam" sub="Linked last week" trail={<Dot />} />
      <Row interactive={false} lead={<Dot />} title="Static row" sub="Not tappable" />
    </Card>
  ),
};
