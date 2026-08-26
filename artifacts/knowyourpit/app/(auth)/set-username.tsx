import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useAuthColors } from "@/hooks/useAuthColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { LogoBackground } from "@/components/LogoBackground";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";

const logoImg = require("@/assets/images/icon-transparent-dark.png");

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

function validate(value: string): string | null {
  if (value.length < 3) return "Username must be at least 3 characters.";
  if (value.length > 20) return "Username can't be longer than 20 characters.";
  if (!USERNAME_REGEX.test(value)) return "Only lowercase letters, numbers, and underscores.";
  return null;
}

export default function SetUsernameScreen() {
  const colors = useAuthColors();
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
      await user.update({
        unsafeMetadata: { ...(user.unsafeMetadata as object ?? {}), username: sanitized },
      });
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
    outer: { flex: 1, backgroundColor: "#0D0D10" },
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingTop: topInset + 40,
      paddingBottom: bottomInset + 32,
    },
    logo: { width: 90, height: 90, marginBottom: 32, opacity: 0.9, alignSelf: "center" },
    title: {
      fontSize: 30,
      fontFamily: "Inter_700Bold",
      color: "#FFFFFF",
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: "rgba(255,255,255,0.6)",
      marginBottom: 36,
      lineHeight: 24,
    },
    label: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: "rgba(255,255,255,0.9)",
      marginBottom: 8,
      marginLeft: 4,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.03)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      borderRadius: 14,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    atSign: {
      fontSize: 18,
      fontFamily: "Inter_500Medium",
      color: "rgba(255,255,255,0.4)",
      marginRight: 4,
    },
    input: {
      flex: 1,
      height: 54,
      fontSize: 18,
      fontFamily: "Inter_500Medium",
      color: "#FFFFFF",
    },
    hint: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: "rgba(255,255,255,0.4)",
      marginBottom: 28,
      marginLeft: 4,
    },
    validationError: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: "#EF4444",
      marginBottom: 24,
      marginLeft: 4,
    },
    errorText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: "#EF4444",
      marginTop: 16,
      textAlign: "center",
    },
    primaryBtn: {
      backgroundColor: "#E84820",
      borderRadius: 14,
      height: 54,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
      shadowColor: "#E84820",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: "#FFFFFF",
    },
  });

  return (
    <AppKeyboardAvoidingView
      style={styles.outer}
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
    </AppKeyboardAvoidingView>
  );
}
