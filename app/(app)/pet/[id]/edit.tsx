import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { BreedPicker } from "@/components/BreedPicker";
import { FormError } from "@/components/FormError";
import { DOG_BREEDS, CAT_BREEDS } from "@/constants/breeds";
import { formatDateInput, formatDateISO, parseDateBR } from "@/lib/utils";
import type { Species, PetSex } from "@/types";

const SEX_OPTIONS: { value: PetSex; label: string; icon: string }[] = [
  { value: "male", label: "Macho", icon: "♂" },
  { value: "female", label: "Fêmea", icon: "♀" },
  { value: "unknown", label: "Não sei", icon: "?" },
];

export default function EditPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Basic info
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [sex, setSex] = useState<PetSex | "">("");
  const [microchip, setMicrochip] = useState("");
  const [neutered, setNeutered] = useState(false);

  // Health & emergency
  const [allergies, setAllergies] = useState("");
  const [vetName, setVetName] = useState("");
  const [vetPhone, setVetPhone] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyCardEnabled, setEmergencyCardEnabled] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadPet();
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
    setWeightKg(data.weight_kg != null ? String(data.weight_kg) : "");
    setSex(data.sex ?? "");
    setMicrochip(data.microchip ?? "");
    setNeutered(data.neutered ?? false);
    setAllergies(data.allergies ?? "");
    setVetName(data.vet_name ?? "");
    setVetPhone(data.vet_phone ?? "");
    setEmergencyContactName(data.emergency_contact_name ?? "");
    setEmergencyContactPhone(data.emergency_contact_phone ?? "");
    setEmergencyCardEnabled(data.emergency_card_enabled ?? false);
    setLoading(false);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Informe o nome do pet."); return; }
    const parsedDate = birthDate ? parseDateBR(birthDate) : null;
    if (birthDate && !parsedDate) { setError("Data inválida. Use o formato DD/MM/AAAA."); return; }
    const parsedWeight = weightKg ? parseFloat(weightKg.replace(",", ".")) : null;
    if (weightKg && isNaN(parsedWeight!)) { setError("Peso inválido."); return; }

    setSaving(true);
    const { error: dbError } = await supabase
      .from("pets")
      .update({
        name: name.trim(),
        species,
        breed: breed.trim() || null,
        birth_date: parsedDate,
        weight_kg: parsedWeight,
        sex: sex || null,
        microchip: microchip.trim() || null,
        neutered,
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
        <Text className="text-xl font-bold text-sage-700">Editar Pet</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <FormError message={error} />

        {/* Informações básicas */}
        <View className="bg-white rounded-2xl p-5 mt-4 shadow-sm">
          <Text className="text-base font-semibold text-sage-700 mb-4">Informações básicas</Text>

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

          <View className="mb-4">
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

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm text-sage-600 mb-1 font-medium">Peso (kg)</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder="Ex: 4,5"
                placeholderTextColor="#a8c5ad"
                value={weightKg}
                onChangeText={(v) => { setWeightKg(v); setError(null); }}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-sage-600 mb-1 font-medium">Microchip</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
                placeholder="Número"
                placeholderTextColor="#a8c5ad"
                value={microchip}
                onChangeText={setMicrochip}
              />
            </View>
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
              trackColor={{ false: "#e6ede7", true: "#7da87b" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Saúde */}
        <View className="bg-white rounded-2xl p-5 mt-3 shadow-sm">
          <Text className="text-base font-semibold text-sage-700 mb-4">Saúde</Text>

          <View className="mb-2">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Alergias e restrições</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Ex: alergia a frango, intolerância a lactose..."
              placeholderTextColor="#a8c5ad"
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
              placeholderTextColor="#a8c5ad"
              value={vetName}
              onChangeText={setVetName}
            />
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Telefone"
              placeholderTextColor="#a8c5ad"
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
              placeholderTextColor="#a8c5ad"
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
            />
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Telefone"
              placeholderTextColor="#a8c5ad"
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
              trackColor={{ false: "#e6ede7", true: "#7da87b" }}
              thumbColor="#fff"
            />
          </View>
          {emergencyCardEnabled && (
            <View className="mt-3 pt-3 border-t border-sage-100 flex-row items-center gap-2">
              <Ionicons name="shield-checkmark-outline" size={14} color="#7da87b" />
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
