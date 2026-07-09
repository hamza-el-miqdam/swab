/**
 * MAP-01/07 — the radial canvas: ring circles, hairline spokes, « moi » at
 * the center, one ContactNode per placed contact, pinch-zoom + bounded pan.
 * Pure presentation from vault data passed in by the carte — this module
 * never loads anything (MAP-05). Gestures write shared values in worklets:
 * zero JS-thread work while panning/zooming (mobile rules 3–4).
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { t } from '../i18n/fr';
import { colors } from '../theme';
import type { VaultContact } from '../vault/vault';
import { ContactNode, type PlacedContact } from './ContactNode';
import { MAP_SIZE, RINGS, clamp, panBound, ringRadius } from './geometry';

const MIN_SCALE = 1;
const MAX_SCALE = 3;

const SPOKE_ANGLES = [0, 45, 90, 135] as const;

interface RadialMapProps {
  contacts: readonly VaultContact[];
  onPressContact: (contact: VaultContact) => void;
}

interface PositionedNode {
  contact: PlacedContact;
  /** Index within its ring — the deterministic angular slot. */
  ringIndex: number;
}

export function RadialMap({ contacts, onPressContact }: RadialMapProps): React.JSX.Element {
  const nodes = useMemo<readonly PositionedNode[]>(() => {
    const perRing = new Map<number, number>();
    return contacts
      .filter((c): c is PlacedContact => c.ring !== undefined)
      .map((contact) => {
        const ringIndex = perRing.get(contact.ring) ?? 0;
        perRing.set(contact.ring, ringIndex + 1);
        return { contact, ringIndex };
      });
  }, [contacts]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .withTestId('carte-pinch')
    .onUpdate((e) => {
      'worklet';
      scale.value = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE);
      const bound = panBound(scale.value);
      tx.value = clamp(tx.value, -bound, bound);
      ty.value = clamp(ty.value, -bound, bound);
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .withTestId('carte-pan')
    .onUpdate((e) => {
      'worklet';
      const bound = panBound(scale.value);
      tx.value = clamp(savedTx.value + e.translationX, -bound, bound);
      ty.value = clamp(savedTy.value + e.translationY, -bound, bound);
    })
    .onEnd(() => {
      'worklet';
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const transform = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
      <Animated.View style={[styles.canvas, transform]} testID="carte-canvas">
      {RINGS.map((ring) => {
        const r = ringRadius(ring);
        return (
          <View
            key={`ring-${ring}`}
            pointerEvents="none"
            style={[
              styles.ringCircle,
              {
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                top: MAP_SIZE / 2 - r,
                left: MAP_SIZE / 2 - r,
              },
            ]}
          />
        );
      })}
      {SPOKE_ANGLES.map((angle) => (
        <View
          key={`spoke-${angle}`}
          pointerEvents="none"
          style={[styles.spoke, { transform: [{ rotate: `${angle}deg` }] }]}
        />
      ))}
      <View pointerEvents="none" style={styles.me}>
        <Text style={styles.meText}>{t('carte.me')}</Text>
      </View>
      {nodes.map(({ contact, ringIndex }) => (
        <ContactNode
          key={contact.id}
          contact={contact}
          index={ringIndex}
          onPress={onPressContact}
        />
      ))}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: MAP_SIZE,
    height: MAP_SIZE,
    alignSelf: 'center',
  },
  ringCircle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.ringLine,
  },
  spoke: {
    position: 'absolute',
    top: MAP_SIZE / 2,
    left: 0,
    width: MAP_SIZE,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.ringLine,
    opacity: 0.6,
  },
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
    zIndex: 1,
  },
  meText: { color: colors.accentInk, fontWeight: '600' },
});
