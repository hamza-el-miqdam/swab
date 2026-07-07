/**
 * FS-03 — pure fiche logic (no React, no I/O; mobile rule 4 spirit).
 *
 * FCH-04: history-window selection — last 12 months, newest first.
 * FCH-05: staleness evaluation — the re-tag invitation becomes due after a
 * configurable quiet period (default 6 months ⚠️ spec assumption) with no
 * axis change or reconfirmation; « À revoir plus tard » snoozes it for
 * 30 days. Everything is computed from vault data; nothing here (or in the
 * callers) ever reaches the network.
 */
import type { VaultContact, VaultHistoryEvent } from '../vault/vault';

export const DAY_MS = 86_400_000;

export interface RetagConfig {
  /** Quiet period after which the invitation shows (FCH-05 default: ~6 months). */
  staleAfterMs: number;
  /** « À revoir plus tard » suppression window (FCH-05: 30 days). */
  snoozeForMs: number;
}

export const DEFAULT_RETAG_CONFIG: RetagConfig = {
  staleAfterMs: 180 * DAY_MS,
  snoozeForMs: 30 * DAY_MS,
};

/** FCH-04: feed window — 12 months. */
export const HISTORY_WINDOW_MS = 365 * DAY_MS;

/**
 * Last moment the user touched (or reconfirmed) the axes. Match events do
 * not count — they say nothing about whether the tags still fit. Undefined
 * for legacy contacts with no timestamps at all: staleness then stays
 * silent rather than nagging everyone right after an app update.
 */
export function lastAxisActivityAt(contact: VaultContact): number | undefined {
  let last = contact.createdAt;
  for (const event of contact.history) {
    if (event.kind === 'match') {
      continue;
    }
    if (last === undefined || event.at > last) {
      last = event.at;
    }
  }
  return last;
}

/** FCH-05: is the discreet re-tag invitation due right now? */
export function isRetagDue(
  contact: VaultContact,
  now: number,
  config: RetagConfig = DEFAULT_RETAG_CONFIG,
): boolean {
  const last = lastAxisActivityAt(contact);
  if (last === undefined || now - last < config.staleAfterMs) {
    return false;
  }
  if (contact.retagSnoozedAt !== undefined && now - contact.retagSnoozedAt < config.snoozeForMs) {
    return false;
  }
  return true;
}

/**
 * FCH-04: events of the last `windowMs` (12 months by default), newest first.
 * Storage order is append (oldest first); for same-millisecond timestamps the
 * later-appended event is the newer one, so reverse before the stable sort.
 */
export function historyWindow(
  events: readonly VaultHistoryEvent[],
  now: number,
  windowMs: number = HISTORY_WINDOW_MS,
): VaultHistoryEvent[] {
  return events
    .filter((e) => now - e.at <= windowMs) // fresh array — input never mutated
    .reverse()
    .sort((a, b) => b.at - a.at);
}
