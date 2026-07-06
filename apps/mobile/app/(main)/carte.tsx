/**
 * FS-02 — « Ma carte »: the app's home. Renders entirely from the on-device
 * vault (MAP-01/05): reloading on focus means an FS-03 re-tag animates the
 * node to its new ring on return. List mode (MAP-08) is feature-equivalent;
 * unplaced contacts stay visible in a tray — nothing hidden silently.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { t } from '../../src/i18n/fr';
import { ETAT_COLORS } from '../../src/map/etatColors';
import { PeekSheet } from '../../src/map/PeekSheet';
import { RadialMap } from '../../src/map/RadialMap';
import { RingList } from '../../src/map/RingList';
import { colors, spacing } from '../../src/theme';
import { Body, Brand, Screen, Title } from '../../src/ui';
import { getContacts, type VaultContact } from '../../src/vault/vault';

export default function Carte(): React.JSX.Element {
  const [contacts, setContacts] = useState<readonly VaultContact[]>([]);
  const [listMode, setListMode] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [selected, setSelected] = useState<VaultContact | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getContacts().then(setContacts);
    }, []),
  );

  const onPressContact = useCallback((contact: VaultContact) => {
    setSelected(contact);
  }, []);

  const unplaced = contacts.filter((c) => c.ring === undefined);

  return (
    <Screen>
      <Brand />
      <Title>{t('carte.title')}</Title>
      <Body>{t('carte.subtitle')}</Body>

      <View style={styles.modeRow}>
        <Text style={styles.dimLabel}>{t('carte.listMode')}</Text>
        <Switch
          accessibilityLabel={t('carte.listMode')}
          onValueChange={setListMode}
          value={listMode}
        />
      </View>

      {listMode ? (
        <RingList contacts={contacts} onPressContact={onPressContact} />
      ) : (
        <ScrollView style={styles.mapArea}>
          <RadialMap contacts={contacts} onPressContact={onPressContact} />
          {contacts.length === 0 ? <Body>{t('carte.empty')}</Body> : null}
          {unplaced.length > 0 ? (
            <View style={styles.tray}>
              {unplaced.map((contact) => (
                <Pressable
                  key={contact.id}
                  accessibilityRole="button"
                  accessibilityLabel={contact.displayName}
                  onPress={() => onPressContact(contact)}
                  style={styles.trayChip}
                >
                  <Text style={styles.trayChipText}>{contact.displayName}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('carte.legend')}
        onPress={() => setLegendOpen((open) => !open)}
        style={styles.legendToggle}
      >
        <Text style={styles.dimLabel}>{t('carte.legend')}</Text>
      </Pressable>
      {legendOpen ? (
        <View style={styles.legend}>
          {Object.entries(ETAT_COLORS).map(([etat, color]) => (
            <View key={etat} style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: color }]} />
              <Text style={styles.dimLabel}>{etat}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <PeekSheet contact={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dimLabel: { color: colors.textDim, fontSize: 14 },
  mapArea: { flex: 1 },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
    paddingVertical: spacing.m,
  },
  trayChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trayChipText: { color: colors.text, fontSize: 13 },
  legendToggle: { paddingVertical: spacing.s },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
    paddingBottom: spacing.s,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
});
