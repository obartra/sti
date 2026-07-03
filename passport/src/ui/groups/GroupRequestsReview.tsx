// Admin join-request review (doc 33, slice 7b): for a public group, the people who
// found it by name and asked to join. Each row is contentless, "Someone asked to
// join.", with no name or count, mirroring the knock inbox: the admin only ever
// decides yes or no, never learns who is behind a request. Approving delivers an
// invite over the grant channel; rejecting hides the request. Admin + public only;
// the parent gates on that.
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../design/components/index.ts";
import type { GroupRecord, PendingRequest } from "../../store/index.ts";
import { GROUPS_COPY as C } from "./groupsCopy.ts";
import "./groups.css";

type State = "loading" | { requests: PendingRequest[] };

function RequestRow({
  onApprove,
  onReject,
}: {
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="gr__admin-row">
      <div className="gr__admin-row-text">{C.requestRow}</div>
      <Button variant="quiet" size="sm" onClick={onReject}>
        {C.rejectCta}
      </Button>
      <Button variant="secondary" size="sm" onClick={onApprove}>
        {C.approveCta}
      </Button>
    </div>
  );
}

export interface GroupRequestsReviewProps {
  group: GroupRecord;
  /** Read the waiting requests for this group (folds nothing; contentless). */
  onReview: (groupId: string) => Promise<PendingRequest[]>;
  /** Approve one request (delivers an invite over the grant channel). */
  onApprove: (groupId: string, request: PendingRequest) => Promise<void>;
  /** Reject one request (hides it from future reviews). */
  onReject: (groupId: string, request: PendingRequest) => Promise<void>;
}

export function GroupRequestsReview({
  group,
  onReview,
  onApprove,
  onReject,
}: GroupRequestsReviewProps) {
  const [state, setState] = useState<State>("loading");
  const groupId = group.groupId;

  const refresh = useCallback(() => {
    void onReview(groupId)
      .then((requests) => setState({ requests }))
      .catch(() => setState({ requests: [] }));
    // onReview is a fresh closure each render (it closes over the latest session);
    // keying on groupId re-reads only when the group changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(refresh, [refresh]);

  const act = (
    fn: (groupId: string, request: PendingRequest) => Promise<void>,
    request: PendingRequest,
  ) => {
    void fn(groupId, request)
      .then(refresh)
      .catch(() => undefined);
  };

  const requests = state === "loading" ? [] : state.requests;

  return (
    <div className="gr__admin">
      <div className="gr__sect-label">{C.requestsHeading}</div>
      {requests.length === 0 ? (
        <div className="gr__note">{C.requestsEmpty}</div>
      ) : (
        <div className="gr__rows">
          {requests.map((r) => (
            <RequestRow
              key={r.requesterHash}
              onApprove={() => act(onApprove, r)}
              onReject={() => act(onReject, r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
