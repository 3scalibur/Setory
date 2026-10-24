// Вкладка «Профіль»: налаштування.

import { useCallback } from 'react';

import { appDeps } from '@/services/app-deps';
import { getUserSettings, updateUserSetting } from '@/services/settingsService';
import { Body, Card, Chip, Heading, Muted, Row } from '@/ui/kit';
import { run } from '@/ui/run';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

export default function ProfileTab() {
  const settings = useLive(useCallback(() => getUserSettings(appDeps), []));

  return (
    <Screen title="Профіль">
      <Heading>Підстановка підходів</Heading>
      <Card>
        <Body>Скільки підходів підставляти у вправу</Body>
        <Row>
          <Chip
            label="Як минулого разу"
            selected={settings.prefillSetCount === 'last'}
            onPress={() => run(() => updateUserSetting(appDeps, 'prefillSetCount', 'last'))}
          />
          <Chip
            label="Як у програмі"
            selected={settings.prefillSetCount === 'template'}
            onPress={() => run(() => updateUserSetting(appDeps, 'prefillSetCount', 'template'))}
          />
        </Row>
        <Muted>Кг і повтори в обох режимах беруться з минулого разу; типи підходів — з того ж джерела, що й кількість.</Muted>
      </Card>

      <Heading>Про апку</Heading>
      <Card>
        <Muted>Setory · технічна версія без дизайну. Усі дані зберігаються лише на телефоні.</Muted>
      </Card>
    </Screen>
  );
}
