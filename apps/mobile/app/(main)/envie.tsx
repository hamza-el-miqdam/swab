/**
 * FS-05 entry point — calm placeholder until Envie & Match lands (MAP-02
 * gives it a permanent nav slot from day one).
 */
import { View } from 'react-native';

import { t } from '../../src/i18n/fr';
import { Body, Brand, Screen, Title } from '../../src/ui';

export default function Envie(): React.JSX.Element {
  return (
    <Screen>
      <Brand />
      <Title>{t('envie.title')}</Title>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Body>{t('envie.placeholder')}</Body>
      </View>
    </Screen>
  );
}
