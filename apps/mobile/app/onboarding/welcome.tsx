/**
 * ONB-01: brand, tagline, privacy promise, single CTA. No account creation
 * before this screen is acknowledged — the CTA is the only action.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { t } from '../../src/i18n/fr';
import { setStep } from '../../src/onboarding/state';
import { Body, Brand, Button, Screen, Title } from '../../src/ui';

export default function Welcome(): React.JSX.Element {
  const router = useRouter();

  const onStart = (): void => {
    void setStep('phone').then(() => router.push('/onboarding/phone'));
  };

  return (
    <Screen>
      <Brand />
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <Title>{t('welcome.tagline')}</Title>
        <Body>{t('welcome.promise')}</Body>
      </View>
      <Button label={t('welcome.cta')} onPress={onStart} />
    </Screen>
  );
}
