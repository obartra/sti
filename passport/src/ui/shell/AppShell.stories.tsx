import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppShell, BackBar, type TabId } from "./AppShell.tsx";

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
        <p className="e-lead">Content for the {tab} tab goes here.</p>
      </AppShell>
    );
  },
};

export const SubScreenWithBackBar: Story = {
  render: function ShellBackStory() {
    const [tab, setTab] = useState<TabId>("care");
    return (
      <AppShell tab={tab} onTab={setTab} showAdd={false}>
        <BackBar title="Care" />
        <p className="e-lead">A sub-screen rendered under the back bar.</p>
      </AppShell>
    );
  },
};
