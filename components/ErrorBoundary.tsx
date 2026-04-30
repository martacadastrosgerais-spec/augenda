import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 bg-cream items-center justify-center px-8">
          <Ionicons name="warning-outline" size={48} color="#60b880" />
          <Text className="text-xl font-semibold text-sage-600 text-center mt-4">
            Algo deu errado
          </Text>
          <Text className="text-sage-400 text-center mt-2 text-sm">
            {this.state.error.message}
          </Text>
          <TouchableOpacity
            className="bg-sage-400 rounded-xl px-6 py-3 mt-6"
            onPress={() => this.setState({ error: null })}
          >
            <Text className="text-white font-semibold">Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
