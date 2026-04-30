import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#7da87b",
        tabBarInactiveTintColor: "#a8c5ad",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e6ede7",
          paddingBottom: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Meus Pets",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="paw" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendário",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="pet/new" options={{ href: null }} />
      <Tabs.Screen name="pet/[id]" options={{ href: null }} />
      <Tabs.Screen name="pet/[id]/add-vaccine" options={{ href: null }} />
      <Tabs.Screen name="pet/[id]/add-medication" options={{ href: null }} />
      <Tabs.Screen name="pet/[id]/share" options={{ href: null }} />
      <Tabs.Screen name="pet/[id]/edit" options={{ href: null }} />
      <Tabs.Screen name="pet/[id]/add-procedure" options={{ href: null }} />
      <Tabs.Screen name="join" options={{ href: null }} />
      <Tabs.Screen name="reminders/new" options={{ href: null }} />
      <Tabs.Screen name="pet/[id]/add-log" options={{ href: null }} />
      <Tabs.Screen name="pet/[id]/add-dose" options={{ href: null }} />
      <Tabs.Screen name="new-event" options={{ href: null }} />
    </Tabs>
  );
}
