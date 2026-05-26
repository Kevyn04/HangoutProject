import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '@/services/auth-context';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { ToastProvider } from '@/context/ToastContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

function NotificationRegistrar() {
  const { user } = useAuth();
  usePushNotifications(user);
  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
      <NotificationRegistrar />
      <ThemeProvider value={DarkTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="create" options={{ presentation: 'modal', title: 'New Hangout', headerStyle: { backgroundColor: '#1a0505' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="event-details" options={{ title: 'Event Details', headerStyle: { backgroundColor: '#1a0505' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="edit-event" options={{ presentation: 'modal', title: 'Edit Hangout', headerStyle: { backgroundColor: '#1a0505' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="enter" options={{ title: 'Explore', headerStyle: { backgroundColor: '#131a24' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="create-bubble" options={{ presentation: 'modal', title: 'New Bubble', headerStyle: { backgroundColor: '#0f0305' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="bubble-detail" options={{ title: 'Bubble', headerStyle: { backgroundColor: '#0f0305' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="page-detail" options={{ title: 'Page', headerStyle: { backgroundColor: '#0f0305' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="user-profile" options={{ title: 'Profile', headerStyle: { backgroundColor: '#0f0305' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="create-page" options={{ presentation: 'modal', title: 'New Page', headerStyle: { backgroundColor: '#0f0305' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="signin" options={{ presentation: 'modal', title: 'Sign In', headerStyle: { backgroundColor: '#1a0505' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="signup" options={{ presentation: 'modal', title: 'Sign Up', headerStyle: { backgroundColor: '#1a0505' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
