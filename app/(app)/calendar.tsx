import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as ExpoCalendar from "expo-calendar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatDateISO } from "@/lib/utils";

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

export default function CalendarScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) fetchEvents();
      else setLoading(false);
    }, [user])
  );

  async function fetchEvents() {
    setLoading(true);

    // Busca todos os pets do usuário (próprios + compartilhados)
    const { data: ownedPets } = await supabase.from("pets").select("id, name").eq("user_id", user!.id);
    const { data: memberships } = await supabase.from("pet_members").select("pet_id, pets(id, name)").eq("user_id", user!.id);

    const petMap: Record<string, string> = {};
    (ownedPets ?? []).forEach((p) => { petMap[p.id] = p.name; });
    (memberships ?? []).forEach((m: any) => { if (m.pets) petMap[m.pets.id] = m.pets.name; });

    const petIds = Object.keys(petMap);
    if (petIds.length === 0) { setEvents([]); setLoading(false); return; }

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

    // Ordena por data
    ev.sort((a, b) => a.date.localeCompare(b.date));
    setEvents(ev);
    setLoading(false);
  }

  async function addToNativeCalendar(event: CalendarEvent) {
    if (Platform.OS === "web") {
      // Web: abre Google Calendar com os dados preenchidos
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
        alarms: [{ relativeOffset: -1440 }], // lembrete 24h antes
      });
    } finally {
      setAddingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#7da87b" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-sage-700">Agenda</Text>
        <Text className="text-sage-400 text-sm">Próximos eventos dos seus pets</Text>
      </View>

      {events.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">🎉</Text>
          <Text className="text-xl font-semibold text-sage-600 text-center">
            Nenhum evento próximo
          </Text>
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
      )}
    </SafeAreaView>
  );
}
