import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  value: string;
  onChange: (breed: string) => void;
  breeds: string[];
  placeholder?: string;
}

export function BreedPicker({ value, onChange, breeds, placeholder = "Buscar raça..." }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? breeds.filter((b) => b.toLowerCase().includes(query.toLowerCase()))
    : breeds;

  function select(breed: string) {
    onChange(breed);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <TouchableOpacity
        className="border border-sage-200 rounded-xl px-4 py-3 bg-sage-50 flex-row items-center justify-between"
        onPress={() => setOpen(true)}
      >
        <Text className={value ? "text-sage-800" : "text-sage-300"}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#a8c5ad" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 bg-black/30 justify-end"
          onPress={() => setOpen(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="px-4 pt-4 pb-2">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-sage-700">Selecionar raça</Text>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Ionicons name="close" size={22} color="#7da87b" />
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center bg-sage-50 border border-sage-200 rounded-xl px-3 mb-2">
                <Ionicons name="search" size={16} color="#a8c5ad" />
                <TextInput
                  className="flex-1 py-3 px-2 text-sage-800"
                  placeholder="Buscar..."
                  placeholderTextColor="#a8c5ad"
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery("")}>
                    <Ionicons name="close-circle" size={16} color="#a8c5ad" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              style={{ maxHeight: 320 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={`px-5 py-3.5 border-b border-sage-50 flex-row items-center justify-between ${
                    value === item ? "bg-sage-50" : ""
                  }`}
                  onPress={() => select(item)}
                >
                  <Text className={`text-base ${value === item ? "text-sage-600 font-medium" : "text-sage-800"}`}>
                    {item}
                  </Text>
                  {value === item && (
                    <Ionicons name="checkmark" size={18} color="#7da87b" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="items-center py-8">
                  <Text className="text-sage-300">Nenhuma raça encontrada</Text>
                </View>
              }
            />
            <View className="h-6" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
