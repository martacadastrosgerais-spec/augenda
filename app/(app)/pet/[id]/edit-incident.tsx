import { useEffect, useState } from "react";
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
import { hapticSuccess } from "@/lib/haptics";

const CATEGORIES: { value: IncidentCategory; label: string; icon: string; color: string; bg: string }[] = [
  { value: "vomit",            label: "Vômito",          icon: "🤢", color: "border-amber-400",  bg: "bg-amber-50"  },
  { value: "diarrhea",         label: "Diarreia",        icon: "💩", color: "border-orange-400", bg: "bg-orange-50" },
  { value: "wound",            label: "Ferida / Lesão",  icon: "🩹", color: "border-red-400",    bg: "bg-red-50"    },
  { value: "behavior",         label: "Comportamento",   icon: "😰", color: "border-blue-400",   bg: "bg-blue-50"   },
  { value: "allergy_reaction", label: "Reação alérgica", icon: "🤧", color: "border-purple-400", bg: "bg-purple-50" },
  { value: "other",            label: "Outro",           icon: "❓", color: "border-sage-300",   bg: "bg-sage-50"   },
];

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

export default function EditIncidentScreen() {
  const { id, incidentId } = useLocalSearchParams<{ id: string; incidentId: string }>();
  const router = useRouter();

  const [category, setCategory] = useState<IncidentCategory>("other");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIncident();
  }, [incidentId]);

  async function loadIncident() {
    const { data } = await supabase.from("incidents").select("*").eq("id", incidentId).single();
    if (data) {
      setCategory(data.category as IncidentCategory);
      setDescription(data.description ?? "");
      const d = new Date(data.occurred_at);
      setDate(`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
      setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      setExistingPhotoUrl(data.photo_url ?? null);
    }
    setLoading(false);
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { setError("Permissão de fotos negada."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images", allowsEditing: true, quality: 0.7, base64: true,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
      setRemovePhoto(false);
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
      setRemovePhoto(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!description.trim()) { setError("Descreva o que aconteceu."); return; }
    const dateISO = parseDateBR(date);
    if (!dateISO) { setError("Data inválida. Use DD/MM/AAAA."); return; }
    if (!/^\d{2}:\d{2}$/.test(time)) { setError("Hora inválida. Use HH:MM."); return; }

    const occurred_at = new Date(`${dateISO}T${time}:00`).toISOString();
    setSaving(true);

    let photo_url = removePhoto ? null : existingPhotoUrl;

    if (photoBase64) {
      const url = await uploadIncidentPhoto(id, incidentId, photoBase64);
      if (url) photo_url = url;
    }

    const { error: dbError } = await supabase
      .from("incidents")
      .update({ category, description: description.trim(), occurred_at, photo_url })
      .eq("id", incidentId);

    setSaving(false);

    if (dbError) {
      setError("Não foi possível salvar. Tente novamente.");
      return;
    }

    hapticSuccess();
    router.replace(`/(app)/pet/${id}` as any);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#32a060" />
      </SafeAreaView>
    );
  }

  const displayedPhoto = photoUri ?? (!removePhoto ? existingPhotoUrl : null);

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Editar adversidade</Text>
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
            placeholder="Descreva o que observou — cor, frequência, contexto..."
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
          <Text className="text-sm font-medium text-sage-600 mb-3">Foto</Text>
          {displayedPhoto ? (
            <View>
              <Image
                source={{ uri: displayedPhoto }}
                className="w-full rounded-xl"
                style={{ height: 180 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => {
                  setPhotoUri(null);
                  setPhotoBase64(null);
                  setRemovePhoto(true);
                }}
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
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-semibold text-base">Salvar alterações</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
