import type { NotificationPermission } from './notificationPermission.types';
import { Platform } from 'react-native';

export async function notificationPermission(request = false): Promise<NotificationPermission> {
  const {
    AndroidImportance, IosAuthorizationStatus, getPermissionsAsync,
    requestPermissionsAsync, setNotificationChannelAsync,
  } = await import('expo-notifications');
  if (request && Platform.OS === 'android') {
    await setNotificationChannelAsync('benefy', {
      name: 'Benefy',
      importance: AndroidImportance.DEFAULT,
    });
  }
  const result = await (request ? requestPermissionsAsync() : getPermissionsAsync());
  const allowed = result.granted || result.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  return allowed ? 'granted' : result.status === 'denied' || !result.canAskAgain ? 'denied' : 'undetermined';
}
