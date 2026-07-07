/**
 * Entry gate (ONB-08): resumes onboarding at the persisted step. Once
 * complete, this becomes the carte placeholder until FS-02 lands — with a
 * minimal, plainly-labelled list of contacts linking to their fiches (FS-03).
 * The radial map is the real entry point later; keep this tiny.
 */
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { t } from '../src/i18n/fr';
import { getStep, routeForStep, type OnboardingStep } from '../src/onboarding/state';
import { colors } from '../src/theme';
import { Body, Brand, Screen, Title } from '../src/ui';
import { getContacts, type VaultContact } from '../src/vault/vault';

export default function Index(): React.JSX.Element | null {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [contacts, setContacts] = useState<readonly VaultContact[]>([]);

  useEffect(() => {
    void getStep().then(setStep);
    void getContacts().then(setContacts);
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
      {contacts.length > 0 ? (
        <>
          <Text style={styles.listHeading}>{t('carte.fiches')}</Text>
          {contacts.map((contact) => (
            <Pressable
              key={contact.id}
              accessibilityRole="button"
              accessibilityLabel={contact.displayName}
              onPress={() => router.push(`/contact/${contact.id}`)}
              style={styles.row}
            >
              <Text style={styles.rowText}>{contact.displayName}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listHeading: { color: colors.textDim, fontSize: 14, marginTop: 8 },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    paddingVertical: 12,
  },
  rowText: { color: colors.text, fontSize: 16 },
});
