import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { FormError } from "@/components/FormError";
import { formatDateInput, parseDateBR, formatDateISO } from "@/lib/utils";

interface ExtractedVaccine {
  name: string;
  applied_at: string;    // DD/MM/YYYY para exibição
  next_dose_at: string;  // DD/MM/YYYY para exibição
  vet_name: string;
  notes: string;
  selected: boolean;
  editing: boolean;
}

const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

function isoToBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

async function callClaudeVision(base64: string, mediaType: string): Promise<ExtractedVaccine[]> {
  if (!ANTHROPIC_KEY) throw new Error("EXPO_PUBLIC_ANTHROPIC_API_KEY não configurada no .env.local");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Esta é uma foto de carteira de vacinação de pet brasileira. Extraia TODAS as vacinas visíveis.

IMPORTANTE: As datas estão no formato brasileiro DD/MM/AAAA (dia/mês/ano). Por exemplo, "04/08/2019" significa dia 4 de agosto de 2019. Converta para ISO YYYY-MM-DD respeitando essa ordem: o primeiro número é o DIA, o segundo é o MÊS.

Retorne APENAS um array JSON válido, sem nenhum texto adicional, markdown ou código. Formato:
[
  {
    "name": "nome da vacina",
    "applied_at": "YYYY-MM-DD ou null",
    "next_dose_at": "YYYY-MM-DD ou null",
    "vet_name": "nome do veterinário ou null",
    "notes": "observações ou null"
  }
]

Se nenhuma vacina for identificada, retorne: []
Nomes comuns: V8, V10, V12, Antirrábica, Gripe, Giardia, Leishmania, Felv, Tríplice Felina.`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Erro ${res.status} na API Anthropic`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "[]";

  // Extrai o JSON mesmo que venha dentro de markdown
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  const parsed: any[] = JSON.parse(match[0]);
  return parsed.map((v) => ({
    name: v.name ?? "",
    applied_at: isoToBR(v.applied_at),
    next_dose_at: isoToBR(v.next_dose_at),
    vet_name: v.vet_name ?? "",
    notes: v.notes ?? "",
    selected: true,
    editing: false,
  }));
}

// Converte URI web para base64 via FileReader
async function uriToBase64Web(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ScanVaccinesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  type Step = "pick" | "scanning" | "review" | "saving";
  const [step, setStep] = useState<Step>("pick");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [vaccines, setVaccines] = useState<ExtractedVaccine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  async function pickImage(fromCamera: boolean) {
    setError(null);
    let result: ImagePicker.ImagePickerResult;

    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Permissão de câmera negada. Ative nas configurações.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        base64: true,
        quality: 0.7,
      });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Permissão de fotos negada. Ative nas configurações.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        base64: true,
        quality: 0.7,
      });
    }

    if (result.canceled) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setStep("scanning");

    try {
      let base64 = asset.base64 ?? null;
      const mediaType = (asset.mimeType ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";

      if (!base64 && Platform.OS === "web") {
        base64 = await uriToBase64Web(asset.uri);
      }

      if (!base64) throw new Error("Não foi possível ler a imagem.");

      const extracted = await callClaudeVision(base64, mediaType);

      if (extracted.length === 0) {
        setError("Nenhuma vacina identificada na imagem. Tente uma foto mais nítida.");
        setStep("pick");
        return;
      }

      setVaccines(extracted);
      setStep("review");
    } catch (e: any) {
      setError(e.message ?? "Erro ao processar a imagem.");
      setStep("pick");
    }
  }

  function toggleSelect(i: number) {
    setVaccines((prev) => prev.map((v, idx) => idx === i ? { ...v, selected: !v.selected } : v));
  }

  function toggleEdit(i: number) {
    setVaccines((prev) => prev.map((v, idx) => idx === i ? { ...v, editing: !v.editing } : v));
  }

  function updateField(i: number, field: keyof ExtractedVaccine, value: string) {
    setVaccines((prev) => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v));
  }

  async function handleSave() {
    const selected = vaccines.filter((v) => v.selected);
    if (selected.length === 0) { setError("Selecione ao menos uma vacina."); return; }

    setStep("saving");
    setError(null);

    const rows = selected.map((v) => ({
      pet_id: id,
      name: v.name.trim(),
      applied_at: parseDateBR(v.applied_at) ?? new Date().toISOString().split("T")[0],
      next_dose_at: v.next_dose_at ? (parseDateBR(v.next_dose_at) ?? null) : null,
      vet_name: v.vet_name.trim() || null,
      notes: v.notes.trim() || null,
    })).filter((r) => r.name);

    const { error: dbError } = await supabase.from("vaccines").insert(rows);

    if (dbError) {
      setError("Erro ao salvar. Tente novamente.");
      setStep("review");
      return;
    }

    setSavedCount(rows.length);
    router.replace(`/(app)/pet/${id}` as any);
  }

  const selectedCount = vaccines.filter((v) => v.selected).length;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Ler carteira de vacinas</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

        {/* ── Passo 1: selecionar imagem ── */}
        {step === "pick" && (
          <View className="px-5 mt-4">
            <FormError message={error} />

            <View className="bg-white rounded-2xl p-6 shadow-sm items-center mb-4">
              <View className="w-20 h-20 rounded-2xl bg-sage-50 items-center justify-center mb-4">
                <Ionicons name="scan-outline" size={42} color="#32a060" />
              </View>
              <Text className="text-sage-800 font-bold text-lg text-center mb-2">
                OCR de carteira de vacinas
              </Text>
              <Text className="text-sage-400 text-sm text-center leading-relaxed">
                Tire uma foto ou escolha da galeria. A IA vai identificar as vacinas e preencher os campos automaticamente.
              </Text>
            </View>

            <View className="gap-3 mb-4">
              {Platform.OS !== "web" && (
                <TouchableOpacity
                  className="bg-sage-700 rounded-2xl py-4 flex-row items-center justify-center gap-2"
                  onPress={() => pickImage(true)}
                >
                  <Ionicons name="camera-outline" size={20} color="#fff" />
                  <Text className="text-white font-semibold text-base">Tirar foto agora</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="bg-sage-400 rounded-2xl py-4 flex-row items-center justify-center gap-2"
                onPress={() => pickImage(false)}
              >
                <Ionicons name="images-outline" size={20} color="#fff" />
                <Text className="text-white font-semibold text-base">Escolher da galeria</Text>
              </TouchableOpacity>
            </View>

            <View className="bg-sage-50 rounded-2xl p-4 flex-row gap-3">
              <Ionicons name="bulb-outline" size={18} color="#165c39" />
              <Text className="text-sage-600 text-xs flex-1 leading-relaxed">
                Para melhores resultados: foto nítida e bem iluminada, página aberta na direção certa, sem reflexos no plástico protetor.
              </Text>
            </View>
          </View>
        )}

        {/* ── Passo 2: lendo ── */}
        {step === "scanning" && (
          <View className="px-5 mt-8 items-center">
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                className="w-full rounded-2xl mb-6"
                style={{ height: 220 }}
                resizeMode="cover"
              />
            )}
            <View className="w-16 h-16 rounded-2xl bg-sage-50 items-center justify-center mb-4">
              <ActivityIndicator size="large" color="#32a060" />
            </View>
            <Text className="text-sage-700 font-bold text-lg mb-1">Lendo carteira...</Text>
            <Text className="text-sage-400 text-sm text-center">
              A IA está identificando as vacinas. Isso leva alguns segundos.
            </Text>
          </View>
        )}

        {/* ── Passo 3: revisão ── */}
        {step === "review" && (
          <View className="px-5 mt-4 pb-8">
            <FormError message={error} />

            {/* Prévia da imagem */}
            {imageUri && (
              <TouchableOpacity
                onPress={() => setStep("pick")}
                className="mb-4"
              >
                <Image
                  source={{ uri: imageUri }}
                  className="w-full rounded-2xl"
                  style={{ height: 140 }}
                  resizeMode="cover"
                />
                <View className="absolute bottom-2 right-2 bg-black/50 rounded-lg px-2 py-1 flex-row items-center gap-1">
                  <Ionicons name="refresh-outline" size={12} color="#fff" />
                  <Text className="text-white text-xs">Nova foto</Text>
                </View>
              </TouchableOpacity>
            )}

            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sage-800 font-bold text-base">
                {vaccines.length} vacina{vaccines.length !== 1 ? "s" : ""} encontrada{vaccines.length !== 1 ? "s" : ""}
              </Text>
              <Text className="text-sage-400 text-xs">{selectedCount} selecionada{selectedCount !== 1 ? "s" : ""}</Text>
            </View>

            {vaccines.map((v, i) => (
              <View
                key={i}
                className={`bg-white rounded-2xl p-4 mb-3 shadow-sm border ${v.selected ? "border-sage-200" : "border-gray-100 opacity-50"}`}
              >
                {/* Header do card */}
                <View className="flex-row items-center justify-between mb-3">
                  <TouchableOpacity
                    className="flex-row items-center gap-2 flex-1"
                    onPress={() => toggleSelect(i)}
                    activeOpacity={0.7}
                  >
                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${v.selected ? "bg-sage-400 border-sage-400" : "border-sage-300"}`}>
                      {v.selected && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <Text className={`font-semibold text-sm flex-1 ${v.selected ? "text-sage-800" : "text-sage-400"}`} numberOfLines={1}>
                      {v.name || "Vacina sem nome"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleEdit(i)} hitSlop={8} className="ml-2">
                    <Ionicons name={v.editing ? "checkmark-circle" : "create-outline"} size={18} color="#165c39" />
                  </TouchableOpacity>
                </View>

                {v.editing ? (
                  /* Modo edição */
                  <View className="gap-3">
                    <View>
                      <Text className="text-xs text-sage-500 mb-1">Nome da vacina</Text>
                      <TextInput
                        className="border border-sage-200 rounded-xl px-3 py-2 text-sage-800 bg-sage-50 text-sm"
                        value={v.name}
                        onChangeText={(t) => updateField(i, "name", t)}
                        placeholder="Nome da vacina"
                        placeholderTextColor="#60b880"
                      />
                    </View>
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Text className="text-xs text-sage-500 mb-1">Data de aplicação</Text>
                        <TextInput
                          className="border border-sage-200 rounded-xl px-3 py-2 text-sage-800 bg-sage-50 text-sm"
                          value={v.applied_at}
                          onChangeText={(t) => updateField(i, "applied_at", formatDateInput(t))}
                          placeholder="DD/MM/AAAA"
                          placeholderTextColor="#60b880"
                          keyboardType="numeric"
                          maxLength={10}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-sage-500 mb-1">Próxima dose</Text>
                        <TextInput
                          className="border border-sage-200 rounded-xl px-3 py-2 text-sage-800 bg-sage-50 text-sm"
                          value={v.next_dose_at}
                          onChangeText={(t) => updateField(i, "next_dose_at", formatDateInput(t))}
                          placeholder="DD/MM/AAAA"
                          placeholderTextColor="#60b880"
                          keyboardType="numeric"
                          maxLength={10}
                        />
                      </View>
                    </View>
                    <View>
                      <Text className="text-xs text-sage-500 mb-1">Veterinário</Text>
                      <TextInput
                        className="border border-sage-200 rounded-xl px-3 py-2 text-sage-800 bg-sage-50 text-sm"
                        value={v.vet_name}
                        onChangeText={(t) => updateField(i, "vet_name", t)}
                        placeholder="Nome do vet"
                        placeholderTextColor="#60b880"
                      />
                    </View>
                  </View>
                ) : (
                  /* Modo leitura */
                  <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                    {v.applied_at ? (
                      <Text className="text-sage-400 text-xs">Aplicada: {v.applied_at}</Text>
                    ) : (
                      <Text className="text-amber-400 text-xs">Data não identificada</Text>
                    )}
                    {v.next_dose_at ? (
                      <Text className="text-sage-400 text-xs">Próxima: {v.next_dose_at}</Text>
                    ) : null}
                    {v.vet_name ? (
                      <Text className="text-sage-400 text-xs">Dr(a). {v.vet_name}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity
              className={`rounded-2xl py-4 items-center mt-2 ${selectedCount === 0 ? "bg-sage-200" : "bg-sage-400"}`}
              onPress={handleSave}
              disabled={selectedCount === 0}
            >
              <Text className="text-white font-bold text-base">
                Salvar {selectedCount} vacina{selectedCount !== 1 ? "s" : ""}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="rounded-2xl py-4 items-center mt-2 border border-sage-200"
              onPress={() => router.replace(`/(app)/pet/${id}` as any)}
            >
              <Text className="text-sage-500 font-medium text-base">Descartar leitura</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Passo 4: salvando ── */}
        {step === "saving" && (
          <View className="px-5 mt-8 items-center">
            <ActivityIndicator size="large" color="#32a060" />
            <Text className="text-sage-600 font-medium mt-4">Salvando vacinas...</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
