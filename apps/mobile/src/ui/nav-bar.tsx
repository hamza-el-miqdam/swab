/**
 * MAP-02 — the app's persistent navigation: exactly Carte / Envie /
 * Sous-groupes. Labels only — no badge, counter, or dot can be rendered
 * here by construction (product law 5). RTL-safe: row direction + logical
 * spacing only.
 */
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t, type I18nKey } from '../i18n/fr';
import { colors, spacing } from '../theme';

interface NavItem {
  href: '/carte' | '/envie' | '/sous-groupes';
  labelKey: I18nKey;
}

const ITEMS: readonly NavItem[] = [
  { href: '/carte', labelKey: 'nav.carte' },
  { href: '/envie', labelKey: 'nav.envie' },
  { href: '/sous-groupes', labelKey: 'nav.sousGroupes' },
];

export function NavBar(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View accessibilityRole="tablist" style={styles.bar}>
      {ITEMS.map((item) => {
        const selected = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Pressable
            key={item.href}
            accessibilityRole="tab"
            accessibilityLabel={t(item.labelKey)}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                router.push(item.href);
              }
            }}
            style={styles.item}
          >
            <Text style={selected ? styles.labelActive : styles.label}>
              {t(item.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
    paddingVertical: spacing.s,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.s,
  },
  label: { color: colors.textDim, fontSize: 14 },
  labelActive: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
