import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { FormError } from "@/components/FormError";
import { formatDateISO, getAge } from "@/lib/utils";
import type { Pet } from "@/types";

const SPECIES_LABEL: Record<string, string> = { dog: "Cachorro", cat: "Gato" };
const SPECIES_ICON: Record<string, string> = { dog: "🐶", cat: "🐱" };

type PetListItem = Pet & { isOwner: boolean };

interface AlertItem {
  id: string;
  petName: string;
  title: string;
  date: string;
  urgency: "overdue" | "today" | "soon";
}

export default function PetsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [pets, setPets] = useState<PetListItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) fetchAll();
      else setLoading(false);
    }, [user])
  );

  async function fetchAll() {
    if (!user) return;
    setError(null);
    await Promise.all([fetchPets(), fetchAlerts()]);
    setLoading(false);
  }

  async function fetchPets() {
    const [ownedRes, memberRes] = await Promise.all([
      supabase.from("pets").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("pet_members").select("pet_id, pets(*)").eq("user_id", user!.id),
    ]);

    if (ownedRes.error || memberRes.error) {
      setError("Não foi possível carregar os pets.");
      return;
    }

    const ownedList: PetListItem[] = (ownedRes.data ?? []).map((p) => ({ ...p, isOwner: true }));
    const memberList: PetListItem[] = (memberRes.data ?? [])
      .map((m: any) => m.pets)
      .filter(Boolean)
      .map((p: Pet) => ({ ...p, isOwner: false }));

    const ownedIds = new Set(ownedList.map((p) => p.id));
    setPets([...ownedList, ...memberList.filter((p) => !ownedIds.has(p.id))]);
  }

  async function fetchAlerts() {
    // Monta mapa de petId → nome
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

    const [vacRes, medRes, procRes] = await Promise.all([
      supabase.from("vaccines").select("id, pet_id, name, next_dose_at")
        .in("pet_id", petIds).not("next_dose_at", "is", null).lte("next_dose_at", in7days),
      supabase.from("medications").select("id, pet_id, name, ends_at")
        .in("pet_id", petIds).eq("active", true).not("ends_at", "is", null).lte("ends_at", in7days),
      supabase.from("procedures").select("id, pet_id, title, performed_at")
        .in("pet_id", petIds).gte("performed_at", today).lte("performed_at", in7days),
    ]);

    const items: AlertItem[] = [];

    (vacRes.data ?? []).forEach((v) => {
      const d = v.next_dose_at!;
      items.push({
        id: `vac-${v.id}`,
        petName: petMap[v.pet_id],
        title: `Vacina: ${v.name}`,
        date: d,
        urgency: d < today ? "overdue" : d === today ? "today" : "soon",
      });
    });

    (medRes.data ?? []).forEach((m) => {
      const d = m.ends_at!;
      items.push({
        id: `med-${m.id}`,
        petName: petMap[m.pet_id],
        title: `Fim do tratamento: ${m.name}`,
        date: d,
        urgency: d < today ? "overdue" : d === today ? "today" : "soon",
      });
    });

    (procRes.data ?? []).forEach((p) => {
      const d = p.performed_at;
      items.push({
        id: `proc-${p.id}`,
        petName: petMap[p.pet_id],
        title: p.title,
        date: d,
        urgency: d === today ? "today" : "soon",
      });
    });

    // Ordena: vencidos primeiro, depois hoje, depois por data
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
        <ActivityIndicator color="#7da87b" size="large" />
      </SafeAreaView>
    );
  }

  const overdue = alerts.filter((a) => a.urgency === "overdue");
  const today = alerts.filter((a) => a.urgency === "today");
  const soon = alerts.filter((a) => a.urgency === "soon");
  const hasAlerts = alerts.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-sage-700">Meus Pets</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="border border-sage-300 rounded-full w-10 h-10 items-center justify-center"
            onPress={() => router.push("/(app)/join")}
          >
            <Ionicons name="enter-outline" size={20} color="#7da87b" />
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-sage-400 rounded-full w-10 h-10 items-center justify-center"
            onPress={() => router.push("/(app)/pet/new")}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FormError message={error} />

      {/* Dashboard de alertas */}
      {hasAlerts && (
        <View className="mb-2">
          {/* Contadores */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }} className="mb-3">
            {overdue.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push("/(app)/calendar")}
                className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex-row items-center gap-2"
              >
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <View>
                  <Text className="text-red-600 font-bold text-sm">{overdue.length} atrasado{overdue.length > 1 ? "s" : ""}</Text>
                  <Text className="text-red-400 text-xs">Atenção necessária</Text>
                </View>
              </TouchableOpacity>
            )}
            {today.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push("/(app)/calendar")}
                className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex-row items-center gap-2"
              >
                <Ionicons name="today-outline" size={18} color="#d97706" />
                <View>
                  <Text className="text-amber-700 font-bold text-sm">{today.length} hoje</Text>
                  <Text className="text-amber-500 text-xs">Neste momento</Text>
                </View>
              </TouchableOpacity>
            )}
            {soon.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push("/(app)/calendar")}
                className="bg-sage-50 border border-sage-200 rounded-2xl px-4 py-3 flex-row items-center gap-2"
              >
                <Ionicons name="calendar-outline" size={18} color="#7da87b" />
                <View>
                  <Text className="text-sage-600 font-bold text-sm">{soon.length} em breve</Text>
                  <Text className="text-sage-400 text-xs">Próximos 7 dias</Text>
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Itens urgentes (vencidos + hoje) */}
          {[...overdue, ...today].length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {[...overdue, ...today].map((item) => {
                const isOverdue = item.urgency === "overdue";
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push("/(app)/calendar")}
                    className={`rounded-2xl p-4 min-w-48 ${isOverdue ? "bg-red-500" : "bg-amber-400"}`}
                  >
                    <Text className="text-white text-xs font-medium mb-1 opacity-90">{item.petName}</Text>
                    <Text className="text-white font-semibold text-sm leading-tight">{item.title}</Text>
                    <Text className={`text-xs mt-2 ${isOverdue ? "text-red-100" : "text-amber-100"}`}>
                      {isOverdue ? `Venceu em ${formatDateISO(item.date)}` : "Hoje"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Lista de pets */}
      {pets.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">🐾</Text>
          <Text className="text-xl font-semibold text-sage-600 text-center">
            Nenhum pet cadastrado ainda
          </Text>
          <Text className="text-sage-400 text-center mt-2">
            Toque no + para adicionar ou use o código de um tutor
          </Text>
        </View>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-white rounded-2xl p-4 mb-3 flex-row items-center shadow-sm"
              onPress={() => router.push(`/(app)/pet/${item.id}`)}
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
              <Ionicons name="chevron-forward" size={18} color="#a8c5ad" />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
