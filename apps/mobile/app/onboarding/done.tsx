/**
 * ONB-07: completion. The promise, restated at the exact moment it became
 * true. Vault sync is attempted best-effort — offline completion is a
 * first-class path (FS-01 acceptance 1); sync retries later (VLT-04).
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { t } from '../../src/i18n/fr';
import { setStep } from '../../src/onboarding/state';
import { Body, Brand, Button, Screen, Title } from '../../src/ui';
import { syncVault } from '../../src/vault/sync';

export default function Done(): React.JSX.Element {
  const router = useRouter();

  const onFinish = (): void => {
    void syncVault().catch(() => {
      // offline is fine — VLT-04 syncs on next foreground
    });
    void setStep('complete').then(() => router.replace('/'));
  };

  return (
    <Screen>
      <Brand />
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <Title>{t('done.title')}</Title>
        <Body>{t('done.subtitle')}</Body>
        <Body>{t('done.promise')}</Body>
      </View>
      <Button label={t('done.cta')} onPress={onFinish} />
    </Screen>
  );
}
