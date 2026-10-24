/*
 * The periods the snapshots of a store are listed for: back from now by presets, the
 * latest alone, or around a date, the daemon filtering them (`since`, `until`).
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** A period: from `since` (inclusive) to `until` (exclusive), times in ms; null for no bound. */
export interface Period {
  since: number | null;
  until: number | null;
}

/** No period: every snapshot. */
export const ALL: Period = { since: null, until: null };

/** The presets of the timeline, the spans back from now; `latest`, the last snapshot alone. */
export const PRESETS = ["latest", "24h", "7d", "30d", "1y", "all"] as const;
export type Preset = (typeof PRESETS)[number];

const SPANS: Record<Exclude<Preset, "latest" | "all">, number> = { "24h": DAY, "7d": WEEK, "30d": MONTH, "1y": YEAR };

/** The period of a preset at `now`; `latest`, the period from the last snapshot on. */
export function presetPeriod(preset: Preset, now: number, times: number[]): Period {
  if (preset === "all") return ALL;
  if (preset === "latest") return times.length > 0 ? { since: Math.max(...times), until: null } : ALL;
  return { since: now - SPANS[preset], until: null };
}

/** The preset a period is, if one. */
export function presetOf(period: Period, now: number, times: number[]): Preset | null {
  return PRESETS.find((p) => {
    const q = presetPeriod(p, now, times);
    return q.since === period.since && q.until === period.until;
  }) ?? null;
}
