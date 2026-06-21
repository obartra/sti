/**
 * Drive a weighted mix of wire operations to put the box under realistic load
 * while the assertions run. It does not assert; it just generates traffic across
 * a small worker pool, in the read-skewed shape from doc 13 §4 (mostly GET /a,
 * some decoy reads, some knocks, a few account reads). Failures are swallowed on
 * purpose: silent server faults are caught via the metrics endpoint, not here.
 */
import type { ApiClient } from "../api/client.ts";
import { randomAliasId, bytesToBase64url } from "../crypto/index.ts";
import type { SeededOwner } from "./seed.ts";

export interface MixOptions {
  readonly ops: number;
  readonly concurrency: number;
}

export interface MixCounts {
  getReal: number;
  getDecoy: number;
  knock: number;
  accountGet: number;
}

function pickOwner(owners: readonly SeededOwner[]): SeededOwner | undefined {
  return owners[Math.floor(Math.random() * owners.length)];
}

function requesterHash(): string {
  return bytesToBase64url(crypto.getRandomValues(new Uint8Array(8)));
}

async function oneOp(
  api: ApiClient,
  owners: readonly SeededOwner[],
  c: MixCounts,
): Promise<void> {
  const owner = pickOwner(owners);
  if (owner === undefined) return;
  const x = Math.random();
  try {
    if (x < 0.6) {
      await api.getAlias(owner.aliasId);
      c.getReal++;
    } else if (x < 0.85) {
      await api.getAlias(randomAliasId());
      c.getDecoy++;
    } else if (x < 0.95) {
      await api.knock(owner.aliasId, requesterHash());
      c.knock++;
    } else {
      await api.getAccount(owner.accountId);
      c.accountGet++;
    }
  } catch {
    // An unreachable/shed surfaces as a thrown ApiError; the metrics endpoint,
    // not this catch, is the silent-fault oracle.
  }
}

/** Run `opts.ops` operations across `opts.concurrency` workers; return the mix tally. */
export async function driveMix(
  api: ApiClient,
  owners: readonly SeededOwner[],
  opts: MixOptions,
): Promise<MixCounts> {
  const counts: MixCounts = {
    getReal: 0,
    getDecoy: 0,
    knock: 0,
    accountGet: 0,
  };
  let remaining = opts.ops;
  const worker = async (): Promise<void> => {
    while (remaining > 0) {
      remaining--;
      await oneOp(api, owners, counts);
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency }, () => worker()));
  return counts;
}
