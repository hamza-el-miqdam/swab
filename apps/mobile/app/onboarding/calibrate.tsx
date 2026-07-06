/**
 * ONB-04/05/06: radial calibration. « moi » at the center; select a person,
 * then tap the ring that fits. Everything written here goes to the VAULT ONLY
 * (ONB-05) — no network import exists in this file, by design.
 *
 * Accessibility: a list mode (toggle) offers the same capabilities with
 * screen-reader-friendly rows (spec non-functional requirement).
 * v0 interaction is tap-to-select + tap-ring-to-place; drag polish comes
 * with FS-02's reanimated map work.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { t } from '../../src/i18n/fr';
import { setStep } from '../../src/onboarding/state';
import { colors, spacing } from '../../src/theme';
import { Body, Brand, Button, Screen, Title } from '../../src/ui';
import {
  getContacts,
  setEtat,
  setRessenti,
  setRing,
  type IntimacyRing,
  type VaultContact,
} from '../../src/vault/vault';

const RINGS: readonly IntimacyRing[] = [1, 2, 3, 4];
const RING_LABEL: Record<IntimacyRing, string> = {
  1: t('ring.1'),
  2: t('ring.2'),
  3: t('ring.3'),
  4: t('ring.4'),
};
const ETATS = [t('etat.available'), t('etat.busy'), t('etat.away')] as const;
const RESSENTIS = [t('ressenti.light'), t('ressenti.precious'), t('ressenti.paused')] as const;

const MAP_SIZE = 320;

function ringRadius(ring: IntimacyRing): number {
  return (MAP_SIZE / 2) * (ring / 4.6) + 24;
}

/** Deterministic angular spread per ring — stable positions, no jumps. */
function positionOn(ring: IntimacyRing, index: number): { top: number; left: number } {
  const angle = index * 2.399963; // golden angle, avoids overlap clumping
  const r = ringRadius(ring);
  return {
    left: MAP_SIZE / 2 + r * Math.cos(angle) - 28,
    top: MAP_SIZE / 2 + r * Math.sin(angle) - 14,
  };
}

export default function Calibrate(): React.JSX.Element {
  const router = useRouter();
  const [contacts, setContacts] = useState<readonly VaultContact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listMode, setListMode] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false); // ONB-06: collapsed by default

  const refresh = async (): Promise<void> => {
    setContacts(await getContacts());
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time load from the vault; setState runs after await, not synchronously
    void refresh();
  }, []);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;
  const unplaced = contacts.filter((c) => c.ring === undefined);

  const place = async (ring: IntimacyRing): Promise<void> => {
    if (selectedId === null) {
      return;
    }
    await setRing(selectedId, ring); // vault only — ONB-05
    await refresh();
  };

  const onContinue = (): void => {
    void setStep('done').then(() => router.push('/onboarding/done'));
  };

  const ringButtons = (
    <View style={styles.ringButtons}>
      {RINGS.map((ring) => (
        <Pressable
          key={ring}
          accessibilityRole="button"
          accessibilityLabel={`${t('calibrate.ringPrefix')} ${ring} — ${RING_LABEL[ring]}`}
          disabled={selectedId === null}
          onPress={() => void place(ring)}
          style={[styles.ringButton, selectedId === null && { opacity: 0.4 }]}
        >
          <Text style={styles.ringButtonText}>{RING_LABEL[ring]}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Screen>
      <Brand />
      <Title>{t('calibrate.title')}</Title>
      <Body>{t('calibrate.hint')}</Body>

      <View style={styles.modeRow}>
        <Text style={styles.modeLabel}>{t('calibrate.listMode')}</Text>
        <Switch
          accessibilityLabel={t('calibrate.listMode')}
          onValueChange={setListMode}
          value={listMode}
        />
      </View>

      <ScrollView style={{ flex: 1 }}>
        {contacts.length === 0 ? <Body>{t('calibrate.empty')}</Body> : null}

        {!listMode && contacts.length > 0 ? (
          <View style={styles.map}>
            {RINGS.map((ring) => (
              <View
                key={ring}
                pointerEvents="none"
                style={[
                  styles.ringCircle,
                  {
                    width: ringRadius(ring) * 2,
                    height: ringRadius(ring) * 2,
                    borderRadius: ringRadius(ring),
                    top: MAP_SIZE / 2 - ringRadius(ring),
                    left: MAP_SIZE / 2 - ringRadius(ring),
                  },
                ]}
              />
            ))}
            <View style={styles.me}>
              <Text style={styles.meText}>{t('calibrate.me')}</Text>
            </View>
            {contacts
              .filter((c): c is VaultContact & { ring: IntimacyRing } => c.ring !== undefined)
              .map((c, i) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.displayName} — ${RING_LABEL[c.ring]}`}
                  onPress={() => setSelectedId(c.id)}
                  style={[
                    styles.chip,
                    positionOn(c.ring, i),
                    selectedId === c.id && styles.chipSelected,
                  ]}
                >
                  <Text style={styles.chipText}>{c.displayName}</Text>
                </Pressable>
              ))}
          </View>
        ) : null}

        {listMode
          ? contacts.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={
                  c.ring !== undefined ? `${c.displayName} — ${RING_LABEL[c.ring]}` : c.displayName
                }
                onPress={() => setSelectedId(c.id)}
                style={[styles.listRow, selectedId === c.id && styles.listRowSelected]}
              >
                <Text style={styles.chipText}>{c.displayName}</Text>
                <Text style={styles.listRing}>
                  {c.ring !== undefined ? RING_LABEL[c.ring] : '—'}
                </Text>
              </Pressable>
            ))
          : null}

        {unplaced.length > 0 && !listMode ? (
          <View style={styles.tray}>
            {unplaced.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={c.displayName}
                onPress={() => setSelectedId(c.id)}
                style={[styles.chip, styles.trayChip, selectedId === c.id && styles.chipSelected]}
              >
                <Text style={styles.chipText}>{c.displayName}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {ringButtons}

        {/* ONB-06: optional layer, collapsed by default, never blocking */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calibrate.optionalLayer')}
          onPress={() => setOptionalOpen((v) => !v)}
          style={styles.optionalHeader}
        >
          <Text style={styles.modeLabel}>{t('calibrate.optionalLayer')}</Text>
        </Pressable>
        {optionalOpen ? (
          selected === null ? (
            <Body>{t('calibrate.optionalHint')}</Body>
          ) : (
            <View style={{ gap: spacing.s }}>
              <Text style={styles.modeLabel}>{t('calibrate.etatTitle')}</Text>
              <View style={styles.tray}>
                {ETATS.map((etat) => (
                  <Pressable
                    key={etat}
                    accessibilityRole="button"
                    accessibilityLabel={etat}
                    onPress={() => void setEtat(selected.id, etat).then(refresh)}
                    style={[styles.chip, styles.trayChip, selected.etat === etat && styles.chipSelected]}
                  >
                    <Text style={styles.chipText}>{etat}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.modeLabel}>{t('calibrate.ressentiTitle')}</Text>
              <View style={styles.tray}>
                {RESSENTIS.map((r) => (
                  <Pressable
                    key={r}
                    accessibilityRole="button"
                    accessibilityLabel={r}
                    onPress={() => void setRessenti(selected.id, r).then(refresh)}
                    style={[styles.chip, styles.trayChip, selected.ressenti === r && styles.chipSelected]}
                  >
                    <Text style={styles.chipText}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        ) : null}
      </ScrollView>

      <Button label={t('calibrate.continue')} onPress={onContinue} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeLabel: { color: colors.textDim, fontSize: 14 },
  map: { width: MAP_SIZE, height: MAP_SIZE, alignSelf: 'center' },
  ringCircle: { position: 'absolute', borderWidth: 1, borderColor: colors.ringLine },
  me: {
    position: 'absolute',
    top: MAP_SIZE / 2 - 22,
    left: MAP_SIZE / 2 - 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meText: { color: colors.accentInk, fontWeight: '600' },
  chip: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipSelected: { borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13 },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
    paddingVertical: spacing.m,
  },
  trayChip: { position: 'relative' },
  ringButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, paddingVertical: spacing.s },
  ringButton: {
    borderWidth: 1,
    borderColor: colors.ringLine,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ringButtonText: { color: colors.text, fontSize: 14 },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  listRowSelected: { backgroundColor: colors.surface },
  listRing: { color: colors.textDim, fontSize: 13 },
  optionalHeader: { paddingVertical: spacing.m },
});
