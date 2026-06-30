import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { AdminPage } from "./AdminPage.tsx";
import type {
  AdminAuditEntry,
  AdminMetrics,
  AdminPingResult,
} from "./adminApi.ts";
import type { ReviewOps } from "./ReviewPanel.tsx";
import type { AuditOps } from "./ActivityPanel.tsx";
import type { MetricsOps } from "./MetricsPanel.tsx";

// The operator surface (doc 20): a dedicated, gated /admin page isolated from the
// user flows. The stories stub the token validator and the review transport so the
// states (lock gate, authed-with-reports, authed-empty) render without a server.
// The meta decorator clears any seeded token so each story starts from a known state.
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

const reviewOps = (
  reports: { name: string; reason: string; count: number; createdAt: number }[],
): ReviewOps => ({
  list: () => Promise.resolve({ kind: "ok", reports }),
  act: () => Promise.resolve("ok"),
});

const auditOps = (entries: AdminAuditEntry[]): AuditOps => ({
  list: () => Promise.resolve({ kind: "ok", entries }),
});

const metricsOps = (metrics: AdminMetrics): MetricsOps => ({
  get: () => Promise.resolve({ kind: "ok", metrics }),
});

const SAMPLE_METRICS: AdminMetrics = {
  accounts: 1840,
  aliases: 5210,
  knocks: 37,
  sendQueueDepth: 4,
  dbSizeBytes: 18 * 1024 * 1024,
  pendingReports: 2,
};

// Fixed UTC instants so the Activity panel's timestamps are deterministic.
const SAMPLE_AUDIT: AdminAuditEntry[] = [
  {
    id: 3,
    action: "vanity.takedown",
    target: "free_money",
    createdAt: Date.UTC(2026, 5, 25, 14, 30, 0),
  },
  {
    id: 2,
    action: "account.disable",
    target: "kQ3xa9c2",
    createdAt: Date.UTC(2026, 5, 24, 9, 5, 0),
  },
  {
    id: 1,
    action: "ping",
    target: "",
    createdAt: Date.UTC(2026, 5, 24, 9, 4, 0),
  },
];

// Pre-seed a token so the page validates it on mount and lands authed without
// interaction (the key is the one adminToken.ts uses).
const seedToken: Decorator = (Story) => {
  sessionStorage.setItem("sti.admin.token", "demo-token");
  return <Story />;
};

// The default state: the locked token gate, before any token is entered.
export const LockGate: Story = {
  args: { ping: always("ok") },
};

// The authed shell with a couple of reported names in the review queue and a few
// recent actions in the activity log below it.
export const AuthedWithReports: Story = {
  args: {
    ping: always("ok"),
    reviewOps: reviewOps([
      { name: "rob1n", reason: "impersonation", count: 3, createdAt: 1 },
      { name: "free_money", reason: "spam", count: 1, createdAt: 2 },
    ]),
    auditOps: auditOps(SAMPLE_AUDIT),
    metricsOps: metricsOps(SAMPLE_METRICS),
  },
  decorators: [seedToken],
};

// The authed shell with an empty queue and no recorded activity (the all-clear).
export const AuthedEmpty: Story = {
  args: {
    ping: always("ok"),
    reviewOps: reviewOps([]),
    auditOps: auditOps([]),
    metricsOps: metricsOps({
      accounts: 0,
      aliases: 0,
      knocks: 0,
      sendQueueDepth: 0,
      dbSizeBytes: 0,
      pendingReports: 0,
    }),
  },
  decorators: [seedToken],
};
