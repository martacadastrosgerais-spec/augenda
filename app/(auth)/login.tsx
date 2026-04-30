import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { FormError } from "@/components/FormError";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <KeyboardAvoidingView
      className="flex-1 bg-cream"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-10">
          <Text className="text-4xl font-bold text-sage-600">AUgenda</Text>
          <Text className="text-sage-400 mt-1">Saúde e bem-estar dos seus pets</Text>
        </View>

        <View className="bg-white rounded-2xl p-6 shadow-sm">
          <Text className="text-xl font-semibold text-sage-700 mb-6">Entrar</Text>

          <FormError message={error} />

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">E-mail</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
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
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="••••••••"
              placeholderTextColor="#60b880"
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            className="bg-sage-400 rounded-xl py-4 items-center"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Entrar</Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-6">
          <Text className="text-sage-500">Não tem conta? </Text>
          <Link href="/(auth)/register">
            <Text className="text-sage-600 font-semibold">Cadastre-se</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
