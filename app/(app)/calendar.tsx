import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CalendarScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream items-center justify-center">
      <Text className="text-5xl mb-4">📅</Text>
      <Text className="text-xl font-semibold text-sage-600">Calendário</Text>
      <Text className="text-sage-400 mt-2">Em breve</Text>
    </SafeAreaView>
  );
}
