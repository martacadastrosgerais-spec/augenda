import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Share,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { FormError } from "@/components/FormError";
import { generateInviteCode, hoursUntilExpiry } from "@/lib/sharing";
import type { PetMember, PetInvite } from "@/types";

export default function SharePetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [petName, setPetName] = useState("");
  const [members, setMembers] = useState<PetMember[]>([]);
  const [activeInvite, setActiveInvite] = useState<PetInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  async function fetchData() {
    const [petRes, membersRes, inviteRes] = await Promise.all([
      supabase.from("pets").select("name").eq("id", id).single(),
      supabase
        .from("pet_members")
        .select("*, profiles(email)")
        .eq("pet_id", id),
      supabase
        .from("pet_invites")
        .select("*")
        .eq("pet_id", id)
        .is("used_by", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (petRes.data) setPetName(petRes.data.name);
    setMembers((membersRes.data as PetMember[]) ?? []);
    setActiveInvite(inviteRes.data as PetInvite | null);
    setLoading(false);
  }

  async function handleGenerateCode() {
    setError(null);
    setGenerating(true);

    // Invalida convites anteriores não utilizados
    await supabase
      .from("pet_invites")
      .delete()
      .eq("pet_id", id)
      .is("used_by", null);

    const code = generateInviteCode();
    const { data, error: insertError } = await supabase
      .from("pet_invites")
      .insert({
        pet_id: id,
        code,
        created_by: user!.id,
      })
      .select()
      .single();

    setGenerating(false);
    if (insertError) {
      setError("Não foi possível gerar o código.");
      console.error("[Share] generate error:", insertError);
    } else {
      setActiveInvite(data as PetInvite);
    }
  }

  async function handleShare() {
    if (!activeInvite) return;
    await Share.share({
      message: `Entre no pet "${petName}" no AUgenda!\n\nCódigo de convite: ${activeInvite.code}\n(válido por ${hoursUntilExpiry(activeInvite.expires_at)}h)`,
      title: `Convite para ${petName}`,
    });
  }

  async function handleRemoveMember(memberId: string, memberEmail?: string) {
    const confirmed = Platform.OS === "web"
      ? window.confirm(`Remover ${memberEmail ?? "este membro"} do pet?`)
      : await new Promise<boolean>((resolve) =>
          Alert.alert(
            "Remover membro",
            `Remover ${memberEmail ?? "este membro"} do pet?`,
            [
              { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
              { text: "Remover", style: "destructive", onPress: () => resolve(true) },
            ]
          )
        );

    if (!confirmed) return;

    const { error: delError } = await supabase.from("pet_members").delete().eq("id", memberId);
    if (delError) {
      setError("Não foi possível remover o membro.");
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
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
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#527558" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Compartilhar {petName}</Text>
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <FormError message={error} />

            {/* Código de convite */}
            <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <Text className="text-base font-semibold text-sage-700 mb-3">
                Código de convite
              </Text>

              {activeInvite ? (
                <>
                  <View className="bg-sage-50 border border-sage-200 rounded-xl py-4 items-center mb-3">
                    <Text className="text-3xl font-bold text-sage-600 tracking-widest">
                      {activeInvite.code}
                    </Text>
                    <Text className="text-sage-400 text-xs mt-1">
                      Expira em {hoursUntilExpiry(activeInvite.expires_at)}h
                    </Text>
                  </View>

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      className="flex-1 bg-sage-400 rounded-xl py-3 items-center flex-row justify-center gap-1"
                      onPress={handleShare}
                    >
                      <Ionicons name="share-outline" size={16} color="#fff" />
                      <Text className="text-white font-medium text-sm">Compartilhar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 border border-sage-300 rounded-xl py-3 items-center"
                      onPress={handleGenerateCode}
                    >
                      <Text className="text-sage-600 font-medium text-sm">Novo código</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text className="text-sage-400 text-sm mb-3">
                    Gere um código para convidar outro tutor a visualizar este pet.
                  </Text>
                  <TouchableOpacity
                    className="bg-sage-400 rounded-xl py-3 items-center"
                    onPress={handleGenerateCode}
                    disabled={generating}
                  >
                    {generating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-semibold">Gerar código</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Cabeçalho da lista de membros */}
            <Text className="text-base font-semibold text-sage-700 mb-2">
              Membros com acesso ({members.length})
            </Text>

            {members.length === 0 && (
              <View className="bg-white rounded-2xl p-5 shadow-sm items-center">
                <Text className="text-sage-300">Nenhum membro ainda</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => {
          const email = (item as any).profiles?.email ?? "Membro";
          const isCurrentUser = item.user_id === user?.id;
          return (
            <View className="bg-white rounded-xl p-4 mb-2 shadow-sm flex-row items-center">
              <View className="w-9 h-9 rounded-full bg-sage-100 items-center justify-center mr-3">
                <Ionicons name="person" size={18} color="#7da87b" />
              </View>
              <View className="flex-1">
                <Text className="text-sage-800 font-medium text-sm" numberOfLines={1}>
                  {email}
                </Text>
                <Text className="text-sage-400 text-xs capitalize">{item.role}</Text>
              </View>
              {!isCurrentUser && (
                <TouchableOpacity
                  onPress={() => handleRemoveMember(item.id, email)}
                  className="p-2"
                >
                  <Ionicons name="person-remove-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
