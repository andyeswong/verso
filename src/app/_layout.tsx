import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DB_NAME, migrate } from '../db/open';
import { chromeFor } from '../design/theme';
import { AppProvider } from '../state/app';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const chrome = chromeFor(scheme);

  const [loaded] = useFonts({
    'Newsreader-Regular': require('../../assets/fonts/Newsreader-Regular.ttf'),
    'Newsreader-Medium': require('../../assets/fonts/Newsreader-Medium.ttf'),
    'Newsreader-SemiBold': require('../../assets/fonts/Newsreader-SemiBold.ttf'),
    'Newsreader-Display': require('../../assets/fonts/Newsreader-Display.ttf'),
    'Newsreader-Italic': require('../../assets/fonts/Newsreader-Italic.ttf'),
    'MartianMono-Regular': require('../../assets/fonts/MartianMono-Regular.ttf'),
    'MartianMono-Medium': require('../../assets/fonts/MartianMono-Medium.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: chrome.paper }} />;

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <AppProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              animationDuration: 180,
              contentStyle: { backgroundColor: chrome.paper },
            }}
          />
        </AppProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
