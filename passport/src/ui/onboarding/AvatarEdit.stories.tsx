import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AvatarEdit } from "./AvatarEdit.tsx";
import { randomAvatar, type AvatarConfig } from "../../lib/avatars.ts";

const meta: Meta<typeof AvatarEdit> = {
  title: "Passport/Onboarding/Avatar edit",
  component: AvatarEdit,
};
export default meta;
type Story = StoryObj<typeof AvatarEdit>;

export const Default: Story = {
  render: function AvatarEditStory() {
    const [config, setConfig] = useState<AvatarConfig>(() => randomAvatar(2));
    return <AvatarEdit config={config} onChange={setConfig} />;
  },
};
