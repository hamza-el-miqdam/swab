/**
 * ONB-03: « Qui compte pour toi ? » — import (permission-gated, hashed
 * on-device) or manual add; « Passer » skips with no penalty and no nag.
 * OS-level denial degrades gracefully to the manual path (acceptance 2).
 */
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../src/i18n/fr';
import { hashPhoneNumber } from '../../src/lib/phoneHash';
import { setStep } from '../../src/onboarding/state';
import { colors, spacing } from '../../src/theme';
import { Body, Brand, Button, Field, Screen, Title } from '../../src/ui';
import { addContact, getContacts } from '../../src/vault/vault';

interface DeviceContact {
  name: string;
  phone?: string;
}

export default function ContactsStep(): React.JSX.Element {
  const router = useRouter();
  const [manualName, setManualName] = useState('');
  const [added, setAdded] = useState<readonly string[]>([]);
  const [importable, setImportable] = useState<readonly DeviceContact[]>([]);
  const [denied, setDenied] = useState(false);

  const refreshAdded = async (): Promise<void> => {
    const contacts = await getContacts();
    setAdded(contacts.map((c) => c.displayName));
  };

  const onImport = async (): Promise<void> => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== Contacts.PermissionStatus.GRANTED) {
      setDenied(true); // graceful: manual path stays fully capable (ONB-03)
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });
    setImportable(
      data
        .filter((c) => (c.name ?? '').length > 0)
        .slice(0, 50)
        .map((c) => {
          const phone = c.phoneNumbers?.[0]?.number;
          return { name: c.name as string, ...(phone !== undefined ? { phone } : {}) };
        }),
    );
  };

  const onPick = async (contact: DeviceContact): Promise<void> => {
    const phoneHash =
      contact.phone !== undefined ? await hashPhoneNumber(contact.phone) : undefined;
    await addContact({
      displayName: contact.name,
      ...(phoneHash !== undefined ? { phoneHash } : {}),
    });
    await refreshAdded();
  };

  const onManualAdd = async (): Promise<void> => {
    const name = manualName.trim();
    if (name.length === 0) {
      return;
    }
    await addContact({ displayName: name });
    setManualName('');
    await refreshAdded();
  };

  const onNext = (skipped: boolean): void => {
    void setStep(skipped && added.length === 0 ? 'calibrate' : 'calibrate').then(() =>
      router.push('/onboarding/calibrate'),
    );
  };

  return (
    <Screen>
      <Brand />
      <Title>{t('contacts.title')}</Title>
      <Body>{t('contacts.hint')}</Body>

      <Button kind="ghost" label={t('contacts.import')} onPress={() => void onImport()} />
      {denied ? <Body>{t('contacts.denied')}</Body> : null}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field
            accessibilityLabel={t('contacts.manualPlaceholder')}
            onChangeText={setManualName}
            onSubmitEditing={() => void onManualAdd()}
            placeholder={t('contacts.manualPlaceholder')}
            value={manualName}
          />
        </View>
        <Button kind="ghost" label={t('contacts.add')} onPress={() => void onManualAdd()} />
      </View>

      <FlatList
        data={[...importable]}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={() => void onPick(item)}
            style={styles.pickRow}
          >
            <Text style={styles.pickText}>{item.name}</Text>
          </Pressable>
        )}
        ListHeaderComponent={
          added.length > 0 ? (
            <Text style={styles.addedLine}>{added.join(' · ')}</Text>
          ) : null
        }
        style={{ flex: 1 }}
      />

      {added.length > 0 ? (
        <Button label={t('contacts.continue')} onPress={() => onNext(false)} />
      ) : (
        <Button kind="ghost" label={t('contacts.skip')} onPress={() => onNext(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.s, alignItems: 'center' },
  pickRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pickText: { color: colors.text, fontSize: 16 },
  addedLine: { color: colors.accent, fontSize: 14, paddingVertical: spacing.s },
});
