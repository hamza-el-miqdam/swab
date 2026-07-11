/**
 * FS-04 entry point — calm placeholder until Subgroups (FCA) lands (MAP-02
 * gives it a permanent nav slot from day one).
 */
import { View } from 'react-native';

import { t } from '../../src/i18n/fr';
import { Body, Brand, Screen, Title } from '../../src/ui';

export default function SousGroupes(): React.JSX.Element {
  return (
    <Screen>
      <Brand />
      <Title>{t('sousgroupes.title')}</Title>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Body>{t('sousgroupes.placeholder')}</Body>
      </View>
    </Screen>
  );
}
