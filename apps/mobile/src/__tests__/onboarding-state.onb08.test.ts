/**
 * ONB-08 — step persistence details beyond the restart test: route mapping
 * is total, garbage in storage falls back to welcome, and the pending
 * signup state (phone hash, dev code) is memory-only by design.
 */
import { kvSet } from '../lib/db';
import {
  clearPendingPhoneHash,
  getDevCode,
  getPendingPhoneHash,
  setDevCode,
  setPendingPhoneHash,
} from '../onboarding/signup';
import { ONBOARDING_STEPS, routeForStep, type OnboardingStep } from '../onboarding/state';

type StateModule = typeof import('../onboarding/state');

describe('ONB-08 routeForStep', () => {
  it.each([
    ['welcome', '/onboarding/welcome'],
    ['phone', '/onboarding/phone'],
    ['contacts', '/onboarding/contacts'],
    ['calibrate', '/onboarding/calibrate'],
    ['done', '/onboarding/done'],
    ['complete', '/'],
  ] as const)('maps %p to %p', (step, route) => {
    expect(routeForStep(step)).toBe(route);
  });

  it('covers every declared step (the mapping is total)', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(routeForStep(step as OnboardingStep)).toMatch(/^\//u);
    }
  });
});

describe('ONB-08 getStep hardening', () => {
  it('falls back to welcome when storage holds an unknown value', async () => {
    await kvSet('onboarding.step.v1', 'not-a-step');
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fresh = require('../onboarding/state') as StateModule;
    await expect(fresh.getStep()).resolves.toBe('welcome');
  });

  it('serves the cached step without re-reading storage', async () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fresh = require('../onboarding/state') as StateModule;
    await fresh.setStep('contacts');
    await kvSet('onboarding.step.v1', 'done'); // behind the cache's back
    await expect(fresh.getStep()).resolves.toBe('contacts');
  });
});

describe('ONB-02 pending signup state is memory-only', () => {
  afterEach(() => {
    clearPendingPhoneHash();
  });

  it('holds the hash and dev code between phone and OTP screens', () => {
    setPendingPhoneHash('hash-1');
    setDevCode('123456');
    expect(getPendingPhoneHash()).toBe('hash-1');
    expect(getDevCode()).toBe('123456');
  });

  it('clears both on clearPendingPhoneHash', () => {
    setPendingPhoneHash('hash-1');
    setDevCode('123456');
    clearPendingPhoneHash();
    expect(getPendingPhoneHash()).toBeNull();
    expect(getDevCode()).toBeNull();
  });
});
