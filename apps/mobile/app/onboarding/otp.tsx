/**
 * ONB-02 (second half): OTP verification. On success the session is stored
 * and the vault key is created BEFORE any classification input is possible.
 * A 422 means new user without displayName — the code is not consumed
 * (API contract), so we reveal a name field and retry with the same code.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError, verifyOtp } from '../../src/api/client';
import { t } from '../../src/i18n/fr';
import { saveTokens } from '../../src/lib/session';
import {
  clearPendingPhoneHash,
  getDevCode,
  getPendingPhoneHash,
} from '../../src/onboarding/signup';
import { setStep } from '../../src/onboarding/state';
import { Body, Brand, Button, Field, Screen, Title } from '../../src/ui';
import { getOrCreateVaultKey } from '../../src/vault/crypto';

export default function Otp(): React.JSX.Element {
  const router = useRouter();
  const phoneHash = getPendingPhoneHash();
  const devCode = getDevCode();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Process death between phone and OTP: pending hash is memory-only, restart
  // resumes at the phone step (state.ts) — offer the way back explicitly.
  if (phoneHash === null) {
    return (
      <Screen>
        <Brand />
        <Body>{t('otp.missingPhone')}</Body>
        <Button label={t('otp.backToPhone')} onPress={() => router.replace('/onboarding/phone')} />
      </Screen>
    );
  }

  const onVerify = async (): Promise<void> => {
    setBusy(true);
    setError(false);
    try {
      const body = needsName ? { phoneHash, code, displayName } : { phoneHash, code };
      const tokens = await verifyOtp(body);
      await saveTokens(tokens);
      await getOrCreateVaultKey(); // ONB-02: key exists before any classification
      clearPendingPhoneHash();
      await setStep('contacts');
      router.replace('/onboarding/contacts');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setNeedsName(true);
      } else {
        setError(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Brand />
      <Title>{t('otp.title')}</Title>
      {devCode !== null ? <Body>{`Code (dev) : ${devCode}`}</Body> : null}
      <Field
        accessibilityLabel={t('otp.title')}
        autoFocus
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={setCode}
        placeholder={t('otp.placeholder')}
        value={code}
      />
      {needsName ? (
        <Field
          accessibilityLabel={t('otp.namePrompt')}
          onChangeText={setDisplayName}
          placeholder={t('otp.namePrompt')}
          value={displayName}
        />
      ) : null}
      {error ? <Body>{t('otp.error')}</Body> : null}
      <View style={{ flex: 1 }} />
      <Button
        disabled={busy || code.length !== 6 || (needsName && displayName.trim().length === 0)}
        label={t('otp.cta')}
        onPress={() => void onVerify()}
      />
    </Screen>
  );
}
