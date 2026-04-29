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

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setError(null);
    if (!email || !password || !confirm) {
      setError("Preencha todos os campos.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (authError) setError("Não foi possível criar a conta. Tente novamente.");
    // sucesso: onAuthStateChange dispara e _layout redireciona automaticamente
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
          <Text className="text-xl font-semibold text-sage-700 mb-6">Criar conta</Text>

          <FormError message={error} />

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">E-mail</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="seu@email.com"
              placeholderTextColor="#a8c5ad"
              value={email}
              onChangeText={(v) => { setEmail(v); setError(null); }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Senha</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="mínimo 6 caracteres"
              placeholderTextColor="#a8c5ad"
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              secureTextEntry
            />
          </View>

          <View className="mb-6">
            <Text className="text-sm text-sage-600 mb-1 font-medium">Confirmar senha</Text>
            <TextInput
              className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="••••••••"
              placeholderTextColor="#a8c5ad"
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setError(null); }}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            className="bg-sage-400 rounded-xl py-4 items-center"
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Cadastrar</Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-6">
          <Text className="text-sage-500">Já tem conta? </Text>
          <Link href="/(auth)/login">
            <Text className="text-sage-600 font-semibold">Entrar</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
