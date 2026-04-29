import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { BreedPicker } from "@/components/BreedPicker";
import { FormError } from "@/components/FormError";
import { DOG_BREEDS, CAT_BREEDS } from "@/constants/breeds";
import { formatDateInput, parseDateBR } from "@/lib/utils";
import type { Species } from "@/types";

export default function NewPetScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setName("");
      setSpecies("dog");
      setBreed("");
      setBirthDate("");
      setError(null);
    }, [])
  );

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome do pet.");
      return;
    }
    const parsedDate = birthDate ? parseDateBR(birthDate) : null;
    if (birthDate && !parsedDate) {
      setError("Data inválida. Use o formato DD/MM/AAAA.");
      return;
    }

    setLoading(true);
    const { error: dbError } = await supabase.from("pets").insert({
      user_id: user!.id,
      name: name.trim(),
      species,
      breed: breed.trim() || null,
      birth_date: parsedDate,
    });
    setLoading(false);

    if (dbError) {
      setError("Não foi possível salvar. Tente novamente.");
      console.error("[NewPet] insert error:", dbError);
    } else {
      router.replace("/(app)");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace("/(app)")} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#527558" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Novo Pet</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <FormError message={error} />

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Nome *</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Nome do seu pet"
              placeholderTextColor="#a8c5ad"
              value={name}
              onChangeText={(v) => { setName(v); setError(null); }}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-2 font-medium">Espécie *</Text>
            <View className="flex-row gap-3">
              {(["dog", "cat"] as Species[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  className={`flex-1 py-3 rounded-xl items-center flex-row justify-center gap-2 border ${
                    species === s ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"
                  }`}
                  onPress={() => { setSpecies(s); setBreed(""); }}
                >
                  <Text className="text-xl">{s === "dog" ? "🐶" : "🐱"}</Text>
                  <Text className={`font-medium ${species === s ? "text-white" : "text-sage-600"}`}>
                    {s === "dog" ? "Cachorro" : "Gato"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Raça</Text>
            <BreedPicker
              value={breed}
              onChange={setBreed}
              breeds={species === "dog" ? DOG_BREEDS : CAT_BREEDS}
              placeholder={species === "dog" ? "Selecionar raça do cachorro" : "Selecionar raça do gato"}
            />
          </View>

          <View className="mb-2">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Data de nascimento</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#a8c5ad"
              value={birthDate}
              onChangeText={(t) => { setBirthDate(formatDateInput(t)); setError(null); }}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mt-4 mb-8"
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Salvar Pet</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
