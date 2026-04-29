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
import type { ProcedureType } from "@/types";

const TYPES: { value: ProcedureType; label: string; icon: string }[] = [
  { value: "consultation", label: "Consulta", icon: "medical-outline" },
  { value: "exam", label: "Exame", icon: "document-text-outline" },
  { value: "surgery", label: "Cirurgia", icon: "cut-outline" },
  { value: "other", label: "Outro", icon: "ellipsis-horizontal-outline" },
];

export default function AddProcedureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [type, setType] = useState<ProcedureType>("consultation");
  const [title, setTitle] = useState("");
  const [performedAt, setPerformedAt] = useState("");
  const [vetName, setVetName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!title.trim()) { setError("Informe o título do procedimento."); return; }
    const parsedDate = parseDateBR(performedAt);
    if (!parsedDate) { setError("Data inválida. Use DD/MM/AAAA."); return; }

    setLoading(true);
    const { error: dbError } = await supabase.from("procedures").insert({
      pet_id: id,
      type,
      title: title.trim(),
      performed_at: parsedDate,
      vet_name: vetName.trim() || null,
      description: description.trim() || null,
    });
    setLoading(false);

    if (dbError) {
      setError("Não foi possível salvar. Tente novamente.");
      console.error("[AddProcedure]", dbError);
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
        <Text className="text-xl font-bold text-sage-700">Novo Procedimento</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <FormError message={error} />

          {/* Tipo */}
          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-2 font-medium">Tipo *</Text>
            <View className="flex-row flex-wrap gap-2">
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setType(t.value)}
                  className={`flex-row items-center gap-1 px-3 py-2 rounded-xl border ${
                    type === t.value ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"
                  }`}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={14}
                    color={type === t.value ? "#fff" : "#7da87b"}
                  />
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
              placeholder="Ex: Consulta de rotina, Hemograma..."
              placeholderTextColor="#a8c5ad"
              value={title}
              onChangeText={(v) => { setTitle(v); setError(null); }}
            />
          </View>

          {/* Data */}
          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Data *</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#a8c5ad"
              value={performedAt}
              onChangeText={(t) => { setPerformedAt(formatDateInput(t)); setError(null); }}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          {/* Veterinário */}
          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Veterinário</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Nome do veterinário"
              placeholderTextColor="#a8c5ad"
              value={vetName}
              onChangeText={setVetName}
            />
          </View>

          {/* Descrição */}
          <View className="mb-2">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Observações</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Detalhes, resultados, observações..."
              placeholderTextColor="#a8c5ad"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>
        </View>

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mt-4 mb-8"
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-semibold text-base">Salvar Procedimento</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
