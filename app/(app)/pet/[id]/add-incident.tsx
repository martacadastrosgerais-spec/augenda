import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { FormError } from "@/components/FormError";
import { formatDateInput, parseDateBR } from "@/lib/utils";
import type { IncidentCategory } from "@/types";
import { trackEvent } from "@/lib/analytics";

const CATEGORIES: { value: IncidentCategory; label: string; icon: string; color: string; bg: string }[] = [
  { value: "vomit",            label: "Vômito",          icon: "🤢", color: "border-amber-400",  bg: "bg-amber-50"  },
  { value: "diarrhea",         label: "Diarreia",        icon: "💩", color: "border-orange-400", bg: "bg-orange-50" },
  { value: "wound",            label: "Ferida / Lesão",  icon: "🩹", color: "border-red-400",    bg: "bg-red-50"    },
  { value: "behavior",         label: "Comportamento",   icon: "😰", color: "border-blue-400",   bg: "bg-blue-50"   },
  { value: "allergy_reaction", label: "Reação alérgica", icon: "🤧", color: "border-purple-400", bg: "bg-purple-50" },
  { value: "other",            label: "Outro",           icon: "❓", color: "border-sage-300",   bg: "bg-sage-50"   },
];

function nowLocalBR() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear();
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return { date: `${d}/${m}/${y}`, time: `${h}:${min}` };
}

async function uploadIncidentPhoto(petId: string, incidentId: string, base64: string): Promise<string | null> {
  try {
    const path = `${petId}/${incidentId}.jpg`;
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const { error } = await supabase.storage.from("pet-incidents").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) return null;
    const { data } = supabase.storage.from("pet-incidents").getPublicUrl(path);
    return data.publicUrl + `?t=${Date.now()}`;
  } catch {
    return null;
  }
}

export default function AddIncidentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const init = nowLocalBR();
  const [category, setCategory] = useState<IncidentCategory>("other");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { setError("Permissão de fotos negada."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images", allowsEditing: true, quality: 0.7, base64: true,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") { setError("Permissão de câmera negada."); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, quality: 0.7, base64: true,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  }

  async function handleSave() {
    setError(null);
    if (!description.trim()) { setError("Descreva o que aconteceu."); return; }
    const dateISO = parseDateBR(date);
    if (!dateISO) { setError("Data inválida. Use DD/MM/AAAA."); return; }
    if (!/^\d{2}:\d{2}$/.test(time)) { setError("Hora inválida. Use HH:MM."); return; }

    const occurred_at = new Date(`${dateISO}T${time}:00`).toISOString();

    setLoading(true);

    const { data: inserted, error: dbError } = await supabase
      .from("incidents")
      .insert({ pet_id: id, occurred_at, category, description: description.trim() })
      .select("id")
      .single();

    if (dbError || !inserted) {
      setLoading(false);
      setError("Não foi possível salvar. Tente novamente.");
      return;
    }

    if (photoBase64) {
      const url = await uploadIncidentPhoto(id, inserted.id, photoBase64);
      if (url) await supabase.from("incidents").update({ photo_url: url }).eq("id", inserted.id);
    }

    setLoading(false);
    trackEvent("incident_logged", { pet_id: id, category });
    router.replace(`/(app)/pet/${id}` as any);
  }

  const selected = CATEGORIES.find((c) => c.value === category)!;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Registrar adversidade</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FormError message={error} />

        {/* Categoria */}
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <Text className="text-sm font-medium text-sage-600 mb-3">O que aconteceu? *</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                onPress={() => setCategory(cat.value)}
                className={`flex-row items-center gap-2 px-3 py-2 rounded-xl border-2 ${
                  category === cat.value ? `${cat.bg} ${cat.color}` : "bg-white border-sage-100"
                }`}
              >
                <Text className="text-base">{cat.icon}</Text>
                <Text className={`text-sm font-medium ${category === cat.value ? "text-sage-800" : "text-sage-500"}`}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Data e hora */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <Text className="text-sm font-medium text-sage-600 mb-3">Quando aconteceu? *</Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-xs text-sage-500 mb-1">Data</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                value={date}
                onChangeText={(t) => { setDate(formatDateInput(t)); setError(null); }}
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#60b880"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <View className="w-28">
              <Text className="text-xs text-sage-500 mb-1">Hora</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                value={time}
                onChangeText={(t) => { setTime(t); setError(null); }}
                placeholder="HH:MM"
                placeholderTextColor="#60b880"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>
        </View>

        {/* Descrição */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <Text className="text-sm font-medium text-sage-600 mb-2">Descrição *</Text>
          <TextInput
            className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
            placeholder={`Descreva o que observou — cor, frequência, contexto...`}
            placeholderTextColor="#60b880"
            value={description}
            onChangeText={(v) => { setDescription(v); setError(null); }}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{ minHeight: 100 }}
          />
        </View>

        {/* Foto */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <Text className="text-sm font-medium text-sage-600 mb-3">Foto (opcional)</Text>
          {photoUri ? (
            <View>
              <Image
                source={{ uri: photoUri }}
                className="w-full rounded-xl"
                style={{ height: 180 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}
                className="absolute top-2 right-2 bg-black/50 rounded-full w-8 h-8 items-center justify-center"
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-3">
              {Platform.OS !== "web" && (
                <TouchableOpacity
                  onPress={takePhoto}
                  className="flex-1 flex-row items-center justify-center gap-2 border border-sage-200 rounded-xl py-3 bg-sage-50"
                >
                  <Ionicons name="camera-outline" size={18} color="#165c39" />
                  <Text className="text-sage-600 text-sm font-medium">Câmera</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={pickPhoto}
                className="flex-1 flex-row items-center justify-center gap-2 border border-sage-200 rounded-xl py-3 bg-sage-50"
              >
                <Ionicons name="images-outline" size={18} color="#165c39" />
                <Text className="text-sage-600 text-sm font-medium">Galeria</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mt-4 mb-8"
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-semibold text-base">Salvar registro</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
