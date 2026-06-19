// Circle / event detail: header, optional date/expiry card, your sharing
// toggle, the roster (shown once the min-5 floor is met) or the small-circle
// aggregate notice, role-based controls (invite / approvals / manage / leave),
// and an inline invite or share-event panel.
//
// Faithful port of comps-reference/app/circles2.jsx CircleDetail. Copy verbatim
// from copy.js `circles`. Internal presentational sub-components live in
// CircleDetail.parts.tsx to keep this file within the length ceiling.
import { useState } from "react";
import { Heart } from "../../design/icons.tsx";
import { makeCircleFixture, circleById } from "./shared.tsx";
import type { Circle } from "./shared.tsx";
import {
  COPY,
  ROSTER_MIN,
  DetailHeader,
  DateCard,
  ShareToggle,
  Roster,
  SmallCircleNotice,
} from "./CircleDetail.parts.tsx";
import { Controls } from "./CircleDetail.panels.tsx";

export interface CircleDetailProps {
  circle?: Circle;
  onInvite?: (() => void) | undefined;
  onApprovals?: (() => void) | undefined;
  onManage?: (() => void) | undefined;
  onLeave?: (() => void) | undefined;
}

export function CircleDetail({
  circle,
  onApprovals,
  onManage,
  onLeave,
}: CircleDetailProps) {
  const [g, setG] = useState<Circle>(
    () => circle ?? circleById(makeCircleFixture(), "thu"),
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("KQ4-V2N");
  const newCode = () =>
    setInviteCode(
      Math.random().toString(36).slice(2, 5).toUpperCase() +
        "-" +
        Math.random().toString(36).slice(2, 5).toUpperCase(),
    );

  const me = g.members.find((m) => m.you);
  const rosterAllowed = g.members.length >= ROSTER_MIN;
  // No group-level status-visibility toggle: the roster shows whenever the
  // min-5 floor is met. Each member's own sharing setting governs whether
  // their status appears; the group never overrides it.
  const showRoster = rosterAllowed;
  const toggleShare = () =>
    setG((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.you ? { ...m, sharing: !m.sharing } : m,
      ),
    }));

  const pendingCount = g.requests.filter((r) => !r.declined).length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <DetailHeader circle={g} />

      {(g.type === "event" || g.expires) && <DateCard circle={g} />}

      {/* your sharing toggle */}
      {me && <ShareToggle me={me} onToggle={toggleShare} />}

      {/* roster */}
      {showRoster ? <Roster circle={g} /> : <SmallCircleNotice />}

      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
          display: "flex",
          gap: 6,
        }}
      >
        <Heart size={14} style={{ flex: "none", marginTop: 1 }} />{" "}
        {COPY.noShame}
      </div>

      {/* role-based controls */}
      <Controls
        circle={g}
        inviteOpen={inviteOpen}
        inviteCode={inviteCode}
        pendingCount={pendingCount}
        onInviteToggle={() => setInviteOpen((v) => !v)}
        onNewCode={newCode}
        onApprovals={onApprovals}
        onManage={onManage}
        onLeave={onLeave}
      />
    </div>
  );
}
