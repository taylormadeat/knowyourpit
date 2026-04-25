import React, { useCallback, useEffect } from "react";
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

import { useSignUp, useSSO } from "@clerk/expo";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { Link, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { LogoBackground } from "@/components/LogoBackground";

const logoImg = require("@/assets/images/logo.png");

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

export default function SignUpScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = React.useState(false);

  const handleSignUp = async () => {
    if (!signUp) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? "Sign up failed.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!signUp) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Verification failed.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = useCallback(async () => {
    try {
      setGoogleLoading(true);
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGoogleLoading(false);
    }
  }, []);
  const styles = StyleSheet.create({
    outer: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingTop: topInset + 40,
      paddingBottom: bottomInset + 32,
    },
    logo: {
      width: 96, height: 96, marginBottom: 20,
    },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 6 },
    subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 36 },
    label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 6 },
    inputRow: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, marginBottom: 16, paddingHorizontal: 14,
    },
    input: { flex: 1, height: 48, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    eyeBtn: { padding: 4 },
    errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.destructive, marginTop: -10, marginBottom: 12 },
    primaryBtn: {
      backgroundColor: colors.primary, borderRadius: colors.radius,
      height: 50, alignItems: "center", justifyContent: "center", marginTop: 8,
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
    dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    googleBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius,
      height: 50, backgroundColor: colors.card,
    },
    googleBtnText: { fontSize: 15, fontFamily: "Inter_500Medium", color: colors.foreground },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 28, gap: 4 },
    footerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primary },
    verifyHint: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 24, lineHeight: 20 },
    resendBtn: { alignItems: "center", marginTop: 16 },
    resendText: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.primary },
  });

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView style={styles.outer} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Feather name="mail" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.verifyHint}>
            We sent a verification code to {email}. Enter it below.
          </Text>
          <Text style={styles.label}>Verification Code</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              autoFocus
            />
          </View>
          {errorMsg && (
            <Text style={styles.errorText}>{errorMsg}</Text>
          )}
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, (isLoading || pressed) && styles.primaryBtnDisabled]}
            onPress={handleVerify}
            disabled={isLoading || !code}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify</Text>}
          </Pressable>
          <Pressable style={styles.resendBtn} onPress={() => signUp?.prepareEmailAddressVerification({ strategy: "email_code" })}>
            <Text style={styles.resendText}>Resend code</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const canSubmit = !!email && !!password && !isLoading;

  return (
    <KeyboardAvoidingView style={styles.outer} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LogoBackground opacity={0.04} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Image source={logoImg} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join KnowYourPit</Text>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>
        <Text style={styles.label}>Password</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Min 8 characters"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPass}
            autoComplete="new-password"
          />
          <Pressable style={styles.eyeBtn} onPress={() => setShowPass((v) => !v)}>
            <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
        {errorMsg && (
          <Text style={styles.errorText}>{errorMsg}</Text>
        )}

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, (!canSubmit || pressed) && styles.primaryBtnDisabled]}
          onPress={handleSignUp}
          disabled={!canSubmit}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.7 }]}
          onPress={handleGoogle}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <>
              <Feather name="chrome" size={18} color={colors.foreground} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        <View nativeID="clerk-captcha" />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Have an account?</Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
