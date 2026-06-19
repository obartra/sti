// Manage & roles (organizer): set expiration, grant/revoke edit rights per
// member, and archive the circle.
//
// Faithful port of comps-reference/app/circles2.jsx CircleManage. Copy verbatim
// from copy.js `circles`.
import { useState } from "react";
import {
  Button,
  Card,
  Avatar,
  Switch,
  Segmented,
} from "../../design/components/index.ts";
import { Trash } from "../../design/icons.tsx";
import { avatarFor } from "../../lib/avatars.ts";
import {
  RoleBadge,
  sectionLbl,
  makeCircleFixture,
  circleById,
} from "./shared.tsx";
import type { Circle, CircleMember } from "./shared.tsx";

const COPY = {
  manageTitle: "Manage circle",
  rolesTitle: "Who can edit",
  canEdit: "Can edit",
  canEditSub: "Name, dates, invites and approvals",
  expLabel: "Expiration",
  expNone: "None",
  expHint: "On expiry the circle archives itself: roster and sharing stop.",
  archive: "Archive now",
  archiveSub: "Roster and sharing stop immediately.",
} as const;

type ExpValue = "none" | "date";

interface RoleRowProps {
  member: CircleMember;
  onSetEdit: (handle: string, can: boolean) => void;
}

function RoleRow({ member: m, onSetEdit }: RoleRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 8px",
      }}
    >
      <Avatar alt={m.handle} src={avatarFor(m.handle)} size="sm" />
      <span
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-strong)",
          minWidth: 0,
        }}
      >
        @{m.handle}
        {m.you ? " · you" : ""}
      </span>
      {m.you ? (
        <RoleBadge role={m.role} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color:
                m.role === "organizer"
                  ? "var(--text-accent)"
                  : "var(--text-subtle)",
            }}
          >
            {COPY.canEdit}
          </span>
          <Switch
            checked={m.role === "organizer"}
            onChange={(v) => {
              onSetEdit(m.handle, v);
            }}
          />
        </div>
      )}
    </div>
  );
}

interface ArchiveCardProps {
  onArchive?: (() => void) | undefined;
}

function ArchiveCard({ onArchive }: ArchiveCardProps) {
  return (
    <Card
      variant="flat"
      style={{
        borderColor: "var(--expired-100)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          flex: "none",
          width: 38,
          height: 38,
          borderRadius: "var(--radius-sm)",
          background: "var(--expired-50)",
          color: "var(--status-expired-base)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Trash size={18} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {COPY.archive}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {COPY.archiveSub}
        </div>
      </div>
      <Button variant="danger" size="sm" onClick={() => onArchive?.()}>
        {COPY.archive.split(" ")[0]}
      </Button>
    </Card>
  );
}

export interface CircleManageProps {
  circle?: Circle;
  onArchive?: (() => void) | undefined;
}

export function CircleManage({ circle, onArchive }: CircleManageProps) {
  const [g, setG] = useState<Circle>(
    () => circle ?? circleById(makeCircleFixture(), "thu"),
  );

  const setEdit = (handle: string, can: boolean) =>
    setG((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.handle === handle && !m.you
          ? { ...m, role: can ? "organizer" : "member" }
          : m,
      ),
    }));

  const setExp = (v: ExpValue) =>
    setG((prev) => {
      if (v === "none") {
        // Clear both the expiry date and the day count; omit daysToExpiry
        // rather than set it to undefined (exactOptionalPropertyTypes).
        const { daysToExpiry, ...rest } = prev;
        void daysToExpiry;
        return { ...rest, expires: null };
      }
      return { ...prev, expires: "30 Jun 2026", daysToExpiry: 20 };
    });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.manageTitle}
        </h1>
        <div
          style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 4 }}
        >
          {g.name}
        </div>
      </div>

      <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {COPY.expLabel}
        </div>
        <Segmented<ExpValue>
          options={[
            { value: "none", label: COPY.expNone },
            { value: "date", label: "30 Jun 2026" },
          ]}
          value={g.expires ? "date" : "none"}
          onChange={setExp}
        />
        <div
          style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}
        >
          {COPY.expHint}
        </div>
      </Card>

      <div>
        <div style={{ ...sectionLbl, marginBottom: 4 }}>{COPY.rolesTitle}</div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-subtle)",
            marginBottom: 8,
          }}
        >
          {COPY.canEditSub}
        </div>
        <Card
          variant="flat"
          style={{
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {g.members.map((m) => (
            <RoleRow key={m.handle} member={m} onSetEdit={setEdit} />
          ))}
        </Card>
      </div>

      <ArchiveCard onArchive={onArchive} />
    </div>
  );
}
