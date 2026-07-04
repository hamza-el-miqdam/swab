/**
 * ONB-02 (first half): phone entry. The raw number is hashed on-device in the
 * input handler (IDT-01) — only the hash reaches signup state and the API.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { requestOtp } from '../../src/api/client';
import { t } from '../../src/i18n/fr';
import { hashPhoneNumber } from '../../src/lib/phoneHash';
import { setDevCode, setPendingPhoneHash } from '../../src/onboarding/signup';
import { Body, Brand, Button, Field, Screen, Title } from '../../src/ui';

export default function Phone(): React.JSX.Element {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const onSubmit = async (): Promise<void> => {
    setBusy(true);
    setError(false);
    try {
      const phoneHash = await hashPhoneNumber(raw);
      const { devCode } = await requestOtp({ phoneHash });
      setPendingPhoneHash(phoneHash);
      setDevCode(devCode ?? null);
      router.push('/onboarding/otp');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Brand />
      <Title>{t('phone.title')}</Title>
      <Body>{t('phone.hint')}</Body>
      <Field
        accessibilityLabel={t('phone.title')}
        autoFocus
        keyboardType="phone-pad"
        onChangeText={setRaw}
        placeholder={t('phone.placeholder')}
        value={raw}
      />
      {error ? <Body>{t('phone.error')}</Body> : null}
      <View style={{ flex: 1 }} />
      <Button
        disabled={busy || raw.trim().length < 6}
        label={t('phone.cta')}
        onPress={() => void onSubmit()}
      />
    </Screen>
  );
}
