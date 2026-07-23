import 'react-native-url-polyfill/auto';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/services/auth-context';
import { ThemeContextProvider, useTheme } from '@/services/theme-context';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { ToastProvider } from '@/context/ToastContext';
import LoadingScreen from '@/components/LoadingScreen';
import { OnboardingOverlay } from '@/components/OnboardingOverlay';
import { recordPrivacyConsent } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const unstable_settings = {
  anchor: '(tabs)',
};

function NotificationRegistrar() {
  const { user } = useAuth();
  usePushNotifications(user);
  return null;
}

// Redirects OAuth users who signed in but haven't chosen a username yet
function UsernameGate() {
  const { needsUsername, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const onChooseUsername = segments[0] === 'choose-username';
    if (needsUsername && !onChooseUsername) {
      router.replace('/choose-username');
    }
  }, [needsUsername, loading, segments, router]);

  return null;
}

const ONBOARDING_KEY = "@hangout/onboarding_done";
const PRIVACY_KEY = "@hangout/privacy_accepted_v1";

function AppContent() {
  const { user, loading } = useAuth();
  const { mode, colors } = useTheme();
  const [overlayMode, setOverlayMode] = useState<"full" | "consent" | null>(null);

  const navTheme = mode === 'dark'
    ? DarkTheme
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: colors.red,
          background: colors.bgBase,
          card: colors.headerBg,
          text: colors.text,
          border: colors.border,
        },
      };

  useEffect(() => {
    if (loading) return;
    AsyncStorage.multiGet([ONBOARDING_KEY, PRIVACY_KEY]).then(([[, onboarded], [, privacyAccepted]]) => {
      if (!onboarded) setOverlayMode("full");
      else if (!privacyAccepted) setOverlayMode("consent"); // existing users who onboarded before the consent step
    });
  }, [loading]);

  // Record consent on the profile once a user exists (covers accept-before-signup)
  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem(PRIVACY_KEY).then((acceptedAt) => {
      if (acceptedAt) recordPrivacyConsent(user, acceptedAt);
    });
  }, [user]);

  const handleAccept = () => {
    setOverlayMode(null);
    const acceptedAt = new Date().toISOString();
    AsyncStorage.multiSet([[ONBOARDING_KEY, "1"], [PRIVACY_KEY, acceptedAt]]);
    if (user) recordPrivacyConsent(user, acceptedAt);
  };

  if (loading) return <LoadingScreen />;
  return (
    <>
      <NotificationRegistrar />
      <UsernameGate />
      <OnboardingOverlay visible={overlayMode !== null} mode={overlayMode ?? "full"} onAccept={handleAccept} />
      <ThemeProvider value={navTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="choose-username" options={{ headerShown: false }} />
          <Stack.Screen name="create" options={{ presentation: 'modal', title: 'New Hangout', headerStyle: { backgroundColor: colors.headerBg }, headerTintColor: colors.headerTint }} />
          <Stack.Screen name="event-details" options={{ title: 'Event Details', headerStyle: { backgroundColor: colors.headerBg }, headerTintColor: colors.headerTint }} />
          {/* TODO(theme-phase-2): edit-event screen body isn't theme-aware yet — header left dark intentionally */}
          <Stack.Screen name="edit-event" options={{ presentation: 'modal', title: 'Edit Hangout', headerStyle: { backgroundColor: '#1a0505' }, headerTintColor: '#fff' }} />
          {/* TODO(theme-phase-2): enter screen isn't theme-aware yet */}
          <Stack.Screen name="enter" options={{ title: 'Explore', headerStyle: { backgroundColor: '#131a24' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="create-bubble" options={{ presentation: 'modal', title: 'New Bubble', headerStyle: { backgroundColor: colors.headerBgAlt }, headerTintColor: colors.headerTint }} />
          <Stack.Screen name="bubble-detail" options={{ title: 'Bubble', headerStyle: { backgroundColor: colors.headerBgAlt }, headerTintColor: colors.headerTint }} />
          <Stack.Screen name="page-detail" options={{ title: 'Page', headerStyle: { backgroundColor: colors.headerBgAlt }, headerTintColor: colors.headerTint }} />
          <Stack.Screen name="user-profile" options={{ title: 'Profile', headerStyle: { backgroundColor: colors.headerBgAlt }, headerTintColor: colors.headerTint }} />
          {/* TODO(theme-phase-2): event-chat screen isn't theme-aware yet */}
          <Stack.Screen name="event-chat" options={{ title: 'Event Chat', headerStyle: { backgroundColor: '#0f0305' }, headerTintColor: '#fff' }} />
          {/* TODO(theme-phase-2): discussion-detail screen isn't theme-aware yet */}
          <Stack.Screen name="discussion-detail" options={{ title: 'Discussion', headerStyle: { backgroundColor: '#0f0305' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="create-page" options={{ presentation: 'modal', title: 'New Page', headerStyle: { backgroundColor: colors.headerBgAlt }, headerTintColor: colors.headerTint }} />
          {/* TODO(theme-phase-2): signin screen isn't theme-aware yet */}
          <Stack.Screen name="signin" options={{ presentation: 'modal', title: 'Sign In', headerStyle: { backgroundColor: '#1a0505' }, headerTintColor: '#fff' }} />
          {/* TODO(theme-phase-2): signup screen isn't theme-aware yet */}
          <Stack.Screen name="signup" options={{ presentation: 'modal', title: 'Sign Up', headerStyle: { backgroundColor: '#1a0505' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ headerShown: false }} />
          <Stack.Screen name="invite-user" options={{ headerShown: false }} />
          <Stack.Screen name="story-viewer" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack>
        <StatusBar style={colors.statusBarStyle} />
      </ThemeProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeContextProvider>
        <AuthProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AuthProvider>
      </ThemeContextProvider>
    </SafeAreaProvider>
  );
}
