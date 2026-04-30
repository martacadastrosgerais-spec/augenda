import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { FormError } from "@/components/FormError";
import {
  getNotificationPermissionStatus,
  requestNotificationPermissions,
  sendTestNotification,
} from "@/lib/notifications";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "undetermined" | "web" | null>(null);
  const [testingNotif, setTestingNotif] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setName(user?.user_metadata?.name ?? "");
      setNameError(null);
      setPasswordError(null);
      setNameSuccess(false);
      setPasswordSuccess(false);
      setNewPassword("");
      setConfirmPassword("");
      setTestSent(false);
      getNotificationPermissionStatus().then(setNotifStatus);
    }, [user])
  );

  async function handleEnableNotifications() {
    const granted = await requestNotificationPermissions();
    setNotifStatus(granted ? "granted" : "denied");
  }

  async function handleTestNotification() {
    setTestingNotif(true);
    const sent = await sendTestNotification();
    setTestingNotif(false);
    if (sent) setTestSent(true);
    else setNotifStatus("denied");
  }

  async function handleSaveName() {
    setNameError(null);
    setNameSuccess(false);
    if (!name.trim()) { setNameError("Informe um nome."); return; }

    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { name: name.trim() } });
    setSavingName(false);

    if (error) setNameError("Não foi possível salvar o nome.");
    else setNameSuccess(true);
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (!newPassword) { setPasswordError("Informe a nova senha."); return; }
    if (newPassword.length < 6) { setPasswordError("A senha deve ter pelo menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("As senhas não coincidem."); return; }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordError("Não foi possível alterar a senha. Tente fazer logout e login novamente.");
    } else {
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleSignOut() {
    if (Platform.OS === "web") {
      if (window.confirm("Tem certeza que deseja sair?")) signOut();
    } else {
      Alert.alert("Sair", "Tem certeza que deseja sair?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: signOut },
      ]);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-sage-700">Perfil</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>

        {/* Info da conta */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mt-4">
          <View className="flex-row items-center mb-4">
            <View className="w-14 h-14 rounded-full bg-sage-100 items-center justify-center">
              <Text className="text-2xl">
                {name ? name.charAt(0).toUpperCase() : "👤"}
              </Text>
            </View>
            <View className="ml-4">
              {name ? <Text className="text-sage-800 font-semibold text-base">{name}</Text> : null}
              <Text className="text-sage-400 text-sm">{user?.email}</Text>
            </View>
          </View>

          {/* Nome */}
          <Text className="text-sm text-sage-600 mb-1 font-medium">Nome de exibição</Text>
          <FormError message={nameError} />
          {nameSuccess && (
            <View className="flex-row items-center bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
              <Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" />
              <Text className="text-green-600 text-sm ml-2">Nome atualizado!</Text>
            </View>
          )}
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50"
              placeholder="Seu nome"
              placeholderTextColor="#60b880"
              value={name}
              onChangeText={(v) => { setName(v); setNameError(null); setNameSuccess(false); }}
            />
            <TouchableOpacity
              className="bg-sage-400 rounded-xl px-4 items-center justify-center"
              onPress={handleSaveName}
              disabled={savingName}
            >
              {savingName
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text className="text-white font-semibold">Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Trocar senha */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mt-3">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-sage-700">Alterar senha</Text>
            <TouchableOpacity onPress={() => setShowPasswords(!showPasswords)}>
              <Ionicons
                name={showPasswords ? "chevron-up" : "chevron-down"}
                size={20}
                color="#60b880"
              />
            </TouchableOpacity>
          </View>

          {showPasswords && (
            <>
              <FormError message={passwordError} />
              {passwordSuccess && (
                <View className="flex-row items-center bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
                  <Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" />
                  <Text className="text-green-600 text-sm ml-2">Senha alterada com sucesso!</Text>
                </View>
              )}
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50 mb-3"
                placeholder="Nova senha"
                placeholderTextColor="#60b880"
                value={newPassword}
                onChangeText={(v) => { setNewPassword(v); setPasswordError(null); setPasswordSuccess(false); }}
                secureTextEntry
              />
              <TextInput
                className="border border-sage-200 rounded-xl px-4 py-3 text-sage-800 bg-sage-50 mb-3"
                placeholder="Confirmar nova senha"
                placeholderTextColor="#60b880"
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setPasswordError(null); setPasswordSuccess(false); }}
                secureTextEntry
              />
              <TouchableOpacity
                className="bg-sage-400 rounded-xl py-3 items-center"
                onPress={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword
                  ? <ActivityIndicator color="#fff" />
                  : <Text className="text-white font-semibold">Alterar senha</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Notificações */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mt-3">
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="notifications-outline" size={20} color="#165c39" />
            <Text className="text-base font-semibold text-sage-700">Notificações</Text>
          </View>

          {notifStatus === "web" && (
            <View className="bg-sage-50 rounded-xl p-3">
              <Text className="text-sage-500 text-sm text-center">
                Notificações locais funcionam apenas no app móvel (iOS/Android).
              </Text>
            </View>
          )}

          {notifStatus === "granted" && (
            <View>
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-6 h-6 rounded-full bg-green-100 items-center justify-center">
                  <Ionicons name="checkmark" size={13} color="#16a34a" />
                </View>
                <Text className="text-green-700 text-sm font-medium">Notificações ativadas</Text>
              </View>
              {testSent ? (
                <View className="bg-green-50 border border-green-200 rounded-xl p-3 flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
                  <Text className="text-green-700 text-sm">Notificação enviada! Aguarde 5 segundos.</Text>
                </View>
              ) : (
                <TouchableOpacity
                  className="border border-sage-200 rounded-xl py-3 items-center"
                  onPress={handleTestNotification}
                  disabled={testingNotif}
                >
                  {testingNotif
                    ? <ActivityIndicator size="small" color="#32a060" />
                    : <Text className="text-sage-600 text-sm font-medium">Enviar notificação de teste</Text>}
                </TouchableOpacity>
              )}
            </View>
          )}

          {(notifStatus === "denied" || notifStatus === "undetermined") && (
            <View>
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-6 h-6 rounded-full bg-amber-100 items-center justify-center">
                  <Ionicons name="warning-outline" size={13} color="#d97706" />
                </View>
                <Text className="text-amber-700 text-sm font-medium">
                  {notifStatus === "denied" ? "Notificações bloqueadas" : "Notificações não ativadas"}
                </Text>
              </View>
              {notifStatus === "denied" ? (
                <Text className="text-sage-400 text-xs">
                  Para receber lembretes, ative as notificações nas configurações do dispositivo para o AUgenda.
                </Text>
              ) : (
                <TouchableOpacity
                  className="bg-sage-400 rounded-xl py-3 items-center"
                  onPress={handleEnableNotifications}
                >
                  <Text className="text-white font-semibold text-sm">Ativar notificações</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Sair */}
        <TouchableOpacity
          className="bg-white rounded-2xl p-4 mt-3 mb-8 flex-row items-center shadow-sm"
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color="#e57373" />
          <Text className="ml-3 text-red-400 font-medium">Sair da conta</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
