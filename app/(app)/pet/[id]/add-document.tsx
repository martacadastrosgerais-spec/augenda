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
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { FormError } from "@/components/FormError";

type PickedFile =
  | { kind: "image"; uri: string; base64: string; name: string; mimeType: string }
  | { kind: "doc"; uri: string; name: string; mimeType: string; size?: number };

async function uploadFile(
  petId: string,
  procedureId: string,
  file: PickedFile
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${petId}/${procedureId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    let bytes: Uint8Array;

    if (file.kind === "image") {
      const byteChars = atob(file.base64);
      bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    } else {
      const b64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: "base64",
      });
      const byteChars = atob(b64);
      bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    }

    const { error } = await supabase.storage
      .from("pet-docs")
      .upload(path, bytes, { contentType: file.mimeType, upsert: false });

    if (error) return null;

    const { data } = supabase.storage.from("pet-docs").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export default function AddDocumentScreen() {
  const { id, procedureId, procedureTitle } = useLocalSearchParams<{
    id: string;
    procedureId: string;
    procedureTitle: string;
  }>();
  const router = useRouter();

  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [docName, setDocName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { setError("Permissão de fotos negada."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const asset = result.assets[0];
      const name = asset.fileName ?? `imagem_${Date.now()}.jpg`;
      setPicked({ kind: "image", uri: asset.uri, base64: asset.base64!, name, mimeType: "image/jpeg" });
      setDocName(name);
      setError(null);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") { setError("Permissão de câmera negada."); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const asset = result.assets[0];
      const name = `foto_${Date.now()}.jpg`;
      setPicked({ kind: "image", uri: asset.uri, base64: asset.base64!, name, mimeType: "image/jpeg" });
      setDocName(name);
      setError(null);
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setPicked({
        kind: "doc",
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
        size: asset.size,
      });
      setDocName(asset.name);
      setError(null);
    }
  }

  async function handleSave() {
    if (!picked) { setError("Selecione um arquivo."); return; }
    if (!docName.trim()) { setError("Informe um nome para o documento."); return; }

    setLoading(true);
    setError(null);

    const fileWithName = { ...picked, name: docName.trim() };
    const url = await uploadFile(id, procedureId, fileWithName);

    if (!url) {
      setLoading(false);
      setError("Falha no upload. Tente novamente.");
      return;
    }

    const { error: dbError } = await supabase.from("attachments").insert({
      procedure_id: procedureId,
      name: docName.trim(),
      file_url: url,
      file_type: picked.mimeType,
      size_bytes: picked.kind === "doc" ? picked.size : undefined,
    });

    setLoading(false);

    if (dbError) {
      setError("Erro ao salvar. Tente novamente.");
      return;
    }

    router.replace(`/(app)/pet/${id}` as any);
  }

  const isPdf = picked?.mimeType === "application/pdf";
  const isImage = picked?.kind === "image" || picked?.mimeType?.startsWith("image/");

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Anexar documento</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <FormError message={error} />

        {/* Contexto */}
        {procedureTitle ? (
          <View className="bg-sage-50 border border-sage-200 rounded-xl px-4 py-3 mt-4 flex-row items-center gap-2">
            <Ionicons name="document-text-outline" size={16} color="#32a060" />
            <Text className="text-sage-600 text-sm flex-1" numberOfLines={1}>
              Procedimento: <Text className="font-medium text-sage-800">{procedureTitle}</Text>
            </Text>
          </View>
        ) : null}

        {/* Seleção */}
        {!picked ? (
          <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
            <Text className="text-sm font-medium text-sage-600 mb-3">Escolha o arquivo</Text>
            <View className="gap-2">
              {Platform.OS !== "web" && (
                <TouchableOpacity
                  onPress={takePhoto}
                  className="flex-row items-center gap-3 border border-sage-200 rounded-xl px-4 py-3 bg-sage-50"
                >
                  <Ionicons name="camera-outline" size={20} color="#165c39" />
                  <Text className="text-sage-700 font-medium">Tirar foto</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={pickImage}
                className="flex-row items-center gap-3 border border-sage-200 rounded-xl px-4 py-3 bg-sage-50"
              >
                <Ionicons name="images-outline" size={20} color="#165c39" />
                <Text className="text-sage-700 font-medium">Galeria de fotos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickDocument}
                className="flex-row items-center gap-3 border border-sage-200 rounded-xl px-4 py-3 bg-sage-50"
              >
                <Ionicons name="document-outline" size={20} color="#165c39" />
                <Text className="text-sage-700 font-medium">Documento / PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-medium text-sage-600">Arquivo selecionado</Text>
              <TouchableOpacity onPress={() => { setPicked(null); setDocName(""); }}>
                <Text className="text-sage-400 text-xs underline">Trocar</Text>
              </TouchableOpacity>
            </View>

            {isImage && picked.kind === "image" ? (
              <Image
                source={{ uri: picked.uri }}
                className="w-full rounded-xl mb-3"
                style={{ height: 180 }}
                resizeMode="cover"
              />
            ) : (
              <View className="bg-red-50 border border-red-100 rounded-xl px-4 py-4 flex-row items-center gap-3 mb-3">
                <Ionicons name="document-text" size={32} color="#ef4444" />
                <Text className="text-sage-700 text-sm flex-1" numberOfLines={2}>{picked.name}</Text>
              </View>
            )}

            <Text className="text-xs text-sage-500 mb-1">Nome do documento</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              value={docName}
              onChangeText={(v) => { setDocName(v); setError(null); }}
              placeholder="Ex: Resultado de exame, Receita..."
              placeholderTextColor="#60b880"
            />
          </View>
        )}

        {picked && (
          <TouchableOpacity
            className="bg-sage-400 rounded-2xl py-4 items-center mt-4 mb-8"
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Salvar documento</Text>
            )}
          </TouchableOpacity>
        )}

        {!picked && <View className="h-8" />}
      </ScrollView>
    </SafeAreaView>
  );
}
