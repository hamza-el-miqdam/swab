/**
 * MAP-04 — the peek sheet: tap a contact, read Intimité / État / Rôles at a
 * glance. Slides up with reanimated (UI thread), scrim behind, handle on
 * top. No bottom-sheet dependency — this stays a ~100-line component.
 *
 * « Ouvrir la fiche » is the FS-03 seam: rendered DISABLED on purpose
 * (visible and honest, nothing hidden). FS-03 flips it to
 * `router.push('/fiche/[id]')` and adds the grow-from-node transition.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { t } from '../i18n/fr';
import { colors, spacing } from '../theme';
import type { VaultContact } from '../vault/vault';
import { etatColor } from './etatColors';
import { RING_LABEL } from './labels';

const SHEET_TRAVEL = 280;
const OPEN_MS = 220;

interface PeekSheetProps {
  contact: VaultContact | null;
  onClose: () => void;
}

const UNSET = '—'; // quiet dash, not copy: an axis simply not filled in yet

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function PeekSheet({ contact, onClose }: PeekSheetProps): React.JSX.Element | null {
  const translateY = useSharedValue(SHEET_TRAVEL);

  useEffect(() => {
    translateY.value =
      contact !== null ? withTiming(0, { duration: OPEN_MS }) : SHEET_TRAVEL;
  }, [contact, translateY]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (contact === null) {
    return null;
  }

  const swatch = etatColor(contact.etat);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable onPress={onClose} style={styles.scrim} testID="peek-scrim" />
      <Animated.View style={[styles.sheet, slide]} testID="peek-sheet">
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <View style={[styles.etatDot, { backgroundColor: swatch.background }]} />
          <Text style={styles.name}>{contact.displayName}</Text>
        </View>
        <Row
          label={t('carte.sheet.intimite')}
          value={contact.ring !== undefined ? RING_LABEL[contact.ring] : UNSET}
        />
        <Row label={t('carte.sheet.etat')} value={contact.etat ?? UNSET} />
        <Row
          label={t('carte.sheet.roles')}
          value={contact.roles.length > 0 ? contact.roles.join(' · ') : UNSET}
        />
        <Pressable
          // FS-03 seam: enabled + router.push(`/fiche/${contact.id}`) once the
          // fiche exists; the grow-from-node transition lands there too.
          accessibilityRole="button"
          accessibilityLabel={t('carte.openFiche')}
          accessibilityState={{ disabled: true }}
          disabled
          style={styles.ficheButton}
        >
          <Text style={styles.ficheButtonText}>{t('carte.openFiche')}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000088',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopStartRadius: 20,
    borderTopEndRadius: 20,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
    paddingBottom: spacing.xl,
    gap: spacing.s,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: spacing.s,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingBottom: spacing.s,
  },
  etatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  name: { color: colors.text, fontSize: 20, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLabel: { color: colors.textDim, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14 },
  ficheButton: {
    marginTop: spacing.m,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    alignItems: 'center',
    opacity: 0.5,
  },
  ficheButtonText: { color: colors.textDim, fontSize: 15 },
});
