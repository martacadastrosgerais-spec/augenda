import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { FormError } from "@/components/FormError";
import { formatDateInput, parseDateBR } from "@/lib/utils";
import type { GroomingType } from "@/types";

const TYPES: { value: GroomingType; label: string; icon: string }[] = [
  { value: "bath",     label: "Banho",        icon: "water-outline" },
  { value: "grooming", label: "Tosa",         icon: "cut-outline" },
  { value: "both",     label: "Banho + Tosa", icon: "sparkles-outline" },
];

function todayBR() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
}

export default function AddGroomingScreen() {
  const { id, petName } = useLocalSearchParams<{ id: string; petName?: string }>();
  const router = useRouter();

  const [type, setType] = useState<GroomingType>("bath");
  const [date, setDate] = useState(todayBR());
  const [groomerName, setGroomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);

    const dateISO = parseDateBR(date);
    if (!dateISO) { setError("Data inválida. Use DD/MM/AAAA."); return; }

    let next_at: string | undefined;
    if (nextDate.trim()) {
      const nextISO = parseDateBR(nextDate);
      if (!nextISO) { setError("Data da próxima vez inválida. Use DD/MM/AAAA."); return; }
      next_at = nextISO;
    }

    setLoading(true);

    const performed_at = new Date(`${dateISO}T12:00:00`).toISOString();

    const { error: dbError } = await supabase.from("grooming_logs").insert({
      pet_id: id,
      type,
      performed_at,
      groomer_name: groomerName.trim() || undefined,
      notes: notes.trim() || undefined,
      next_at,
    });

    if (dbError) {
      setLoading(false);
      setError("Não foi possível salvar. Tente novamente.");
      return;
    }

    if (next_at) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const typeLabel = TYPES.find((t) => t.value === type)?.label ?? "Banho/Tosa";
        const name = petName ?? "Pet";
        await supabase.from("reminders").insert({
          pet_id: id,
          user_id: authData.user.id,
          title: `${typeLabel} — ${name}`,
          type: "custom",
          scheduled_date: next_at,
          time_of_day: "09:00",
          recurrence: "once",
          enabled: true,
        });
      }
    }

    setLoading(false);
    router.replace(`/(app)/pet/${id}` as any);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Registrar higiene</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <FormError message={error} />

        {/* Tipo */}
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <Text className="text-sm font-medium text-sage-600 mb-3">Tipo de serviço *</Text>
          <View className="flex-row gap-2">
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setType(t.value)}
                className={`flex-1 items-center py-3 rounded-xl border-2 gap-1 ${
                  type === t.value
                    ? "bg-teal-50 border-teal-400"
                    : "bg-white border-sage-100"
                }`}
              >
                <Ionicons
                  name={t.icon as any}
                  size={20}
                  color={type === t.value ? "#0d9488" : "#60b880"}
                />
                <Text
                  className={`text-xs font-medium ${
                    type === t.value ? "text-teal-700" : "text-sage-500"
                  }`}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Data */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <Text className="text-sm font-medium text-sage-600 mb-3">Data do serviço *</Text>
          <TextInput
            className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
            value={date}
            onChangeText={(t) => { setDate(formatDateInput(t)); setError(null); }}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#60b880"
            keyboardType="numeric"
            maxLength={10}
          />
        </View>

        {/* Profissional */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <Text className="text-sm font-medium text-sage-600 mb-2">Profissional (opcional)</Text>
          <TextInput
            className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
            value={groomerName}
            onChangeText={setGroomerName}
            placeholder="Nome do banista / tosador"
            placeholderTextColor="#60b880"
          />
        </View>

        {/* Observações */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <Text className="text-sm font-medium text-sage-600 mb-2">Observações (opcional)</Text>
          <TextInput
            className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
            value={notes}
            onChangeText={setNotes}
            placeholder="Produto usado, comportamento, observações..."
            placeholderTextColor="#60b880"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 80 }}
          />
        </View>

        {/* Próxima vez */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <Text className="text-sm font-medium text-sage-600 mb-1">Próxima vez (opcional)</Text>
          <Text className="text-xs text-sage-400 mb-3">
            Cria um lembrete automático na data informada.
          </Text>
          <TextInput
            className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
            value={nextDate}
            onChangeText={(t) => { setNextDate(formatDateInput(t)); setError(null); }}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#60b880"
            keyboardType="numeric"
            maxLength={10}
          />
        </View>

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mt-4 mb-8"
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Salvar registro</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
