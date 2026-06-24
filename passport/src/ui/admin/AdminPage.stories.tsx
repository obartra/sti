import type { Meta, StoryObj } from "@storybook/react-vite";
import { AdminPage } from "./AdminPage.tsx";
import type { AdminPingResult } from "./adminApi.ts";

// The operator surface (doc 20): a dedicated, gated /admin page isolated from the
// user flows. The stories stub the token validator so the two visual states (the
// lock gate and the authed shell) render without a server. The meta decorator
// clears any seeded token so each story starts from a known state.
const meta: Meta<typeof AdminPage> = {
  title: "Passport/Admin/AdminPage",
  component: AdminPage,
  args: { apiBase: "https://api.sti.care" },
  decorators: [
    (Story) => {
      sessionStorage.removeItem("sti.admin.token");
      return <Story />;
    },
  ],
};
export default meta;
type Story = StoryObj<typeof AdminPage>;

const always = (result: AdminPingResult) => () => Promise.resolve(result);

// The default state: the locked token gate, before any token is entered.
export const LockGate: Story = {
  args: { ping: always("ok") },
};

// The authed shell: a token is pre-seeded for the tab (the key adminToken.ts uses),
// so the page validates it on mount and lands on the panel without interaction.
export const Authed: Story = {
  args: { ping: always("ok") },
  decorators: [
    (Story) => {
      sessionStorage.setItem("sti.admin.token", "demo-token");
      return <Story />;
    },
  ],
};
