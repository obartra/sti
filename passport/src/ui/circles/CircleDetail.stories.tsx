import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleDetail } from "./CircleDetail.tsx";
import type { CircleRecord, ContactRecord } from "../../store/accountBlob.ts";
import type { PassportStore } from "../../store/index.ts";
import type { ResolvedView } from "../public/PublicResolution.tsx";

// Circle detail: a header, the member roster (shown at or above the min-5 floor),
// and a delete control. Meaningful states: a resolved roster (mixed blue/gray)
// and a small circle (under the floor) where the roster gives way to the notice.
const meta: Meta<typeof CircleDetail> = {
  title: "Passport/Circles/Detail",
  component: CircleDetail,
};
export default meta;
type Story = StoryObj<typeof CircleDetail>;

function contact(id: string, label: string, blue: boolean): ContactRecord {
  return {
    id,
    label,
    createdDay: 1,
    expiresDay: null,
    alias: { id, writeToken: "w", key: "k", isPublic: false },
    ...(blue ? { theirStatusAlias: { id: `s-${id}`, key: "k" } } : {}),
  };
}

const contacts: ContactRecord[] = [
  contact("a", "sam", true),
  contact("b", "ari", true),
  contact("c", "leo", false),
  contact("d", "kit", true),
  contact("e", "noa", false),
  contact("f", "jules", true),
  contact("g", "theo", false),
];

// A resolver that reads blue for any contact carrying a status alias (id "s-*").
const resolveAlias: PassportStore["resolveAlias"] = ({ id }) => {
  const view: ResolvedView = { state: "blue", identity: { handle: "x" } };
  return Promise.resolve(id.startsWith("s-") ? view : null);
};

const big: CircleRecord = {
  id: "c1",
  name: "Thursday crew",
  memberContactIds: ["a", "b", "c", "d", "e", "f", "g"],
};

// At/above the floor: the roster shows each member's blue/gray status.
export const WithRoster: Story = {
  args: { circle: big, contacts, resolveAlias },
};

// Under 5 people: the roster gives way to the small-circle privacy notice.
export const SmallCircle: Story = {
  args: {
    circle: { id: "c2", name: "Fern house", memberContactIds: ["a", "b", "c"] },
    contacts,
    resolveAlias,
  },
};
