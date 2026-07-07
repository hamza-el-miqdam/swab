/**
 * FCH-04 — history window: last 12 months only, newest first (pure logic).
 * FCH-05 — staleness: due after a configurable quiet period (default 6 months
 * ⚠️ spec assumption), reconfirm resets the timer, « À revoir plus tard »
 * snoozes for 30 days. Pure TS, no React (mobile rule 4 spirit).
 */
import {
  DAY_MS,
  DEFAULT_RETAG_CONFIG,
  HISTORY_WINDOW_MS,
  historyWindow,
  isRetagDue,
  lastAxisActivityAt,
} from '../domain/fiche';
import type { VaultContact, VaultHistoryEvent } from '../vault/vault';

const NOW = Date.UTC(2026, 6, 7); // 2026-07-07

function ev(daysAgo: number, kind: VaultHistoryEvent['kind'] = 'axis-change'): VaultHistoryEvent {
  return { id: `ev-${kind}-${daysAgo}`, at: NOW - daysAgo * DAY_MS, kind };
}

function contact(partial: Partial<VaultContact>): VaultContact {
  return { id: 'c1', displayName: 'Nora', roles: [], history: [], ...partial };
}

describe('FCH-04 historyWindow', () => {
  it('keeps only events from the last 12 months, newest first', () => {
    const events = [ev(400), ev(30), ev(300), ev(1, 'match')];
    const windowed = historyWindow(events, NOW);
    expect(windowed.map((e) => e.id)).toEqual(['ev-match-1', 'ev-axis-change-30', 'ev-axis-change-300']);
  });

  it('breaks same-millisecond ties by append order — later-appended is newer', () => {
    const a = { ...ev(5), id: 'first-appended' };
    const b = { ...ev(5), id: 'second-appended' };
    expect(historyWindow([a, b], NOW).map((e) => e.id)).toEqual([
      'second-appended',
      'first-appended',
    ]);
  });

  it('does not mutate the input array', () => {
    const events = [ev(30), ev(1)];
    const before = events.map((e) => e.id);
    historyWindow(events, NOW);
    expect(events.map((e) => e.id)).toEqual(before);
  });

  it('accepts a custom window', () => {
    const events = [ev(10), ev(40)];
    expect(historyWindow(events, NOW, 20 * DAY_MS).map((e) => e.id)).toEqual(['ev-axis-change-10']);
  });

  it('default window is 12 months', () => {
    expect(HISTORY_WINDOW_MS).toBe(365 * DAY_MS);
  });
});

describe('FCH-05 lastAxisActivityAt', () => {
  it('is undefined when there is no timestamp at all (legacy contact)', () => {
    expect(lastAxisActivityAt(contact({}))).toBeUndefined();
  });

  it('falls back to createdAt when history is empty', () => {
    expect(lastAxisActivityAt(contact({ createdAt: NOW - 5 * DAY_MS }))).toBe(NOW - 5 * DAY_MS);
  });

  it('takes the latest axis-change or reconfirm, ignoring match events', () => {
    const c = contact({
      createdAt: NOW - 300 * DAY_MS,
      history: [ev(200), ev(50, 'reconfirm'), ev(1, 'match')],
    });
    expect(lastAxisActivityAt(c)).toBe(NOW - 50 * DAY_MS);
  });
});

describe('FCH-05 isRetagDue', () => {
  it('is false for a fresh contact', () => {
    expect(isRetagDue(contact({ createdAt: NOW - DAY_MS }), NOW)).toBe(false);
  });

  it('is true after the default 6-month quiet period', () => {
    expect(isRetagDue(contact({ createdAt: NOW - 200 * DAY_MS }), NOW)).toBe(true);
  });

  it('is false when nothing is dated (legacy blob) — never nag on upgrade', () => {
    expect(isRetagDue(contact({}), NOW)).toBe(false);
  });

  it('a recent reconfirm resets the timer', () => {
    const c = contact({
      createdAt: NOW - 400 * DAY_MS,
      history: [ev(10, 'reconfirm')],
    });
    expect(isRetagDue(c, NOW)).toBe(false);
  });

  it('« À revoir plus tard » suppresses the nudge for 30 days…', () => {
    const c = contact({ createdAt: NOW - 200 * DAY_MS, retagSnoozedAt: NOW - 10 * DAY_MS });
    expect(isRetagDue(c, NOW)).toBe(false);
  });

  it('…and the nudge is eligible again after 30 days', () => {
    const c = contact({ createdAt: NOW - 200 * DAY_MS, retagSnoozedAt: NOW - 31 * DAY_MS });
    expect(isRetagDue(c, NOW)).toBe(true);
  });

  it('the quiet period is configurable', () => {
    const c = contact({ createdAt: NOW - 40 * DAY_MS });
    expect(isRetagDue(c, NOW)).toBe(false);
    expect(isRetagDue(c, NOW, { ...DEFAULT_RETAG_CONFIG, staleAfterMs: 30 * DAY_MS })).toBe(true);
  });

  it('defaults: 6 months quiet, 30 days snooze (spec assumption, FCH-05)', () => {
    expect(DEFAULT_RETAG_CONFIG.staleAfterMs).toBe(180 * DAY_MS);
    expect(DEFAULT_RETAG_CONFIG.snoozeForMs).toBe(30 * DAY_MS);
  });
});
