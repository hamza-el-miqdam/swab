/**
 * Entry gate (ONB-08): resumes onboarding at the persisted step. Once
 * complete, home is the carte (FS-02).
 */
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { getStep, routeForStep, type OnboardingStep } from '../src/onboarding/state';

export default function Index(): React.JSX.Element | null {
  const [step, setStep] = useState<OnboardingStep | null>(null);

  useEffect(() => {
    void getStep().then(setStep);
  }, []);

  if (step === null) {
    return null; // gate resolving — first paint is instant from SQLite
  }
  if (step !== 'complete') {
    return <Redirect href={routeForStep(step)} />;
  }
  return <Redirect href="/carte" />;
}
