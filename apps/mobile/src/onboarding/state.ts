/**
 * ONB-08 — resumable onboarding. The current step is persisted locally
 * (plain: a step name is not classification data). Killing the app mid-flow
 * resumes at the same step via the gate in app/index.tsx.
 *
 * Note: the step stays 'phone' until OTP verification succeeds — the pending
 * phone hash is memory-only, so a restart during OTP re-asks the number.
 */
import { kvGet, kvSet } from '../lib/db';

export const ONBOARDING_STEPS = [
  'welcome',
  'phone',
  'contacts',
  'calibrate',
  'done',
  'complete',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const STEP_KEY = 'onboarding.step.v1';

let cached: OnboardingStep | null = null;

function isStep(value: string | null): value is OnboardingStep {
  return value !== null && (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export async function getStep(): Promise<OnboardingStep> {
  if (cached !== null) {
    return cached;
  }
  const raw = await kvGet(STEP_KEY);
  cached = isStep(raw) ? raw : 'welcome';
  return cached;
}

export async function setStep(step: OnboardingStep): Promise<void> {
  cached = step;
  await kvSet(STEP_KEY, step);
}

export function routeForStep(step: OnboardingStep): string {
  switch (step) {
    case 'welcome':
      return '/onboarding/welcome';
    case 'phone':
      return '/onboarding/phone';
    case 'contacts':
      return '/onboarding/contacts';
    case 'calibrate':
      return '/onboarding/calibrate';
    case 'done':
      return '/onboarding/done';
    case 'complete':
      return '/';
  }
}
