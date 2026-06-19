import type { Meta, StoryObj } from "@storybook/react-vite";
import { Report, ReportSaved } from "./Report.tsx";

// C2 Report a result. The owner records their OWN test outcomes (positive /
// negative, per site) and saves them to the passport. This is owner-only data
// entry: the outcome chips and per-site capture never reach a viewer; partners
// only ever see the derived two-state (blue/gray) badge. ReportSaved is the
// confirmation shown after a positive is recorded.
const meta: Meta<typeof Report> = {
  title: "Passport/Core/Report a result",
  component: Report,
};
export default meta;
type Story = StoryObj<typeof Report>;

// The report form. Lands on "All negative" (the one-tap full-core-panel path);
// switch to "Specific results" in-story to enter per-infection and per-site
// outcomes and watch the blue-card coverage guidance update live.
export const ReportForm: Story = {};

// Pre-filled date label, otherwise the same form.
export const WithDate: Story = { args: { lastTestedLabel: "12 Jun 2026" } };

type SavedStory = StoryObj<typeof ReportSaved>;

// The confirmation after a positive is recorded. The card is gray: a positive
// shows no status, identical to every other reason a card isn't current. It
// never names what was tested for.
export const Saved: SavedStory = {
  render: (args) => <ReportSaved {...args} />,
  args: { viewerBadge: "gray", handle: "robin" },
};

// Saved while the card stays blue (an all-clear core panel), with protection
// labels carried through on the badge.
export const SavedBlue: SavedStory = {
  render: (args) => <ReportSaved {...args} />,
  args: { viewerBadge: "blue", labels: ["hiv"], handle: "robin" },
};
