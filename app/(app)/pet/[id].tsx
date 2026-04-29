import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  FlatList,
  Platform,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatDateISO, getAge } from "@/lib/utils";
import type { Pet, Vaccine, Medication, Procedure, SymptomLog } from "@/types";

const SEX_LABEL: Record<string, string> = { male: "Macho", female: "Fêmea" };
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
  const [activeTab, setActiveTab] = useState<Tab>("vaccines");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (id) {
      setDeleting(false);
      setConfirmDelete(false);
      fetchData();
    }
  }, [id]);

  async function fetchData() {
    const [petRes, vaccinesRes, medsRes, procsRes, logsRes] = await Promise.all([
      supabase.from("pets").select("*").eq("id", id).single(),
      supabase.from("vaccines").select("*").eq("pet_id", id).order("applied_at", { ascending: false }),
      supabase.from("medications").select("*").eq("pet_id", id).order("started_at", { ascending: false }),
      supabase.from("procedures").select("*").eq("pet_id", id).order("performed_at", { ascending: false }),
      supabase.from("symptom_logs").select("*").eq("pet_id", id).order("noted_at", { ascending: false }),
    ]);

    if (petRes.error) Alert.alert("Erro", petRes.error.message);
    else setPet(petRes.data);

    setVaccines(vaccinesRes.data ?? []);
    setMedications(medsRes.data ?? []);
    setProcedures(procsRes.data ?? []);
    setLogs(logsRes.data ?? []);
    setLoading(false);
  }


  function getEmergencyUrl() {
    const base = process.env.EXPO_PUBLIC_SUPABASE_URL?.includes("supabase.co")
      ? "https://augenda.app"
      : "http://localhost:8081";
    return `${base}/emergency/${id}`;
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#7da87b" size="large" />
      </SafeAreaView>
    );
  }

  if (!pet) return null;

  const SPECIES_ICON = pet.species === "dog" ? "🐶" : "🐱";

  return (
    <SafeAreaView className="flex-1 bg-cream">
      {/* Header */}
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace("/(app)")} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#527558" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700 flex-1">{pet.name}</Text>
        {user?.id === pet.user_id && (
          <View className="flex-row items-center gap-1">
            {confirmDelete ? (
              <>
                <Text className="text-sage-500 text-xs mr-1">Deletar?</Text>
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
                  className="border border-sage-300 rounded-lg px-3 py-1"
                >
                  <Text className="text-sage-600 text-xs font-semibold">Não</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => router.push(`/(app)/pet/${id}/edit` as any)} className="p-1">
                  <Ionicons name="create-outline" size={22} color="#527558" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmDelete(true)} className="p-1">
                  <Ionicons name="trash-outline" size={22} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push(`/(app)/pet/${id}/share`)} className="p-1">
                  <Ionicons name="people-outline" size={22} color="#527558" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

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

        {pet.emergency_card_enabled && (
          <TouchableOpacity
            onPress={shareEmergencyCard}
            className="mt-4 pt-4 border-t border-sage-100 flex-row items-center gap-2"
          >
            <View className="bg-red-50 rounded-full p-1">
              <Ionicons name="medical" size={14} color="#ef4444" />
            </View>
            <Text className="text-red-400 text-xs font-medium flex-1">Cartão de emergência ativo</Text>
            <Ionicons name="share-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
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
      <View className="flex-1 px-5">
        {activeTab === "vaccines" && (
          <>
            <TouchableOpacity
              className="bg-sage-400 rounded-xl py-3 flex-row items-center justify-center mb-3"
              onPress={() => router.push(`/(app)/pet/${id}/add-vaccine`)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text className="text-white font-medium ml-1">Registrar vacina</Text>
            </TouchableOpacity>

            {vaccines.length === 0 ? (
              <View className="items-center mt-8">
                <Text className="text-sage-300 text-lg">Nenhuma vacina registrada</Text>
              </View>
            ) : (
              <FlatList
                data={vaccines}
                keyExtractor={(v) => v.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View className="bg-white rounded-xl p-4 mb-2 shadow-sm">
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
                        <Ionicons name="calendar-outline" size={12} color="#7da87b" />
                        <Text className="text-sage-500 text-xs ml-1">
                          Próxima dose: {formatDateISO(item.next_dose_at)}
                        </Text>
                      </View>
                    )}
                    {item.notes && (
                      <Text className="text-sage-400 text-xs mt-1">{item.notes}</Text>
                    )}
                  </View>
                )}
              />
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
              <FlatList
                data={medications}
                keyExtractor={(m) => m.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View className="bg-white rounded-xl p-4 mb-2 shadow-sm">
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
                    <View className="mt-2 pt-2 border-t border-sage-100 flex-row gap-4">
                      <Text className="text-sage-400 text-xs">Início: {formatDateISO(item.started_at)}</Text>
                      {item.ends_at && (
                        <Text className="text-sage-400 text-xs">Fim: {formatDateISO(item.ends_at)}</Text>
                      )}
                    </View>
                  </View>
                )}
              />
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
              <FlatList
                data={procedures}
                keyExtractor={(p) => p.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View className="bg-white rounded-xl p-4 mb-2 shadow-sm">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-0.5">
                          <View className="bg-sage-100 px-2 py-0.5 rounded-full">
                            <Text className="text-sage-600 text-xs font-medium">
                              {PROCEDURE_TYPE_LABEL[item.type]}
                            </Text>
                          </View>
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
                  </View>
                )}
              />
            )}
          </>
        )}

        {activeTab === "logs" && (
          <>
            <TouchableOpacity
              className="bg-sage-400 rounded-xl py-3 flex-row items-center justify-center mb-3"
              onPress={() => router.push(`/(app)/pet/${id}/add-log` as any)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text className="text-white font-medium ml-1">Nova anotação</Text>
            </TouchableOpacity>

            {logs.length === 0 ? (
              <View className="items-center mt-8">
                <Text className="text-sage-300 text-lg">Nenhuma anotação registrada</Text>
              </View>
            ) : (
              <FlatList
                data={logs}
                keyExtractor={(l) => l.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const sev = SEVERITY_CONFIG[item.severity];
                  const d = new Date(item.noted_at);
                  const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
                  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                  return (
                    <View className="bg-white rounded-xl p-4 mb-2 shadow-sm">
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
                }}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
