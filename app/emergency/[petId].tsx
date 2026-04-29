import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { getAge } from "@/lib/utils";
import type { Pet, Medication, Vaccine } from "@/types";

const SPECIES_LABEL: Record<string, string> = { dog: "Cão", cat: "Gato" };
const SEX_LABEL: Record<string, string> = { male: "Macho", female: "Fêmea", unknown: "—" };

export default function EmergencyCardScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (petId) fetchCard();
  }, [petId]);

  async function fetchCard() {
    const [petRes, medsRes, vacRes] = await Promise.all([
      supabase.from("pets").select("*").eq("id", petId).eq("emergency_card_enabled", true).single(),
      supabase.from("medications").select("*").eq("pet_id", petId).eq("active", true).order("started_at"),
      supabase.from("vaccines").select("*").eq("pet_id", petId).order("applied_at", { ascending: false }).limit(5),
    ]);

    if (petRes.error || !petRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPet(petRes.data);
    setMedications(medsRes.data ?? []);
    setVaccines(vacRes.data ?? []);
    setLoading(false);
  }

  function callPhone(phone: string) {
    Linking.openURL(`tel:${phone.replace(/\D/g, "")}`);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#7da87b" size="large" />
      </SafeAreaView>
    );
  }

  if (notFound || !pet) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Text className="text-5xl mb-4">🐾</Text>
        <Text className="text-xl font-bold text-sage-700 text-center">Cartão não disponível</Text>
        <Text className="text-sage-400 text-center mt-2">
          Este cartão de emergência não existe ou foi desativado pelo tutor.
        </Text>
      </SafeAreaView>
    );
  }

  const age = getAge(pet.birth_date);
  const SPECIES_ICON = pet.species === "dog" ? "🐶" : "🐱";

  return (
    <SafeAreaView className="flex-1 bg-cream">
      {/* Header vermelho de emergência */}
      <View className="bg-red-500 px-5 py-4 flex-row items-center gap-3">
        <Ionicons name="medical" size={24} color="#fff" />
        <View>
          <Text className="text-white font-bold text-lg">Cartão de Emergência</Text>
          <Text className="text-red-100 text-xs">AUgenda — Saúde Pet</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Identidade */}
        <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 rounded-full bg-sage-100 items-center justify-center">
              <Text className="text-3xl">{SPECIES_ICON}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-sage-800">{pet.name}</Text>
              <Text className="text-sage-500 text-sm">
                {SPECIES_LABEL[pet.species] ?? pet.species}
                {pet.breed ? ` · ${pet.breed}` : ""}
              </Text>
              {pet.sex && pet.sex !== "unknown" && (
                <Text className="text-sage-400 text-xs mt-0.5">{SEX_LABEL[pet.sex]}{pet.neutered ? " · Castrado(a)" : ""}</Text>
              )}
            </View>
          </View>

          <View className="flex-row flex-wrap gap-3 mt-4 pt-4 border-t border-sage-100">
            {age && (
              <View className="items-center bg-sage-50 rounded-xl px-4 py-2">
                <Text className="text-sage-400 text-xs">Idade</Text>
                <Text className="text-sage-700 font-semibold text-sm">{age}</Text>
              </View>
            )}
            {pet.weight_kg != null && (
              <View className="items-center bg-sage-50 rounded-xl px-4 py-2">
                <Text className="text-sage-400 text-xs">Peso</Text>
                <Text className="text-sage-700 font-semibold text-sm">{pet.weight_kg} kg</Text>
              </View>
            )}
            {pet.microchip && (
              <View className="items-center bg-sage-50 rounded-xl px-4 py-2">
                <Text className="text-sage-400 text-xs">Microchip</Text>
                <Text className="text-sage-700 font-semibold text-sm">{pet.microchip}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Alergias */}
        {pet.allergies ? (
          <View className="bg-amber-50 border border-amber-200 mx-4 mt-3 rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-1">
              <Ionicons name="warning-outline" size={16} color="#d97706" />
              <Text className="text-amber-700 font-semibold text-sm">Alergias e restrições</Text>
            </View>
            <Text className="text-amber-800 text-sm">{pet.allergies}</Text>
          </View>
        ) : null}

        {/* Medicamentos ativos */}
        {medications.length > 0 && (
          <View className="bg-white mx-4 mt-3 rounded-2xl p-5 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="medical-outline" size={16} color="#7da87b" />
              <Text className="text-base font-semibold text-sage-700">Medicamentos em uso</Text>
            </View>
            {medications.map((med) => (
              <View key={med.id} className="py-2 border-b border-sage-50 last:border-0">
                <Text className="text-sage-800 font-medium">{med.name}</Text>
                {med.dose && <Text className="text-sage-500 text-xs">{med.dose}</Text>}
                {med.frequency && <Text className="text-sage-400 text-xs">{med.frequency}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Vacinas recentes */}
        {vaccines.length > 0 && (
          <View className="bg-white mx-4 mt-3 rounded-2xl p-5 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="shield-checkmark-outline" size={16} color="#7da87b" />
              <Text className="text-base font-semibold text-sage-700">Vacinas recentes</Text>
            </View>
            {vaccines.map((vac) => (
              <View key={vac.id} className="flex-row justify-between py-2 border-b border-sage-50 last:border-0">
                <Text className="text-sage-800 text-sm">{vac.name}</Text>
                <Text className="text-sage-400 text-xs">{vac.applied_at}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Contatos */}
        {(pet.vet_name || pet.vet_phone || pet.emergency_contact_name || pet.emergency_contact_phone) && (
          <View className="bg-white mx-4 mt-3 mb-6 rounded-2xl p-5 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="call-outline" size={16} color="#7da87b" />
              <Text className="text-base font-semibold text-sage-700">Contatos</Text>
            </View>

            {(pet.vet_name || pet.vet_phone) && (
              <View className="mb-3">
                <Text className="text-sage-400 text-xs mb-1">Veterinário</Text>
                {pet.vet_name && <Text className="text-sage-800 font-medium">{pet.vet_name}</Text>}
                {pet.vet_phone && (
                  <TouchableOpacity onPress={() => callPhone(pet.vet_phone!)} className="flex-row items-center gap-1 mt-0.5">
                    <Ionicons name="call" size={13} color="#7da87b" />
                    <Text className="text-sage-500 text-sm">{pet.vet_phone}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {(pet.emergency_contact_name || pet.emergency_contact_phone) && (
              <View>
                <Text className="text-sage-400 text-xs mb-1">Contato de emergência</Text>
                {pet.emergency_contact_name && (
                  <Text className="text-sage-800 font-medium">{pet.emergency_contact_name}</Text>
                )}
                {pet.emergency_contact_phone && (
                  <TouchableOpacity onPress={() => callPhone(pet.emergency_contact_phone!)} className="flex-row items-center gap-1 mt-0.5">
                    <Ionicons name="call" size={13} color="#e57373" />
                    <Text className="text-red-400 text-sm font-medium">{pet.emergency_contact_phone}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
