import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { FormError } from "@/components/FormError";
import { getAge } from "@/lib/utils";
import type { Pet } from "@/types";

const SPECIES_LABEL: Record<string, string> = { dog: "Cachorro", cat: "Gato" };
const SPECIES_ICON: Record<string, string> = { dog: "🐶", cat: "🐱" };

type PetListItem = Pet & { isOwner: boolean };

export default function PetsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [pets, setPets] = useState<PetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchPets();
    else setLoading(false);
  }, [user]);

  async function fetchPets() {
    if (!user) return;
    setError(null);

    // Pets onde é dono
    const { data: owned, error: ownedError } = await supabase
      .from("pets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Pets onde é membro
    const { data: memberships, error: memberError } = await supabase
      .from("pet_members")
      .select("pet_id, pets(*)")
      .eq("user_id", user.id);

    if (ownedError || memberError) {
      console.error("[fetchPets] ownedError:", ownedError);
      console.error("[fetchPets] memberError:", memberError);
      setError("Não foi possível carregar os pets.");
      setLoading(false);
      return;
    }

    const ownedList: PetListItem[] = (owned ?? []).map((p) => ({ ...p, isOwner: true }));

    const memberList: PetListItem[] = (memberships ?? [])
      .map((m: any) => m.pets)
      .filter(Boolean)
      .map((p: Pet) => ({ ...p, isOwner: false }));

    // Remove duplicatas (caso improvável)
    const ownedIds = new Set(ownedList.map((p) => p.id));
    const combined = [...ownedList, ...memberList.filter((p) => !ownedIds.has(p.id))];

    setPets(combined);
    setLoading(false);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#7da87b" size="large" />
      </SafeAreaView>
    );
  }

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
