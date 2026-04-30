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
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { FormError } from "@/components/FormError";
import { formatDateInput, formatDateISO, parseDateBR } from "@/lib/utils";

const RESTOCK_OPTIONS = [
  { label: "3 dias antes", value: 3 },
  { label: "7 dias antes", value: 7 },
  { label: "15 dias antes", value: 15 },
  { label: "30 dias antes", value: 30 },
];

export default function EditMedicationScreen() {
  const { id, medicationId } = useLocalSearchParams<{ id: string; medicationId: string }>();
  const router = useRouter();

  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [continuous, setContinuous] = useState(false);
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [restockEnabled, setRestockEnabled] = useState(false);
  const [restockDays, setRestockDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMedication();
  }, [medicationId]);

  async function loadMedication() {
    const { data, error: dbError } = await supabase
      .from("medications")
      .select("*")
      .eq("id", medicationId)
      .single();

    if (dbError || !data) {
      setError("Não foi possível carregar o medicamento.");
      setLoading(false);
      return;
    }

    setName(data.name ?? "");
    setDose(data.dose ?? "");
    setFrequency(data.frequency ?? "");
    setStartedAt(data.started_at ? formatDateISO(data.started_at) : "");
    setActive(data.active ?? true);
    setNotes(data.notes ?? "");

    if (data.ends_at) {
      setContinuous(false);
      setEndsAt(formatDateISO(data.ends_at));
    } else {
      setContinuous(true);
      setEndsAt("");
    }

    if (data.restock_reminder_days) {
      setRestockEnabled(true);
      setRestockDays(data.restock_reminder_days);
    }

    setLoading(false);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Informe o nome do medicamento."); return; }
    if (!startedAt) { setError("Informe a data de início."); return; }
    const started = parseDateBR(startedAt);
    if (!started) { setError("Data de início inválida. Use DD/MM/AAAA."); return; }
    const ends = (!continuous && endsAt) ? parseDateBR(endsAt) : null;
    if (!continuous && endsAt && !ends) { setError("Data de fim inválida. Use DD/MM/AAAA."); return; }
    if (restockEnabled && !ends) { setError("Lembrete de recompra requer data de fim definida."); return; }

    setSaving(true);

    const { error: dbError } = await supabase
      .from("medications")
      .update({
        name: name.trim(),
        dose: dose.trim() || null,
        frequency: frequency.trim() || null,
        started_at: started,
        ends_at: ends,
        notes: notes.trim() || null,
        active,
        restock_reminder_days: restockEnabled ? restockDays : null,
      })
      .eq("id", medicationId);

    setSaving(false);

    if (dbError) {
      setError("Não foi possível salvar. Tente novamente.");
      return;
    }

    router.replace(`/(app)/pet/${id}` as any);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#32a060" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Editar Medicamento</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <FormError message={error} />

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Nome do medicamento *</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Ex: Bravecto, Simparica..."
              placeholderTextColor="#60b880"
              value={name}
              onChangeText={(v) => { setName(v); setError(null); }}
            />
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm text-sage-600 mb-1 font-medium">Dose</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder="Ex: 1 comprimido"
                placeholderTextColor="#60b880"
                value={dose}
                onChangeText={(v) => { setDose(v); setError(null); }}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-sage-600 mb-1 font-medium">Frequência</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder="Ex: 1x ao dia"
                placeholderTextColor="#60b880"
                value={frequency}
                onChangeText={(v) => { setFrequency(v); setError(null); }}
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Data de início *</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#60b880"
              value={startedAt}
              onChangeText={(t) => { setStartedAt(formatDateInput(t)); setError(null); }}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          <View className="mb-4 flex-row items-center justify-between py-3 px-4 bg-sage-50 rounded-xl border border-sage-100">
            <View className="flex-row items-center gap-2">
              <Ionicons name="infinite-outline" size={18} color="#165c39" />
              <View>
                <Text className="text-sm font-medium text-sage-700">Uso contínuo</Text>
                <Text className="text-xs text-sage-400">Sem previsão de término</Text>
              </View>
            </View>
            <Switch
              value={continuous}
              onValueChange={(v) => {
                setContinuous(v);
                if (v) { setEndsAt(""); setRestockEnabled(false); }
                setError(null);
              }}
              trackColor={{ false: "#cce8d4", true: "#32a060" }}
              thumbColor="#fff"
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          </View>

          {!continuous && (
            <View className="mb-4">
              <Text className="text-sm text-sage-600 mb-1 font-medium">Data de fim</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder="DD/MM/AAAA (opcional)"
                placeholderTextColor="#60b880"
                value={endsAt}
                onChangeText={(t) => { setEndsAt(formatDateInput(t)); setError(null); }}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          )}

          <View className="mb-4 flex-row items-center justify-between py-3 px-4 bg-sage-50 rounded-xl border border-sage-100">
            <View className="flex-row items-center gap-2">
              <Ionicons name={active ? "checkmark-circle-outline" : "close-circle-outline"} size={18} color="#165c39" />
              <View>
                <Text className="text-sm font-medium text-sage-700">Tratamento ativo</Text>
                <Text className="text-xs text-sage-400">{active ? "Em curso" : "Encerrado"}</Text>
              </View>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: "#cce8d4", true: "#32a060" }}
              thumbColor="#fff"
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          </View>

          <View>
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

        {!continuous && (
          <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2">
                <Ionicons name="cart-outline" size={18} color="#165c39" />
                <Text className="text-base font-semibold text-sage-700">Lembrete de recompra</Text>
              </View>
              <Switch
                value={restockEnabled}
                onValueChange={setRestockEnabled}
                trackColor={{ false: "#cce8d4", true: "#32a060" }}
                thumbColor="#fff"
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            </View>
            <Text className="text-sage-400 text-xs mb-3">
              Aviso antes de o medicamento acabar para comprar mais.
            </Text>
            {restockEnabled && (
              <View>
                <Text className="text-sm text-sage-600 mb-2 font-medium">Avisar quantos dias antes?</Text>
                <View className="flex-row flex-wrap gap-2">
                  {RESTOCK_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setRestockDays(opt.value)}
                      className={`px-3 py-2 rounded-xl border ${restockDays === opt.value ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"}`}
                    >
                      <Text className={`text-sm font-medium ${restockDays === opt.value ? "text-white" : "text-sage-600"}`}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mt-4 mb-8"
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-semibold text-base">Salvar alterações</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
