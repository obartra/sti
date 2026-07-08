import { createRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LinkupView } from "./Linkup.tsx";

// Connect in person (doc 25): one screen shows your code and runs the camera at
// once; neither person picks a role. The stories pin each phase of the surface:
// live show+scan, the honest pending/failed mint states, the camera fallback
// (the show half stays useful), and the completion pair (warm only when both
// are blue; a gray gets one neutral routing-to-care line, never a verdict).
const meta: Meta<typeof LinkupView> = {
  title: "Passport/Linkup",
  component: LinkupView,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof LinkupView>;

const base = {
  ownerBadge: "blue",
  videoRef: createRef<HTMLVideoElement>(),
  onRetry: () => undefined,
  onClose: () => undefined,
} as const;

// jsdom/storybook has no camera, so the live viewport never opens here; the
// camera-side states are the honest fallback lines.
export const Showing: Story = {
  args: {
    ...base,
    phase: { kind: "showing", url: "https://sti.care/a/a7f3k9q2#k=Zr8&n=Qm" },
    scanStatus: "denied",
  },
};

export const Preparing: Story = {
  args: { ...base, phase: { kind: "pending" }, scanStatus: "denied" },
};

export const PrepareFailed: Story = {
  args: { ...base, phase: { kind: "failed" }, scanStatus: "denied" },
};

export const LinkedBothBlue: Story = {
  args: {
    ...base,
    phase: {
      kind: "linked",
      peers: [{ key: "p1", label: "Sam", badge: "blue" }],
      doorUrl: "https://sti.care/d#p=a7f3k9q2",
    },
    scanStatus: "denied",
  },
};

export const LinkedOneGray: Story = {
  args: {
    ...base,
    phase: {
      kind: "linked",
      peers: [{ key: "p1", label: "", badge: "gray" }],
      doorUrl: "https://sti.care/d#p=a7f3k9q2",
    },
    scanStatus: "denied",
  },
};

export const LinkedThree: Story = {
  args: {
    ...base,
    phase: {
      kind: "linked",
      peers: [
        { key: "p1", label: "Sam", badge: "blue" },
        { key: "p2", label: "", badge: "blue" },
      ],
      doorUrl: "https://sti.care/d#p=a7f3k9q2",
    },
    scanStatus: "denied",
  },
};
