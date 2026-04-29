import { View, Text, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    Alert.alert("Sair", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-sage-700">Perfil</Text>
      </View>

      <View className="px-5 mt-4">
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <View className="flex-row items-center mb-4">
            <View className="w-14 h-14 rounded-full bg-sage-100 items-center justify-center">
              <Ionicons name="person" size={28} color="#7da87b" />
            </View>
            <View className="ml-4">
              <Text className="text-sage-400 text-xs">Conta</Text>
              <Text className="text-sage-800 font-medium">{user?.email}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          className="bg-white rounded-2xl p-4 mt-3 flex-row items-center shadow-sm"
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color="#e57373" />
          <Text className="ml-3 text-red-400 font-medium">Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
