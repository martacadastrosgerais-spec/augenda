import { useState } from "react";
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
import { useAuth } from "@/lib/auth";
import { FormError } from "@/components/FormError";
import { formatDateInput, parseDateBR } from "@/lib/utils";
import { scheduleLocalReminder, buildReminderDate } from "@/lib/notifications";

const RESTOCK_OPTIONS = [
  { label: "3 dias antes", value: 3 },
  { label: "7 dias antes", value: 7 },
  { label: "15 dias antes", value: 15 },
  { label: "30 dias antes", value: 30 },
];

export default function AddMedicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [restockEnabled, setRestockEnabled] = useState(false);
  const [restockDays, setRestockDays] = useState(7);
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

    if (restockEnabled && !ends) {
      setError("Informe a data de fim para ativar o lembrete de recompra.");
      return;
    }

    setLoading(true);

    const { error: dbError, data: med } = await supabase.from("medications").insert({
      pet_id: id,
      name: name.trim(),
      dose: dose.trim() || null,
      frequency: frequency.trim() || null,
      started_at: started,
      ends_at: ends,
      notes: notes.trim() || null,
      active: true,
      restock_reminder_days: restockEnabled ? restockDays : null,
    }).select().single();

    if (dbError) {
      setLoading(false);
      setError("Não foi possível salvar. Tente novamente.");
      return;
    }

    // Criar lembrete de recompra se ativado
    if (restockEnabled && ends && user) {
      const [year, month, day] = ends.split("-").map(Number);
      const alertDate = new Date(year, month - 1, day - restockDays);
      alertDate.setHours(9, 0, 0, 0);

      if (alertDate > new Date()) {
        const localId = await scheduleLocalReminder({
          title: `Recomprar: ${name.trim()}`,
          body: `Faltam ${restockDays} dias para acabar. Hora de comprar mais!`,
          date: alertDate,
          recurrence: "once",
        });

        await supabase.from("reminders").insert({
          pet_id: id,
          user_id: user.id,
          title: `Recomprar: ${name.trim()}`,
          type: "medication",
          scheduled_date: alertDate.toISOString().split("T")[0],
          time_of_day: "09:00:00",
          recurrence: "once",
          notes: `Lembrete automático: ${restockDays} dias antes do fim do tratamento`,
          local_notification_id: localId,
          enabled: localId !== null,
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
                placeholderTextColor="#60b880"
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
                placeholderTextColor="#60b880"
                value={value}
                onChangeText={(t) => { set(formatDateInput(t)); setError(null); }}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          ))}

          <View className="mb-4">
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

        {/* Lembrete de recompra */}
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
            Receba um aviso antes de o medicamento acabar para comprar mais.
          </Text>

          {restockEnabled && (
            <View>
              <Text className="text-sm text-sage-600 mb-2 font-medium">Avisar com quanto tempo de antecedência?</Text>
              <View className="flex-row flex-wrap gap-2">
                {RESTOCK_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setRestockDays(opt.value)}
                    className={`px-3 py-2 rounded-xl border ${
                      restockDays === opt.value ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"
                    }`}
                  >
                    <Text className={`text-sm font-medium ${restockDays === opt.value ? "text-white" : "text-sage-600"}`}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View className="mt-3 bg-sage-50 rounded-xl p-3 flex-row items-start gap-2">
                <Ionicons name="information-circle-outline" size={15} color="#165c39" />
                <Text className="text-sage-600 text-xs flex-1">
                  O lembrete será criado automaticamente e também aparecerá na tela de Agenda.
                </Text>
              </View>
            </View>
          )}
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
