import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Button } from "../../design/components/index.ts";
import { StatusLabel } from "./StatusLabel.tsx";
import "./editorial.stories.css";

// The editorial styleguide (doc 37): every piece of the .e-* grammar rendered
// by the real CSS, in one dense story. Deliberately NOT titled "Design
// System*", so lost-pixel captures it and the whole system regresses as one
// target; it is also the review artifact each migrated screen cluster is
// judged against. Demo copy reuses real product strings; nothing here invents
// voice.
const meta: Meta = {
  title: "Editorial/Styleguide",
};
export default meta;

type Story = StoryObj;

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="sg__section">
      <hr className="e-rule" />
      <p className="e-eyebrow sg__section-label">{label}</p>
      <div className="sg__section-body">{children}</div>
    </section>
  );
}

export const Default: Story = {
  render: () => (
    <div className="sg">
      <p className="e-eyebrow">Doc 37</p>
      <h1 className="e-title sg__head-title">The editorial grammar</h1>
      <p className="e-lead sg__head-lead">
        Every class of the editorial skin, rendered by the real CSS.
      </p>

      <Section label="Type">
        <p className="e-display">Display, serif</p>
        <p className="e-title">Screen title, serif</p>
        <p className="e-section">Section title, serif</p>
        <p className="e-lead">Lead paragraph, sans on the clamped lead size.</p>
        <p className="e-micro">
          Micro copy, 13px floor, muted and never lighter.
        </p>
      </Section>

      <Section label="Status words">
        <div className="sg__inline">
          <StatusLabel label="Curable" tone="clear" />
          <StatusLabel label="Treatable" tone="treat" />
          <StatusLabel label="Usually goes away" tone="none" />
        </div>
      </Section>

      <Section label="Rows">
        <div>
          <div className="e-row">
            <span className="e-row__body">
              <span className="e-row__title">Find free testing near you</span>
              <span className="e-row__sub">Clinics that never bill you</span>
            </span>
          </div>
          <div className="e-row">
            <span className="e-row__body">
              <span className="e-row__title">Talk to a clinician</span>
              <span className="e-row__sub">What to say, in plain words</span>
            </span>
          </div>
        </div>
      </Section>

      <Section label="Callouts">
        <div className="sg__stack">
          <div className="e-card e-card--urgent">
            <p className="e-row__title">Think you were exposed to HIV?</p>
            <p className="e-micro sg__gap-sm">
              PEP works best inside 72 hours.
            </p>
          </div>
          <div className="e-card">
            <Button variant="primary">Find free testing</Button>
          </div>
        </div>
      </Section>

      <Section label="The artifact">
        <div className="e-artifact sg__artifact-pad">
          <p className="e-eyebrow">sti.care passport</p>
          <p className="e-section sg__gap-sm">
            The badge card keeps its object-ness
          </p>
          <p className="e-micro sg__gap-sm">
            Hairline border, restrained shadow, never a glow.
          </p>
        </div>
      </Section>
    </div>
  ),
};
