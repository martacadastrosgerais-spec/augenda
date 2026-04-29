import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 items-center justify-center p-5 bg-cream">
        <Text className="text-xl font-bold text-sage-700">Página não encontrada</Text>
        <Link href="/" className="mt-4">
          <Text className="text-sage-500">Voltar ao início</Text>
        </Link>
      </View>
    </>
  );
}
