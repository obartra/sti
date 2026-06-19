import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppShell, BackBar, type TabId } from "./AppShell.tsx";
import { Card } from "../../design/components/index.ts";

const meta: Meta<typeof AppShell> = {
  title: "Passport/App shell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AppShell>;

export const Default: Story = {
  render: function ShellStory() {
    const [tab, setTab] = useState<TabId>("home");
    return (
      <AppShell tab={tab} onTab={setTab}>
        <Card>Content for the {tab} tab goes here.</Card>
      </AppShell>
    );
  },
};

export const SubScreenWithBackBar: Story = {
  render: function ShellBackStory() {
    const [tab, setTab] = useState<TabId>("results");
    return (
      <AppShell tab={tab} onTab={setTab} showAdd={false}>
        <BackBar title="Results" />
        <Card style={{ marginTop: "var(--space-4)" }}>
          A sub-screen rendered under the back bar.
        </Card>
      </AppShell>
    );
  },
};
