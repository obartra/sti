// Create a circle: name it and pick which of your contacts are in it. A circle is
// just a private grouping of contacts you've already linked with; there is no
// invite, no join, no roles. A roster of member statuses appears once the circle
// reaches five members (below that it stays hidden, never a partial reveal).
import { useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Field,
  Input,
  Switch,
} from "../../design/components/index.ts";
import { Lock } from "../../design/icons.tsx";
import { avatarFor } from "../../lib/avatars.ts";
import { sectionLbl } from "./shared.tsx";
import type { CircleRecord, ContactRecord } from "../../store/accountBlob.ts";

const COPY = {
  createTitle: "Create a circle",
  editTitle: "Edit circle",
  nameLabel: "Name",
  nameHint: "Keep it neutral. It shows on lock screens and notifications.",
  namePlaceholder: "e.g. Thursday group",
  pickLabel: "Members",
  floorNote:
    "A roster of statuses appears once a circle reaches 5 people, never below, so no one is singled out.",
  noContacts: "Add connections first, then group them into a circle here.",
  create: "Create circle",
  save: "Save changes",
} as const;

interface PickRowProps {
  contact: ContactRecord;
  checked: boolean;
  onToggle: () => void;
}

function PickRow({ contact, checked, onToggle }: PickRowProps) {
  const name = contact.label.trim() === "" ? "Contact" : contact.label;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "8px 8px",
      }}
    >
      <Avatar alt={name} src={avatarFor(contact.id)} size="sm" />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14.5,
          fontWeight: 600,
          color: "var(--text-strong)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <Switch checked={checked} onChange={onToggle} label={`Add ${name}`} />
    </div>
  );
}

export interface CircleCreateProps {
  contacts: ContactRecord[];
  /** When present, the screen edits this circle (prefilled) instead of creating. */
  existing?: CircleRecord | undefined;
  onCreate?: ((name: string, memberContactIds: string[]) => void) | undefined;
}

export function CircleCreate({
  contacts,
  existing,
  onCreate,
}: CircleCreateProps) {
  const editing = existing !== undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(existing?.memberContactIds ?? []),
  );
  const ok = name.trim().length >= 2;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 600,
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        {editing ? COPY.editTitle : COPY.createTitle}
      </h1>

      <Field label={COPY.nameLabel} hint={COPY.nameHint}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={COPY.namePlaceholder}
        />
      </Field>

      <div>
        <div style={{ ...sectionLbl, marginBottom: 8 }}>{COPY.pickLabel}</div>
        {contacts.length === 0 ? (
          <Card variant="flat">
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.55,
                color: "var(--text-muted)",
              }}
            >
              {COPY.noContacts}
            </div>
          </Card>
        ) : (
          <Card
            variant="flat"
            style={{ padding: 6, display: "flex", flexDirection: "column" }}
          >
            {contacts.map((c) => (
              <PickRow
                key={c.id}
                contact={c}
                checked={selected.has(c.id)}
                onToggle={() => toggle(c.id)}
              />
            ))}
          </Card>
        )}
      </div>

      <Card variant="flat" style={{ display: "flex", gap: 12 }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Lock size={17} />
        </span>
        <div
          style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}
        >
          {COPY.floorNote}
        </div>
      </Card>

      <Button
        variant="primary"
        size="lg"
        block
        disabled={!ok}
        onClick={() => onCreate?.(name.trim(), [...selected])}
      >
        {editing ? COPY.save : COPY.create}
      </Button>
    </div>
  );
}
