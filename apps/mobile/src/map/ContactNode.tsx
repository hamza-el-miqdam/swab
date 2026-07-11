/**
 * MAP-01/03/04 — one contact on the map. Memoized (render-heavy surface,
 * mobile rule 3); position animates with reanimated `withTiming` on the UI
 * thread when the ring changes (FS-02 acceptance: re-tag → animated move,
 * no teleport). The very first mount snaps into place — only *changes*
 * animate.
 */
import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../theme';
import type { IntimacyRing, VaultContact } from '../vault/vault';
import { etatColor } from './etatColors';
import { NODE_HALF_HEIGHT, NODE_HALF_WIDTH, positionOn } from './geometry';
import { contactLabel, initials } from './labels';

export type PlacedContact = VaultContact & { ring: IntimacyRing };

interface ContactNodeProps {
  contact: PlacedContact;
  /** Stable per-ring index — drives the deterministic angular position. */
  index: number;
  onPress: (contact: VaultContact) => void;
}

/** Node diameter steps down with distance: closer reads bigger. */
export function nodeSize(ring: IntimacyRing): number {
  return 44 - (ring - 1) * 4;
}

const MOVE_MS = 350;

function ContactNodeInner({ contact, index, onPress }: ContactNodeProps): React.JSX.Element {
  const size = nodeSize(contact.ring);
  const chip = positionOn(contact.ring, index);
  const centerX = chip.left + NODE_HALF_WIDTH;
  const centerY = chip.top + NODE_HALF_HEIGHT;
  const left = centerX - size / 2;
  const top = centerY - size / 2;

  const x = useSharedValue(left);
  const y = useSharedValue(top);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true; // first mount: appear in place, no travel
      x.value = left;
      y.value = top;
      return;
    }
    x.value = withTiming(left, { duration: MOVE_MS });
    y.value = withTiming(top, { duration: MOVE_MS });
  }, [left, top, x, y]);

  const animatedPosition = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  const palette = etatColor(contact.etat);

  return (
    <Animated.View style={[styles.holder, animatedPosition]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={contactLabel(contact)}
        onPress={() => onPress(contact)}
        style={[
          styles.node,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: palette.background,
            borderColor: palette.border,
          },
        ]}
      >
        <Text style={styles.initials}>{initials(contact.displayName)}</Text>
      </Pressable>
    </Animated.View>
  );
}

export const ContactNode = memo(ContactNodeInner);

const styles = StyleSheet.create({
  holder: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  node: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initials: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
