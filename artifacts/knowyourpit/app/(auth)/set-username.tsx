import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { LogoBackground } from "@/components/LogoBackground";

const logoImg = require("@/assets/images/logo.png");

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

function validate(value: string): string | null {
  if (value.length < 3) return "Username must be at least 3 characters.";
  if (value.length > 20) return "Username can't be longer than 20 characters.";
  if (!USERNAME_REGEX.test(value)) return "Only lowercase letters, numbers, and underscores.";
  return null;
}

export default function SetUsernameScreen() {
  const colors = useColors();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const router = useRouter();
  const { user } = useUser();

  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const validationError = sanitized.length > 0 ? validate(sanitized) : null;
  const canSubmit = !isLoading && sanitized.length >= 3 && validationError === null;

  const handleSetUsername = async () => {
    if (!user || !canSubmit) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await user.update({ username: sanitized });
      router.replace("/(tabs)");
    } catch (e: any) {
      const msg =
        e?.errors?.[0]?.longMessage ??
        e?.errors?.[0]?.message ??
        e?.message ??
        "Couldn't save username. Please try again.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    outer: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingTop: topInset + 40,
      paddingBottom: bottomInset + 32,
    },
    logo: { width: 80, height: 80, marginBottom: 24 },
    title: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 36,
      lineHeight: 22,
    },
    label: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 6,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      marginBottom: 8,
      paddingHorizontal: 14,
    },
    atSign: {
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginRight: 2,
    },
    input: {
      flex: 1,
      height: 50,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    hint: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 24,
    },
    validationError: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.destructive,
      marginBottom: 16,
    },
    errorText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.destructive,
      marginTop: 12,
      textAlign: "center",
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LogoBackground opacity={0.04} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={logoImg} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Choose your username</Text>
        <Text style={styles.subtitle}>
          This is how PitMaster will know you. Pick something you'll want to keep — usernames must be unique.
        </Text>

        <Text style={styles.label}>Username</Text>
        <View style={styles.inputRow}>
          <Text style={styles.atSign}>@</Text>
          <TextInput
            style={styles.input}
            value={sanitized}
            onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="pitmaster42"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSetUsername}
          />
        </View>

        {sanitized.length > 0 && validationError ? (
          <Text style={styles.validationError}>{validationError}</Text>
        ) : (
          <Text style={styles.hint}>
            3–20 characters. Letters, numbers, and underscores only.
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (!canSubmit || pressed) && styles.primaryBtnDisabled,
          ]}
          onPress={handleSetUsername}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Continue →</Text>
          )}
        </Pressable>

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
