import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { BreedPicker } from "@/components/BreedPicker";
import { FormError } from "@/components/FormError";
import { DOG_BREEDS, CAT_BREEDS } from "@/constants/breeds";
import { formatDateInput, parseDateBR } from "@/lib/utils";
import type { Species } from "@/types";
import { trackEvent } from "@/lib/analytics";

async function uploadPhoto(petId: string, base64: string): Promise<string | null> {
  try {
    const path = `${petId}/photo.jpg`;
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const { error } = await supabase.storage.from("pet-photos").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) return null;
    const { data } = supabase.storage.from("pet-photos").getPublicUrl(path);
    return data.publicUrl + `?t=${Date.now()}`;
  } catch {
    return null;
  }
}

export default function NewPetScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setName("");
      setSpecies("dog");
      setBreed("");
      setBirthDate("");
      setMicrochip("");
      setPhotoUri(null);
      setPhotoBase64(null);
      setError(null);
    }, [])
  );

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      setError("Permissão de fotos negada. Ative nas configurações.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      setError("Permissão de câmera negada. Ative nas configurações.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Informe o nome do pet."); return; }
    const parsedDate = birthDate ? parseDateBR(birthDate) : null;
    if (birthDate && !parsedDate) { setError("Data inválida. Use o formato DD/MM/AAAA."); return; }

    setLoading(true);
    const { data: inserted, error: dbError } = await supabase
      .from("pets")
      .insert({
        user_id: user!.id,
        name: name.trim(),
        species,
        breed: breed.trim() || null,
        birth_date: parsedDate,
        microchip: microchip.trim() || null,
      })
      .select("id")
      .single();

    if (dbError || !inserted) {
      setError("Não foi possível salvar. Tente novamente.");
      setLoading(false);
      return;
    }

    if (photoBase64) {
      const url = await uploadPhoto(inserted.id, photoBase64);
      if (url) {
        await supabase.from("pets").update({ photo_url: url }).eq("id", inserted.id);
      }
    }

    setLoading(false);
    trackEvent("pet_created", { species });
    router.replace("/(app)");
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace("/(app)")} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Novo Pet</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Foto */}
        <View className="items-center mt-6 mb-2">
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                className="w-28 h-28 rounded-full bg-sage-100"
              />
            ) : (
              <View className="w-28 h-28 rounded-full bg-sage-100 items-center justify-center border-2 border-dashed border-sage-300">
                <Ionicons name="camera-outline" size={32} color="#60b880" />
              </View>
            )}
          </TouchableOpacity>
          <View className="flex-row gap-3 mt-2">
            <TouchableOpacity onPress={pickPhoto} className="flex-row items-center gap-1 px-3 py-1.5 bg-sage-50 rounded-full border border-sage-200">
              <Ionicons name="images-outline" size={14} color="#165c39" />
              <Text className="text-sage-600 text-xs font-medium">Galeria</Text>
            </TouchableOpacity>
            {Platform.OS !== "web" && (
              <TouchableOpacity onPress={takePhoto} className="flex-row items-center gap-1 px-3 py-1.5 bg-sage-50 rounded-full border border-sage-200">
                <Ionicons name="camera-outline" size={14} color="#165c39" />
                <Text className="text-sage-600 text-xs font-medium">Câmera</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="bg-white rounded-2xl p-5 mt-2 shadow-sm">
          <FormError message={error} />

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Nome *</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Nome do seu pet"
              placeholderTextColor="#60b880"
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

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Data de nascimento</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#60b880"
              value={birthDate}
              onChangeText={(t) => { setBirthDate(formatDateInput(t)); setError(null); }}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          <View>
            <Text className="text-sm text-sage-600 mb-1 font-medium">Microchip</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Número do microchip (opcional)"
              placeholderTextColor="#60b880"
              value={microchip}
              onChangeText={setMicrochip}
              keyboardType="number-pad"
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
