// Виконати дію з кнопки: помилки для користувача показуємо як є, решту — коротко і в консоль.

import { router } from 'expo-router';
import { Alert } from 'react-native';

import { ActiveSessionError, UserError } from '@/services/deps';

export function run<T>(action: () => T): T | undefined {
  try {
    return action();
  } catch (error) {
    if (error instanceof ActiveSessionError) {
      Alert.alert('Тренування вже триває', error.message, [
        { text: 'Закрити', style: 'cancel' },
        {
          text: 'Продовжити',
          onPress: () => router.push({ pathname: '/session/[id]', params: { id: error.activeSessionId } }),
        },
      ]);
    } else if (error instanceof UserError) {
      Alert.alert('Не вийшло', error.message);
    } else {
      console.error(error);
      Alert.alert('Щось пішло не так', error instanceof Error ? error.message : String(error));
    }
    return undefined;
  }
}

/** Підтвердження небезпечної дії. */
export function confirm(title: string, message: string, actionText: string, onConfirm: () => void, destructive = true) {
  Alert.alert(title, message, [
    { text: 'Назад', style: 'cancel' },
    { text: actionText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** Як run, але повертає true, якщо дія вдалась (щоб переходити далі лише після успіху). */
export function succeeded(action: () => void): boolean {
  let ok = false;
  run(() => {
    action();
    ok = true;
  });
  return ok;
}
