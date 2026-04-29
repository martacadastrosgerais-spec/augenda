import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { FormError } from "@/components/FormError";
import { formatDateInput, parseDateBR } from "@/lib/utils";
import { scheduleLocalReminder, cancelLocalReminder, buildReminderDate } from "@/lib/notifications";
import type { ReminderType, ReminderRecurrence } from "@/types";

const TYPE_OPTIONS: { value: ReminderType; label: string; icon: string }[] = [
  { value: "vaccine", label: "Vacina", icon: "shield-checkmark-outline" },
  { value: "medication", label: "Medicamento", icon: "medical-outline" },
  { value: "procedure", label: "Procedimento", icon: "document-text-outline" },
  { value: "custom", label: "Personalizado", icon: "notifications-outline" },
];

const RECURRENCE_OPTIONS: { value: ReminderRecurrence; label: string }[] = [
  { value: "once", label: "Uma vez" },
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

interface PetOption { id: string; name: string; }

export default function NewReminderScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { petId: preselectedPetId } = useLocalSearchParams<{ petId?: string }>();

  const [pets, setPets] = useState<PetOption[]>([]);
  const [selectedPetId, setSelectedPetId] = useState(preselectedPetId ?? "");
  const [type, setType] = useState<ReminderType>("custom");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>("once");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPets, setLoadingPets] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPets();
  }, []);

  async function loadPets() {
    const [ownedRes, memberRes] = await Promise.all([
      supabase.from("pets").select("id, name").eq("user_id", user!.id).order("name"),
      supabase.from("pet_members").select("pet_id, pets(id, name)").eq("user_id", user!.id),
    ]);

    const all: PetOption[] = [];
    (ownedRes.data ?? []).forEach((p) => all.push({ id: p.id, name: p.name }));
    (memberRes.data ?? []).forEach((m: any) => {
      if (m.pets && !all.find((p) => p.id === m.pets.id)) {
        all.push({ id: m.pets.id, name: m.pets.name });
      }
    });

    setPets(all);
    if (!preselectedPetId && all.length > 0) setSelectedPetId(all[0].id);
    setLoadingPets(false);
  }

  function formatTimeInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  function validateTime(t: string): boolean {
    const parts = t.split(":");
    if (parts.length !== 2) return false;
    const h = Number(parts[0]), m = Number(parts[1]);
    return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }

  async function handleSave() {
    setError(null);
    if (!selectedPetId) { setError("Selecione um pet."); return; }
    if (!title.trim()) { setError("Informe o título do lembrete."); return; }
    const parsedDate = parseDateBR(date);
    if (!parsedDate) { setError("Data inválida. Use DD/MM/AAAA."); return; }
    if (!validateTime(time)) { setError("Horário inválido. Use HH:MM."); return; }

    const reminderDate = buildReminderDate(parsedDate, time);
    if (recurrence === "once" && reminderDate < new Date()) {
      setError("A data/hora do lembrete já passou.");
      return;
    }

    setLoading(true);

    const localId = await scheduleLocalReminder({
      title: `${pets.find((p) => p.id === selectedPetId)?.name ?? ""} — ${title.trim()}`,
      body: notes.trim() || "Lembrete AUgenda",
      date: reminderDate,
      recurrence,
    });

    const { error: dbError } = await supabase.from("reminders").insert({
      pet_id: selectedPetId,
      user_id: user!.id,
      title: title.trim(),
      type,
      scheduled_date: parsedDate,
      time_of_day: time + ":00",
      recurrence,
      notes: notes.trim() || null,
      local_notification_id: localId,
      enabled: true,
    });

    setLoading(false);

    if (dbError) {
      if (localId) cancelLocalReminder(localId);
      setError("Não foi possível salvar o lembrete.");
    } else {
      router.back();
    }
  }

  if (loadingPets) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#7da87b" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#527558" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Novo Lembrete</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <FormError message={error} />

          {/* Pet */}
          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-2 font-medium">Pet *</Text>
            <View className="flex-row flex-wrap gap-2">
              {pets.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedPetId(p.id)}
                  className={`px-3 py-2 rounded-xl border ${
                    selectedPetId === p.id ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"
                  }`}
                >
                  <Text className={`text-sm font-medium ${selectedPetId === p.id ? "text-white" : "text-sage-600"}`}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tipo */}
          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-2 font-medium">Tipo</Text>
            <View className="flex-row flex-wrap gap-2">
              {TYPE_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setType(t.value)}
                  className={`flex-row items-center gap-1 px-3 py-2 rounded-xl border ${
                    type === t.value ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"
                  }`}
                >
                  <Ionicons name={t.icon as any} size={13} color={type === t.value ? "#fff" : "#7da87b"} />
                  <Text className={`text-sm font-medium ${type === t.value ? "text-white" : "text-sage-600"}`}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Título */}
          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Título *</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Ex: Próxima dose da raiva, Dar vermífugo..."
              placeholderTextColor="#a8c5ad"
              value={title}
              onChangeText={(v) => { setTitle(v); setError(null); }}
            />
          </View>

          {/* Data e Hora */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm text-sage-600 mb-1 font-medium">Data *</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#a8c5ad"
                value={date}
                onChangeText={(v) => { setDate(formatDateInput(v)); setError(null); }}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <View className="w-28">
              <Text className="text-sm text-sage-600 mb-1 font-medium">Hora</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder="09:00"
                placeholderTextColor="#a8c5ad"
                value={time}
                onChangeText={(v) => { setTime(formatTimeInput(v)); setError(null); }}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>

          {/* Recorrência */}
          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-2 font-medium">Repetir</Text>
            <View className="flex-row flex-wrap gap-2">
              {RECURRENCE_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setRecurrence(r.value)}
                  className={`px-3 py-2 rounded-xl border ${
                    recurrence === r.value ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"
                  }`}
                >
                  <Text className={`text-sm font-medium ${recurrence === r.value ? "text-white" : "text-sage-600"}`}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Observações */}
          <View className="mb-2">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Observações</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Detalhes adicionais..."
              placeholderTextColor="#a8c5ad"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: "top" }}
            />
          </View>
        </View>

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mt-4 mb-8"
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-semibold text-base">Salvar Lembrete</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
