import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text, useColorScheme, View } from 'react-native';

import { useDatabaseReady } from '@/db/use-database-ready';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const dbState = useDatabaseReady();

  useEffect(() => {
    if (dbState.status !== 'loading') SplashScreen.hideAsync();
  }, [dbState.status]);

  if (dbState.status === 'loading') return null;

  if (dbState.status === 'error') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>Не вдалося відкрити базу даних</Text>
        <Text selectable>{dbState.error.message}</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="session/[id]" options={{ title: 'Тренування' }} />
        <Stack.Screen name="summary/[id]" options={{ title: 'Підсумок', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="routine/[id]" options={{ title: 'Програма' }} />
        <Stack.Screen name="routine/edit" options={{ title: 'Програма', presentation: 'modal' }} />
        <Stack.Screen name="folder/edit" options={{ title: 'Папка', presentation: 'modal' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Вправа' }} />
        <Stack.Screen name="exercise/edit" options={{ title: 'Власна вправа', presentation: 'modal' }} />
        <Stack.Screen name="pick-exercise" options={{ title: 'Обрати вправу', presentation: 'modal' }} />
        <Stack.Screen name="backlog" options={{ title: 'Пропущені' }} />
        <Stack.Screen name="catch-up" options={{ title: 'День пропущених' }} />
      </Stack>
    </ThemeProvider>
  );
}
