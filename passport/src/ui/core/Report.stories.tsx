import type { Meta, StoryObj } from "@storybook/react-vite";
import { Report, ReportSaved } from "./Report.tsx";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import { toEpochDay } from "../../core/clock.ts";

// The form defaults "Date tested" to today, so an unpinned story re-renders
// differently every day and its visual baseline drifts with the wall clock.
// Pin the clock edge to a fixed day (2026-06-15) instead.
const STORY_DAY = toEpochDay(Date.UTC(2026, 5, 15));

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

// The report form. Opens straight into per-condition entry, everything starting
// at "not tested"; the "what a blue card needs" checklist and the HIV-protection
// route toggles update live as outcomes and routes are entered.
export const ReportForm: Story = {
  args: { today: STORY_DAY },
};

// Starting from an owner already on PrEP, so the route requirement reads as met
// from the outset and only a complete clear panel is left to earn blue.
export const OnPrep: Story = {
  args: {
    ownerState: { ...INITIAL_OWNER_STATE, onPrep: true },
    today: STORY_DAY,
  },
};

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
