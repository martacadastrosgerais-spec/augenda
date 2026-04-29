import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { FormError } from "@/components/FormError";
import { formatCode } from "@/lib/sharing";

export default function JoinPetScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; name: string; species: string } | null>(null);

  async function handleValidate() {
    const clean = formatCode(code);
    if (clean.length < 6) {
      setError("O código deve ter 6 caracteres.");
      return;
    }

    setError(null);
    setLoading(true);

    const { data: invite, error: inviteError } = await supabase
      .from("pet_invites")
      .select("*, pets(id, name, species)")
      .eq("code", clean)
      .is("used_by", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    setLoading(false);

    if (inviteError || !invite) {
      setError("Código inválido ou expirado.");
      return;
    }

    const pet = (invite as any).pets;
    if (!pet) { setError("Pet não encontrado."); return; }

    // Verifica se já é membro
    const { data: existing } = await supabase
      .from("pet_members")
      .select("id")
      .eq("pet_id", pet.id)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (existing) {
      setError("Você já tem acesso a este pet.");
      return;
    }

    // Verifica se é o próprio dono
    const { data: petData } = await supabase
      .from("pets")
      .select("user_id")
      .eq("id", pet.id)
      .single();

    if (petData?.user_id === user!.id) {
      setError("Você já é o tutor responsável por este pet.");
      return;
    }

    setPreview({ id: pet.id, name: pet.name, species: pet.species });
  }

  async function handleJoin() {
    if (!preview) return;
    setLoading(true);
    setError(null);

    const clean = formatCode(code);

    // Busca o convite novamente para pegar o invite.id e created_by
    const { data: invite } = await supabase
      .from("pet_invites")
      .select("id, created_by")
      .eq("code", clean)
      .is("used_by", null)
      .maybeSingle();

    if (!invite) {
      setLoading(false);
      setError("Código não encontrado. Tente novamente.");
      return;
    }

    // Insere membro
    const { error: memberError } = await supabase.from("pet_members").insert({
      pet_id: preview.id,
      user_id: user!.id,
      role: "viewer",
      invited_by: invite.created_by,
    });

    if (memberError) {
      setLoading(false);
      setError("Não foi possível entrar no pet.");
      console.error("[Join] member insert error:", memberError);
      return;
    }

    // Marca convite como usado
    await supabase
      .from("pet_invites")
      .update({ used_by: user!.id, used_at: new Date().toISOString() })
      .eq("id", invite.id);

    setLoading(false);
    router.replace("/(app)");
  }

  const SPECIES_ICON = preview?.species === "dog" ? "🐶" : "🐱";

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace("/(app)")} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#527558" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Entrar com código</Text>
      </View>

      <View className="flex-1 px-5 pt-4">
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <Text className="text-sage-600 text-sm mb-4">
            Digite o código de 6 caracteres recebido de outro tutor.
          </Text>

          <FormError message={error} />

          <TextInput
            className="border border-sage-200 rounded-xl px-4 py-4 text-center text-2xl font-bold text-sage-800 bg-sage-50 tracking-widest mb-4"
            placeholder="XXXXXX"
            placeholderTextColor="#a8c5ad"
            value={code}
            onChangeText={(t) => {
              setCode(formatCode(t));
              setError(null);
              setPreview(null);
            }}
            autoCapitalize="characters"
            maxLength={6}
          />

          {!preview ? (
            <TouchableOpacity
              className="bg-sage-400 rounded-xl py-4 items-center"
              onPress={handleValidate}
              disabled={loading || code.length < 6}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold">Validar código</Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <View className="bg-sage-50 border border-sage-200 rounded-xl p-4 mb-4 flex-row items-center">
                <Text className="text-3xl mr-3">{SPECIES_ICON}</Text>
                <View>
                  <Text className="text-sage-400 text-xs">Pet encontrado</Text>
                  <Text className="text-sage-800 font-bold text-lg">{preview.name}</Text>
                </View>
              </View>

              <TouchableOpacity
                className="bg-sage-400 rounded-xl py-4 items-center"
                onPress={handleJoin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Entrar no pet</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
