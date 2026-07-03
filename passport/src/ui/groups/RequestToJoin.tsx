// Request to join a public group by name (doc 33, slice 7b): the member-initiated way
// in. You type a group's name and ask; an admin then accepts or not. A name that does
// not resolve to a public group comes back as a uniform "not found", which never
// reveals whether a private group by that name exists. Mirrors the findable-name
// entry. Shown inline on the groups list (doc 31's UX fork: ask by name from People).
import { useState } from "react";
import { Button, Field, Input } from "../../design/components/index.ts";
import { Search } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import type { RequestResult } from "../../store/index.ts";
import { GROUPS_COPY as C } from "./groupsCopy.ts";
import "./groups.css";

type Status = "idle" | "busy" | "requested" | "not-found";

export interface RequestToJoinProps {
  /** Ask to join the named public group; resolves how the ask landed. */
  onRequest: (handle: string) => Promise<RequestResult>;
}

export function RequestToJoin({ onRequest }: RequestToJoinProps) {
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const name = handle.trim();
    if (name === "" || status === "busy") return;
    setStatus("busy");
    void onRequest(name)
      .then((r) => setStatus(r === "requested" ? "requested" : "not-found"))
      .catch(() => setStatus("not-found"));
  };

  if (status === "requested") {
    return (
      <div className={cx("e-card", "gr__done")}>
        <div className="gr__done-title">{C.requestedTitle}</div>
        <div className="gr__done-body">{C.requestedBody}</div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="gr__form-group">
      <Field label={C.requestTitle} htmlFor="join-by-name">
        <Input
          id="join-by-name"
          value={handle}
          error={status === "not-found"}
          disabled={status === "busy"}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="e.g. thursday_run"
          onChange={(ev) => {
            setHandle(ev.target.value);
            if (status === "not-found") setStatus("idle");
          }}
        />
      </Field>
      {status === "not-found" && (
        <div className="gr__error">{C.requestNotFound}</div>
      )}
      <Button
        type="submit"
        variant="secondary"
        size="md"
        icon={<Search size={16} />}
        disabled={handle.trim() === "" || status === "busy"}
      >
        {C.requestCta}
      </Button>
    </form>
  );
}
