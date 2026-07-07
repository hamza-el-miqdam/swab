/**
 * FS-03 — Fiche contact. « Les quatre axes, éditables d'un tap — tu déclares,
 * swab ne devine pas. » Everything on this screen reads and writes the
 * on-device vault ONLY (FCH-01, mobile rules 1–2): no network import exists
 * in this file, by design — sync stays the opaque blob path in vault/sync.ts.
 *
 * FCH-02/03: nothing here reflects the other person's classification, and
 * there is no counter, badge, or metric anywhere. FCH-05: the re-tag
 * invitation is an inline banner — never a modal, never blocking. FCH-07:
 * back is router.back() for now; the MAP-04 spatial-continuity transition
 * lands with FS-02.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { historyWindow, isRetagDue } from '../../src/domain/fiche';
import {
  ETAT_CONSEQUENCE,
  ETATS,
  RESSENTIS,
  RING_LABEL,
  RINGS,
  ROLES,
} from '../../src/domain/taxonomies';
import { t } from '../../src/i18n/fr';
import { colors, spacing } from '../../src/theme';
import { Body, Brand, Button, Screen, Title } from '../../src/ui';
import {
  getContacts,
  reconfirmAxes,
  setEtat,
  setRessenti,
  setRing,
  setRoles,
  snoozeRetag,
  type VaultContact,
  type VaultHistoryEvent,
} from '../../src/vault/vault';

const AXIS_TITLE = {
  ring: t('fiche.ringTitle'),
  roles: t('fiche.rolesTitle'),
  etat: t('fiche.etatTitle'),
  ressenti: t('fiche.ressentiTitle'),
} as const;

function ringLabelFromValue(value: string | undefined): string {
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 || n === 4 ? RING_LABEL[n] : (value ?? '—');
}

/** FCH-04: one calm line per event — coarse, qualitative, never numeric. */
function eventLabel(event: VaultHistoryEvent): string {
  if (event.kind === 'reconfirm') {
    return t('fiche.history.reconfirm');
  }
  if (event.kind === 'match') {
    return t('fiche.history.match');
  }
  const axis = event.axis ?? 'ring';
  const value = axis === 'ring' ? ringLabelFromValue(event.value) : (event.value ?? '—');
  return `${AXIS_TITLE[axis]} — ${value}`;
}

/** Slash-free date — a date is context, not a counter (FCH-03). */
function eventDate(at: number): string {
  return new Date(at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface ChipProps {
  label: string;
  a11yLabel: string;
  selected: boolean;
  onPress: () => void;
}

function Chip({ label, a11yLabel, selected, onPress }: ChipProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export default function ContactCard(): React.JSX.Element | null {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const [contact, setContact] = useState<VaultContact | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Staleness reference captured once per mount: reconfirm/snooze writes
  // move the vault side of the comparison, which is what dismisses the nudge.
  const [now] = useState(() => Date.now());

  const refresh = useCallback(async (): Promise<void> => {
    const contacts = await getContacts();
    setContact(contacts.find((c) => c.id === id) ?? null);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time load from the vault; setState runs after await, not synchronously
    void refresh();
  }, [refresh]);

  const goBack = useCallback(() => {
    // FCH-07: MAP-04 spatial-continuity transition arrives with FS-02.
    router.back();
  }, [router]);

  if (!loaded) {
    return null; // first paint resolves from SQLite, no spinner needed
  }

  if (contact === null) {
    return (
      <Screen>
        <Brand />
        <Body>{t('fiche.notFound')}</Body>
        <Button kind="ghost" label={t('fiche.back')} onPress={goBack} />
      </Screen>
    );
  }

  const pending = contact.linkedUserId === undefined; // FCH-08
  const retagDue = isRetagDue(contact, now); // FCH-05
  const events = historyWindow(contact.history, now); // FCH-04
  const consequenceKey = ETAT_CONSEQUENCE[contact.etat ?? '']; // FCH-06

  // Toggles read the CURRENT vault state at tap time, not the render-time
  // closure: rapid successive taps must never lose an edit (offline-first,
  // the vault is the source of truth).
  const fresh = async (): Promise<VaultContact | undefined> =>
    (await getContacts()).find((c) => c.id === contact.id);

  const editRing = async (ring: (typeof RINGS)[number]): Promise<void> => {
    await setRing(contact.id, ring);
    await refresh();
  };
  const toggleRole = async (role: string): Promise<void> => {
    const roles = (await fresh())?.roles ?? [];
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    await setRoles(contact.id, next);
    await refresh();
  };
  const editEtat = async (etat: string): Promise<void> => {
    const current = (await fresh())?.etat;
    await setEtat(contact.id, current === etat ? undefined : etat);
    await refresh();
  };
  const editRessenti = async (ressenti: string): Promise<void> => {
    const current = (await fresh())?.ressenti;
    await setRessenti(contact.id, current === ressenti ? undefined : ressenti);
    await refresh();
  };
  const onReconfirm = (): void => {
    void reconfirmAxes(contact.id).then(refresh);
  };
  const onSnooze = (): void => {
    void snoozeRetag(contact.id).then(refresh);
  };

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('fiche.back')}
        onPress={goBack}
        style={styles.back}
      >
        <Text style={styles.backText}>{t('fiche.back')}</Text>
      </Pressable>

      <Title>{contact.displayName}</Title>

      {pending ? (
        <View style={styles.pending}>
          <Text style={styles.pendingText}>{t('fiche.pending')}</Text>
          <Body>{t('fiche.envieInactive')}</Body>
        </View>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {retagDue ? (
          <View style={styles.retag}>
            <Body>{t('fiche.retag.prompt')}</Body>
            <View style={styles.retagActions}>
              <Button kind="ghost" label={t('fiche.retag.confirm')} onPress={onReconfirm} />
              <Button kind="ghost" label={t('fiche.retag.later')} onPress={onSnooze} />
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{AXIS_TITLE.ring}</Text>
        <View style={styles.chipRow}>
          {RINGS.map((ring) => (
            <Chip
              key={ring}
              label={RING_LABEL[ring]}
              a11yLabel={`${AXIS_TITLE.ring} — ${RING_LABEL[ring]}`}
              selected={contact.ring === ring}
              onPress={() => void editRing(ring)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{AXIS_TITLE.roles}</Text>
        <View style={styles.chipRow}>
          {ROLES.map((role) => (
            <Chip
              key={role}
              label={role}
              a11yLabel={`${AXIS_TITLE.roles} — ${role}`}
              selected={contact.roles.includes(role)}
              onPress={() => void toggleRole(role)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{AXIS_TITLE.etat}</Text>
        <View style={styles.chipRow}>
          {ETATS.map((etat) => (
            <Chip
              key={etat}
              label={etat}
              a11yLabel={`${AXIS_TITLE.etat} — ${etat}`}
              selected={contact.etat === etat}
              onPress={() => void editEtat(etat)}
            />
          ))}
        </View>
        {consequenceKey !== undefined ? (
          <Text style={styles.consequence}>{t(consequenceKey)}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>{AXIS_TITLE.ressenti}</Text>
        <View style={styles.chipRow}>
          {RESSENTIS.map((ressenti) => (
            <Chip
              key={ressenti}
              label={ressenti}
              a11yLabel={`${AXIS_TITLE.ressenti} — ${ressenti}`}
              selected={contact.ressenti === ressenti}
              onPress={() => void editRessenti(ressenti)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('fiche.historyTitle')}</Text>
        {events.length === 0 ? (
          <Body>{t('fiche.historyEmpty')}</Body>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.historyRow}>
              <Text style={styles.historyLabel}>{eventLabel(event)}</Text>
              <Text style={styles.historyDate}>{eventDate(event.at)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  backText: { color: colors.textDim, fontSize: 15 },
  scroll: { flex: 1 },
  scrollContent: { gap: spacing.s, paddingBottom: spacing.xl },
  sectionTitle: { color: colors.textDim, fontSize: 14, marginTop: spacing.m },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14 },
  consequence: { color: colors.textDim, fontSize: 13, fontStyle: 'italic' },
  pending: { gap: spacing.xs },
  pendingText: { color: colors.accent, fontSize: 13 },
  retag: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: spacing.m,
    gap: spacing.s,
  },
  retagActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    paddingVertical: spacing.s,
    gap: spacing.s,
  },
  historyLabel: { color: colors.text, fontSize: 14, flexShrink: 1 },
  historyDate: { color: colors.textDim, fontSize: 12 },
});
