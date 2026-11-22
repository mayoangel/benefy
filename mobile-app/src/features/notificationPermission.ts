import type { NotificationPermission } from './notificationPermission.types';
export async function notificationPermission(_request = false): Promise<NotificationPermission> {
  return 'unavailable' as const;
}
