import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { AdminPage } from "./AdminPage.tsx";
import type {
  AdminAuditEntry,
  AdminFeedback,
  AdminHealth,
  AdminMetrics,
  AdminPingResult,
  AdminTrends,
} from "./adminApi.ts";
import type { ReviewOps } from "./ReviewPanel.tsx";
import type { AuditOps } from "./ActivityPanel.tsx";
import type { MetricsOps } from "./MetricsPanel.tsx";
import type { HealthOps } from "./HealthPanel.tsx";
import type { FeedbackOps } from "./FeedbackPanel.tsx";

// The operator surface (doc 20): a dedicated, gated /admin page isolated from the
// user flows. The stories stub the token validator and the review transport so the
// states (lock gate, authed-with-reports, authed-empty) render without a server.
// The meta decorator clears any seeded token so each story starts from a known state.
const meta: Meta<typeof AdminPage> = {
  title: "Passport/Admin/AdminPage",
  component: AdminPage,
  args: { apiBase: "https://api.sti.care" },
  // A full-page takeover like the app shell: the page owns its own centered
  // frame, so it skips the preview's flex wrapper (which would shrink-wrap it
  // and collapse the size-contained console to zero width).
  parameters: { layout: "fullscreen" },
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

const metricsOps = (
  metrics: AdminMetrics,
  trends: AdminTrends,
): MetricsOps => ({
  get: () => Promise.resolve({ kind: "ok", metrics }),
  getTrends: () => Promise.resolve({ kind: "ok", trends }),
});

const healthOps = (health: AdminHealth): HealthOps => ({
  get: () => Promise.resolve({ kind: "ok", health }),
});

const feedbackOps = (feedback: AdminFeedback[]): FeedbackOps => ({
  list: () => Promise.resolve({ kind: "ok", feedback }),
  resolve: () => Promise.resolve("ok"),
});

const SAMPLE_METRICS: AdminMetrics = {
  accounts: 1840,
  aliases: 5210,
  knocks: 37,
  sendQueueDepth: 4,
  dbSizeBytes: 18 * 1024 * 1024,
  pendingReports: 2,
  pendingFeedback: 1,
};

// A week of per-day report counts (epoch-days, UTC) and a latency histogram, so the
// trend charts have deterministic baseline content. Aggregate only: daily counts and
// time buckets, never a per-name or per-account figure.
const DAY_MS = 24 * 60 * 60 * 1000;
const baseDay = Math.floor(Date.UTC(2026, 5, 25) / DAY_MS);
const SAMPLE_TRENDS: AdminTrends = {
  reportsPerDay: [0, 2, 1, 4, 3, 5, 2].map((count, i) => ({
    day: baseDay - 6 + i,
    count,
  })),
  signupsPerDay: [3, 5, 4, 8, 6, 9, 7].map((count, i) => ({
    day: baseDay - 6 + i,
    count,
  })),
  reviewLatency: [
    { underMs: 60 * 60 * 1000, count: 3 },
    { underMs: 6 * 60 * 60 * 1000, count: 5 },
    { underMs: DAY_MS, count: 2 },
    { underMs: 3 * DAY_MS, count: 1 },
    { underMs: 7 * DAY_MS, count: 0 },
    { underMs: 0, count: 0 },
  ],
};

const EMPTY_TRENDS: AdminTrends = {
  reportsPerDay: [],
  signupsPerDay: [],
  reviewLatency: [],
};

// A "needs a look" snapshot: a couple of logged errors and a small send-queue
// backlog, so the health chip renders amber with a breakdown. Aggregate only.
const SAMPLE_HEALTH: AdminHealth = {
  errors: [
    { type: "store", count: 2 },
    { type: "enqueue", count: 0 },
    { type: "janitor", count: 0 },
    { type: "decode", count: 1 },
  ],
  sendQueueDepth: 3,
  sendQueueOldestAgeSeconds: 42,
  janitorAgeSeconds: 12,
  inflightCurrent: 1,
  inflightMax: 64,
};

// The all-clear snapshot: nothing logged, an empty queue, a fresh heartbeat.
const CLEAR_HEALTH: AdminHealth = {
  errors: [
    { type: "store", count: 0 },
    { type: "enqueue", count: 0 },
    { type: "janitor", count: 0 },
    { type: "decode", count: 0 },
  ],
  sendQueueDepth: 0,
  sendQueueOldestAgeSeconds: 0,
  janitorAgeSeconds: 8,
  inflightCurrent: 0,
  inflightMax: 64,
};

// Fixed UTC instants so the feedback panel's timestamps are deterministic. The
// "question" rows are labs open-questions responses (doc 35): they carry a topic
// code and render in the Answers view on the Queues tab, not the feedback queue.
const SAMPLE_FEEDBACK: AdminFeedback[] = [
  {
    id: 5,
    reason: "question",
    topic: "groups",
    body: "Groups read as mutual care to me. The invite-only ones that ask for a screenshot are the thing to watch.",
    createdAt: Date.UTC(2026, 5, 25, 18, 40, 0),
  },
  {
    id: 4,
    reason: "question",
    topic: "help-or-harm",
    body: "It helped me have the conversation earlier than I would have on my own.",
    createdAt: Date.UTC(2026, 5, 25, 16, 12, 0),
  },
  {
    id: 3,
    reason: "question",
    topic: "groups",
    body: "A group I'm in switched to sharing statuses before events and it feels routine now.",
    createdAt: Date.UTC(2026, 5, 25, 15, 30, 0),
  },
  {
    id: 2,
    reason: "broken",
    body: "the share button does nothing on my phone",
    createdAt: Date.UTC(2026, 5, 25, 15, 2, 0),
  },
  {
    id: 1,
    reason: "confusing",
    body: "",
    createdAt: Date.UTC(2026, 5, 24, 11, 20, 0),
  },
];

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

// The busy console's shared transports: reported names, feedback + answers, a
// needs-a-look health snapshot, and the trend series. Each tab story reuses them
// so the four captures show one consistent service state.
const BUSY_ARGS = {
  ping: always("ok"),
  reviewOps: reviewOps([
    { name: "rob1n", reason: "impersonation", count: 3, createdAt: 1 },
    { name: "free_money", reason: "spam", count: 1, createdAt: 2 },
  ]),
  auditOps: auditOps(SAMPLE_AUDIT),
  metricsOps: metricsOps(SAMPLE_METRICS, SAMPLE_TRENDS),
  healthOps: healthOps(SAMPLE_HEALTH),
  feedbackOps: feedbackOps(SAMPLE_FEEDBACK),
} as const;

// The authed console's first section: the health band plus the waiting-work
// figures (the default tab).
export const AuthedWithReports: Story = {
  args: BUSY_ARGS,
  decorators: [seedToken],
};

// The Queues tab: both work queues side by side, with the labs answers view
// (grouped by question, with its per-question counts and CSV download) below.
export const AuthedQueues: Story = {
  args: { ...BUSY_ARGS, initialTab: "queues" },
  decorators: [seedToken],
};

// The Metrics tab: the stored totals and the three trend charts.
export const AuthedMetrics: Story = {
  args: { ...BUSY_ARGS, initialTab: "metrics" },
  decorators: [seedToken],
};

// The Tools tab: the id lookup beside the audit record.
export const AuthedTools: Story = {
  args: { ...BUSY_ARGS, initialTab: "tools" },
  decorators: [seedToken],
};

// The authed shell with an empty queue and no recorded activity (the all-clear).
export const AuthedEmpty: Story = {
  args: {
    ping: always("ok"),
    reviewOps: reviewOps([]),
    auditOps: auditOps([]),
    metricsOps: metricsOps(
      {
        accounts: 0,
        aliases: 0,
        knocks: 0,
        sendQueueDepth: 0,
        dbSizeBytes: 0,
        pendingReports: 0,
        pendingFeedback: 0,
      },
      EMPTY_TRENDS,
    ),
    healthOps: healthOps(CLEAR_HEALTH),
    feedbackOps: feedbackOps([]),
  },
  decorators: [seedToken],
};
