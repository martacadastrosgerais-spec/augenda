import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
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

const TYPE_TAB: Record<string, string> = {
  vaccine: "vaccines",
  medication: "medications",
  procedure: "procedures",
  reminder: "vaccines",
};
const TYPE_LABEL: Record<string, string> = {
  vaccine: "Vacina",
  medication: "Medicamento",
  procedure: "Procedimento",
  reminder: "Lembrete",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatTodayLabel() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
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
    const { data } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user!.id)
      .single();
    if (data?.email) {
      setUserName(data.email.split("@")[0].split(".")[0]);
    }
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
      .map((m: any) => m.pets)
      .filter(Boolean)
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
    const { data } = await supabase
      .from("pets")
      .select("*")
      .eq("user_id", user!.id)
      .eq("archived", true)
      .order("updated_at", { ascending: false });
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
      supabase.from("vaccines").select("id, pet_id, name, next_dose_at")
        .in("pet_id", petIds).not("next_dose_at", "is", null).lte("next_dose_at", in7days),
      supabase.from("medications").select("id, pet_id, name, ends_at")
        .in("pet_id", petIds).eq("active", true).not("ends_at", "is", null).lte("ends_at", in7days),
      supabase.from("procedures").select("id, pet_id, title, performed_at")
        .in("pet_id", petIds).gte("performed_at", today).lte("performed_at", in7days),
      supabase.from("reminders").select("id, pet_id, title, scheduled_date, type")
        .in("pet_id", petIds).eq("scheduled_date", today).eq("enabled", true),
    ]);

    const items: AlertItem[] = [];

    (vacRes.data ?? []).forEach((v) => {
      const d = v.next_dose_at!;
      items.push({ id: `vac-${v.id}`, petName: petMap[v.pet_id], petId: v.pet_id, title: `Vacina: ${v.name}`, date: d, urgency: d < today ? "overdue" : d === today ? "today" : "soon", type: "vaccine" });
    });

    (medRes.data ?? []).forEach((m) => {
      const d = m.ends_at!;
      items.push({ id: `med-${m.id}`, petName: petMap[m.pet_id], petId: m.pet_id, title: `Fim: ${m.name}`, date: d, urgency: d < today ? "overdue" : d === today ? "today" : "soon", type: "medication" });
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
      <SafeAreaView className="flex-1 bg-sage-700 items-center justify-center">
        <ActivityIndicator color="#fff" size="large" />
      </SafeAreaView>
    );
  }

  const overdue = alerts.filter((a) => a.urgency === "overdue");
  const todayAlerts = alerts.filter((a) => a.urgency === "today");
  const soon = alerts.filter((a) => a.urgency === "soon");

  return (
    <SafeAreaView className="flex-1 bg-sage-700" edges={["top"]}>
      {/* Header */}
      <View className="bg-sage-700 px-5 pt-4 pb-5">
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-white/70 text-sm capitalize">{formatTodayLabel()}</Text>
            <Text className="text-white text-2xl font-bold mt-0.5">
              {getGreeting()}{userName ? `, ${userName}` : ""} 👋
            </Text>
          </View>
          <View className="flex-row gap-2 mt-1">
            <TouchableOpacity
              className="border border-sage-500 rounded-full w-10 h-10 items-center justify-center"
              onPress={() => router.push("/(app)/join")}
              accessibilityLabel="Entrar com código de convite"
              accessibilityRole="button"
            >
              <Ionicons name="enter-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-sage-400 rounded-full w-10 h-10 items-center justify-center"
              onPress={() => router.push("/(app)/pet/new")}
              accessibilityLabel="Adicionar novo pet"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats pills */}
        <View className="flex-row gap-2 mt-4">
          <View className="bg-white/10 rounded-full px-3 py-1.5 flex-row items-center gap-1.5">
            <Ionicons name="paw" size={13} color="#fff" />
            <Text className="text-white text-xs font-semibold">{pets.length} pet{pets.length !== 1 ? "s" : ""}</Text>
          </View>
          {overdue.length > 0 && (
            <TouchableOpacity
              className="bg-red-500 rounded-full px-3 py-1.5 flex-row items-center gap-1.5"
              onPress={() => router.push("/(app)/calendar")}
            >
              <Ionicons name="alert-circle" size={13} color="#fff" />
              <Text className="text-white text-xs font-semibold">{overdue.length} atrasado{overdue.length !== 1 ? "s" : ""}</Text>
            </TouchableOpacity>
          )}
          {todayAlerts.length > 0 && (
            <TouchableOpacity
              className="bg-amber-500 rounded-full px-3 py-1.5 flex-row items-center gap-1.5"
              onPress={() => router.push("/(app)/calendar")}
            >
              <Ionicons name="today-outline" size={13} color="#fff" />
              <Text className="text-white text-xs font-semibold">{todayAlerts.length} hoje</Text>
            </TouchableOpacity>
          )}
          {soon.length > 0 && (
            <TouchableOpacity
              className="bg-white/20 rounded-full px-3 py-1.5 flex-row items-center gap-1.5"
              onPress={() => router.push("/(app)/calendar")}
            >
              <Ionicons name="calendar-outline" size={13} color="#fff" />
              <Text className="text-white text-xs font-semibold">{soon.length} em breve</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conteúdo claro arredondado */}
      <View className="flex-1 bg-cream rounded-t-3xl overflow-hidden" style={{ marginTop: -12 }}>
        {isOffline && (
          <View className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex-row items-center gap-2">
            <Ionicons name="cloud-offline-outline" size={14} color="#d97706" />
            <Text className="text-amber-700 text-xs flex-1">Sem conexão — dados em cache</Text>
          </View>
        )}
        <FormError message={error} />

        <FlatList
          data={pets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#32a060" colors={["#32a060"]} />
          }
          ListEmptyComponent={
            pets.length === 0 && alerts.length === 0 ? (
              <View className="items-center justify-center px-8 mt-16">
                <Text className="text-5xl mb-4">🐾</Text>
                <Text className="text-xl font-semibold text-sage-600 text-center">
                  Nenhum pet cadastrado ainda
                </Text>
                <Text className="text-sage-400 text-center mt-2">
                  Toque no + para adicionar ou use o código de um tutor
                </Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            <>
              {alerts.length > 0 ? (
                <View className="mb-4">
                  {overdue.length > 0 && (
                    <View className="mb-4">
                      <View className="flex-row items-center gap-2 mb-2">
                        <Ionicons name="alert-circle" size={16} color="#ef4444" />
                        <Text className="text-red-500 font-bold text-sm uppercase tracking-wide">Atrasados</Text>
                      </View>
                      {overdue.map((item) => (
                        <AlertCard key={item.id} item={item} onPress={() => router.push(`/(app)/pet/${item.petId}?tab=${TYPE_TAB[item.type]}` as any)} />
                      ))}
                    </View>
                  )}
                  {todayAlerts.length > 0 && (
                    <View className="mb-4">
                      <View className="flex-row items-center gap-2 mb-2">
                        <Ionicons name="today-outline" size={16} color="#d97706" />
                        <Text className="text-amber-600 font-bold text-sm uppercase tracking-wide">Hoje</Text>
                      </View>
                      {todayAlerts.map((item) => (
                        <AlertCard key={item.id} item={item} onPress={() => router.push(`/(app)/pet/${item.petId}?tab=${TYPE_TAB[item.type]}` as any)} />
                      ))}
                    </View>
                  )}
                  {soon.length > 0 && (
                    <View className="mb-4">
                      <View className="flex-row items-center gap-2 mb-2">
                        <Ionicons name="calendar-outline" size={16} color="#32a060" />
                        <Text className="text-sage-500 font-bold text-sm uppercase tracking-wide">Esta semana</Text>
                      </View>
                      {soon.map((item) => (
                        <AlertCard key={item.id} item={item} onPress={() => router.push(`/(app)/pet/${item.petId}?tab=${TYPE_TAB[item.type]}` as any)} />
                      ))}
                    </View>
                  )}
                  <View className="h-px bg-sage-100 mb-4" />
                </View>
              ) : null}
              {pets.length > 0 ? (
                <View className="flex-row items-center gap-2 mb-3 mt-1">
                  <Ionicons name="paw" size={15} color="#32a060" />
                  <Text className="text-sage-500 font-bold text-sm uppercase tracking-wide">Meus Pets</Text>
                </View>
              ) : null}
            </>
          }
          ListFooterComponent={
            <>
              <TouchableOpacity
                className="flex-row items-center gap-2 py-3 mt-2"
                onPress={() => {
                  if (!showArchived) fetchArchivedPets();
                  setShowArchived((v) => !v);
                }}
              >
                <Ionicons name={showArchived ? "chevron-up" : "archive-outline"} size={15} color="#60b880" />
                <Text className="text-sage-400 text-sm">
                  {showArchived ? "Ocultar arquivados" : "Ver pets arquivados"}
                </Text>
              </TouchableOpacity>
              {showArchived && (
                <View className="mt-1">
                  {loadingArchived ? (
                    <ActivityIndicator color="#32a060" style={{ marginVertical: 12 }} />
                  ) : archivedPets.length === 0 ? (
                    <Text className="text-sage-300 text-sm text-center py-4">Nenhum pet arquivado</Text>
                  ) : (
                    archivedPets.map((item) => (
                      <View key={item.id} className="bg-white/60 rounded-2xl p-4 mb-3 flex-row items-center shadow-sm border border-sage-100">
                        {item.photo_url ? (
                          <Image source={{ uri: item.photo_url }} className="w-12 h-12 rounded-full bg-sage-100 opacity-60" />
                        ) : (
                          <View className="w-12 h-12 rounded-full bg-sage-100 items-center justify-center opacity-60">
                            <Text className="text-2xl">{SPECIES_ICON[item.species]}</Text>
                          </View>
                        )}
                        <View className="ml-3 flex-1">
                          <Text className="text-base font-semibold text-sage-400">{item.name}</Text>
                          <Text className="text-sage-300 text-xs">{SPECIES_LABEL[item.species]}{item.breed ? ` · ${item.breed}` : ""}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => unarchivePet(item.id)}
                          className="border border-sage-200 rounded-xl px-3 py-1.5 flex-row items-center gap-1"
                        >
                          <Ionicons name="refresh-outline" size={13} color="#32a060" />
                          <Text className="text-sage-500 text-xs font-medium">Restaurar</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              className="bg-white rounded-2xl p-4 mb-3 flex-row items-center shadow-sm"
              onPress={() => router.push(`/(app)/pet/${item.id}`)}
              style={index === 0 && alerts.length === 0 ? { marginTop: 0 } : undefined}
            >
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} className="w-16 h-16 rounded-full bg-sage-100" />
              ) : (
                <View className="w-16 h-16 rounded-full bg-sage-100 items-center justify-center">
                  <Text className="text-3xl">{SPECIES_ICON[item.species]}</Text>
                </View>
              )}
              <View className="ml-4 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg font-semibold text-sage-800">{item.name}</Text>
                  {!item.isOwner && (
                    <View className="bg-sage-100 px-2 py-0.5 rounded-full">
                      <Text className="text-sage-500 text-xs">Compartilhado</Text>
                    </View>
                  )}
                </View>
                <Text className="text-sage-500 text-sm">
                  {SPECIES_LABEL[item.species]}
                  {item.breed ? ` • ${item.breed}` : ""}
                </Text>
                {item.birth_date && (
                  <Text className="text-sage-400 text-xs mt-0.5">{getAge(item.birth_date)}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#60b880" />
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function AlertCard({ item, onPress }: { item: AlertItem; onPress: () => void }) {
  const isOverdue = item.urgency === "overdue";
  const isToday = item.urgency === "today";

  const bgColor = isOverdue ? "bg-red-50" : isToday ? "bg-amber-50" : "bg-sage-50";
  const borderColor = isOverdue ? "border-red-200" : isToday ? "border-amber-200" : "border-sage-200";
  const iconColor = isOverdue ? "#ef4444" : isToday ? "#d97706" : "#32a060";
  const petColor = isOverdue ? "text-red-400" : isToday ? "text-amber-500" : "text-sage-400";
  const titleColor = isOverdue ? "text-red-700" : isToday ? "text-amber-700" : "text-sage-700";
  const dateColor = isOverdue ? "text-red-400" : isToday ? "text-amber-400" : "text-sage-400";

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-xl p-3 mb-2 border flex-row items-center gap-3 ${bgColor} ${borderColor}`}
    >
      <View className={`w-8 h-8 rounded-full items-center justify-center ${isOverdue ? "bg-red-100" : isToday ? "bg-amber-100" : "bg-sage-100"}`}>
        <Ionicons name={TYPE_ICON[item.type] as any} size={16} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className={`text-xs font-medium ${petColor}`}>{item.petName} · {TYPE_LABEL[item.type]}</Text>
        <Text className={`text-sm font-semibold ${titleColor}`} numberOfLines={1}>{item.title}</Text>
      </View>
      <Text className={`text-xs ${dateColor}`}>
        {isToday ? "Hoje" : isOverdue ? formatDateISO(item.date) : formatDateISO(item.date)}
      </Text>
    </TouchableOpacity>
  );
}
