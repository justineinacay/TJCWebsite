import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type ReminderScheduleResult = {
  enabled: boolean;
  notificationIds: string[];
};

async function ensurePermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medication-reminders', {
      name: 'Medication reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 120, 250],
      lightColor: '#C4301E',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleMedicationReminders(
  medicationName: string,
  dose: string,
  times: string[],
): Promise<ReminderScheduleResult> {
  const allowed = await ensurePermission();
  if (!allowed) return { enabled: false, notificationIds: [] };

  const notificationIds: string[] = [];
  try {
    for (const time of times) {
      const [hour, minute] = time.split(':').map(Number);
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Oras na ng gamot',
          body: `${medicationName} ${dose} — buksan ang NakNak para mag-check in.`,
          sound: true,
          data: { kind: 'medication-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: 'medication-reminders',
        },
      });
      notificationIds.push(identifier);
    }
  } catch (error) {
    await cancelMedicationReminders(notificationIds);
    throw error;
  }

  return { enabled: true, notificationIds };
}

export async function cancelMedicationReminders(notificationIds: string[]) {
  await Promise.all(
    notificationIds.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined),
    ),
  );
}
