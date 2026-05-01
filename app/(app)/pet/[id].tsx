import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Platform,
  Share,
  TextInput,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatDateISO, getAge } from "@/lib/utils";
import type { Pet, Vaccine, Medication, MedicationDose, Procedure, SymptomLog, ChronicCondition, Incident, IncidentCategory, Attachment, GroomingLog, GroomingType } from "@/types";


const SEX_LABEL: Record<string, string> = { male: "Macho", female: "Fêmea" };

const INCIDENT_CONFIG: Record<IncidentCategory, { label: string; icon: string; color: string; bg: string }> = {
  vomit:            { label: "Vômito",          icon: "🤢", color: "text-amber-600",  bg: "bg-amber-50"  },
  diarrhea:         { label: "Diarreia",        icon: "💩", color: "text-orange-600", bg: "bg-orange-50" },
  wound:            { label: "Ferida / Lesão",  icon: "🩹", color: "text-red-600",    bg: "bg-red-50"    },
  behavior:         { label: "Comportamento",   icon: "😰", color: "text-blue-600",   bg: "bg-blue-50"   },
  allergy_reaction: { label: "Reação alérgica", icon: "🤧", color: "text-purple-600", bg: "bg-purple-50" },
  other:            { label: "Outro",           icon: "❓", color: "text-sage-600",   bg: "bg-sage-50"   },
};
const GROOMING_CONFIG: Record<GroomingType, { label: string; icon: string }> = {
  bath:     { label: "Banho",        icon: "water-outline" },
  grooming: { label: "Tosa",         icon: "cut-outline" },
  both:     { label: "Banho + Tosa", icon: "sparkles-outline" },
};

const SEVERITY_CONFIG = {
  low:    { label: "Normal",  color: "bg-sage-100",  textColor: "text-sage-600" },
  medium: { label: "Atenção", color: "bg-amber-100", textColor: "text-amber-600" },
  high:   { label: "Urgente", color: "bg-red-100",   textColor: "text-red-600" },
} as const;

type Tab = "vaccines" | "medications" | "procedures" | "logs";

const PROCEDURE_TYPE_LABEL: Record<string, string> = {
  consultation: "Consulta",
  surgery: "Cirurgia",
  exam: "Exame",
  other: "Outro",
};

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [pet, setPet] = useState<Pet | null>(null);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [groomingLogs, setGroomingLogs] = useState<GroomingLog[]>([]);
  const [conditions, setConditions] = useState<ChronicCondition[]>([]);
  const [lastDoses, setLastDoses] = useState<Record<string, string>>({});
  const [addingCondition, setAddingCondition] = useState(false);
  const [newConditionName, setNewConditionName] = useState("");
  const [savingCondition, setSavingCondition] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("vaccines");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [mlQuery, setMlQuery] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        setDeleting(false);
        setConfirmDelete(false);
        fetchData();
      }
    }, [id])
  );

  async function fetchData() {
    const [petRes, vaccinesRes, medsRes, procsRes, logsRes, condRes, dosesRes, incidentsRes, groomingRes] = await Promise.all([
      supabase.from("pets").select("*").eq("id", id).single(),
      supabase.from("vaccines").select("*").eq("pet_id", id).order("applied_at", { ascending: false }),
      supabase.from("medications").select("*").eq("pet_id", id).order("started_at", { ascending: false }),
      supabase.from("procedures").select("*, attachments(*)").eq("pet_id", id).order("performed_at", { ascending: false }),
      supabase.from("symptom_logs").select("*").eq("pet_id", id).order("noted_at", { ascending: false }),
      supabase.from("chronic_conditions").select("*").eq("pet_id", id).order("created_at"),
      supabase.from("medication_doses").select("medication_id, administered_at").eq("pet_id", id).order("administered_at", { ascending: false }),
      supabase.from("incidents").select("*").eq("pet_id", id).order("occurred_at", { ascending: false }),
      supabase.from("grooming_logs").select("*").eq("pet_id", id).order("performed_at", { ascending: false }),
    ]);

    if (petRes.error) Alert.alert("Erro", petRes.error.message);
    else setPet(petRes.data);

    setVaccines(vaccinesRes.data ?? []);
    setMedications(medsRes.data ?? []);
    setProcedures(procsRes.data ?? []);
    setLogs(logsRes.data ?? []);
    setConditions((condRes as any).data ?? []);
    setIncidents((incidentsRes.data ?? []) as Incident[]);
    setGroomingLogs((groomingRes.data ?? []) as GroomingLog[]);

    const doseMap: Record<string, string> = {};
    for (const d of (dosesRes.data ?? []) as MedicationDose[]) {
      if (!doseMap[d.medication_id]) doseMap[d.medication_id] = d.administered_at;
    }
    setLastDoses(doseMap);

    setLoading(false);
  }


  function getEmergencyUrl() {
    const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? "https://velvety-liger-3bd88f.netlify.app";
    return `${appUrl}/emergency/${id}`;
  }

  async function shareEmergencyCard() {
    const url = getEmergencyUrl();
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.share) {
        navigator.share({ title: `Cartão de emergência — ${pet?.name}`, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => alert("Link copiado!"));
      }
    } else {
      Share.share({ message: `Cartão de emergência de ${pet?.name}: ${url}` });
    }
  }

  function openMlSearch(medName: string) {
    setMlQuery(medName);
  }

  async function saveCondition() {
    if (!newConditionName.trim()) return;
    setSavingCondition(true);
    const { data, error } = await supabase
      .from("chronic_conditions")
      .insert({ pet_id: id, name: newConditionName.trim() })
      .select()
      .single();
    setSavingCondition(false);
    if (!error && data) {
      setConditions((prev) => [...prev, data as ChronicCondition]);
      setNewConditionName("");
      setAddingCondition(false);
    }
  }

  async function deleteCondition(condId: string) {
    await supabase.from("chronic_conditions").delete().eq("id", condId);
    setConditions((prev) => prev.filter((c) => c.id !== condId));
  }

  async function handleDelete() {
    setDeleting(true);
    const { error: delError } = await supabase.from("pets").delete().eq("id", id);
    if (delError) {
      setDeleting(false);
      setConfirmDelete(false);
      return;
    }
    router.replace("/(app)");
  }

  async function handleArchive() {
    await supabase.from("pets").update({ archived: true }).eq("id", id);
    router.replace("/(app)");
  }

  async function handleUnarchive() {
    await supabase.from("pets").update({ archived: false }).eq("id", id);
    setPet((prev) => prev ? { ...prev, archived: false } : prev);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-sage-700 items-center justify-center">
        <ActivityIndicator color="#fff" size="large" />
      </SafeAreaView>
    );
  }

  if (!pet) return null;

  const SPECIES_ICON = pet.species === "dog" ? "🐶" : "🐱";

  return (
    <SafeAreaView className="flex-1 bg-sage-700" edges={["top"]}>
      {/* Header verde escuro */}
      <View className="bg-sage-700 px-5 pt-4 pb-5 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace("/(app)")} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white flex-1">{pet.name}</Text>
        {user?.id === pet.user_id && (
          <View className="flex-row items-center gap-1">
            {confirmDelete ? (
              <>
                <Text className="text-sage-300 text-xs mr-1">Deletar?</Text>
                <TouchableOpacity
                  onPress={handleDelete}
                  disabled={deleting}
                  className="bg-red-500 rounded-lg px-3 py-1"
                >
                  {deleting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text className="text-white text-xs font-semibold">Sim</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setConfirmDelete(false)}
                  className="border border-sage-500 rounded-lg px-3 py-1"
                >
                  <Text className="text-white text-xs font-semibold">Não</Text>
                </TouchableOpacity>
              </>
            ) : confirmArchive ? (
              <>
                <Text className="text-sage-300 text-xs mr-1">Arquivar?</Text>
                <TouchableOpacity onPress={handleArchive} className="bg-amber-500 rounded-lg px-3 py-1">
                  <Text className="text-white text-xs font-semibold">Sim</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmArchive(false)} className="border border-sage-500 rounded-lg px-3 py-1">
                  <Text className="text-white text-xs font-semibold">Não</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => router.push(`/(app)/pet/${id}/edit` as any)} className="p-1">
                  <Ionicons name="create-outline" size={22} color="#fff" />
                </TouchableOpacity>
                {!pet.archived && (
                  <TouchableOpacity onPress={() => setConfirmArchive(true)} className="p-1">
                    <Ionicons name="archive-outline" size={21} color="#fde68a" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setConfirmDelete(true)} className="p-1">
                  <Ionicons name="trash-outline" size={22} color="#fca5a5" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push(`/(app)/pet/${id}/share`)} className="p-1">
                  <Ionicons name="people-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      <ScrollView className="flex-1 bg-cream rounded-t-3xl" style={{ marginTop: -12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={{ height: 16 }} />

      {pet.archived && (
        <View className="mx-5 mb-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex-row items-center gap-3">
          <Ionicons name="archive" size={18} color="#d97706" />
          <Text className="text-amber-700 text-sm flex-1">Este pet está arquivado.</Text>
          <TouchableOpacity onPress={handleUnarchive} className="bg-amber-400 rounded-xl px-3 py-1.5">
            <Text className="text-white text-xs font-semibold">Restaurar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pet info card */}
      <View className="mx-5 bg-white rounded-2xl p-5 shadow-sm mb-4">
        <View className="flex-row items-center">
          {pet.photo_url ? (
            <Image source={{ uri: pet.photo_url }} className="w-20 h-20 rounded-full bg-sage-100" />
          ) : (
            <View className="w-20 h-20 rounded-full bg-sage-100 items-center justify-center">
              <Text className="text-4xl">{SPECIES_ICON}</Text>
            </View>
          )}
          <View className="ml-4 flex-1">
            <Text className="text-xl font-bold text-sage-800">{pet.name}</Text>
            {pet.breed && <Text className="text-sage-500">{pet.breed}</Text>}
            <View className="flex-row flex-wrap gap-x-3 mt-1">
              {pet.birth_date && (
                <Text className="text-sage-400 text-sm">{formatDateISO(pet.birth_date)} • {getAge(pet.birth_date)}</Text>
              )}
              {pet.weight_kg != null && (
                <Text className="text-sage-400 text-sm">{pet.weight_kg} kg</Text>
              )}
              {pet.sex && pet.sex !== "unknown" && (
                <Text className="text-sage-400 text-sm">{SEX_LABEL[pet.sex]}{pet.neutered ? " · Castrado(a)" : ""}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Condições crônicas */}
        <View className="mt-4 pt-4 border-t border-sage-100">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-semibold text-sage-600 uppercase tracking-wide">Condições crônicas</Text>
            {!addingCondition && (
              <TouchableOpacity onPress={() => setAddingCondition(true)} className="p-0.5">
                <Ionicons name="add-circle-outline" size={18} color="#32a060" />
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row flex-wrap gap-2">
            {conditions.map((c) => (
              <View key={c.id} className="bg-purple-50 border border-purple-100 rounded-full px-3 py-1 flex-row items-center gap-1">
                <Text className="text-purple-700 text-xs font-medium">{c.name}</Text>
                <TouchableOpacity onPress={() => deleteCondition(c.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={13} color="#9333ea" />
                </TouchableOpacity>
              </View>
            ))}
            {conditions.length === 0 && !addingCondition && (
              <Text className="text-sage-300 text-xs">Nenhuma registrada</Text>
            )}
          </View>

          {addingCondition && (
            <View className="flex-row items-center gap-2 mt-2">
              <TextInput
                className="flex-1 border border-sage-200 rounded-xl px-3 py-2 text-sage-800 bg-sage-50 text-sm"
                placeholder="Nome da condição..."
                placeholderTextColor="#60b880"
                value={newConditionName}
                onChangeText={setNewConditionName}
                onSubmitEditing={saveCondition}
                autoFocus
                returnKeyType="done"
              />
              <TouchableOpacity onPress={saveCondition} disabled={savingCondition} hitSlop={4}>
                {savingCondition
                  ? <ActivityIndicator size="small" color="#32a060" />
                  : <Ionicons name="checkmark-circle" size={28} color="#32a060" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setAddingCondition(false); setNewConditionName(""); }} hitSlop={4}>
                <Ionicons name="close-circle" size={28} color="#60b880" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {pet.emergency_card_enabled && (
          <View className="mt-4 pt-4 border-t border-sage-100">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="bg-red-50 rounded-full p-1">
                <Ionicons name="medical" size={14} color="#ef4444" />
              </View>
              <Text className="text-red-400 text-xs font-medium flex-1">Cartão de emergência ativo</Text>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setShowQR(true)}
                className="flex-1 flex-row items-center justify-center gap-1 border border-red-200 rounded-xl py-2"
              >
                <Ionicons name="qr-code-outline" size={15} color="#ef4444" />
                <Text className="text-red-400 text-xs font-medium">QR Code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={shareEmergencyCard}
                className="flex-1 flex-row items-center justify-center gap-1 border border-red-200 rounded-xl py-2"
              >
                <Ionicons name="share-outline" size={15} color="#ef4444" />
                <Text className="text-red-400 text-xs font-medium">Compartilhar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row mx-5 bg-white rounded-2xl p-1 shadow-sm mb-4">
        {(["vaccines", "medications", "procedures", "logs"] as Tab[]).map((tab) => {
          const labels = { vaccines: "Vacinas", medications: "Medicam.", procedures: "Proced.", logs: "Diário" };
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              className={`flex-1 py-2 rounded-xl items-center ${active ? "bg-sage-400" : ""}`}
              onPress={() => setActiveTab(tab)}
            >
              <Text className={`text-xs font-medium ${active ? "text-white" : "text-sage-500"}`}>
                {labels[tab]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      <View className="px-5 pb-8">
        {activeTab === "vaccines" && (
          <>
            <View className="flex-row gap-2 mb-3">
              <TouchableOpacity
                className="flex-1 bg-sage-400 rounded-xl py-3 flex-row items-center justify-center"
                onPress={() => router.push(`/(app)/pet/${id}/add-vaccine`)}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="text-white font-medium ml-1">Registrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-sage-700 rounded-xl py-3 flex-row items-center justify-center"
                onPress={() => router.push(`/(app)/pet/${id}/scan-vaccines` as any)}
              >
                <Ionicons name="scan-outline" size={17} color="#fff" />
                <Text className="text-white font-medium ml-1">Ler carteira</Text>
              </TouchableOpacity>
            </View>

            {vaccines.length === 0 ? (
              <View className="items-center mt-8">
                <Text className="text-sage-300 text-lg">Nenhuma vacina registrada</Text>
              </View>
            ) : (
              vaccines.map((item) => (
                <View key={item.id} className="bg-white rounded-xl p-4 mb-2 shadow-sm">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="font-semibold text-sage-800">{item.name}</Text>
                      {item.vet_name && (
                        <Text className="text-sage-500 text-xs mt-0.5">Dr(a). {item.vet_name}</Text>
                      )}
                    </View>
                    <View className="items-end">
                      <Text className="text-sage-400 text-xs">Aplicada</Text>
                      <Text className="text-sage-600 text-sm font-medium">{formatDateISO(item.applied_at)}</Text>
                    </View>
                  </View>
                  {item.next_dose_at && (
                    <View className="mt-2 pt-2 border-t border-sage-100 flex-row items-center">
                      <Ionicons name="calendar-outline" size={12} color="#32a060" />
                      <Text className="text-sage-500 text-xs ml-1">
                        Próxima dose: {formatDateISO(item.next_dose_at)}
                      </Text>
                    </View>
                  )}
                  {item.notes && (
                    <Text className="text-sage-400 text-xs mt-1">{item.notes}</Text>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {activeTab === "medications" && (
          <>
            <TouchableOpacity
              className="bg-sage-400 rounded-xl py-3 flex-row items-center justify-center mb-3"
              onPress={() => router.push(`/(app)/pet/${id}/add-medication`)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text className="text-white font-medium ml-1">Registrar medicamento</Text>
            </TouchableOpacity>

            {medications.length === 0 ? (
              <View className="items-center mt-8">
                <Text className="text-sage-300 text-lg">Nenhum medicamento registrado</Text>
              </View>
            ) : (
              medications.map((item) => (
                <View key={item.id} className="bg-white rounded-xl p-4 mb-2 shadow-sm">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="font-semibold text-sage-800">{item.name}</Text>
                      {item.dose && <Text className="text-sage-500 text-sm">{item.dose}</Text>}
                      {item.frequency && <Text className="text-sage-400 text-xs">{item.frequency}</Text>}
                    </View>
                    <View className={`px-2 py-1 rounded-full ${item.active ? "bg-sage-100" : "bg-gray-100"}`}>
                      <Text className={`text-xs font-medium ${item.active ? "text-sage-600" : "text-gray-400"}`}>
                        {item.active ? "Ativo" : "Encerrado"}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-2 pt-2 border-t border-sage-100 flex-row flex-wrap gap-x-4 gap-y-1 items-center">
                    <Text className="text-sage-400 text-xs">Início: {formatDateISO(item.started_at)}</Text>
                    {item.ends_at ? (
                      <Text className="text-sage-400 text-xs">Fim: {formatDateISO(item.ends_at)}</Text>
                    ) : (
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="infinite-outline" size={11} color="#32a060" />
                        <Text className="text-sage-500 text-xs font-medium">Uso contínuo</Text>
                      </View>
                    )}
                  </View>
                  {lastDoses[item.id] && (
                    <View className="mt-1 flex-row items-center gap-1">
                      <Ionicons name="checkmark-circle-outline" size={12} color="#32a060" />
                      <Text className="text-sage-400 text-xs">
                        Última dose: {formatDateISO(lastDoses[item.id])}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row gap-2 mt-2">
                    {item.active && (
                      <TouchableOpacity
                        onPress={() => router.push({
                          pathname: `/(app)/pet/${id}/add-dose` as any,
                          params: { medicationId: item.id, medicationName: item.name },
                        })}
                        className="flex-1 flex-row items-center justify-center gap-1 border border-sage-200 rounded-xl py-2"
                      >
                        <Ionicons name="add-circle-outline" size={14} color="#165c39" />
                        <Text className="text-sage-600 text-xs font-medium">Registrar dose</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => router.push({
                        pathname: `/(app)/pet/${id}/edit-medication` as any,
                        params: { medicationId: item.id },
                      })}
                      className="flex-1 flex-row items-center justify-center gap-1 border border-sage-200 rounded-xl py-2"
                    >
                      <Ionicons name="create-outline" size={14} color="#165c39" />
                      <Text className="text-sage-600 text-xs font-medium">Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => openMlSearch(item.name)}
                      className="flex-1 flex-row items-center justify-center gap-1 border border-sage-200 rounded-xl py-2"
                    >
                      <Ionicons name="cart-outline" size={14} color="#165c39" />
                      <Text className="text-sage-600 text-xs font-medium">Comprar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === "procedures" && (
          <>
            <TouchableOpacity
              className="bg-sage-400 rounded-xl py-3 flex-row items-center justify-center mb-3"
              onPress={() => router.push(`/(app)/pet/${id}/add-procedure` as any)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text className="text-white font-medium ml-1">Registrar procedimento</Text>
            </TouchableOpacity>

            {procedures.length === 0 ? (
              <View className="items-center mt-8">
                <Text className="text-sage-300 text-lg">Nenhum procedimento registrado</Text>
              </View>
            ) : (
              procedures.map((item) => {
                const attachments = (item.attachments ?? []) as Attachment[];
                return (
                  <View key={item.id} className="bg-white rounded-xl p-4 mb-2 shadow-sm">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-0.5">
                          <View className="bg-sage-100 px-2 py-0.5 rounded-full">
                            <Text className="text-sage-600 text-xs font-medium">
                              {PROCEDURE_TYPE_LABEL[item.type]}
                            </Text>
                          </View>
                          {attachments.length > 0 && (
                            <View className="bg-blue-50 px-2 py-0.5 rounded-full flex-row items-center gap-1">
                              <Ionicons name="attach" size={10} color="#3b82f6" />
                              <Text className="text-blue-500 text-xs font-medium">{attachments.length}</Text>
                            </View>
                          )}
                        </View>
                        <Text className="font-semibold text-sage-800">{item.title}</Text>
                        {item.vet_name && (
                          <Text className="text-sage-500 text-xs mt-0.5">Dr(a). {item.vet_name}</Text>
                        )}
                      </View>
                      <Text className="text-sage-600 text-sm font-medium">
                        {formatDateISO(item.performed_at)}
                      </Text>
                    </View>
                    {item.description && (
                      <Text className="text-sage-400 text-xs mt-2 pt-2 border-t border-sage-100">
                        {item.description}
                      </Text>
                    )}
                    {attachments.length > 0 && (
                      <View className="mt-2 pt-2 border-t border-sage-100 gap-1">
                        {attachments.map((att) => (
                          <TouchableOpacity
                            key={att.id}
                            onPress={() => Linking.openURL(att.file_url)}
                            className="flex-row items-center gap-2 bg-sage-50 rounded-lg px-3 py-2"
                          >
                            <Ionicons
                              name={att.file_type === "application/pdf" ? "document-text-outline" : "image-outline"}
                              size={14}
                              color="#32a060"
                            />
                            <Text className="text-sage-600 text-xs flex-1" numberOfLines={1}>{att.name}</Text>
                            <Ionicons name="open-outline" size={12} color="#60b880" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: `/(app)/pet/${id}/add-document` as any,
                          params: { procedureId: item.id, procedureTitle: item.title },
                        })
                      }
                      className="mt-2 flex-row items-center justify-center gap-1 border border-sage-200 rounded-xl py-2"
                    >
                      <Ionicons name="attach" size={14} color="#165c39" />
                      <Text className="text-sage-600 text-xs font-medium">Anexar documento</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}

        {activeTab === "procedures" && (
          <>
            {/* Grooming section */}
            <View className="flex-row items-center gap-2 mt-2 mb-2">
              <View className="flex-1 h-px bg-sage-100" />
              <Text className="text-xs font-semibold text-sage-400 uppercase tracking-wide">Higiene</Text>
              <View className="flex-1 h-px bg-sage-100" />
            </View>

            <TouchableOpacity
              className="bg-teal-500 rounded-xl py-3 flex-row items-center justify-center mb-3"
              onPress={() =>
                router.push({
                  pathname: `/(app)/pet/${id}/add-grooming` as any,
                  params: { petName: pet.name },
                })
              }
            >
              <Ionicons name="water-outline" size={18} color="#fff" />
              <Text className="text-white font-medium ml-1">Registrar banho / tosa</Text>
            </TouchableOpacity>

            {groomingLogs.length === 0 ? (
              <View className="items-center mt-4 mb-4">
                <Text className="text-sage-300 text-sm">Nenhum registro de higiene</Text>
              </View>
            ) : (
              groomingLogs.map((item) => {
                const cfg = GROOMING_CONFIG[item.type as GroomingType] ?? GROOMING_CONFIG.bath;
                const d = new Date(item.performed_at);
                const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
                return (
                  <View key={item.id} className="bg-white rounded-xl p-4 mb-2 shadow-sm border-l-4 border-teal-300">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-row items-center gap-2">
                        <View className="bg-teal-50 rounded-full p-1.5">
                          <Ionicons name={cfg.icon as any} size={14} color="#0d9488" />
                        </View>
                        <View>
                          <Text className="font-semibold text-sage-800 text-sm">{cfg.label}</Text>
                          {item.groomer_name ? (
                            <Text className="text-sage-500 text-xs">{item.groomer_name}</Text>
                          ) : null}
                        </View>
                      </View>
                      <Text className="text-sage-600 text-xs font-medium">{dateStr}</Text>
                    </View>
                    {item.notes ? (
                      <Text className="text-sage-400 text-xs mt-2 pt-2 border-t border-sage-100">
                        {item.notes}
                      </Text>
                    ) : null}
                    {item.next_at ? (
                      <View className="mt-2 flex-row items-center gap-1">
                        <Ionicons name="calendar-outline" size={11} color="#0d9488" />
                        <Text className="text-teal-600 text-xs">
                          Próxima: {formatDateISO(item.next_at)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </>
        )}

        {activeTab === "logs" && (
          <>
            <View className="flex-row gap-2 mb-3">
              <TouchableOpacity
                className="flex-1 bg-red-400 rounded-xl py-3 flex-row items-center justify-center gap-1"
                onPress={() => router.push(`/(app)/pet/${id}/add-incident` as any)}
              >
                <Text className="text-white text-base">⚠️</Text>
                <Text className="text-white font-medium text-sm">Adversidade</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-sage-400 rounded-xl py-3 flex-row items-center justify-center gap-1"
                onPress={() => router.push(`/(app)/pet/${id}/add-log` as any)}
              >
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text className="text-white font-medium text-sm">Anotação</Text>
              </TouchableOpacity>
            </View>

            {logs.length === 0 && incidents.length === 0 ? (
              <View className="items-center mt-8">
                <Text className="text-sage-300 text-lg">Nenhum registro no diário</Text>
              </View>
            ) : (
              <>
                {incidents.map((item) => {
                  const cfg = INCIDENT_CONFIG[item.category as IncidentCategory] ?? INCIDENT_CONFIG.other;
                  const d = new Date(item.occurred_at);
                  const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
                  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                  return (
                    <View key={item.id} className="bg-white rounded-xl p-4 mb-2 shadow-sm border-l-4 border-red-300">
                      <View className="flex-row items-start justify-between mb-2">
                        <View className={`${cfg.bg} px-2 py-0.5 rounded-full flex-row items-center gap-1`}>
                          <Text className="text-xs">{cfg.icon}</Text>
                          <Text className={`${cfg.color} text-xs font-medium`}>{cfg.label}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-sage-600 text-xs font-medium">{dateStr}</Text>
                          <Text className="text-sage-400 text-xs">{timeStr}</Text>
                        </View>
                      </View>
                      <Text className="text-sage-800 text-sm leading-relaxed">{item.description}</Text>
                      {item.photo_url && (
                        <Image
                          source={{ uri: item.photo_url }}
                          className="w-full rounded-xl mt-3"
                          style={{ height: 160 }}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                  );
                })}

                {logs.map((item) => {
                  const sev = SEVERITY_CONFIG[item.severity];
                  const d = new Date(item.noted_at);
                  const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
                  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                  return (
                    <View key={item.id} className="bg-white rounded-xl p-4 mb-2 shadow-sm">
                      <View className="flex-row items-start justify-between mb-2">
                        <View className={`${sev.color} px-2 py-0.5 rounded-full`}>
                          <Text className={`${sev.textColor} text-xs font-medium`}>{sev.label}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-sage-600 text-xs font-medium">{dateStr}</Text>
                          <Text className="text-sage-400 text-xs">{timeStr}</Text>
                        </View>
                      </View>
                      <Text className="text-sage-800 text-sm leading-relaxed">{item.description}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </View>

      </ScrollView>

      {/* Modal de compra */}
      <Modal
        visible={mlQuery !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setMlQuery(null)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-sage-800 font-bold text-base">Comprar medicamento</Text>
              <TouchableOpacity onPress={() => setMlQuery(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color="#165c39" />
              </TouchableOpacity>
            </View>

            <Text className="text-sage-500 text-xs mb-2">Edite o nome da busca se precisar:</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50 mb-4"
              value={mlQuery ?? ""}
              onChangeText={setMlQuery}
              placeholder="Nome do produto"
              placeholderTextColor="#60b880"
            />

            <TouchableOpacity
              className="bg-[#FFE600] rounded-2xl py-4 flex-row items-center justify-center gap-2 mb-3"
              onPress={() => {
                const q = encodeURIComponent(mlQuery ?? "");
                Linking.openURL(`https://www.mercadolivre.com.br/jm/search?as_word=${q}`);
              }}
            >
              <Text className="text-[#333] font-bold text-base">Buscar no Mercado Livre</Text>
              <Ionicons name="open-outline" size={18} color="#333" />
            </TouchableOpacity>

            <TouchableOpacity
              className="border border-sage-200 rounded-2xl py-3.5 flex-row items-center justify-center gap-2"
              onPress={() => {
                const q = encodeURIComponent(`${mlQuery} para pets comprar`);
                Linking.openURL(`https://www.google.com/search?q=${q}`);
              }}
            >
              <Ionicons name="search-outline" size={16} color="#165c39" />
              <Text className="text-sage-600 font-medium text-sm">Buscar no Google</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* QR Code modal */}
      <Modal
        visible={showQR}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQR(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/60 items-center justify-center"
          activeOpacity={1}
          onPress={() => setShowQR(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View className="bg-white rounded-3xl p-8 mx-6 items-center shadow-xl">
              <View className="flex-row items-center gap-2 mb-4">
                <Ionicons name="medical" size={18} color="#ef4444" />
                <Text className="text-sage-800 font-bold text-lg">Cartão de emergência</Text>
              </View>
              <Text className="text-sage-500 text-sm text-center mb-5">
                Aponte a câmera para acessar{"\n"}o cartão de <Text className="font-semibold">{pet.name}</Text>
              </Text>
              <View className="p-3 bg-white rounded-2xl border border-sage-100">
                <QRCode
                  value={getEmergencyUrl()}
                  size={200}
                  color="#1a1a1a"
                  backgroundColor="#ffffff"
                />
              </View>
              <Text className="text-sage-300 text-xs mt-4 text-center" numberOfLines={1}>
                {getEmergencyUrl()}
              </Text>
              <TouchableOpacity
                onPress={shareEmergencyCard}
                className="mt-4 flex-row items-center gap-2 bg-red-50 rounded-xl px-5 py-3"
              >
                <Ionicons name="share-outline" size={16} color="#ef4444" />
                <Text className="text-red-400 text-sm font-medium">Compartilhar link</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowQR(false)} className="mt-3">
                <Text className="text-sage-400 text-sm">Fechar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
