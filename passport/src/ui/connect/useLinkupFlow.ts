/**
 * The in-person linkup's state machine (doc 25), separated from the camera and
 * the markup so it is testable without either. On mount it mints this device's
 * OFFER (a pending contact + the URL the shown QR carries); when the camera
 * decodes the other person's offer it completes that pending contact, and the
 * screen advances to its completion, independent of the other phone. Closing
 * before anything linked discards the offer (revoking its alias), so walking
 * away means nothing happened; closing after completion keeps the links.
 *
 * More than two rides the OPEN DOOR (doc 25): once linked, this screen opens its
 * own door (a knock pointer shown as the new QR) and, while open, admits each
 * arrival by minting a fresh bundle and sealing it over the grant channel; a
 * scanned door on someone else's screen runs the joiner side of the same leg.
 * Every leg lands as one more face on the completion screen. All of it is
 * polling over sealed blobs; the door pieces no-op when the deps are absent
 * (stories, demo).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { todayEpochDay } from "../../core/clock.ts";
import {
  doorUrl,
  freshSnapshotBadge,
  mintInbox,
  parseScannedConnect,
  type ContactInvite,
  type DoorHandle,
  type DoorStore,
  type ScannedCode,
  type ScannedConnect,
} from "../../store/index.ts";
import type { AliasLink, InboxCapability } from "../../store/index.ts";
import type { ResolvedView } from "../public/PublicResolution.tsx";
import type { BadgeState } from "../badge-card.tsx";

/** One linked person, as the completion shows them: a stable key (their alias
 * id), a name (may be empty until their card resolves), and a badge (null until
 * known; snapshot or live). */
export interface PeerView {
  readonly key: string;
  readonly label: string;
  readonly badge: BadgeState | null;
}

/** What the linkup screen renders right now. */
export type LinkupPhase =
  | { readonly kind: "pending" }
  | { readonly kind: "failed" }
  | { readonly kind: "showing"; readonly url: string }
  | {
      readonly kind: "linked";
      readonly peers: readonly PeerView[];
      readonly doorUrl: string | null;
    };

/** The door plumbing surface the flow uses (a Pick of the real DoorStore). */
type DoorDeps = Pick<
  DoorStore,
  | "open"
  | "close"
  | "arrivals"
  | "admit"
  | "pollReturn"
  | "knock"
  | "redeem"
  | "sendReturn"
>;

export interface LinkupDeps {
  /** Mint this device's offer: a pending contact + the URL the QR shows. */
  readonly createOffer: () => Promise<{ contactId: string; url: string }>;
  /** Complete the pending contact with the scanned offer (the store op). */
  readonly complete: (
    contactId: string,
    invite: ContactInvite,
  ) => Promise<void>;
  /** Discard a pending offer (revoke + drop) when its leg was abandoned. */
  readonly discard: (contactId: string) => void;
  /** Resolve a peer's live card (fills the completion when online). */
  readonly resolvePeer: (link: AliasLink) => Promise<ResolvedView | null>;
  /** A scanned non-offer code routes exactly like OPENING the same link (a
   * remote invite keeps its accept flow and return leg); the gesture ends, so
   * the flow discards its unfinished state before handing over. */
  readonly onViewCode: (code: ScannedCode) => void;
  /** Leave the screen (both the cancel and the Done paths end here). */
  readonly onExit: () => void;
  /** The door plumbing (doc 25); absent means the door simply never opens. */
  readonly door?: DoorDeps | undefined;
  /** Joiner leg: accept a redeemed grant's invite (mints this side; resolves
   * with the contact + the RETURN invite URL to send back). */
  readonly acceptGrant?:
    | ((invite: ContactInvite) => Promise<{ contactId: string; url: string }>)
    | undefined;
  /** Holder leg: ingest a joiner's return, completing the admitted pending. */
  readonly ingestReturn?: ((ret: ContactInvite) => void) | undefined;
  /** Poll cadence for the door legs (tests shorten it). */
  readonly pollMs?: number | undefined;
}

export interface LinkupFlow {
  readonly phase: LinkupPhase;
  /** Feed one classified scan result in (wired to the camera by the screen). */
  readonly onScanned: (scanned: ScannedConnect) => void;
  /** Re-attempt the offer mint after a failure. */
  readonly onRetry: () => void;
  /** Close the screen: discards unfinished legs, keeps every completed link. */
  readonly onClose: () => void;
}

type AddPeer = (peer: PeerView, alias: AliasLink) => void;

// One admitted-but-unanswered door leg on the holder side: the fresh pending
// contact and the return channel its joiner will answer through.
interface Admission {
  readonly contactId: string;
  readonly returnInbox: InboxCapability;
}

// The door legs' working state: refs throughout, since it drives polling, not
// markup (the one rendered fact, the open door itself, is React state).
interface DoorWork {
  readonly seenDoors: Set<string>;
  readonly joining: Set<string>;
  readonly admittedHashes: Set<string>;
  admissions: Admission[];
  ticking: boolean;
}

// Fill (or correct) one face from its live card: the label prefers what we
// already have, the badge prefers the live resolve.
function fillPeer(
  prev: readonly PeerView[],
  key: string,
  view: ResolvedView,
): readonly PeerView[] {
  return prev.map((p) =>
    p.key === key
      ? {
          ...p,
          label: p.label !== "" ? p.label : view.identity.handle,
          badge: view.state,
        }
      : p,
  );
}

// Everything one door leg needs, bundled so the tick helpers stay within the
// parameter cap: the plumbing, the flow deps, the working sets, and the sink.
interface LegCtx {
  readonly d: DoorDeps;
  readonly deps: LinkupDeps;
  readonly work: DoorWork;
  readonly addPeer: AddPeer;
}

// Holder side of one admission: mint a fresh bundle (the offer mint, reused;
// its URL is parsed back into the invite it carries), seal it + a fresh return
// channel to the arrival's key, and remember the leg for the return poll.
async function admitOne(
  ctx: LegCtx,
  door: DoorHandle,
  arrival: { requesterHash: string },
): Promise<void> {
  const minted = await ctx.deps.createOffer();
  const parsed = parseScannedConnect(minted.url);
  if (parsed?.kind !== "offer") return;
  const returnInbox = mintInbox();
  await ctx.d.admit(door, arrival, { invite: parsed.invite, returnInbox });
  ctx.work.admissions.push({ contactId: minted.contactId, returnInbox });
}

// One holder tick: admit new arrivals, then ingest any landed returns.
async function holderTick(ctx: LegCtx, door: DoorHandle): Promise<void> {
  const { d, deps, work, addPeer } = ctx;
  for (const arrival of await d.arrivals(door)) {
    if (work.admittedHashes.has(arrival.requesterHash)) continue;
    work.admittedHashes.add(arrival.requesterHash);
    await admitOne(ctx, door, arrival).catch(() =>
      work.admittedHashes.delete(arrival.requesterHash),
    );
  }
  for (const leg of [...work.admissions]) {
    const ret = await d.pollReturn(leg.returnInbox);
    if (ret === null) continue;
    work.admissions = work.admissions.filter((a) => a !== leg);
    deps.ingestReturn?.(ret);
    addPeer(
      { key: ret.alias.id, label: ret.sharedName ?? "", badge: null },
      { id: ret.alias.id, key: ret.alias.key },
    );
  }
}

// One joiner tick: redeem each pending door; on a grant, accept and answer.
async function joinerTick(ctx: LegCtx): Promise<void> {
  const { d, deps, work, addPeer } = ctx;
  for (const pointerId of [...work.joining]) {
    const grant = await d.redeem(pointerId);
    if (grant === null || deps.acceptGrant === undefined) continue;
    work.joining.delete(pointerId);
    const accepted = await deps.acceptGrant(grant.invite);
    await d.sendReturn(grant.returnInbox, accepted.url);
    const alias = grant.invite.alias;
    addPeer(
      { key: alias.id, label: grant.invite.sharedName ?? "", badge: null },
      { id: alias.id, key: alias.key },
    );
  }
}

// The open-door half of the flow: opens our own door once anything linked,
// polls all legs (arrivals, returns, redemptions), and cleans up on close.
function useDoorLegs(
  depsRef: RefObject<LinkupDeps>,
  addPeer: AddPeer,
  linked: boolean,
): {
  doorHandle: DoorHandle | null;
  joinDoor: (pointerId: string) => void;
  closeDoor: () => void;
} {
  const [door, setDoor] = useState<DoorHandle | null>(null);
  // Bumped when a join begins, so the poll effect notices it (the sets are refs).
  const [joinTick, setJoinTick] = useState(0);
  const work = useRef<DoorWork>({
    seenDoors: new Set(),
    joining: new Set(),
    admittedHashes: new Set(),
    admissions: [],
    ticking: false,
  });

  useEffect(() => {
    const d = depsRef.current.door;
    if (d === undefined || !linked || door !== null) return;
    let stale = false;
    d.open()
      .then((handle) => {
        if (stale) void d.close(handle);
        else setDoor(handle);
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [depsRef, linked, door]);

  useEffect(() => {
    const deps = depsRef.current;
    const d = deps.door;
    if (d === undefined) return;
    if (door === null && work.current.joining.size === 0) return;
    const ctx: LegCtx = { d, deps, work: work.current, addPeer };
    const tick = async () => {
      if (work.current.ticking) return;
      work.current.ticking = true;
      try {
        if (door !== null) await holderTick(ctx, door);
        await joinerTick(ctx);
      } catch {
        // A failed tick retries whole on the next interval.
      } finally {
        work.current.ticking = false;
      }
    };
    const interval = setInterval(() => void tick(), deps.pollMs ?? 2500);
    void tick();
    return () => clearInterval(interval);
  }, [depsRef, door, joinTick, addPeer]);

  const joinDoor = useCallback(
    (pointerId: string) => {
      const d = depsRef.current.door;
      if (d === undefined || work.current.seenDoors.has(pointerId)) return;
      work.current.seenDoors.add(pointerId);
      work.current.joining.add(pointerId);
      setJoinTick((t) => t + 1);
      void d.knock(pointerId).catch(() => undefined);
    },
    [depsRef],
  );

  const closeDoor = useCallback(() => {
    for (const leg of work.current.admissions) {
      depsRef.current.discard(leg.contactId);
    }
    work.current.admissions = [];
    if (door !== null) void depsRef.current.door?.close(door);
  }, [depsRef, door]);

  return { doorHandle: door, joinDoor, closeDoor };
}

export function useLinkupFlow(deps: LinkupDeps): LinkupFlow {
  const [offer, setOffer] = useState<{
    contactId: string;
    url: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [peers, setPeers] = useState<readonly PeerView[]>([]);
  const [attempt, setAttempt] = useState(0);
  // A scan can land before our own offer finishes minting; hold it and complete
  // once the offer exists (the effect below), so neither order is special.
  const [held, setHeld] = useState<ScannedConnect | null>(null);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const offerConsumed = useRef(false);

  useEffect(() => {
    let stale = false;
    setFailed(false);
    depsRef.current
      .createOffer()
      .then((minted) => {
        if (!stale) setOffer(minted);
      })
      .catch(() => {
        if (!stale) setFailed(true);
      });
    return () => {
      stale = true;
    };
  }, [attempt]);

  // Add one linked face, then let the live resolve fill (or correct) it.
  const addPeer = useCallback<AddPeer>((peer, alias) => {
    setPeers((prev) =>
      prev.some((p) => p.key === peer.key) ? prev : [...prev, peer],
    );
    depsRef.current
      .resolvePeer(alias)
      .then((view) => {
        if (view !== null) setPeers((prev) => fillPeer(prev, peer.key, view));
      })
      .catch(() => undefined);
  }, []);

  const doorLegs = useDoorLegs(depsRef, addPeer, peers.length > 0);

  const completeWith = useCallback(
    (contactId: string, scanned: ScannedConnect & { kind: "offer" }) => {
      offerConsumed.current = true;
      // Optimistic: the record write is local-first (it syncs later), so the
      // completion shows as soon as the scan lands; a failure is swallowed the
      // same way the other fire-and-fold contact actions are.
      depsRef.current
        .complete(contactId, scanned.invite)
        .catch(() => undefined);
      const alias = scanned.invite.alias;
      addPeer(
        {
          key: alias.id,
          label: scanned.invite.sharedName ?? "",
          badge: freshSnapshotBadge(scanned.snapshot, todayEpochDay()),
        },
        { id: alias.id, key: alias.key },
      );
    },
    [addPeer],
  );

  useEffect(() => {
    if (offer === null || held?.kind !== "offer") return;
    setHeld(null);
    completeWith(offer.contactId, held);
  }, [offer, held, completeWith]);

  // Unfinished legs die with the gesture: the unconsumed offer, and every
  // admitted leg whose joiner never answered. Completed links stay. Shared by
  // closing the screen and routing away to a scanned code's own flow.
  const cleanup = useCallback(() => {
    if (offer !== null && !offerConsumed.current) {
      depsRef.current.discard(offer.contactId);
    }
    doorLegs.closeDoor();
  }, [offer, doorLegs]);

  const onScanned = useCallback(
    (scanned: ScannedConnect) => {
      if (scanned.kind === "code") {
        cleanup();
        depsRef.current.onViewCode(scanned.code);
        return;
      }
      if (scanned.kind === "door") {
        doorLegs.joinDoor(scanned.pointerId);
        return;
      }
      if (offerConsumed.current) return;
      if (offer === null) {
        setHeld(scanned);
        return;
      }
      completeWith(offer.contactId, scanned);
    },
    [offer, completeWith, doorLegs, cleanup],
  );

  const onClose = useCallback(() => {
    cleanup();
    depsRef.current.onExit();
  }, [cleanup]);

  const phase: LinkupPhase =
    peers.length > 0
      ? {
          kind: "linked",
          peers,
          doorUrl:
            doorLegs.doorHandle !== null
              ? doorUrl(doorLegs.doorHandle.pointerId)
              : null,
        }
      : offer !== null
        ? { kind: "showing", url: offer.url }
        : failed
          ? { kind: "failed" }
          : { kind: "pending" };

  return { phase, onScanned, onRetry: () => setAttempt((a) => a + 1), onClose };
}
