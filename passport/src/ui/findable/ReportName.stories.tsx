import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReportName } from "./ReportName.tsx";

// Report a findable name (doc 17, F5c): the anonymous reason picker. The report
// transport is stubbed so the form renders without a server.
const meta: Meta<typeof ReportName> = {
  title: "Passport/Findable/ReportName",
  component: ReportName,
  args: {
    name: "rob1n",
    report: () => Promise.resolve(),
    onClose: () => undefined,
  },
};
export default meta;
type Story = StoryObj<typeof ReportName>;

export const Default: Story = {};
