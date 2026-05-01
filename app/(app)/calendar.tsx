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

// ─── Upcoming events ────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  petName: string;
  type: "vaccine" | "medication" | "procedure";
  title: string;
  date: string;
  detail?: string;
}

const EVENT_CONFIG = {
  vaccine:   { label: "Vacina",        color: "bg-blue-100",   textColor: "text-blue-600",   icon: "shield-checkmark-outline" },
  medication:{ label: "Medicamento",   color: "bg-amber-100",  textColor: "text-amber-600",  icon: "medical-outline" },
  procedure: { label: "Procedimento",  color: "bg-purple-100", textColor: "text-purple-600", icon: "document-text-outline" },
} as const;

// ─── Reminders ──────────────────────────────────────────────────────────────

const REMINDER_CONFIG = {
  vaccine:   { color: "bg-blue-100",   textColor: "text-blue-600",   icon: "shield-checkmark-outline" },
  medication:{ color: "bg-amber-100",  textColor: "text-amber-600",  icon: "medical-outline" },
  procedure: { color: "bg-purple-100", textColor: "text-purple-600", icon: "document-text-outline" },
  custom:    { color: "bg-sage-100",   textColor: "text-sage-600",   icon: "notifications-outline" },
} as const;

const RECURRENCE_LABEL: Record<string, string> = {
  once: "Uma vez", daily: "Diário", weekly: "Semanal", monthly: "Mensal", yearly: "Anual",
};

// ─── Timeline ───────────────────────────────────────────────────────────────

type TimelineEventType = "vaccine" | "medication_start" | "medication_end" | "procedure" | "symptom" | "incident" | "grooming";

interface TimelineEntry {
  id: string;
  petName: string;
  eventType: TimelineEventType;
  title: string;
  date: string;       // YYYY-MM-DD for grouping
  datetime: string;   // full ISO string for sorting
  note?: string;
  severity?: "low" | "medium" | "high";
}

type FlatItem =
  | { kind: "header"; label: string; date: string }
  | { kind: "entry"; entry: TimelineEntry };

const TIMELINE_CONFIG: Record<TimelineEventType, { label: string; color: string; textColor: string; icon: string }> = {
  vaccine:          { label: "Vacina aplicada",   color: "bg-blue-100",   textColor: "text-blue-600",   icon: "shield-checkmark-outline" },
  medication_start: { label: "Medicamento",        color: "bg-amber-100",  textColor: "text-amber-600",  icon: "medical-outline" },
  medication_end:   { label: "Fim do tratamento",  color: "bg-orange-100", textColor: "text-orange-600", icon: "medical-outline" },
  procedure:        { label: "Procedimento",        color: "bg-purple-100", textColor: "text-purple-600", icon: "document-text-outline" },
  symptom:          { label: "Anotação",            color: "bg-sage-100",   textColor: "text-sage-600",   icon: "journal-outline" },
  incident:         { label: "Adversidade",         color: "bg-red-100",    textColor: "text-red-600",    icon: "alert-circle-outline" },
  grooming:         { label: "Higiene",             color: "bg-teal-100",   textColor: "text-teal-600",   icon: "water-outline" },
};

const SYMPTOM_SEVERITY: Record<string, { color: string; textColor: string }> = {
  low:    { color: "bg-sage-100",   textColor: "text-sage-600" },
  medium: { color: "bg-amber-100",  textColor: "text-amber-600" },
  high:   { color: "bg-red-100",    textColor: "text-red-600" },
};

function formatDateHeader(iso: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (iso === today) return "Hoje";
  if (iso === yesterday) return "Ontem";
  return formatDateISO(iso);
}

function buildFlatItems(entries: TimelineEntry[]): FlatItem[] {
  const items: FlatItem[] = [];
  let lastDate = "";
  for (const entry of entries) {
    if (entry.date !== lastDate) {
      lastDate = entry.date;
      items.push({ kind: "header", date: entry.date, label: formatDateHeader(entry.date) });
    }
    items.push({ kind: "entry", entry });
  }
  return items;
}

// ─── Panel ──────────────────────────────────────────────────────────────────

type Panel = "month" | "events" | "reminders" | "timeline";

// ─── Month calendar types ────────────────────────────────────────────────────

interface DayEvent {
  title: string;
  petName: string;
  type: "vaccine" | "medication" | "procedure" | "reminder";
}

const DOT_COLORS: Record<string, string> = {
  vaccine:    "#3b82f6",
  medication: "#f59e0b",
  procedure:  "#a855f7",
  reminder:   "#32a060",
};

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEK_DAYS = ["D","S","T","Q","Q","S","S"];

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>("month");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [timeline, setTimeline] = useState<FlatItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  // ── Month panel ────────────────────────────────────────────────────────────
  const [dayEvents, setDayEvents] = useState<Record<string, DayEvent[]>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [monthLoading, setMonthLoading] = useState(true);
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchEvents();
        fetchReminders();
        fetchTimeline();
        fetchMonthData();
      } else {
        setEventsLoading(false);
        setRemindersLoading(false);
        setTimelineLoading(false);
        setMonthLoading(false);
      }
    }, [user])
  );

  // ── helpers ────────────────────────────────────────────────────────────────

  async function getPetMap(): Promise<{ map: Record<string, string>; ids: string[] }> {
    const [ownedRes, memberRes] = await Promise.all([
      supabase.from("pets").select("id, name").eq("user_id", user!.id),
      supabase.from("pet_members").select("pet_id, pets(id, name)").eq("user_id", user!.id),
    ]);
    const map: Record<string, string> = {};
    (ownedRes.data ?? []).forEach((p) => { map[p.id] = p.name; });
    (memberRes.data ?? []).forEach((m: any) => { if (m.pets) map[m.pets.id] = m.pets.name; });
    return { map, ids: Object.keys(map) };
  }

  // ── fetchMonthData ─────────────────────────────────────────────────────────

  async function fetchMonthData() {
    setMonthLoading(true);
    try {
      const { map: petMap, ids: petIds } = await getPetMap();
      if (petIds.length === 0) { setDayEvents({}); setMonthLoading(false); return; }

      const [vacRes, medRes, procRes, remRes] = await Promise.all([
        supabase.from("vaccines").select("pet_id, name, applied_at, next_dose_at").in("pet_id", petIds),
        supabase.from("medications").select("pet_id, name, started_at, ends_at").in("pet_id", petIds),
        supabase.from("procedures").select("pet_id, title, performed_at").in("pet_id", petIds),
        supabase.from("reminders").select("pet_id, title, scheduled_date").in("pet_id", petIds).eq("enabled", true),
      ]);

      const evMap: Record<string, DayEvent[]> = {};
      function addDay(date: string, ev: DayEvent) {
        const d = (date ?? "").split("T")[0];
        if (!d) return;
        if (!evMap[d]) evMap[d] = [];
        evMap[d].push(ev);
      }

      (vacRes.data ?? []).forEach((v) => {
        addDay(v.applied_at, { title: v.name, petName: petMap[v.pet_id] ?? "", type: "vaccine" });
        if (v.next_dose_at) addDay(v.next_dose_at, { title: `Próxima dose: ${v.name}`, petName: petMap[v.pet_id] ?? "", type: "vaccine" });
      });
      (medRes.data ?? []).forEach((m) => {
        addDay(m.started_at, { title: m.name, petName: petMap[m.pet_id] ?? "", type: "medication" });
        if (m.ends_at) addDay(m.ends_at, { title: `Fim: ${m.name}`, petName: petMap[m.pet_id] ?? "", type: "medication" });
      });
      (procRes.data ?? []).forEach((p) => addDay(p.performed_at, { title: p.title, petName: petMap[p.pet_id] ?? "", type: "procedure" }));
      (remRes.data ?? []).forEach((r) => addDay(r.scheduled_date, { title: r.title, petName: petMap[r.pet_id] ?? "", type: "reminder" }));

      setDayEvents(evMap);
    } catch (e) {
      console.error("[fetchMonthData]", e);
    }
    setMonthLoading(false);
  }

  function selectDay(day: string) {
    setSelectedDay((prev) => prev === day ? null : day);
  }

  // ── fetchEvents ────────────────────────────────────────────────────────────

  async function fetchEvents() {
    setEventsLoading(true);
    const { map: petMap, ids: petIds } = await getPetMap();
    if (petIds.length === 0) { setEvents([]); setEventsLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];
    const [vaccinesRes, medsRes, procsRes] = await Promise.all([
      supabase.from("vaccines").select("id, pet_id, name, next_dose_at").in("pet_id", petIds).not("next_dose_at", "is", null).gte("next_dose_at", today).order("next_dose_at"),
      supabase.from("medications").select("id, pet_id, name, ends_at").in("pet_id", petIds).eq("active", true).not("ends_at", "is", null).gte("ends_at", today).order("ends_at"),
      supabase.from("procedures").select("id, pet_id, type, title, performed_at").in("pet_id", petIds).gte("performed_at", today).order("performed_at"),
    ]);

    const ev: CalendarEvent[] = [];
    (vaccinesRes.data ?? []).forEach((v) => ev.push({ id: `vaccine-${v.id}`, petName: petMap[v.pet_id], type: "vaccine", title: `Próxima dose: ${v.name}`, date: v.next_dose_at! }));
    (medsRes.data ?? []).forEach((m) => ev.push({ id: `med-${m.id}`, petName: petMap[m.pet_id], type: "medication", title: m.name, date: m.ends_at!, detail: "Fim do tratamento" }));
    (procsRes.data ?? []).forEach((p) => ev.push({ id: `proc-${p.id}`, petName: petMap[p.pet_id], type: "procedure", title: p.title, date: p.performed_at }));
    ev.sort((a, b) => a.date.localeCompare(b.date));
    setEvents(ev);
    setEventsLoading(false);
  }

  // ── fetchReminders ─────────────────────────────────────────────────────────

  async function fetchReminders() {
    setRemindersLoading(true);
    const { ids: petIds } = await getPetMap();
    if (petIds.length === 0) { setReminders([]); setRemindersLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("reminders")
      .select("*, pets(name)")
      .in("pet_id", petIds)
      .or(`recurrence.neq.once,scheduled_date.gte.${today}`)
      .order("scheduled_date")
      .order("time_of_day");

    setReminders((data ?? []) as any);
    setRemindersLoading(false);
  }

  // ── fetchTimeline ──────────────────────────────────────────────────────────

  async function fetchTimeline() {
    setTimelineLoading(true);
    const { map: petMap, ids: petIds } = await getPetMap();
    if (petIds.length === 0) { setTimeline([]); setTimelineLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];

    const [vacRes, medRes, procRes, logRes, incRes, groomRes] = await Promise.all([
      supabase.from("vaccines").select("id, pet_id, name, applied_at").in("pet_id", petIds).lte("applied_at", today).order("applied_at", { ascending: false }).limit(60),
      supabase.from("medications").select("id, pet_id, name, started_at, ends_at, active").in("pet_id", petIds).order("started_at", { ascending: false }).limit(60),
      supabase.from("procedures").select("id, pet_id, type, title, performed_at, description").in("pet_id", petIds).lte("performed_at", today).order("performed_at", { ascending: false }).limit(60),
      supabase.from("symptom_logs").select("id, pet_id, noted_at, description, severity").in("pet_id", petIds).order("noted_at", { ascending: false }).limit(60),
      supabase.from("incidents").select("id, pet_id, occurred_at, category, description").in("pet_id", petIds).order("occurred_at", { ascending: false }).limit(40),
      supabase.from("grooming_logs").select("id, pet_id, performed_at, type, groomer_name").in("pet_id", petIds).order("performed_at", { ascending: false }).limit(40),
    ]);

    const entries: TimelineEntry[] = [];

    (vacRes.data ?? []).forEach((v) => entries.push({
      id: `vac-${v.id}`,
      petName: petMap[v.pet_id] ?? "",
      eventType: "vaccine",
      title: v.name,
      date: v.applied_at,
      datetime: v.applied_at,
    }));

    (medRes.data ?? []).forEach((m) => {
      entries.push({
        id: `med-start-${m.id}`,
        petName: petMap[m.pet_id] ?? "",
        eventType: "medication_start",
        title: m.name,
        date: m.started_at,
        datetime: m.started_at,
        note: "Início do tratamento",
      });
      const endDate = m.ends_at as string | null;
      if (endDate && endDate <= today) {
        entries.push({
          id: `med-end-${m.id}`,
          petName: petMap[m.pet_id] ?? "",
          eventType: "medication_end",
          title: m.name,
          date: endDate,
          datetime: endDate,
        });
      }
    });

    (procRes.data ?? []).forEach((p) => entries.push({
      id: `proc-${p.id}`,
      petName: petMap[p.pet_id] ?? "",
      eventType: "procedure",
      title: p.title,
      date: p.performed_at,
      datetime: p.performed_at,
      note: p.description ?? undefined,
    }));

    (logRes.data ?? []).forEach((l) => entries.push({
      id: `log-${l.id}`,
      petName: petMap[l.pet_id] ?? "",
      eventType: "symptom",
      title: l.description.length > 60 ? l.description.slice(0, 57) + "…" : l.description,
      date: l.noted_at.split("T")[0],
      datetime: l.noted_at,
      severity: l.severity,
    }));

    const INCIDENT_LABEL: Record<string, string> = {
      vomit: "Vômito", diarrhea: "Diarreia", wound: "Ferida / Lesão",
      behavior: "Comportamento", allergy_reaction: "Reação alérgica", other: "Outro",
    };
    (incRes.data ?? []).forEach((i) => entries.push({
      id: `inc-${i.id}`,
      petName: petMap[i.pet_id] ?? "",
      eventType: "incident",
      title: i.description.length > 60 ? i.description.slice(0, 57) + "…" : i.description,
      date: i.occurred_at.split("T")[0],
      datetime: i.occurred_at,
      note: INCIDENT_LABEL[i.category] ?? i.category,
    }));

    const GROOMING_LABEL: Record<string, string> = { bath: "Banho", grooming: "Tosa", both: "Banho + Tosa" };
    (groomRes.data ?? []).forEach((g) => entries.push({
      id: `groom-${g.id}`,
      petName: petMap[g.pet_id] ?? "",
      eventType: "grooming",
      title: GROOMING_LABEL[g.type] ?? g.type,
      date: g.performed_at.split("T")[0],
      datetime: g.performed_at,
      note: g.groomer_name ?? undefined,
    }));

    // Sort descending
    entries.sort((a, b) => b.datetime.localeCompare(a.datetime));

    // Cap at 150 most recent
    setTimeline(buildFlatItems(entries.slice(0, 150)));
    setTimelineLoading(false);
  }

  // ── reminder actions ───────────────────────────────────────────────────────

  async function toggleReminder(reminder: Reminder) {
    setTogglingId(reminder.id);
    const newEnabled = !reminder.enabled;
    await supabase.from("reminders").update({ enabled: newEnabled }).eq("id", reminder.id);
    setReminders((prev) => prev.map((r) => r.id === reminder.id ? { ...r, enabled: newEnabled } : r));
    setTogglingId(null);
  }

  async function deleteReminder(reminder: Reminder) {
    setDeletingId(reminder.id);
    if (reminder.local_notification_id) await cancelLocalReminder(reminder.local_notification_id);
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
      if (status !== "granted") return;
      const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
      const cal = calendars.find((c) => c.allowsModifications && c.isPrimary) ?? calendars.find((c) => c.allowsModifications);
      if (!cal) return;
      const startDate = new Date(event.date + "T09:00:00");
      const endDate = new Date(event.date + "T10:00:00");
      await ExpoCalendar.createEventAsync(cal.id, {
        title: `${event.petName} — ${event.title}`,
        startDate, endDate,
        notes: event.detail ?? "",
        alarms: [{ relativeOffset: -1440 }],
      });
    } finally {
      setAddingId(null);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const loading = panel === "month" ? monthLoading : panel === "events" ? eventsLoading : panel === "reminders" ? remindersLoading : timelineLoading;

  const PANEL_LABELS: Record<Panel, string> = {
    month: "Mês",
    events: "Próximos",
    reminders: "Lembretes",
    timeline: "Histórico",
  };

  return (
    <SafeAreaView className="flex-1 bg-sage-700" edges={["top"]}>
      {/* Header verde escuro */}
      <View className="bg-sage-700 px-5 pt-4 pb-5 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-white">Agenda</Text>
          <Text className="text-sage-300 text-sm">{PANEL_LABELS[panel]}</Text>
        </View>
        <TouchableOpacity
          className="bg-sage-400 rounded-full w-10 h-10 items-center justify-center"
          onPress={() => router.push("/(app)/new-event" as any)}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Conteúdo claro arredondado */}
      <View className="flex-1 bg-cream rounded-t-3xl overflow-hidden" style={{ marginTop: -12 }}>

      {/* Panel toggle — 4 abas */}
      <View className="flex-row mx-5 mt-4 bg-white rounded-2xl p-1 shadow-sm mb-3">
        {(["month", "events", "reminders", "timeline"] as Panel[]).map((p) => {
          const active = panel === p;
          return (
            <TouchableOpacity
              key={p}
              className={`flex-1 py-2 rounded-xl items-center ${active ? "bg-sage-400" : ""}`}
              onPress={() => setPanel(p)}
            >
              <Text className={`text-xs font-medium ${active ? "text-white" : "text-sage-500"}`}>
                {PANEL_LABELS[p]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && panel !== "month" ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#32a060" size="large" />
        </View>

      ) : panel === "month" ? (
        <FlatList
          data={selectedDay ? (dayEvents[selectedDay] ?? []) : []}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <MonthGrid
                year={currentMonth.year}
                month={currentMonth.month}
                todayStr={new Date().toISOString().split("T")[0]}
                dayEvents={dayEvents}
                selectedDay={selectedDay}
                loading={monthLoading}
                onSelectDay={selectDay}
                onPrevMonth={() => setCurrentMonth(({ year, month }) =>
                  month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
                )}
                onNextMonth={() => setCurrentMonth(({ year, month }) =>
                  month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
                )}
              />
              {selectedDay && (
                <View className="px-5 mb-2 mt-1">
                  <Text className="text-xs font-semibold text-sage-500 uppercase tracking-wide">
                    {formatDateISO(selectedDay)}
                  </Text>
                </View>
              )}
              {selectedDay && !dayEvents[selectedDay]?.length && (
                <View className="items-center py-4">
                  <Text className="text-sage-300 text-sm">Nenhum evento neste dia.</Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const color = DOT_COLORS[item.type];
            const typeLabel = item.type === "vaccine" ? "Vacina" : item.type === "medication" ? "Medicamento" : item.type === "procedure" ? "Procedimento" : "Lembrete";
            return (
              <View className="bg-white rounded-2xl p-4 mb-2 mx-5 shadow-sm flex-row items-start gap-3">
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginTop: 4 }} />
                <View className="flex-1">
                  <Text className="text-sage-800 font-medium text-sm">{item.title}</Text>
                  <View className="flex-row items-center gap-2 mt-0.5">
                    <Text className="text-sage-400 text-xs">{item.petName}</Text>
                    <Text className="text-sage-300 text-xs">·</Text>
                    <Text className="text-sage-400 text-xs">{typeLabel}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />

      ) : panel === "events" ? (
        events.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-5xl mb-4">🎉</Text>
            <Text className="text-xl font-semibold text-sage-600 text-center">Nenhum evento próximo</Text>
            <Text className="text-sage-400 text-center mt-2">Vacinas, medicamentos e procedimentos futuros aparecem aqui.</Text>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(e) => e.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const cfg = EVENT_CONFIG[item.type];
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
                    {isAdding ? <ActivityIndicator size="small" color="#32a060" /> : <Ionicons name="calendar-outline" size={14} color="#32a060" />}
                    <Text className="text-sage-500 text-xs font-medium">
                      {Platform.OS === "web" ? "Abrir no Google Calendar" : "Adicionar ao calendário"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )

      ) : panel === "reminders" ? (
        reminders.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-5xl mb-4">🔔</Text>
            <Text className="text-xl font-semibold text-sage-600 text-center">Nenhum lembrete</Text>
            <Text className="text-sage-400 text-center mt-2">Toque no + para criar um lembrete com notificação.</Text>
          </View>
        ) : (
          <FlatList
            data={reminders}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const cfg = REMINDER_CONFIG[item.type];
              const petName = (item as any).pets?.name ?? "";
              const isDeleting = deletingId === item.id;
              const isToggling = togglingId === item.id;
              return (
                <View className={`bg-white rounded-2xl p-4 mb-3 shadow-sm ${!item.enabled ? "opacity-50" : ""}`}>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <View className={`${cfg.color} px-2 py-0.5 rounded-full`}>
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
                        <ActivityIndicator size="small" color="#32a060" />
                      ) : (
                        <Switch
                          value={item.enabled}
                          onValueChange={() => toggleReminder(item)}
                          trackColor={{ false: "#cce8d4", true: "#32a060" }}
                          thumbColor="#fff"
                          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                      )}
                      <Text className="text-sage-500 text-xs">{item.enabled ? "Ativo" : "Inativo"}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteReminder(item)} disabled={isDeleting} className="p-1">
                      {isDeleting ? <ActivityIndicator size="small" color="#ef4444" /> : <Ionicons name="trash-outline" size={16} color="#ef4444" />}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )

      ) : (
        /* ── Timeline / Histórico ── */
        timeline.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-5xl mb-4">📋</Text>
            <Text className="text-xl font-semibold text-sage-600 text-center">Sem histórico ainda</Text>
            <Text className="text-sage-400 text-center mt-2">Vacinas, medicamentos, procedimentos e anotações aparecerão aqui.</Text>
          </View>
        ) : (
          <FlatList
            data={timeline}
            keyExtractor={(item) => item.kind === "header" ? `h-${item.date}` : item.entry.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              if (item.kind === "header") {
                return (
                  <View className="mb-2 mt-4 first:mt-0">
                    <Text className="text-xs font-bold text-sage-500 uppercase tracking-wide">{item.label}</Text>
                  </View>
                );
              }

              const { entry } = item;
              const cfg = TIMELINE_CONFIG[entry.eventType];
              const sevCfg = entry.severity ? SYMPTOM_SEVERITY[entry.severity] : null;
              const badgeColor = sevCfg?.color ?? cfg.color;
              const badgeTextColor = sevCfg?.textColor ?? cfg.textColor;

              // Format time for symptom logs (they have full datetime)
              const timeStr = entry.eventType === "symptom" && entry.datetime.includes("T")
                ? new Date(entry.datetime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                : null;

              return (
                <View className="bg-white rounded-2xl p-4 mb-2 shadow-sm">
                  <View className="flex-row items-start gap-3">
                    {/* Left: colored dot */}
                    <View className={`w-8 h-8 rounded-full ${badgeColor} items-center justify-center mt-0.5 shrink-0`}>
                      <Ionicons name={cfg.icon as any} size={14} color="" className={badgeTextColor} />
                    </View>

                    <View className="flex-1">
                      <View className="flex-row items-center justify-between mb-0.5">
                        <View className="flex-row items-center gap-2 flex-1">
                          <Text className={`text-xs font-semibold ${badgeTextColor}`}>{cfg.label}</Text>
                          <Text className="text-sage-400 text-xs">· {entry.petName}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-sage-400 text-xs">{timeStr ?? ""}</Text>
                        </View>
                      </View>
                      <Text className="text-sage-800 font-medium text-sm">{entry.title}</Text>
                      {entry.note && (
                        <Text className="text-sage-400 text-xs mt-0.5" numberOfLines={2}>{entry.note}</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )
      )}
      </View>
    </SafeAreaView>
  );
}

// ─── MonthGrid ───────────────────────────────────────────────────────────────

function chunkWeeks<T>(arr: T[]): T[][] {
  const weeks: T[][] = [];
  for (let i = 0; i < arr.length; i += 7) weeks.push(arr.slice(i, i + 7));
  return weeks;
}

function MonthGrid({ year, month, todayStr, dayEvents, selectedDay, loading, onSelectDay, onPrevMonth, onNextMonth }: {
  year: number;
  month: number;
  todayStr: string;
  dayEvents: Record<string, DayEvent[]>;
  selectedDay: string | null;
  loading: boolean;
  onSelectDay: (day: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = chunkWeeks(cells);

  return (
    <View className="bg-white rounded-2xl mx-5 mb-3 p-4 shadow-sm">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={onPrevMonth} hitSlop={8} className="p-1">
          <Ionicons name="chevron-back" size={20} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-sage-800 font-bold text-base">
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={onNextMonth} hitSlop={8} className="p-1">
          <Ionicons name="chevron-forward" size={20} color="#165c39" />
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View className="flex-row mb-1">
        {WEEK_DAYS.map((d, i) => (
          <View key={i} style={{ flex: 1 }} className="items-center">
            <Text className="text-sage-400 text-xs font-semibold">{d}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View className="py-8 items-center">
          <ActivityIndicator color="#32a060" />
        </View>
      ) : (
        <>
          {weeks.map((week, wi) => (
            <View key={wi} className="flex-row">
              {week.map((day, di) => {
                if (!day) return <View key={di} style={{ flex: 1, minHeight: 44 }} />;

                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDay;
                const evTypes = Array.from(new Set((dayEvents[dateStr] ?? []).map((e) => e.type)));

                return (
                  <TouchableOpacity
                    key={di}
                    style={{ flex: 1, minHeight: 44 }}
                    className="items-center py-1"
                    onPress={() => onSelectDay(dateStr)}
                    activeOpacity={0.7}
                  >
                    <View style={{
                      width: 32, height: 32, borderRadius: 16,
                      alignItems: "center", justifyContent: "center",
                      backgroundColor: isSelected ? "#32a060" : isToday ? "#cce8d4" : "transparent",
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: isSelected || isToday ? "700" : "400",
                        color: isSelected ? "#fff" : isToday ? "#165c39" : "#0e4220",
                      }}>
                        {day}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 2, height: 6, marginTop: 1 }}>
                      {evTypes.slice(0, 3).map((type) => (
                        <View key={type} style={{
                          width: 5, height: 5, borderRadius: 3,
                          backgroundColor: DOT_COLORS[type],
                        }} />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Legenda */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12, justifyContent: "center" }}>
            {Object.entries(DOT_COLORS).map(([type, color]) => (
              <View key={type} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
                <Text style={{ fontSize: 11, color: "#60b880" }}>
                  {type === "vaccine" ? "Vacina" : type === "medication" ? "Medicamento" : type === "procedure" ? "Procedimento" : "Lembrete"}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
