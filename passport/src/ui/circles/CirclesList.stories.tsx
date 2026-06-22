import type { Meta, StoryObj } from "@storybook/react-vite";
import { CirclesList } from "./CirclesList.tsx";
import type { CircleRecord } from "../../store/accountBlob.ts";

// The circles list: one row per private grouping (name + member count).
// Meaningful states: a populated list and the empty state.
const meta: Meta<typeof CirclesList> = {
  title: "Passport/Circles/List",
  component: CirclesList,
};
export default meta;
type Story = StoryObj<typeof CirclesList>;

const circles: CircleRecord[] = [
  {
    id: "c1",
    name: "Thursday crew",
    memberContactIds: ["a", "b", "c", "d", "e", "f", "g"],
  },
  { id: "c2", name: "Fern house", memberContactIds: ["a", "b", "c", "d", "e"] },
];

// Default: a couple of circles with their member counts.
export const Populated: Story = { args: { circles } };

// Empty: no circles yet, so the empty-state card with a Create CTA shows.
export const Empty: Story = { args: { circles: [] } };
