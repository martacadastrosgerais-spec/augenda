import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as ExpoCalendar from "expo-calendar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatDateISO } from "@/lib/utils";
import { cancelLocalReminder } from "@/lib/notifications";
import type { Reminder } from "@/types";

interface CalendarEvent {
  id: string;
  petName: string;
  type: "vaccine" | "medication" | "procedure";
  title: string;
  date: string;
  detail?: string;
}

const TYPE_CONFIG = {
  vaccine: { label: "Vacina", color: "bg-blue-100", textColor: "text-blue-600", icon: "shield-checkmark-outline" },
  medication: { label: "Medicamento", color: "bg-amber-100", textColor: "text-amber-600", icon: "medical-outline" },
  procedure: { label: "Procedimento", color: "bg-purple-100", textColor: "text-purple-600", icon: "document-text-outline" },
} as const;

const REMINDER_TYPE_CONFIG = {
  vaccine: { color: "bg-blue-100", textColor: "text-blue-600", icon: "shield-checkmark-outline" },
  medication: { color: "bg-amber-100", textColor: "text-amber-600", icon: "medical-outline" },
  procedure: { color: "bg-purple-100", textColor: "text-purple-600", icon: "document-text-outline" },
  custom: { color: "bg-sage-100", textColor: "text-sage-600", icon: "notifications-outline" },
} as const;

const RECURRENCE_LABEL: Record<string, string> = {
  once: "Uma vez",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

type Panel = "events" | "reminders";

export default function CalendarScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>("events");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchEvents();
        fetchReminders();
      } else {
        setEventsLoading(false);
        setRemindersLoading(false);
      }
    }, [user])
  );

  async function fetchEvents() {
    setEventsLoading(true);

    const { data: ownedPets } = await supabase.from("pets").select("id, name").eq("user_id", user!.id);
    const { data: memberships } = await supabase.from("pet_members").select("pet_id, pets(id, name)").eq("user_id", user!.id);

    const petMap: Record<string, string> = {};
    (ownedPets ?? []).forEach((p) => { petMap[p.id] = p.name; });
    (memberships ?? []).forEach((m: any) => { if (m.pets) petMap[m.pets.id] = m.pets.name; });

    const petIds = Object.keys(petMap);
    if (petIds.length === 0) { setEvents([]); setEventsLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];

    const [vaccinesRes, medsRes, procsRes] = await Promise.all([
      supabase.from("vaccines").select("id, pet_id, name, next_dose_at").in("pet_id", petIds).not("next_dose_at", "is", null).gte("next_dose_at", today).order("next_dose_at"),
      supabase.from("medications").select("id, pet_id, name, ends_at").in("pet_id", petIds).eq("active", true).not("ends_at", "is", null).gte("ends_at", today).order("ends_at"),
      supabase.from("procedures").select("id, pet_id, type, title, performed_at").in("pet_id", petIds).gte("performed_at", today).order("performed_at"),
    ]);

    const ev: CalendarEvent[] = [];

    (vaccinesRes.data ?? []).forEach((v) => ev.push({
      id: `vaccine-${v.id}`,
      petName: petMap[v.pet_id],
      type: "vaccine",
      title: `Próxima dose: ${v.name}`,
      date: v.next_dose_at!,
    }));

    (medsRes.data ?? []).forEach((m) => ev.push({
      id: `med-${m.id}`,
      petName: petMap[m.pet_id],
      type: "medication",
      title: m.name,
      date: m.ends_at!,
      detail: "Fim do tratamento",
    }));

    (procsRes.data ?? []).forEach((p) => ev.push({
      id: `proc-${p.id}`,
      petName: petMap[p.pet_id],
      type: "procedure",
      title: p.title,
      date: p.performed_at,
    }));

    ev.sort((a, b) => a.date.localeCompare(b.date));
    setEvents(ev);
    setEventsLoading(false);
  }

  async function fetchReminders() {
    setRemindersLoading(true);

    const { data: ownedPets } = await supabase.from("pets").select("id").eq("user_id", user!.id);
    const { data: memberships } = await supabase.from("pet_members").select("pet_id").eq("user_id", user!.id);

    const petIds = [
      ...(ownedPets ?? []).map((p) => p.id),
      ...(memberships ?? []).map((m: any) => m.pet_id),
    ];

    if (petIds.length === 0) { setReminders([]); setRemindersLoading(false); return; }

    const { data } = await supabase
      .from("reminders")
      .select("*, pets(name)")
      .in("pet_id", petIds)
      .order("scheduled_date")
      .order("time_of_day");

    setReminders((data ?? []) as any);
    setRemindersLoading(false);
  }

  async function toggleReminder(reminder: Reminder) {
    setTogglingId(reminder.id);
    const newEnabled = !reminder.enabled;

    await supabase.from("reminders").update({ enabled: newEnabled }).eq("id", reminder.id);
    setReminders((prev) => prev.map((r) => r.id === reminder.id ? { ...r, enabled: newEnabled } : r));
    setTogglingId(null);
  }

  async function deleteReminder(reminder: Reminder) {
    setDeletingId(reminder.id);
    if (reminder.local_notification_id) {
      await cancelLocalReminder(reminder.local_notification_id);
    }
    await supabase.from("reminders").delete().eq("id", reminder.id);
    setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    setDeletingId(null);
  }

  async function addToNativeCalendar(event: CalendarEvent) {
    if (Platform.OS === "web") {
      const startDate = new Date(event.date + "T09:00:00");
      const endDate = new Date(event.date + "T10:00:00");
      const params = new URLSearchParams({
        action: "TEMPLATE",
        text: `${event.petName} — ${event.title}`,
        dates: `${startDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z/${endDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        details: event.detail ?? "",
      });
      window.open(`https://calendar.google.com/calendar/render?${params}`, "_blank");
      return;
    }

    setAddingId(event.id);
    try {
      const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
      if (status !== "granted") { setAddingId(null); return; }

      const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
      const defaultCal = calendars.find((c) => c.allowsModifications && c.isPrimary)
        ?? calendars.find((c) => c.allowsModifications);

      if (!defaultCal) { setAddingId(null); return; }

      const startDate = new Date(event.date + "T09:00:00");
      const endDate = new Date(event.date + "T10:00:00");

      await ExpoCalendar.createEventAsync(defaultCal.id, {
        title: `${event.petName} — ${event.title}`,
        startDate,
        endDate,
        notes: event.detail ?? "",
        alarms: [{ relativeOffset: -1440 }],
      });
    } finally {
      setAddingId(null);
    }
  }

  const loading = panel === "events" ? eventsLoading : remindersLoading;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-sage-700">Agenda</Text>
          <Text className="text-sage-400 text-sm">
            {panel === "events" ? "Próximos eventos dos seus pets" : "Seus lembretes"}
          </Text>
        </View>
        {panel === "reminders" && (
          <TouchableOpacity
            className="bg-sage-400 rounded-full w-10 h-10 items-center justify-center"
            onPress={() => router.push("/(app)/reminders/new")}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Toggle de painel */}
      <View className="flex-row mx-5 bg-white rounded-2xl p-1 shadow-sm mb-3">
        {(["events", "reminders"] as Panel[]).map((p) => {
          const labels = { events: "Próximos eventos", reminders: "Lembretes" };
          const active = panel === p;
          return (
            <TouchableOpacity
              key={p}
              className={`flex-1 py-2 rounded-xl items-center ${active ? "bg-sage-400" : ""}`}
              onPress={() => setPanel(p)}
            >
              <Text className={`text-xs font-medium ${active ? "text-white" : "text-sage-500"}`}>
                {labels[p]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7da87b" size="large" />
        </View>
      ) : panel === "events" ? (
        events.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-5xl mb-4">🎉</Text>
            <Text className="text-xl font-semibold text-sage-600 text-center">Nenhum evento próximo</Text>
            <Text className="text-sage-400 text-center mt-2">
              Vacinas, medicamentos e procedimentos futuros aparecem aqui.
            </Text>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(e) => e.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const cfg = TYPE_CONFIG[item.type];
              const isAdding = addingId === item.id;
              return (
                <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <View className={`${cfg.color} px-2 py-0.5 rounded-full flex-row items-center gap-1`}>
                          <Ionicons name={cfg.icon as any} size={11} color="" className={cfg.textColor} />
                          <Text className={`${cfg.textColor} text-xs font-medium`}>{cfg.label}</Text>
                        </View>
                        <Text className="text-sage-400 text-xs">{item.petName}</Text>
                      </View>
                      <Text className="font-semibold text-sage-800">{item.title}</Text>
                      {item.detail && <Text className="text-sage-400 text-xs mt-0.5">{item.detail}</Text>}
                    </View>
                    <Text className="text-sage-600 text-sm font-medium ml-2">{formatDateISO(item.date)}</Text>
                  </View>

                  <TouchableOpacity
                    className="mt-3 pt-3 border-t border-sage-100 flex-row items-center gap-1"
                    onPress={() => addToNativeCalendar(item)}
                    disabled={isAdding}
                  >
                    {isAdding ? (
                      <ActivityIndicator size="small" color="#7da87b" />
                    ) : (
                      <Ionicons name="calendar-outline" size={14} color="#7da87b" />
                    )}
                    <Text className="text-sage-500 text-xs font-medium">
                      {Platform.OS === "web" ? "Abrir no Google Calendar" : "Adicionar ao calendário"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )
      ) : (
        reminders.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-5xl mb-4">🔔</Text>
            <Text className="text-xl font-semibold text-sage-600 text-center">Nenhum lembrete</Text>
            <Text className="text-sage-400 text-center mt-2">
              Toque no + para criar um lembrete com notificação.
            </Text>
          </View>
        ) : (
          <FlatList
            data={reminders}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const cfg = REMINDER_TYPE_CONFIG[item.type];
              const petName = (item as any).pets?.name ?? "";
              const isDeleting = deletingId === item.id;
              const isToggling = togglingId === item.id;
              return (
                <View className={`bg-white rounded-2xl p-4 mb-3 shadow-sm ${!item.enabled ? "opacity-50" : ""}`}>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <View className={`${cfg.color} px-2 py-0.5 rounded-full flex-row items-center gap-1`}>
                          <Ionicons name={cfg.icon as any} size={11} color="" className={cfg.textColor} />
                        </View>
                        {petName ? <Text className="text-sage-400 text-xs">{petName}</Text> : null}
                        <View className="bg-sage-50 px-2 py-0.5 rounded-full">
                          <Text className="text-sage-400 text-xs">{RECURRENCE_LABEL[item.recurrence]}</Text>
                        </View>
                      </View>
                      <Text className="font-semibold text-sage-800">{item.title}</Text>
                      {item.notes && <Text className="text-sage-400 text-xs mt-0.5">{item.notes}</Text>}
                    </View>
                    <View className="items-end gap-1">
                      <Text className="text-sage-600 text-sm font-medium">{formatDateISO(item.scheduled_date)}</Text>
                      <Text className="text-sage-400 text-xs">{item.time_of_day.slice(0, 5)}</Text>
                    </View>
                  </View>

                  <View className="mt-3 pt-3 border-t border-sage-100 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      {isToggling ? (
                        <ActivityIndicator size="small" color="#7da87b" />
                      ) : (
                        <Switch
                          value={item.enabled}
                          onValueChange={() => toggleReminder(item)}
                          trackColor={{ false: "#e6ede7", true: "#7da87b" }}
                          thumbColor="#fff"
                          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                      )}
                      <Text className="text-sage-500 text-xs">{item.enabled ? "Ativo" : "Inativo"}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteReminder(item)}
                      disabled={isDeleting}
                      className="p-1"
                    >
                      {isDeleting
                        ? <ActivityIndicator size="small" color="#ef4444" />
                        : <Ionicons name="trash-outline" size={16} color="#ef4444" />}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )
      )}
    </SafeAreaView>
  );
}
