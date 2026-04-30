import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { FormError } from "@/components/FormError";
import { formatDateInput, parseDateBR } from "@/lib/utils";
import { scheduleLocalReminder, buildReminderDate } from "@/lib/notifications";
import type { ProcedureType, ReminderType, ReminderRecurrence } from "@/types";

type EventKind = "vaccine" | "medication" | "procedure" | "reminder";

interface PetOption { id: string; name: string; species: string; }

const KIND_OPTIONS: { value: EventKind; label: string; icon: string; color: string; activeColor: string }[] = [
  { value: "vaccine",    label: "Vacina",        icon: "shield-checkmark-outline", color: "border-blue-200",   activeColor: "bg-blue-500 border-blue-500" },
  { value: "medication", label: "Medicamento",   icon: "medical-outline",          color: "border-amber-200",  activeColor: "bg-amber-500 border-amber-500" },
  { value: "procedure",  label: "Procedimento",  icon: "document-text-outline",    color: "border-purple-200", activeColor: "bg-purple-500 border-purple-500" },
  { value: "reminder",   label: "Lembrete",      icon: "notifications-outline",    color: "border-sage-200",   activeColor: "bg-sage-400 border-sage-400" },
];

const PROCEDURE_TYPES: { value: ProcedureType; label: string }[] = [
  { value: "consultation", label: "Consulta" },
  { value: "exam",         label: "Exame" },
  { value: "surgery",      label: "Cirurgia" },
  { value: "other",        label: "Outro" },
];

const RECURRENCE_OPTIONS: { value: ReminderRecurrence; label: string }[] = [
  { value: "once",    label: "Uma vez" },
  { value: "daily",   label: "Diário" },
  { value: "weekly",  label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly",  label: "Anual" },
];

const SPECIES_ICON: Record<string, string> = { dog: "🐶", cat: "🐱" };

export default function NewEventScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [pets, setPets] = useState<PetOption[]>([]);
  const [loadingPets, setLoadingPets] = useState(true);
  const [selectedPetIds, setSelectedPetIds] = useState<Set<string>>(new Set());

  const [kind, setKind] = useState<EventKind>("vaccine");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Vacina ──
  const [vacName, setVacName] = useState("");
  const [vacAppliedAt, setVacAppliedAt] = useState("");
  const [vacNextDose, setVacNextDose] = useState("");
  const [vacVet, setVacVet] = useState("");
  const [vacNotes, setVacNotes] = useState("");

  // ── Medicamento ──
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medFrequency, setMedFrequency] = useState("");
  const [medStartedAt, setMedStartedAt] = useState("");
  const [medEndsAt, setMedEndsAt] = useState("");
  const [medNotes, setMedNotes] = useState("");

  // ── Procedimento ──
  const [procType, setProcType] = useState<ProcedureType>("consultation");
  const [procTitle, setProcTitle] = useState("");
  const [procDate, setProcDate] = useState("");
  const [procVet, setProcVet] = useState("");
  const [procDesc, setProcDesc] = useState("");

  // ── Lembrete ──
  const [remTitle, setRemTitle] = useState("");
  const [remType, setRemType] = useState<ReminderType>("custom");
  const [remDate, setRemDate] = useState("");
  const [remTime, setRemTime] = useState("09:00");
  const [remRecurrence, setRemRecurrence] = useState<ReminderRecurrence>("once");
  const [remNotes, setRemNotes] = useState("");
  const [remNotify, setRemNotify] = useState(true);

  useEffect(() => { loadPets(); }, []);

  async function loadPets() {
    if (!user) return;
    const [ownedRes, memberRes] = await Promise.all([
      supabase.from("pets").select("id, name, species").eq("user_id", user.id).order("name"),
      supabase.from("pet_members").select("pet_id, pets(id, name, species)").eq("user_id", user.id),
    ]);
    const map: Record<string, PetOption> = {};
    (ownedRes.data ?? []).forEach((p) => { map[p.id] = p; });
    (memberRes.data ?? []).forEach((m: any) => { if (m.pets) map[m.pets.id] = m.pets; });
    const list = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    setPets(list);
    if (list.length === 1) setSelectedPetIds(new Set([list[0].id]));
    setLoadingPets(false);
  }

  function togglePet(petId: string) {
    setSelectedPetIds((prev) => {
      const next = new Set(prev);
      if (next.has(petId)) next.delete(petId);
      else next.add(petId);
      return next;
    });
  }

  function formatTimeInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  async function handleSave() {
    setError(null);
    const petIds = Array.from(selectedPetIds);
    if (petIds.length === 0) { setError("Selecione pelo menos um pet."); return; }

    if (kind === "vaccine") {
      if (!vacName.trim()) { setError("Informe o nome da vacina."); return; }
      const applied = parseDateBR(vacAppliedAt);
      if (!applied) { setError("Data de aplicação inválida. Use DD/MM/AAAA."); return; }
      const nextDose = vacNextDose ? parseDateBR(vacNextDose) : null;
      if (vacNextDose && !nextDose) { setError("Data da próxima dose inválida."); return; }

      setLoading(true);
      await Promise.all(petIds.map((petId) =>
        supabase.from("vaccines").insert({
          pet_id: petId, name: vacName.trim(), applied_at: applied,
          next_dose_at: nextDose, vet_name: vacVet.trim() || null, notes: vacNotes.trim() || null,
        })
      ));
    }

    else if (kind === "medication") {
      if (!medName.trim()) { setError("Informe o nome do medicamento."); return; }
      const started = parseDateBR(medStartedAt);
      if (!started) { setError("Data de início inválida. Use DD/MM/AAAA."); return; }
      const ends = medEndsAt ? parseDateBR(medEndsAt) : null;
      if (medEndsAt && !ends) { setError("Data de fim inválida."); return; }

      setLoading(true);
      await Promise.all(petIds.map((petId) =>
        supabase.from("medications").insert({
          pet_id: petId, name: medName.trim(), dose: medDose.trim() || null,
          frequency: medFrequency.trim() || null, started_at: started,
          ends_at: ends, notes: medNotes.trim() || null, active: true,
        })
      ));
    }

    else if (kind === "procedure") {
      if (!procTitle.trim()) { setError("Informe o título do procedimento."); return; }
      const date = parseDateBR(procDate);
      if (!date) { setError("Data inválida. Use DD/MM/AAAA."); return; }

      setLoading(true);
      await Promise.all(petIds.map((petId) =>
        supabase.from("procedures").insert({
          pet_id: petId, type: procType, title: procTitle.trim(),
          performed_at: date, vet_name: procVet.trim() || null, description: procDesc.trim() || null,
        })
      ));
    }

    else if (kind === "reminder") {
      if (!remTitle.trim()) { setError("Informe o título do lembrete."); return; }
      const date = parseDateBR(remDate);
      if (!date) { setError("Data inválida. Use DD/MM/AAAA."); return; }
      const [h, m] = remTime.split(":").map(Number);
      if (isNaN(h) || isNaN(m) || h > 23 || m > 59) { setError("Horário inválido."); return; }

      setLoading(true);
      await Promise.all(petIds.map(async (petId) => {
        let localNotificationId: string | null = null;
        if (remNotify && Platform.OS !== "web") {
          const reminderDate = buildReminderDate(date, remTime);
          localNotificationId = await scheduleLocalReminder({
            title: remTitle.trim(),
            body: pets.find((p) => p.id === petId)?.name ?? "",
            date: reminderDate,
            recurrence: remRecurrence,
          });
        }
        return supabase.from("reminders").insert({
          pet_id: petId, user_id: user!.id, title: remTitle.trim(),
          type: remType, scheduled_date: date, time_of_day: remTime + ":00",
          recurrence: remRecurrence, enabled: true, notes: remNotes.trim() || null,
          local_notification_id: localNotificationId,
        });
      }));
    }

    setLoading(false);
    router.replace("/(app)/calendar");
  }

  const kindCfg = KIND_OPTIONS.find((k) => k.value === kind)!;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace("/(app)/calendar")} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#527558" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Novo Evento</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Tipo de evento */}
        <View className="mt-4 mb-3">
          <Text className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">Tipo</Text>
          <View className="flex-row flex-wrap gap-2">
            {KIND_OPTIONS.map((opt) => {
              const active = kind === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => { setKind(opt.value); setError(null); }}
                  className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${active ? opt.activeColor : `bg-white ${opt.color}`}`}
                >
                  <Ionicons name={opt.icon as any} size={14} color={active ? "#fff" : "#7da87b"} />
                  <Text className={`text-sm font-medium ${active ? "text-white" : "text-sage-600"}`}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Seleção de pets */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-3">
          <Text className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">
            Aplicar para *
          </Text>
          {loadingPets ? (
            <ActivityIndicator color="#7da87b" />
          ) : pets.length === 0 ? (
            <Text className="text-sage-400 text-sm">Nenhum pet cadastrado.</Text>
          ) : (
            <View className="gap-2">
              {pets.map((pet) => {
                const selected = selectedPetIds.has(pet.id);
                return (
                  <TouchableOpacity
                    key={pet.id}
                    onPress={() => togglePet(pet.id)}
                    className={`flex-row items-center gap-3 px-3 py-2.5 rounded-xl border ${
                      selected ? "bg-sage-50 border-sage-300" : "bg-white border-sage-100"
                    }`}
                  >
                    <Text className="text-lg">{SPECIES_ICON[pet.species] ?? "🐾"}</Text>
                    <Text className={`flex-1 font-medium text-sm ${selected ? "text-sage-800" : "text-sage-500"}`}>
                      {pet.name}
                    </Text>
                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      selected ? "bg-sage-400 border-sage-400" : "border-sage-300"
                    }`}>
                      {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Formulário dinâmico */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-3">
          <FormError message={error} />

          {/* ── VACINA ── */}
          {kind === "vaccine" && (
            <>
              <Field label="Nome da vacina *" value={vacName} onChange={(v) => { setVacName(v); setError(null); }} placeholder="Ex: V10, Antirrábica..." />
              <Field label="Veterinário" value={vacVet} onChange={setVacVet} placeholder="Nome do vet" />
              <DateField label="Data de aplicação *" value={vacAppliedAt} onChange={(v) => { setVacAppliedAt(v); setError(null); }} />
              <DateField label="Próxima dose" value={vacNextDose} onChange={(v) => { setVacNextDose(v); setError(null); }} />
              <TextAreaField label="Observações" value={vacNotes} onChange={setVacNotes} />
            </>
          )}

          {/* ── MEDICAMENTO ── */}
          {kind === "medication" && (
            <>
              <Field label="Nome do medicamento *" value={medName} onChange={(v) => { setMedName(v); setError(null); }} placeholder="Ex: Bravecto, Simparica..." />
              <Field label="Dose" value={medDose} onChange={setMedDose} placeholder="Ex: 1 comprimido" />
              <Field label="Frequência" value={medFrequency} onChange={setMedFrequency} placeholder="Ex: 1x ao dia, a cada 3 meses..." />
              <DateField label="Data de início *" value={medStartedAt} onChange={(v) => { setMedStartedAt(v); setError(null); }} />
              <DateField label="Data de fim" value={medEndsAt} onChange={(v) => { setMedEndsAt(v); setError(null); }} />
              <TextAreaField label="Observações" value={medNotes} onChange={setMedNotes} />
            </>
          )}

          {/* ── PROCEDIMENTO ── */}
          {kind === "procedure" && (
            <>
              <View className="mb-4">
                <Text className="text-sm text-sage-600 mb-2 font-medium">Tipo de procedimento</Text>
                <View className="flex-row flex-wrap gap-2">
                  {PROCEDURE_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => setProcType(t.value)}
                      className={`px-3 py-2 rounded-xl border ${
                        procType === t.value ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"
                      }`}
                    >
                      <Text className={`text-sm font-medium ${procType === t.value ? "text-white" : "text-sage-600"}`}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Field label="Título *" value={procTitle} onChange={(v) => { setProcTitle(v); setError(null); }} placeholder="Ex: Consulta de rotina, Hemograma..." />
              <DateField label="Data *" value={procDate} onChange={(v) => { setProcDate(v); setError(null); }} />
              <Field label="Veterinário" value={procVet} onChange={setProcVet} placeholder="Nome do veterinário" />
              <TextAreaField label="Observações" value={procDesc} onChange={setProcDesc} />
            </>
          )}

          {/* ── LEMBRETE ── */}
          {kind === "reminder" && (
            <>
              <Field label="Título *" value={remTitle} onChange={(v) => { setRemTitle(v); setError(null); }} placeholder="Ex: Dar antiparasitário, Vacina anual..." />

              <View className="mb-4">
                <Text className="text-sm text-sage-600 mb-2 font-medium">Categoria</Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { value: "vaccine" as ReminderType, label: "Vacina" },
                    { value: "medication" as ReminderType, label: "Medicamento" },
                    { value: "procedure" as ReminderType, label: "Procedimento" },
                    { value: "custom" as ReminderType, label: "Personalizado" },
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => setRemType(t.value)}
                      className={`px-3 py-2 rounded-xl border ${
                        remType === t.value ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"
                      }`}
                    >
                      <Text className={`text-sm font-medium ${remType === t.value ? "text-white" : "text-sage-600"}`}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-sm text-sage-600 mb-1 font-medium">Data *</Text>
                  <TextInput
                    className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#a8c5ad"
                    value={remDate}
                    onChangeText={(v) => { setRemDate(formatDateInput(v)); setError(null); }}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <View className="w-28">
                  <Text className="text-sm text-sage-600 mb-1 font-medium">Hora</Text>
                  <TextInput
                    className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                    placeholder="HH:MM"
                    placeholderTextColor="#a8c5ad"
                    value={remTime}
                    onChangeText={(v) => { setRemTime(formatTimeInput(v)); setError(null); }}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm text-sage-600 mb-2 font-medium">Recorrência</Text>
                <View className="flex-row flex-wrap gap-2">
                  {RECURRENCE_OPTIONS.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      onPress={() => setRemRecurrence(r.value)}
                      className={`px-3 py-2 rounded-xl border ${
                        remRecurrence === r.value ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"
                      }`}
                    >
                      <Text className={`text-sm font-medium ${remRecurrence === r.value ? "text-white" : "text-sage-600"}`}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {Platform.OS !== "web" && (
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-sm text-sage-600 font-medium">Notificação</Text>
                  <Switch
                    value={remNotify}
                    onValueChange={setRemNotify}
                    trackColor={{ false: "#e6ede7", true: "#7da87b" }}
                    thumbColor="#fff"
                  />
                </View>
              )}

              <TextAreaField label="Observações" value={remNotes} onChange={setRemNotes} />
            </>
          )}
        </View>

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mb-8"
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-semibold text-base">
              Salvar{selectedPetIds.size > 1 ? ` para ${selectedPetIds.size} pets` : ""}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Componentes de campo reutilizáveis ──────────────────────────────────────

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm text-sage-600 mb-1 font-medium">{label}</Text>
      <TextInput
        className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
        placeholder={placeholder}
        placeholderTextColor="#a8c5ad"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

function DateField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm text-sage-600 mb-1 font-medium">{label}</Text>
      <TextInput
        className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
        placeholder="DD/MM/AAAA"
        placeholderTextColor="#a8c5ad"
        value={value}
        onChangeText={(t) => onChange(formatDateInput(t))}
        keyboardType="numeric"
        maxLength={10}
      />
    </View>
  );
}

function TextAreaField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <View className="mb-2">
      <Text className="text-sm text-sage-600 mb-1 font-medium">{label}</Text>
      <TextInput
        className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
        placeholder="Observações opcionais"
        placeholderTextColor="#a8c5ad"
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={3}
        style={{ minHeight: 72, textAlignVertical: "top" }}
      />
    </View>
  );
}
