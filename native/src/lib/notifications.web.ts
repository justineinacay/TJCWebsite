export type ReminderScheduleResult = {
  enabled: boolean;
  notificationIds: string[];
};

export async function scheduleMedicationReminders(): Promise<ReminderScheduleResult> {
  return { enabled: false, notificationIds: [] };
}

export async function cancelMedicationReminders(_notificationIds: string[]): Promise<void> {}
