/**
 * Entry gate (ONB-08): resumes onboarding at the persisted step. Once
 * complete, this becomes the carte placeholder until FS-02 lands.
 */
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { t } from '../src/i18n/fr';
import { getStep, routeForStep, type OnboardingStep } from '../src/onboarding/state';
import { Body, Brand, Screen, Title } from '../src/ui';

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
  return (
    <Screen>
      <Brand />
      <Title>{t('carte.title')}</Title>
      <Body>{t('carte.placeholder')}</Body>
    </Screen>
  );
}
