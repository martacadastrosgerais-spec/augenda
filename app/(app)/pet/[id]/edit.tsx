import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Image,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { BreedPicker } from "@/components/BreedPicker";
import { FormError } from "@/components/FormError";
import { DOG_BREEDS, CAT_BREEDS } from "@/constants/breeds";
import { formatDateInput, formatDateISO, parseDateBR } from "@/lib/utils";
import type { Species, PetSex, WeightLog } from "@/types";

const SEX_OPTIONS: { value: PetSex; label: string }[] = [
  { value: "male", label: "Macho" },
  { value: "female", label: "Fêmea" },
  { value: "unknown", label: "Não sei" },
];

async function uploadPhoto(petId: string, uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    const path = `${petId}/photo.jpg`;
    const { error } = await supabase.storage.from("pet-photos").upload(path, blob, {
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

export default function EditPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Basic info
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<PetSex | "">("");
  const [microchip, setMicrochip] = useState("");
  const [neutered, setNeutered] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);

  // Health & emergency
  const [allergies, setAllergies] = useState("");
  const [vetName, setVetName] = useState("");
  const [vetPhone, setVetPhone] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyCardEnabled, setEmergencyCardEnabled] = useState(false);

  // Weight history
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [newWeightKg, setNewWeightKg] = useState("");
  const [newWeightDate, setNewWeightDate] = useState(
    new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  );
  const [addingWeight, setAddingWeight] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) { loadPet(); loadWeightLogs(); }
  }, [id]);

  async function loadPet() {
    const { data, error: fetchError } = await supabase
      .from("pets")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !data) {
      setError("Não foi possível carregar o pet.");
      setLoading(false);
      return;
    }

    setName(data.name);
    setSpecies(data.species);
    setBreed(data.breed ?? "");
    setBirthDate(data.birth_date ? formatDateISO(data.birth_date) : "");
    setSex(data.sex ?? "");
    setMicrochip(data.microchip ?? "");
    setNeutered(data.neutered ?? false);
    setPhotoUrl(data.photo_url ?? null);
    setAllergies(data.allergies ?? "");
    setVetName(data.vet_name ?? "");
    setVetPhone(data.vet_phone ?? "");
    setEmergencyContactName(data.emergency_contact_name ?? "");
    setEmergencyContactPhone(data.emergency_contact_phone ?? "");
    setEmergencyCardEnabled(data.emergency_card_enabled ?? false);
    setLoading(false);
  }

  async function loadWeightLogs() {
    const { data } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("pet_id", id)
      .order("measured_at", { ascending: false })
      .limit(20);
    setWeightLogs(data ?? []);
  }

  async function handleAddWeight() {
    if (!newWeightKg.trim()) return;
    const kg = parseFloat(newWeightKg.replace(",", "."));
    if (isNaN(kg) || kg <= 0) { setError("Peso inválido."); return; }
    const dateISO = parseDateBR(newWeightDate);
    if (!dateISO) { setError("Data de pesagem inválida."); return; }

    setAddingWeight(true);
    const { error: dbError } = await supabase.from("weight_logs").insert({
      pet_id: id,
      weight_kg: kg,
      measured_at: dateISO,
    });
    if (!dbError) {
      await supabase.from("pets").update({ weight_kg: kg }).eq("id", id);
      setNewWeightKg("");
      await loadWeightLogs();
    }
    setAddingWeight(false);
  }

  async function handleDeleteWeight(logId: string) {
    await supabase.from("weight_logs").delete().eq("id", logId);
    await loadWeightLogs();
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { setError("Permissão de fotos negada."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setNewPhotoUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") { setError("Permissão de câmera negada."); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setNewPhotoUri(result.assets[0].uri);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Informe o nome do pet."); return; }
    const parsedDate = birthDate ? parseDateBR(birthDate) : null;
    if (birthDate && !parsedDate) { setError("Data inválida. Use o formato DD/MM/AAAA."); return; }

    setSaving(true);

    let finalPhotoUrl = photoUrl;
    if (newPhotoUri) {
      const uploaded = await uploadPhoto(id, newPhotoUri);
      if (uploaded) finalPhotoUrl = uploaded;
    }

    const { error: dbError } = await supabase
      .from("pets")
      .update({
        name: name.trim(),
        species,
        breed: breed.trim() || null,
        birth_date: parsedDate,
        sex: sex || null,
        microchip: microchip.trim() || null,
        neutered,
        photo_url: finalPhotoUrl,
        allergies: allergies.trim() || null,
        vet_name: vetName.trim() || null,
        vet_phone: vetPhone.trim() || null,
        emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null,
        emergency_card_enabled: emergencyCardEnabled,
      })
      .eq("id", id);
    setSaving(false);

    if (dbError) {
      setError("Não foi possível salvar. Tente novamente.");
    } else {
      router.replace(`/(app)/pet/${id}` as any);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#32a060" size="large" />
      </SafeAreaView>
    );
  }

  const displayPhoto = newPhotoUri ?? photoUrl;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.replace(`/(app)/pet/${id}` as any)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#165c39" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-sage-700">Editar Pet</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <FormError message={error} />

        {/* Foto */}
        <View className="items-center mt-4 mb-2">
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
            {displayPhoto ? (
              <Image source={{ uri: displayPhoto }} className="w-28 h-28 rounded-full bg-sage-100" />
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

        {/* Informações básicas */}
        <View className="bg-white rounded-2xl p-5 mt-2 shadow-sm">
          <Text className="text-base font-semibold text-sage-700 mb-4">Informações básicas</Text>

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

          <View className="mb-4">
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

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-2 font-medium">Sexo</Text>
            <View className="flex-row gap-2">
              {SEX_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setSex(sex === opt.value ? "" : opt.value)}
                  className={`flex-1 py-2 rounded-xl items-center border ${
                    sex === opt.value ? "bg-sage-400 border-sage-400" : "bg-white border-sage-200"
                  }`}
                >
                  <Text className={`text-sm font-medium ${sex === opt.value ? "text-white" : "text-sage-600"}`}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-sage-600 font-medium">Castrado(a)</Text>
            <Switch
              value={neutered}
              onValueChange={setNeutered}
              trackColor={{ false: "#cce8d4", true: "#32a060" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Histórico de peso */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="barbell-outline" size={18} color="#165c39" />
            <Text className="text-base font-semibold text-sage-700">Histórico de peso</Text>
          </View>

          {/* Adicionar nova pesagem */}
          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <Text className="text-xs text-sage-500 mb-1">Peso (kg)</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-3 py-2.5 text-sage-800 bg-sage-50 text-sm"
                placeholder="Ex: 4,5"
                placeholderTextColor="#60b880"
                value={newWeightKg}
                onChangeText={(v) => { setNewWeightKg(v); setError(null); }}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-sage-500 mb-1">Data</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-3 py-2.5 text-sage-800 bg-sage-50 text-sm"
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#60b880"
                value={newWeightDate}
                onChangeText={(t) => setNewWeightDate(formatDateInput(t))}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <TouchableOpacity
              onPress={handleAddWeight}
              disabled={addingWeight || !newWeightKg.trim()}
              className={`self-end rounded-xl px-3 py-2.5 items-center justify-center ${newWeightKg.trim() ? "bg-sage-400" : "bg-sage-200"}`}
            >
              {addingWeight
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="add" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>

          {weightLogs.length === 0 ? (
            <Text className="text-sage-400 text-sm text-center py-3">Nenhuma pesagem registrada</Text>
          ) : (
            weightLogs.map((log, i) => (
              <View key={log.id} className={`flex-row items-center justify-between py-2 ${i < weightLogs.length - 1 ? "border-b border-sage-50" : ""}`}>
                <Text className="text-sage-700 font-semibold text-sm">{log.weight_kg} kg</Text>
                <Text className="text-sage-400 text-xs flex-1 ml-3">{formatDateISO(log.measured_at)}</Text>
                <TouchableOpacity onPress={() => handleDeleteWeight(log.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color="#d1d5db" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Saúde */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <Text className="text-base font-semibold text-sage-700 mb-4">Saúde</Text>
          <View className="mb-2">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Alergias e restrições</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Ex: alergia a frango, intolerância a lactose..."
              placeholderTextColor="#60b880"
              value={allergies}
              onChangeText={setAllergies}
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: "top" }}
            />
          </View>
        </View>

        {/* Contatos */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <Text className="text-base font-semibold text-sage-700 mb-4">Contatos</Text>

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Veterinário</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50 mb-2"
              placeholder="Nome do veterinário"
              placeholderTextColor="#60b880"
              value={vetName}
              onChangeText={setVetName}
            />
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Telefone"
              placeholderTextColor="#60b880"
              value={vetPhone}
              onChangeText={setVetPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View className="mb-2">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Contato de emergência</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50 mb-2"
              placeholder="Nome"
              placeholderTextColor="#60b880"
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
            />
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Telefone"
              placeholderTextColor="#60b880"
              value={emergencyContactPhone}
              onChangeText={setEmergencyContactPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Cartão de emergência */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-base font-semibold text-sage-700">Cartão de emergência</Text>
              <Text className="text-sage-400 text-xs mt-0.5">
                Gera um link público com informações vitais do pet, acessível sem login.
              </Text>
            </View>
            <Switch
              value={emergencyCardEnabled}
              onValueChange={setEmergencyCardEnabled}
              trackColor={{ false: "#cce8d4", true: "#32a060" }}
              thumbColor="#fff"
            />
          </View>
          {emergencyCardEnabled && (
            <View className="mt-3 pt-3 border-t border-sage-100 flex-row items-center gap-2">
              <Ionicons name="shield-checkmark-outline" size={14} color="#32a060" />
              <Text className="text-sage-500 text-xs">
                O link público estará disponível na tela do pet após salvar.
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          className="bg-sage-400 rounded-2xl py-4 items-center mt-4 mb-8"
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Salvar alterações</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
