import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  message: string | null;
}

export function FormError({ message }: Props) {
  if (!message) return null;
  return (
    <View className="flex-row items-center bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
      <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
      <Text className="text-red-500 text-sm ml-2 flex-1">{message}</Text>
    </View>
  );
}
