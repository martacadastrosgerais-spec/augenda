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
import type { SymptomSeverity } from "@/types";

const SEVERITY_OPTIONS: { value: SymptomSeverity; label: string; color: string; textColor: string; activeColor: string }[] = [
  { value: "low", label: "Normal", color: "bg-sage-50", textColor: "text-sage-600", activeColor: "bg-sage-400" },
  { value: "medium", label: "Atenção", color: "bg-amber-50", textColor: "text-amber-600", activeColor: "bg-amber-400" },
  { value: "high", label: "Urgente", color: "bg-red-50", textColor: "text-red-600", activeColor: "bg-red-500" },
];

function nowDateString() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function nowTimeString() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AddLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<SymptomSeverity>("low");
  const [date, setDate] = useState(nowDateString);
  const [time, setTime] = useState(nowTimeString);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function formatTimeInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  async function handleSave() {
    setError(null);
    if (!description.trim()) { setError("Descreva o que foi observado."); return; }
    const parsedDate = parseDateBR(date);
    if (!parsedDate) { setError("Data inválida. Use DD/MM/AAAA."); return; }

    const [h, m] = time.split(":").map(Number);
    if (isNaN(h) || isNaN(m) || h > 23 || m > 59) { setError("Horário inválido."); return; }

    const notedAt = new Date(
      Number(parsedDate.split("-")[0]),
      Number(parsedDate.split("-")[1]) - 1,
      Number(parsedDate.split("-")[2]),
      h, m, 0
    ).toISOString();

    setLoading(true);
    const { error: dbError } = await supabase.from("symptom_logs").insert({
      pet_id: id,
      noted_at: notedAt,
      description: description.trim(),
      severity,
    });
    setLoading(false);

    if (dbError) {
      setError("Não foi possível salvar. Tente novamente.");
    } else {
      router.replace(`/(app)/pet/${id}` as any);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Nova Anotação</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <FormError message={error} />

          {/* Gravidade */}
          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-2 font-medium">Gravidade</Text>
            <View className="flex-row gap-2">
              {SEVERITY_OPTIONS.map((opt) => {
                const active = severity === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setSeverity(opt.value)}
                    className={`flex-1 py-2.5 rounded-xl items-center border ${
                      active ? `${opt.activeColor} border-transparent` : `bg-white border-sage-200`
                    }`}
                  >
                    <Text className={`text-sm font-semibold ${active ? "text-white" : opt.textColor}`}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Descrição */}
          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">O que foi observado? *</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Ex: Vômito após alimentação, coceira no ouvido, sem apetite..."
              placeholderTextColor="#60b880"
              value={description}
              onChangeText={(v) => { setDescription(v); setError(null); }}
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: "top" }}
              autoFocus
            />
          </View>

          {/* Data e Hora */}
          <View className="flex-row gap-3 mb-2">
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
        </View>

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mt-4 mb-8"
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-semibold text-base">Salvar Anotação</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
