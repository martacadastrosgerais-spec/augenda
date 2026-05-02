import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { FormError } from "@/components/FormError";
import { formatDateInput, parseDateBR } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

export default function AddVaccineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [appliedAt, setAppliedAt] = useState("");
  const [nextDoseAt, setNextDoseAt] = useState("");
  const [vetName, setVetName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Informe o nome da vacina."); return; }
    if (!appliedAt) { setError("Informe a data de aplicação."); return; }
    const applied = parseDateBR(appliedAt);
    if (!applied) { setError("Data de aplicação inválida. Use DD/MM/AAAA."); return; }
    const nextDose = nextDoseAt ? parseDateBR(nextDoseAt) : null;
    if (nextDoseAt && !nextDose) { setError("Data da próxima dose inválida. Use DD/MM/AAAA."); return; }

    setLoading(true);
    const { error: dbError } = await supabase.from("vaccines").insert({
      pet_id: id,
      name: name.trim(),
      applied_at: applied,
      next_dose_at: nextDose,
      vet_name: vetName.trim() || null,
      notes: notes.trim() || null,
    });
    setLoading(false);

    if (dbError) {
      setError("Não foi possível salvar. Tente novamente.");
      console.error("[AddVaccine] insert error:", dbError);
    } else {
      trackEvent("vaccine_added", { pet_id: id });
      router.replace(`/(app)/pet/${id}` as any);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Registrar Vacina</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <FormError message={error} />

          {[
            { label: "Nome da vacina *", value: name, set: setName, placeholder: "Ex: V10, Antirrábica..." },
            { label: "Médico veterinário", value: vetName, set: setVetName, placeholder: "Nome do vet" },
          ].map(({ label, value, set, placeholder }) => (
            <View key={label} className="mb-4">
              <Text className="text-sm text-sage-600 mb-1 font-medium">{label}</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder={placeholder}
                placeholderTextColor="#60b880"
                value={value}
                onChangeText={(v) => { set(v); setError(null); }}
              />
            </View>
          ))}

          {[
            { label: "Data de aplicação *", value: appliedAt, set: setAppliedAt },
            { label: "Próxima dose", value: nextDoseAt, set: setNextDoseAt },
          ].map(({ label, value, set }) => (
            <View key={label} className="mb-4">
              <Text className="text-sm text-sage-600 mb-1 font-medium">{label}</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#60b880"
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
              placeholderTextColor="#60b880"
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
            <Text className="text-white font-semibold text-base">Salvar Vacina</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
