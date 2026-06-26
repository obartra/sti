// The window over which a reconnect-triggered operation is spread. Short enough to
// stay responsive (a partner-notify still lands within seconds of coming online),
// long enough to break the "same instant" co-timing.
const RECONNECT_JITTER_MAX_MS = 15_000;

/**
 * A random delay to spread a reconnect-triggered operation so the owner's distinct
 * ops (the backup blob push, the republish, the inbox catch-up reads) do not all
 * fire in the same instant when connectivity returns (doc 22 S3: no synchronized
 * reconnect burst). It is defense-in-depth: the blind server keeps no per-request
 * trail (doc 12), so it does not group the ops anyway, but spreading them denies a
 * timing-only observer the burst. Each call is independent, so two ops scheduled
 * together land at different times.
 */
export function reconnectJitterMs(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const r = (buf[0] ?? 0) / 0x1_0000_0000;
  return Math.floor(r * RECONNECT_JITTER_MAX_MS);
}
