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

export default function AddMedicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Informe o nome do medicamento."); return; }
    if (!startedAt) { setError("Informe a data de início."); return; }
    const started = parseDateBR(startedAt);
    if (!started) { setError("Data de início inválida. Use DD/MM/AAAA."); return; }
    const ends = endsAt ? parseDateBR(endsAt) : null;
    if (endsAt && !ends) { setError("Data de fim inválida. Use DD/MM/AAAA."); return; }

    setLoading(true);
    const { error: dbError } = await supabase.from("medications").insert({
      pet_id: id,
      name: name.trim(),
      dose: dose.trim() || null,
      frequency: frequency.trim() || null,
      started_at: started,
      ends_at: ends,
      notes: notes.trim() || null,
      active: true,
    });
    setLoading(false);

    if (dbError) {
      setError("Não foi possível salvar. Tente novamente.");
      console.error("[AddMedication] insert error:", dbError);
    } else {
      router.replace(`/(app)/pet/${id}` as any);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#527558" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Registrar Medicamento</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <FormError message={error} />

          {[
            { label: "Nome do medicamento *", value: name, set: setName, placeholder: "Ex: Bravecto, Simparica..." },
            { label: "Dose", value: dose, set: setDose, placeholder: "Ex: 1 comprimido" },
            { label: "Frequência", value: frequency, set: setFrequency, placeholder: "Ex: 1x ao dia, a cada 3 meses..." },
          ].map(({ label, value, set, placeholder }) => (
            <View key={label} className="mb-4">
              <Text className="text-sm text-sage-600 mb-1 font-medium">{label}</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder={placeholder}
                placeholderTextColor="#a8c5ad"
                value={value}
                onChangeText={(v) => { set(v); setError(null); }}
              />
            </View>
          ))}

          {[
            { label: "Data de início *", value: startedAt, set: setStartedAt },
            { label: "Data de fim", value: endsAt, set: setEndsAt },
          ].map(({ label, value, set }) => (
            <View key={label} className="mb-4">
              <Text className="text-sm text-sage-600 mb-1 font-medium">{label}</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#a8c5ad"
                value={value}
                onChangeText={(t) => { set(formatDateInput(t)); setError(null); }}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          ))}

          <View className="mb-2">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Observações</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Observações opcionais"
              placeholderTextColor="#a8c5ad"
              value={notes}
              onChangeText={(v) => { setNotes(v); setError(null); }}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mt-4 mb-8"
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-semibold text-base">Salvar Medicamento</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
