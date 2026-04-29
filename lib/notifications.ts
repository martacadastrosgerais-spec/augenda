import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleLocalReminder(opts: {
  title: string;
  body: string;
  date: Date;
  recurrence: "once" | "daily" | "weekly" | "monthly" | "yearly";
}): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  try {
    if (opts.recurrence === "once") {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: opts.title, body: opts.body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: opts.date },
      });
      return id;
    }

    if (opts.recurrence === "daily") {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: opts.title, body: opts.body, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: opts.date.getHours(),
          minute: opts.date.getMinutes(),
        },
      });
      return id;
    }

    if (opts.recurrence === "weekly") {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: opts.title, body: opts.body, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: opts.date.getDay() + 1,
          hour: opts.date.getHours(),
          minute: opts.date.getMinutes(),
        },
      });
      return id;
    }

    // Monthly e yearly: agendar só a próxima ocorrência (reagendar após disparo)
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: opts.title, body: opts.body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: opts.date },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelLocalReminder(localId: string): Promise<void> {
  if (Platform.OS === "web" || !localId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(localId);
  } catch {}
}

export function buildReminderDate(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0);
}
