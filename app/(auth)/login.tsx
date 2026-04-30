import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { FormError } from "@/components/FormError";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError("E-mail ou senha incorretos.");
  }

  return (
    <SafeAreaView className="flex-1 bg-sage-700" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero — verde escuro */}
          <View className="bg-sage-700 px-6 pt-10 pb-12 items-center">
            <View className="w-16 h-16 rounded-2xl bg-sage-600 items-center justify-center mb-4">
              <Text className="text-4xl">🐾</Text>
            </View>
            <Text className="text-4xl font-bold text-white tracking-tight">AUgenda</Text>
            <Text className="text-sage-300 mt-2 text-sm">Saúde e bem-estar dos seus pets</Text>
          </View>

          {/* Card do formulário */}
          <View className="flex-1 bg-cream rounded-t-3xl px-6 pt-8 pb-8" style={{ marginTop: -16 }}>
            <Text className="text-2xl font-bold text-sage-700 mb-6">Entrar</Text>

            <FormError message={error} />

            <View className="mb-4">
              <Text className="text-sm text-sage-600 mb-1 font-medium">E-mail</Text>
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-white"
                placeholder="seu@email.com"
                placeholderTextColor="#60b880"
                value={email}
                onChangeText={(v) => { setEmail(v); setError(null); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm text-sage-600 mb-1 font-medium">Senha</Text>
              <View className="flex-row items-center border border-sage-200 rounded-xl bg-white">
                <TextInput
                  className="flex-1 px-4 py-3 text-sage-800"
                  placeholder="••••••••"
                  placeholderTextColor="#60b880"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(null); }}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity
                  onPress={() => setShowPass(!showPass)}
                  className="px-3"
                  hitSlop={8}
                >
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="#60b880" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              className="bg-sage-700 rounded-xl py-4 items-center shadow-sm"
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Entrar</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row justify-center mt-6">
              <Text className="text-sage-500">Não tem conta? </Text>
              <Link href="/(auth)/register">
                <Text className="text-sage-600 font-bold">Cadastre-se</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
