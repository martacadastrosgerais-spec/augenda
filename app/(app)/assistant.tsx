import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Pet } from "@/types";

const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

type ActionType =
  | "add_vaccine"
  | "add_medication"
  | "add_dose"
  | "add_incident"
  | "add_log"
  | "add_procedure"
  | "unknown";

interface ParsedAction {
  action: ActionType;
  pet_id: string;
  pet_name: string;
  data: Record<string, any>;
  confirmation: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: ParsedAction;
  status?: "pending" | "saved" | "cancelled";
}

const ACTION_LABELS: Record<ActionType, string> = {
  add_vaccine:    "Vacina",
  add_medication: "Medicamento",
  add_dose:       "Dose",
  add_incident:   "Adversidade",
  add_log:        "Anotação",
  add_procedure:  "Procedimento",
  unknown:        "Dúvida",
};

const ACTION_COLORS: Record<ActionType, string> = {
  add_vaccine:    "bg-blue-100 text-blue-700",
  add_medication: "bg-sage-100 text-sage-700",
  add_dose:       "bg-green-100 text-green-700",
  add_incident:   "bg-red-100 text-red-700",
  add_log:        "bg-amber-100 text-amber-700",
  add_procedure:  "bg-purple-100 text-purple-700",
  unknown:        "bg-gray-100 text-gray-600",
};

function formatFieldValue(key: string, value: any): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (key.includes("_at") && typeof value === "string") {
    const d = new Date(value.includes("T") ? value : value + "T12:00:00");
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  }
  return String(value);
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nome", dose: "Dose", frequency: "Frequência",
  started_at: "Início", ends_at: "Fim", continuous: "Uso contínuo",
  applied_at: "Aplicada em", next_dose_at: "Próxima dose", vet_name: "Veterinário",
  title: "Título", type: "Tipo", performed_at: "Data",
  category: "Categoria", description: "Descrição", occurred_at: "Quando",
  medication_name: "Medicamento", administered_at: "Administrada em",
  severity: "Gravidade", noted_at: "Quando",
};

const CATEGORY_LABELS: Record<string, string> = {
  vomit: "Vômito", diarrhea: "Diarreia", wound: "Ferida/Lesão",
  behavior: "Comportamento", allergy_reaction: "Reação alérgica", other: "Outro",
};
const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  consultation: "Consulta", surgery: "Cirurgia", exam: "Exame", other: "Outro",
};
const SEVERITY_LABELS: Record<string, string> = {
  low: "Normal", medium: "Atenção", high: "Urgente",
};

function displayValue(key: string, value: any): string {
  if (key === "category") return CATEGORY_LABELS[value] ?? value;
  if (key === "type") return PROCEDURE_TYPE_LABELS[value] ?? value;
  if (key === "severity") return SEVERITY_LABELS[value] ?? value;
  return formatFieldValue(key, value);
}

async function callClaude(
  userMessage: string,
  pets: Pet[],
  history: { role: string; content: string }[]
): Promise<ParsedAction> {
  const today = new Date().toLocaleDateString("pt-BR");
  const nowISO = new Date().toISOString();

  const systemPrompt = `Você é o assistente do AUgenda, app de saúde pet. Seu papel é entender o que o tutor quer registrar e extrair dados estruturados.

Pets do usuário:
${pets.map((p) => `- ${p.name} (id: ${p.id}, espécie: ${p.species === "dog" ? "cachorro" : "gato"})`).join("\n")}

Data/hora atual: ${today} — ${nowISO}

Responda SEMPRE com JSON válido, sem markdown, sem texto fora do JSON:
{
  "action": "add_vaccine" | "add_medication" | "add_dose" | "add_incident" | "add_log" | "add_procedure" | "unknown",
  "pet_id": "uuid do pet ou vazio se não identificado",
  "pet_name": "nome do pet",
  "data": { campos da ação },
  "confirmation": "frase amigável descrevendo o que vai ser salvo, pedindo confirmação"
}

Campos por ação:
- add_vaccine: { name, applied_at (YYYY-MM-DD), next_dose_at (YYYY-MM-DD ou null), vet_name (ou null) }
- add_medication: { name, dose (ou null), frequency (ou null), started_at (YYYY-MM-DD), ends_at (YYYY-MM-DD ou null), continuous (bool) }
- add_dose: { medication_name, administered_at (ISO timestamp) }
- add_incident: { category ("vomit"|"diarrhea"|"wound"|"behavior"|"allergy_reaction"|"other"), description, occurred_at (ISO timestamp) }
- add_log: { description, severity ("low"|"medium"|"high"), noted_at (ISO timestamp) }
- add_procedure: { title, type ("consultation"|"surgery"|"exam"|"other"), performed_at (YYYY-MM-DD), vet_name (ou null) }
- unknown: quando faltar informação essencial — use "confirmation" para pedir o que falta

Datas relativas: "hoje" = ${today}, "agora" = ${nowISO}. Interprete "às 14h" como hora de hoje.
Se o tutor não especificar pet e houver só um, use-o. Se houver vários, pergunte.`;

  const messages = [
    ...history.slice(-6),
    { role: "user", content: userMessage },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Erro ${res.status} na API`);
  const json = await res.json();
  const text: string = json.content?.[0]?.text ?? "{}";

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta inválida da IA");
  return JSON.parse(match[0]) as ParsedAction;
}

async function saveAction(action: ParsedAction, userId: string): Promise<string> {
  const { action: type, pet_id, data } = action;

  if (type === "add_vaccine") {
    const { error } = await supabase.from("vaccines").insert({
      pet_id, name: data.name, applied_at: data.applied_at,
      next_dose_at: data.next_dose_at || null, vet_name: data.vet_name || null,
    });
    if (error) throw error;
    return `Vacina **${data.name}** registrada para ${action.pet_name}.`;
  }

  if (type === "add_medication") {
    const { error } = await supabase.from("medications").insert({
      pet_id, name: data.name, dose: data.dose || null,
      frequency: data.frequency || null, started_at: data.started_at,
      ends_at: data.continuous ? null : (data.ends_at || null),
      active: true,
    });
    if (error) throw error;
    return `Medicamento **${data.name}** registrado para ${action.pet_name}.`;
  }

  if (type === "add_dose") {
    const { data: meds } = await supabase.from("medications")
      .select("id, name").eq("pet_id", pet_id).eq("active", true);
    const med = meds?.find((m) =>
      m.name.toLowerCase().includes(data.medication_name.toLowerCase()) ||
      data.medication_name.toLowerCase().includes(m.name.toLowerCase())
    );
    if (!med) throw new Error(`Medicamento "${data.medication_name}" não encontrado entre os ativos de ${action.pet_name}.`);
    const { error } = await supabase.from("medication_doses").insert({
      medication_id: med.id, pet_id,
      administered_at: data.administered_at,
      administered_by: userId,
    });
    if (error) throw error;
    return `Dose de **${med.name}** registrada para ${action.pet_name}.`;
  }

  if (type === "add_incident") {
    const { error } = await supabase.from("incidents").insert({
      pet_id, category: data.category,
      description: data.description, occurred_at: data.occurred_at,
    });
    if (error) throw error;
    return `Adversidade registrada para ${action.pet_name}.`;
  }

  if (type === "add_log") {
    const { error } = await supabase.from("symptom_logs").insert({
      pet_id, description: data.description,
      severity: data.severity, noted_at: data.noted_at,
    });
    if (error) throw error;
    return `Anotação salva para ${action.pet_name}.`;
  }

  if (type === "add_procedure") {
    const { error } = await supabase.from("procedures").insert({
      pet_id, title: data.title, type: data.type,
      performed_at: data.performed_at, vet_name: data.vet_name || null,
    });
    if (error) throw error;
    return `Procedimento **${data.title}** registrado para ${action.pet_name}.`;
  }

  throw new Error("Ação desconhecida.");
}

export default function AssistantScreen() {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Olá! Pode me contar o que aconteceu com seus pets e eu registro para você. Por exemplo:\n\n• \"Pipo tomou Bravecto hoje\"\n• \"Bento vomitou às 14h\"\n• \"Serafim foi na consulta de rotina ontem\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);
  const historyRef = useRef<{ role: string; content: string }[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadPets();
    }, [user])
  );

  async function loadPets() {
    if (!user) return;
    const [ownedRes, memberRes] = await Promise.all([
      supabase.from("pets").select("*").eq("user_id", user.id),
      supabase.from("pet_members").select("pet_id, pets(*)").eq("user_id", user.id),
    ]);
    const owned: Pet[] = ownedRes.data ?? [];
    const member: Pet[] = (memberRes.data ?? []).map((m: any) => m.pets).filter(Boolean);
    const ownedIds = new Set(owned.map((p) => p.id));
    setPets([...owned, ...member.filter((p) => !ownedIds.has(p.id))]);
  }

  function addMessage(msg: Omit<Message, "id">) {
    const newMsg = { ...msg, id: Date.now().toString() + Math.random() };
    setMessages((prev) => [newMsg, ...prev]);
    return newMsg;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    addMessage({ role: "user", text });
    historyRef.current.push({ role: "user", content: text });

    setLoading(true);
    try {
      const parsed = await callClaude(text, pets, historyRef.current);
      historyRef.current.push({ role: "assistant", content: parsed.confirmation });

      const msg = addMessage({
        role: "assistant",
        text: parsed.confirmation,
        action: parsed.action !== "unknown" && parsed.pet_id ? parsed : undefined,
        status: parsed.action !== "unknown" && parsed.pet_id ? "pending" : undefined,
      });

      // Auto-scroll
      setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
    } catch (e: any) {
      addMessage({ role: "assistant", text: `Ops, algo deu errado: ${e.message}` });
    }
    setLoading(false);
  }

  async function handleConfirm(msgId: string, action: ParsedAction) {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, status: "saving" as any } : m)
    );
    try {
      const successText = await saveAction(action, user!.id);
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, status: "saved", text: successText } : m)
      );
      historyRef.current.push({ role: "assistant", content: successText });
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, status: "pending", text: `Erro ao salvar: ${e.message}` } : m)
      );
    }
  }

  function handleCancel(msgId: string) {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, status: "cancelled", action: undefined } : m)
    );
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === "user";

    if (isUser) {
      return (
        <View className="items-end mb-3 px-4">
          <View className="bg-sage-400 rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs">
            <Text className="text-white text-sm">{item.text}</Text>
          </View>
        </View>
      );
    }

    const isSaved = item.status === "saved";
    const isCancelled = item.status === "cancelled";
    const isSaving = (item.status as any) === "saving";
    const hasPendingAction = item.action && item.status === "pending";

    return (
      <View className="items-start mb-3 px-4">
        <View className="flex-row items-start gap-2 max-w-xs">
          <View className="w-7 h-7 rounded-full bg-sage-100 items-center justify-center mt-0.5">
            <Text className="text-sm">🐾</Text>
          </View>
          <View className="flex-1">
            {/* Bubble de texto */}
            <View className={`rounded-2xl rounded-tl-sm px-4 py-3 ${isSaved ? "bg-green-50 border border-green-200" : "bg-white border border-sage-100"}`}>
              {isSaved && <Ionicons name="checkmark-circle" size={16} color="#22c55e" style={{ marginBottom: 4 }} />}
              <Text className={`text-sm leading-relaxed ${isSaved ? "text-green-700" : "text-sage-800"}`}>
                {item.text}
              </Text>
            </View>

            {/* Card de confirmação */}
            {hasPendingAction && item.action && (
              <View className="bg-white border border-sage-200 rounded-2xl mt-2 overflow-hidden">
                <View className="px-4 pt-3 pb-2 border-b border-sage-50 flex-row items-center gap-2">
                  <View className={`px-2 py-0.5 rounded-full ${ACTION_COLORS[item.action.action]}`}>
                    <Text className={`text-xs font-semibold ${ACTION_COLORS[item.action.action].split(" ")[1]}`}>
                      {ACTION_LABELS[item.action.action]}
                    </Text>
                  </View>
                  <Text className="text-sage-600 text-xs font-medium">{item.action.pet_name}</Text>
                </View>
                <View className="px-4 py-3 gap-1">
                  {Object.entries(item.action.data)
                    .filter(([, v]) => v !== null && v !== undefined && v !== "")
                    .map(([key, value]) => {
                      const displayed = displayValue(key, value);
                      if (!displayed) return null;
                      return (
                        <View key={key} className="flex-row gap-2">
                          <Text className="text-sage-400 text-xs w-24">{FIELD_LABELS[key] ?? key}</Text>
                          <Text className="text-sage-700 text-xs font-medium flex-1">{displayed}</Text>
                        </View>
                      );
                    })}
                </View>
                <View className="flex-row border-t border-sage-100">
                  <TouchableOpacity
                    onPress={() => handleCancel(item.id)}
                    className="flex-1 py-3 items-center"
                  >
                    <Text className="text-sage-400 text-sm font-medium">Cancelar</Text>
                  </TouchableOpacity>
                  <View className="w-px bg-sage-100" />
                  <TouchableOpacity
                    onPress={() => handleConfirm(item.id, item.action!)}
                    className="flex-1 py-3 items-center"
                  >
                    {isSaving
                      ? <ActivityIndicator size="small" color="#32a060" />
                      : <Text className="text-sage-600 text-sm font-semibold">Confirmar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isCancelled && (
              <Text className="text-sage-400 text-xs mt-1 ml-1">Cancelado</Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sage-700" edges={["top"]}>
      <View className="bg-sage-700 px-5 pt-4 pb-5">
        <Text className="text-white text-2xl font-bold">Assistente</Text>
        <Text className="text-white/60 text-sm mt-0.5">Registre em linguagem natural</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1 bg-cream rounded-t-3xl overflow-hidden"
        style={{ marginTop: -12 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        />

        {/* Input */}
        <View className="px-4 pb-4 pt-2 border-t border-sage-100 bg-cream flex-row items-end gap-2">
          <TextInput
            className="flex-1 bg-white border border-sage-200 rounded-2xl px-4 py-3 text-sage-800 text-sm"
            placeholder="Ex: Pipo tomou Bravecto hoje..."
            placeholderTextColor="#60b880"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            style={{ maxHeight: 100 }}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={loading || !input.trim()}
            className={`w-11 h-11 rounded-full items-center justify-center ${input.trim() && !loading ? "bg-sage-400" : "bg-sage-200"}`}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
