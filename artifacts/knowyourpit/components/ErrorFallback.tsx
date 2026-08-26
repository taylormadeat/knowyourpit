import { Feather } from "@expo/vector-icons";
import { reloadAppAsync } from "expo";
import * as Updates from "expo-updates";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { Screen, Sheet, Button, ErrorState } from "@/components/ui";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch (restartError) {
      console.error("Failed to restart app:", restartError);
      resetError();
    }
  };

  const formatErrorDetails = (): string => {
    let details = `Error: ${error.message}\n\n`;
    if (error.stack) {
      details += `Stack Trace:\n${error.stack}`;
    }
    return details;
  };

  const monoFont = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  });

  return (
    <Screen edges={["top", "bottom", "left", "right"]} preset="centered" style={{ backgroundColor: colors.background }}>
      <Button
        variant="ghost"
        size="icon"
        onPress={() => setIsModalVisible(true)}
        style={[styles.topButton, { top: insets.top + 16, right: 16 }]}
        leftIcon={<Feather name="alert-circle" size={24} color={colors.foreground} />}
        accessibilityLabel="View error details"
      />

      <ErrorState
        title="Something went wrong"
        description="Please reload the app to continue."
        action={{ label: "Try Again", onPress: handleRestart }}
      />

      <Text
        style={[styles.diagText, { color: colors.mutedForeground, fontFamily: monoFont }]}
        selectable
      >
        {`${error.message}\n\nupdate: ${Updates.updateId ?? "embedded"}${
          Updates.createdAt ? ` (${Updates.createdAt.toISOString()})` : ""
        }`}
      </Text>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Sheet
            title="Error Details"
            onClose={() => setIsModalVisible(false)}
            style={[styles.modalContainer, { height: "90%" }]}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
              showsVerticalScrollIndicator
            >
              <View style={[styles.errorContainer, { backgroundColor: colors.card }]}>
                <Text
                  style={{
                    fontSize: 12,
                    lineHeight: 18,
                    color: colors.foreground,
                    fontFamily: monoFont,
                  }}
                  selectable
                >
                  {formatErrorDetails()}
                </Text>
              </View>
            </ScrollView>
          </Sheet>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  diagText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 16,
    opacity: 0.6,
  },
  topButton: {
    position: "absolute",
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  errorContainer: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
    padding: 16,
  },
});
