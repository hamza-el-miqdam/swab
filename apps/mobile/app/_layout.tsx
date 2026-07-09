import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '../src/theme';

const rootStyle = { flex: 1 } as const;

export default function RootLayout(): React.JSX.Element {
  return (
    // Gesture root is required once for the whole app (carte pan/zoom, MAP-07)
    <GestureHandlerRootView style={rootStyle}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  );
}
