import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { FormError } from "@/components/FormError";
import { formatDateInput, parseDateBR } from "@/lib/utils";
import type { MedicationDose } from "@/types";
import { trackEvent } from "@/lib/analytics";
import { hapticSuccess } from "@/lib/haptics";

function nowDateString() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function nowTimeString() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTimeInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function formatDoseDate(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} às ${h}:${m}`;
}

export default function AddDoseScreen() {
  const { id, medicationId, medicationName } = useLocalSearchParams<{
    id: string;
    medicationId: string;
    medicationName: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();

  const [date, setDate] = useState(nowDateString);
  const [time, setTime] = useState(nowTimeString);
  const [administeredBy, setAdministeredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentDoses, setRecentDoses] = useState<MedicationDose[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useState(() => {
    if (medicationId) fetchHistory();
  });

  async function fetchHistory() {
    const { data } = await supabase
      .from("medication_doses")
      .select("*")
      .eq("medication_id", medicationId)
      .order("administered_at", { ascending: false })
      .limit(5);
    setRecentDoses((data as MedicationDose[]) ?? []);
    setLoadingHistory(false);
  }

  async function handleSave() {
    setError(null);
    const parsedDate = parseDateBR(date);
    if (!parsedDate) { setError("Data inválida. Use DD/MM/AAAA."); return; }

    const [h, m] = time.split(":").map(Number);
    if (isNaN(h) || isNaN(m) || h > 23 || m > 59) { setError("Horário inválido."); return; }

    const administeredAt = new Date(
      Number(parsedDate.split("-")[0]),
      Number(parsedDate.split("-")[1]) - 1,
      Number(parsedDate.split("-")[2]),
      h, m, 0
    ).toISOString();

    setLoading(true);
    const { error: dbError } = await supabase.from("medication_doses").insert({
      medication_id: medicationId,
      pet_id: id,
      administered_at: administeredAt,
      administered_by: administeredBy.trim() || null,
      notes: notes.trim() || null,
    });
    setLoading(false);

    if (dbError) {
      setError("Não foi possível salvar. Tente novamente.");
    } else {
      hapticSuccess();
      trackEvent("dose_confirmed", { pet_id: id });
      router.replace(`/(app)/pet/${id}` as any);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-sage-700">Registrar Dose</Text>
          {medicationName ? (
            <Text className="text-sage-500 text-sm">{medicationName}</Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <FormError message={error} />

          {/* Data e Hora */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm text-sage-600 mb-1 font-medium">Data</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#60b880"
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
                placeholder="HH:MM"
                placeholderTextColor="#60b880"
                value={time}
                onChangeText={(v) => { setTime(formatTimeInput(v)); setError(null); }}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>

          {/* Administrado por */}
          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Administrado por</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Ex: Marta, veterinário, cuidador..."
              placeholderTextColor="#60b880"
              value={administeredBy}
              onChangeText={setAdministeredBy}
            />
          </View>

          {/* Observações */}
          <View className="mb-2">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Observações</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Reação, dificuldade para tomar, etc."
              placeholderTextColor="#60b880"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: "top" }}
            />
          </View>
        </View>

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mt-4"
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-semibold text-base">Confirmar dose</Text>
          )}
        </TouchableOpacity>

        {/* Histórico recente */}
        <View className="mt-6 mb-8">
          <Text className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">
            Últimas 5 doses
          </Text>
          {loadingHistory ? (
            <ActivityIndicator color="#32a060" />
          ) : recentDoses.length === 0 ? (
            <Text className="text-sage-300 text-sm">Nenhuma dose registrada ainda.</Text>
          ) : (
            <FlatList
              data={recentDoses}
              keyExtractor={(d) => d.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View className="bg-white rounded-xl px-4 py-3 mb-2 shadow-sm flex-row items-start gap-3">
                  <View className="bg-sage-100 rounded-full p-1.5 mt-0.5">
                    <Ionicons name="checkmark" size={12} color="#165c39" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sage-700 text-sm font-medium">
                      {formatDoseDate(item.administered_at)}
                    </Text>
                    {item.administered_by ? (
                      <Text className="text-sage-400 text-xs mt-0.5">Por: {item.administered_by}</Text>
                    ) : null}
                    {item.notes ? (
                      <Text className="text-sage-400 text-xs mt-0.5">{item.notes}</Text>
                    ) : null}
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
