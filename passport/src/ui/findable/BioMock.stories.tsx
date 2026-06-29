import type { Meta, StoryObj } from "@storybook/react-vite";
import { BioMock } from "./BioMock.tsx";
import {
  BIO_MOCKS,
  publicLinkFor,
  type BioMock as BioMockData,
} from "./shareLinkGuideCopy.ts";

// Pick a mock by kind, with a fallback so the type is BioMockData (not undefined)
// under noUncheckedIndexedAccess. The kinds always exist in BIO_MOCKS.
const FALLBACK: BioMockData = {
  kind: "oneline",
  surface: "Your bio",
  field: "Bio",
  line: "{link}",
};
const byKind = (kind: BioMockData["kind"]): BioMockData =>
  BIO_MOCKS.find((m) => m.kind === kind) ?? FALLBACK;

// The stylized bio-placement mockups (doc brief): our own on-brand frames with the
// link highlighted, not copies of any dating app's UI. One story per kind, in a
// phone-width frame for the visual baseline.
const meta: Meta<typeof BioMock> = {
  title: "Passport/Findable/BioMock",
  component: BioMock,
  decorators: [
    (Story) => (
      <div style={{ width: 390, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  args: { link: publicLinkFor("robin") },
};
export default meta;
type Story = StoryObj<typeof BioMock>;

// A dating-profile "About" field with the link dropped in.
export const Profile: Story = {
  args: { data: byKind("profile") },
};

// A one-line bio that ends in the link.
export const OneLine: Story = {
  args: { data: byKind("oneline") },
};

// A link-in-bio row, the sti.care row highlighted among plain ones.
export const LinkRow: Story = {
  args: { data: byKind("linkrow") },
};
