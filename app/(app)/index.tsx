import { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cacheGet, cacheSet } from "@/lib/cache";
import { FormError } from "@/components/FormError";
import { formatDateISO, getAge } from "@/lib/utils";
import type { Pet } from "@/types";

const SPECIES_LABEL: Record<string, string> = { dog: "Cachorro", cat: "Gato" };
const SPECIES_ICON: Record<string, string> = { dog: "🐶", cat: "🐱" };

type PetListItem = Pet & { isOwner: boolean };

interface AlertItem {
  id: string;
  petName: string;
  petId: string;
  title: string;
  date: string;
  urgency: "overdue" | "today" | "soon";
  type: "vaccine" | "medication" | "procedure" | "reminder";
}

const TYPE_ICON: Record<string, string> = {
  vaccine: "shield-checkmark-outline",
  medication: "medkit-outline",
  procedure: "calendar-outline",
  reminder: "notifications-outline",
};
const TYPE_LABEL: Record<string, string> = {
  vaccine: "Vacina",
  medication: "Medicamento",
  procedure: "Procedimento",
  reminder: "Lembrete",
};
const TYPE_TAB: Record<string, string> = {
  vaccine: "vaccines",
  medication: "medications",
  procedure: "procedures",
  reminder: "vaccines",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatTodayLabel() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

export default function PetsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [pets, setPets] = useState<PetListItem[]>([]);
  const [archivedPets, setArchivedPets] = useState<PetListItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (user) fetchAll();
      else setLoading(false);
    }, [user])
  );

  async function fetchAll() {
    if (!user) return;
    setError(null);
    await Promise.all([fetchPets(), fetchAlerts(), fetchUserName()]);
    setLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }

  async function fetchUserName() {
    const { data } = await supabase.from("profiles").select("email").eq("id", user!.id).single();
    if (data?.email) setUserName(data.email.split("@")[0].split(".")[0]);
  }

  async function fetchPets() {
    const [ownedRes, memberRes] = await Promise.all([
      supabase.from("pets").select("*").eq("user_id", user!.id).eq("archived", false).order("created_at", { ascending: false }),
      supabase.from("pet_members").select("pet_id, pets(*)").eq("user_id", user!.id),
    ]);

    if (ownedRes.error || memberRes.error) {
      const cached = await cacheGet<PetListItem[]>(`pets_${user!.id}`);
      if (cached) { setPets(cached); setIsOffline(true); }
      else setError("Não foi possível carregar os pets.");
      return;
    }

    const ownedList: PetListItem[] = (ownedRes.data ?? []).map((p) => ({ ...p, isOwner: true }));
    const memberList: PetListItem[] = (memberRes.data ?? [])
      .map((m: any) => m.pets).filter(Boolean)
      .filter((p: Pet) => !p.archived)
      .map((p: Pet) => ({ ...p, isOwner: false }));

    const ownedIds = new Set(ownedList.map((p) => p.id));
    const combined = [...ownedList, ...memberList.filter((p) => !ownedIds.has(p.id))];
    setPets(combined);
    setIsOffline(false);
    await cacheSet(`pets_${user!.id}`, combined);
  }

  async function fetchArchivedPets() {
    setLoadingArchived(true);
    const { data } = await supabase.from("pets").select("*").eq("user_id", user!.id).eq("archived", true).order("updated_at", { ascending: false });
    setArchivedPets((data ?? []).map((p) => ({ ...p, isOwner: true })));
    setLoadingArchived(false);
  }

  async function unarchivePet(petId: string) {
    await supabase.from("pets").update({ archived: false }).eq("id", petId);
    setArchivedPets((prev) => prev.filter((p) => p.id !== petId));
    fetchPets();
  }

  async function fetchAlerts() {
    const [ownedRes, memberRes] = await Promise.all([
      supabase.from("pets").select("id, name").eq("user_id", user!.id),
      supabase.from("pet_members").select("pet_id, pets(id, name)").eq("user_id", user!.id),
    ]);

    const petMap: Record<string, string> = {};
    (ownedRes.data ?? []).forEach((p) => { petMap[p.id] = p.name; });
    (memberRes.data ?? []).forEach((m: any) => { if (m.pets) petMap[m.pets.id] = m.pets.name; });

    const petIds = Object.keys(petMap);
    if (petIds.length === 0) { setAlerts([]); return; }

    const today = new Date().toISOString().split("T")[0];
    const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    const [vacRes, medRes, procRes, remRes] = await Promise.all([
      supabase.from("vaccines").select("id, pet_id, name, next_dose_at").in("pet_id", petIds).not("next_dose_at", "is", null).lte("next_dose_at", in7days),
      supabase.from("medications").select("id, pet_id, name, ends_at").in("pet_id", petIds).eq("active", true).not("ends_at", "is", null).lte("ends_at", in7days),
      supabase.from("procedures").select("id, pet_id, title, performed_at").in("pet_id", petIds).gte("performed_at", today).lte("performed_at", in7days),
      supabase.from("reminders").select("id, pet_id, title, scheduled_date, type").in("pet_id", petIds).eq("scheduled_date", today).eq("enabled", true),
    ]);

    const items: AlertItem[] = [];
    (vacRes.data ?? []).forEach((v) => {
      const d = v.next_dose_at!;
      items.push({ id: `vac-${v.id}`, petName: petMap[v.pet_id], petId: v.pet_id, title: v.name, date: d, urgency: d < today ? "overdue" : d === today ? "today" : "soon", type: "vaccine" });
    });
    (medRes.data ?? []).forEach((m) => {
      const d = m.ends_at!;
      items.push({ id: `med-${m.id}`, petName: petMap[m.pet_id], petId: m.pet_id, title: m.name, date: d, urgency: d < today ? "overdue" : d === today ? "today" : "soon", type: "medication" });
    });
    (procRes.data ?? []).forEach((p) => {
      const d = p.performed_at;
      items.push({ id: `proc-${p.id}`, petName: petMap[p.pet_id], petId: p.pet_id, title: p.title, date: d, urgency: d === today ? "today" : "soon", type: "procedure" });
    });
    (remRes.data ?? []).forEach((r) => {
      if (!items.find((i) => i.id === `rem-${r.id}`)) {
        items.push({ id: `rem-${r.id}`, petName: petMap[r.pet_id], petId: r.pet_id, title: r.title, date: today, urgency: "today", type: "reminder" });
      }
    });

    items.sort((a, b) => {
      const order = { overdue: 0, today: 1, soon: 2 };
      if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
      return a.date.localeCompare(b.date);
    });

    setAlerts(items);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#165c39" size="large" />
      </SafeAreaView>
    );
  }

  const overdue = alerts.filter((a) => a.urgency === "overdue");
  const todayAlerts = alerts.filter((a) => a.urgency === "today");
  const soon = alerts.filter((a) => a.urgency === "soon");
  const urgentAlerts = [...overdue, ...todayAlerts];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#165c39" colors={["#165c39"]} />
        }
      >
        {/* Header limpo */}
        <View className="px-5 pt-5 pb-4">
          <Text className="text-sage-400 text-sm capitalize mb-1">{formatTodayLabel()}</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sage-800 text-2xl font-bold">
              {getGreeting()}{userName ? `, ${userName}` : ""} 👋
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(app)/join")}
              className="flex-row items-center gap-1.5 border border-sage-200 rounded-full px-3 py-1.5"
            >
              <Ionicons name="enter-outline" size={14} color="#165c39" />
              <Text className="text-sage-600 text-xs font-medium">Entrar</Text>
            </TouchableOpacity>
          </View>

          {/* Linha de contexto */}
          {alerts.length > 0 && (
            <View className="flex-row items-center gap-2 mt-3 flex-wrap">
              {overdue.length > 0 && (
                <View className="flex-row items-center gap-1 bg-red-50 border border-red-100 rounded-full px-2.5 py-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <Text className="text-red-500 text-xs font-medium">{overdue.length} atrasado{overdue.length !== 1 ? "s" : ""}</Text>
                </View>
              )}
              {todayAlerts.length > 0 && (
                <View className="flex-row items-center gap-1 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <Text className="text-amber-600 text-xs font-medium">{todayAlerts.length} para hoje</Text>
                </View>
              )}
              {soon.length > 0 && (
                <View className="flex-row items-center gap-1 bg-sage-50 border border-sage-200 rounded-full px-2.5 py-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-sage-300" />
                  <Text className="text-sage-500 text-xs font-medium">{soon.length} esta semana</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {isOffline && (
          <View className="mx-5 mb-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 flex-row items-center gap-2">
            <Ionicons name="cloud-offline-outline" size={14} color="#d97706" />
            <Text className="text-amber-600 text-xs flex-1">Sem conexão — dados em cache</Text>
          </View>
        )}
        <FormError message={error} />

        {/* Alertas urgentes */}
        {urgentAlerts.length > 0 && (
          <View className="px-5 mb-5">
            <Text className="text-xs font-semibold text-sage-400 uppercase tracking-widest mb-3">Precisam de atenção</Text>
            <View className="bg-white rounded-2xl overflow-hidden border border-sage-100"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
            >
              {urgentAlerts.slice(0, 5).map((item, i) => {
                const isOverdue = item.urgency === "overdue";
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push(`/(app)/pet/${item.petId}?tab=${TYPE_TAB[item.type]}` as any)}
                    className={`flex-row items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-sage-50" : ""}`}
                  >
                    <View className={`w-9 h-9 rounded-xl items-center justify-center ${isOverdue ? "bg-red-50" : "bg-amber-50"}`}>
                      <Ionicons name={TYPE_ICON[item.type] as any} size={17} color={isOverdue ? "#ef4444" : "#d97706"} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sage-700 text-sm font-semibold" numberOfLines={1}>{item.title}</Text>
                      <Text className="text-sage-400 text-xs mt-0.5">{item.petName} · {TYPE_LABEL[item.type]}</Text>
                    </View>
                    <View className={`px-2 py-0.5 rounded-full ${isOverdue ? "bg-red-50" : "bg-amber-50"}`}>
                      <Text className={`text-xs font-medium ${isOverdue ? "text-red-400" : "text-amber-500"}`}>
                        {isOverdue ? "Atrasado" : "Hoje"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {urgentAlerts.length > 5 && (
                <TouchableOpacity
                  onPress={() => router.push("/(app)/calendar")}
                  className="border-t border-sage-50 px-4 py-3 flex-row items-center justify-center gap-1"
                >
                  <Text className="text-sage-400 text-xs">+{urgentAlerts.length - 5} mais na agenda</Text>
                  <Ionicons name="arrow-forward" size={11} color="#60b880" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Alertas em breve (colapsados) */}
        {soon.length > 0 && (
          <View className="px-5 mb-5">
            <Text className="text-xs font-semibold text-sage-400 uppercase tracking-widest mb-3">Esta semana</Text>
            <View className="bg-white rounded-2xl overflow-hidden border border-sage-100"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
            >
              {soon.slice(0, 3).map((item, i) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => router.push(`/(app)/pet/${item.petId}?tab=${TYPE_TAB[item.type]}` as any)}
                  className={`flex-row items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-sage-50" : ""}`}
                >
                  <View className="w-9 h-9 rounded-xl bg-sage-50 items-center justify-center">
                    <Ionicons name={TYPE_ICON[item.type] as any} size={17} color="#60b880" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sage-700 text-sm font-semibold" numberOfLines={1}>{item.title}</Text>
                    <Text className="text-sage-400 text-xs mt-0.5">{item.petName} · {TYPE_LABEL[item.type]}</Text>
                  </View>
                  <Text className="text-sage-400 text-xs">{formatDateISO(item.date)}</Text>
                </TouchableOpacity>
              ))}
              {soon.length > 3 && (
                <TouchableOpacity
                  onPress={() => router.push("/(app)/calendar")}
                  className="border-t border-sage-50 px-4 py-3 flex-row items-center justify-center gap-1"
                >
                  <Text className="text-sage-400 text-xs">+{soon.length - 3} mais na agenda</Text>
                  <Ionicons name="arrow-forward" size={11} color="#60b880" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Pets */}
        <View className="px-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold text-sage-400 uppercase tracking-widest">Meus Pets</Text>
            <TouchableOpacity
              onPress={() => router.push("/(app)/pet/new")}
              className="flex-row items-center gap-1 bg-sage-400 rounded-full px-3 py-1.5"
              accessibilityLabel="Adicionar novo pet"
            >
              <Ionicons name="add" size={14} color="#fff" />
              <Text className="text-white text-xs font-semibold">Novo pet</Text>
            </TouchableOpacity>
          </View>

          {pets.length === 0 ? (
            <View className="items-center py-12">
              <Text className="text-4xl mb-3">🐾</Text>
              <Text className="text-sage-600 font-semibold text-base text-center">Nenhum pet ainda</Text>
              <Text className="text-sage-400 text-sm text-center mt-1 mb-5">Adicione seu primeiro pet para começar</Text>
              <TouchableOpacity
                onPress={() => router.push("/(app)/pet/new")}
                className="bg-sage-400 rounded-2xl px-6 py-3 flex-row items-center gap-2"
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="text-white font-semibold">Adicionar pet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            pets.map((item) => (
              <TouchableOpacity
                key={item.id}
                className="bg-white rounded-2xl mb-3 flex-row items-center p-4 border border-sage-50"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
                onPress={() => router.push(`/(app)/pet/${item.id}`)}
              >
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={{ width: 56, height: 56, borderRadius: 16 }} />
                ) : (
                  <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "#e8f5ee", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 26 }}>{SPECIES_ICON[item.species]}</Text>
                  </View>
                )}
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sage-800 text-base font-bold">{item.name}</Text>
                    {!item.isOwner && (
                      <View className="bg-sage-100 px-2 py-0.5 rounded-full">
                        <Text className="text-sage-500 text-xs">Compartilhado</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sage-400 text-sm mt-0.5">
                    {SPECIES_LABEL[item.species]}{item.breed ? ` · ${item.breed}` : ""}
                  </Text>
                  {item.birth_date && (
                    <Text className="text-sage-300 text-xs mt-0.5">{getAge(item.birth_date)}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#c8e6d0" />
              </TouchableOpacity>
            ))
          )}

          {/* Arquivados */}
          <TouchableOpacity
            className="flex-row items-center gap-2 py-3 mt-1"
            onPress={() => { if (!showArchived) fetchArchivedPets(); setShowArchived((v) => !v); }}
          >
            <Ionicons name={showArchived ? "chevron-up" : "archive-outline"} size={14} color="#a0c4b0" />
            <Text className="text-sage-300 text-sm">{showArchived ? "Ocultar arquivados" : "Ver pets arquivados"}</Text>
          </TouchableOpacity>

          {showArchived && (
            <View>
              {loadingArchived ? (
                <ActivityIndicator color="#32a060" style={{ marginVertical: 12 }} />
              ) : archivedPets.length === 0 ? (
                <Text className="text-sage-300 text-sm text-center py-4">Nenhum pet arquivado</Text>
              ) : (
                archivedPets.map((item) => (
                  <View key={item.id} className="bg-white/50 rounded-2xl p-4 mb-3 flex-row items-center border border-sage-100">
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#e8f5ee", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                      <Text style={{ fontSize: 22 }}>{SPECIES_ICON[item.species]}</Text>
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-sage-400 font-semibold">{item.name}</Text>
                      <Text className="text-sage-300 text-xs">{SPECIES_LABEL[item.species]}{item.breed ? ` · ${item.breed}` : ""}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => unarchivePet(item.id)}
                      className="border border-sage-200 rounded-xl px-3 py-2 flex-row items-center gap-1"
                    >
                      <Ionicons name="refresh-outline" size={12} color="#32a060" />
                      <Text className="text-sage-500 text-xs font-medium">Restaurar</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
