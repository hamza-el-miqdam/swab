/**
 * MAP-08 — the accessibility fallback: a SectionList grouped by ring,
 * feature-equivalent to the radial view (same label vocabulary, same
 * press action). Unplaced contacts get their own trailing section so
 * nothing is hidden from screen-reader users either.
 */
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';
import type { VaultContact } from '../vault/vault';
import { etatColor } from './etatColors';
import { RINGS } from './geometry';
import { RING_LABEL, contactLabel } from './labels';

interface RingListProps {
  contacts: readonly VaultContact[];
  onPressContact: (contact: VaultContact) => void;
}

interface RingSection {
  title: string | null;
  data: VaultContact[];
}

function buildSections(contacts: readonly VaultContact[]): RingSection[] {
  const sections: RingSection[] = RINGS.map((ring) => ({
    title: RING_LABEL[ring],
    data: contacts.filter((c) => c.ring === ring),
  }));
  const unplaced = contacts.filter((c) => c.ring === undefined);
  if (unplaced.length > 0) {
    sections.push({ title: null, data: [...unplaced] });
  }
  return sections.filter((s) => s.data.length > 0);
}

export function RingList({ contacts, onPressContact }: RingListProps): React.JSX.Element {
  return (
    <SectionList
      sections={buildSections(contacts)}
      keyExtractor={(item) => item.id}
      renderSectionHeader={({ section }) =>
        section.title !== null ? (
          <Text accessibilityRole="header" style={styles.header}>
            {section.title}
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={contactLabel(item)}
          onPress={() => onPressContact(item)}
          style={styles.row}
        >
          <View
            style={[styles.swatch, { backgroundColor: etatColor(item.etat).background }]}
          />
          <Text style={styles.name}>{item.displayName}</Text>
        </Pressable>
      )}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  header: {
    color: colors.textDim,
    fontSize: 13,
    paddingTop: spacing.m,
    paddingBottom: spacing.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  name: { color: colors.text, fontSize: 16 },
});
