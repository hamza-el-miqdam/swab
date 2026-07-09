/**
 * MAP-02 — the three persistent surfaces behind one custom tab bar
 * (src/ui/nav-bar.tsx). The custom bar renders labels only: badges and
 * counters are impossible by construction (product law 5).
 */
import { Tabs } from 'expo-router';

import { colors } from '../../src/theme';
import { NavBar } from '../../src/ui/nav-bar';

function renderNavBar(): React.JSX.Element {
  return <NavBar />;
}

export default function MainLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
      tabBar={renderNavBar}
    >
      <Tabs.Screen name="carte" />
      <Tabs.Screen name="envie" />
      <Tabs.Screen name="sous-groupes" />
    </Tabs>
  );
}
