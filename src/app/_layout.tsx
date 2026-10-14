import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

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
      <View style={styles.error}>
        <Text style={styles.errorTitle}>Не вдалося відкрити базу даних</Text>
        <Text selectable>{dbState.error.message}</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#FFFFFF' },
  errorTitle: { fontSize: 20, fontWeight: '700' },
});
