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

import { useSignUp, useSignIn } from "@clerk/expo/legacy";
import { useSSO } from "@clerk/expo";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import { Link, useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
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
  const { signIn, setActive: signInSetActive } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [resendLoading, setResendLoading] = React.useState(false);
  const [resendSuccess, setResendSuccess] = React.useState(false);
  const [resendError, setResendError] = React.useState<string | null>(null);
  const [resendSessionExpired, setResendSessionExpired] = React.useState(false);
  const [showSignInLink, setShowSignInLink] = React.useState(false);

  const handleSignUp = async () => {
    if (!signUp) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareVerification({ strategy: "email_code" });
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
      setShowSignInLink(false);
      const result = await signUp.attemptVerification({ strategy: "email_code", code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setErrorMsg("Verification could not be completed. Please request a new code and try again.");
      }
    } catch (e: any) {
      const clerkCode = e?.errors?.[0]?.code ?? "";
      const clerkMsg: string = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "";
      const isAlreadyVerified =
        clerkCode === "form_identifier_exists" ||
        clerkCode === "verification_already_verified" ||
        clerkMsg.toLowerCase().includes("already been verified") ||
        clerkMsg.toLowerCase().includes("already verified");

      if (isAlreadyVerified && signIn && signInSetActive) {
        try {
          const attempt = await signIn.create({ identifier: email, password });
          if (attempt.status === "complete") {
            await signInSetActive({ session: attempt.createdSessionId });
            router.replace("/(tabs)");
            return;
          }
        } catch (signInErr: any) {
          const signInErrMsg = signInErr?.errors?.[0]?.longMessage ?? signInErr?.errors?.[0]?.message ?? signInErr?.message ?? "unknown";
          console.warn("[sign-up] auto-sign-in after already-verified failed:", signInErrMsg);
        }
        setErrorMsg("Your email is already verified. Please sign in with your credentials.");
        setShowSignInLink(true);
      } else {
        setErrorMsg(clerkMsg || "Verification failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!signUp) return;
    try {
      setResendLoading(true);
      setResendError(null);
      setResendSuccess(false);
      setResendSessionExpired(false);
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (e: any) {
      const clerkCode = e?.errors?.[0]?.code ?? "";
      const clerkMsg: string = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? "";
      const isExpired =
        clerkCode === "session_exists" ||
        clerkCode === "sign_up_not_found" ||
        clerkMsg.toLowerCase().includes("expired") ||
        clerkMsg.toLowerCase().includes("not found");
      if (isExpired) {
        setResendSessionExpired(true);
        setResendError("Your sign-up session has expired. Please go back and sign up again.");
      } else {
        setResendError(clerkMsg || "Could not resend code. Please try again.");
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoogle = useCallback(async () => {
    try {
      setGoogleLoading(true);
      const {
        createdSessionId,
        setActive: ssoSetActive,
        signUp: ssoSignUp,
        signIn: ssoSignIn,
      } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: Linking.createURL("/oauth-native-callback"),
      });
      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId });
        router.replace("/(tabs)");
      } else if (ssoSignUp && ssoSetActive) {
        if (ssoSignUp.createdSessionId) {
          await ssoSetActive({ session: ssoSignUp.createdSessionId });
          router.replace("/(tabs)");
        } else if (ssoSignUp.status === "missing_requirements") {
          const missing = ssoSignUp.missingFields ?? [];
          if (missing.includes("username") && ssoSignUp.emailAddress) {
            const base = ssoSignUp.emailAddress
              .split("@")[0]
              .replace(/[^a-z0-9]/gi, "")
              .toLowerCase()
              .slice(0, 15);
            const suffix = Math.floor(Math.random() * 9000 + 1000);
            const updated = await ssoSignUp.update({ username: `${base}${suffix}` });
            if (updated.status === "complete" && updated.createdSessionId) {
              await ssoSetActive({ session: updated.createdSessionId });
              router.replace("/(tabs)");
            } else {
              setErrorMsg("Google sign-up could not be completed. Please try again.");
            }
          } else {
            setErrorMsg("Google sign-up could not be completed. Please try again.");
          }
        } else {
          setErrorMsg("Google sign-up could not be completed. Please try again.");
        }
      } else if (ssoSignIn?.createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: ssoSignIn.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setErrorMsg("Google sign-in could not complete. Please try again.");
      }
    } catch (e: any) {
      const msg =
        e?.errors?.[0]?.longMessage ??
        e?.errors?.[0]?.message ??
        e?.message ??
        "Google sign-in failed. Please try again or use email instead.";
      setErrorMsg(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow]);

  const handleApple = useCallback(async () => {
    if (Platform.OS === "ios") {
      if (!signUp || !setActive || !signIn || !signInSetActive) return;
      try {
        setAppleLoading(true);
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) throw new Error("No identity token from Apple.");
        try {
          const attempt = await signUp.create({
            strategy: "oauth_token_apple",
            token: credential.identityToken,
          });
          if (attempt.status === "complete") {
            await setActive({ session: attempt.createdSessionId });
            router.replace("/(tabs)");
          } else {
            setErrorMsg("Apple sign-in could not be completed. Please try again.");
          }
        } catch (signUpErr: any) {
          const code = signUpErr?.errors?.[0]?.code;
          if (
            code === "form_identifier_exists" ||
            code === "external_account_exists"
          ) {
            const attempt = await signIn.create({
              strategy: "oauth_token_apple",
              token: credential.identityToken,
            });
            if (attempt.status === "complete") {
              await signInSetActive({ session: attempt.createdSessionId });
              router.replace("/(tabs)");
            } else {
              setErrorMsg("Apple sign-in could not be completed. Please try again.");
            }
          } else {
            throw signUpErr;
          }
        }
      } catch (e: any) {
        if ((e as any).code === "ERR_REQUEST_CANCELED") return;
        const msg =
          e?.errors?.[0]?.longMessage ??
          e?.errors?.[0]?.message ??
          e?.message ??
          "Apple sign-in failed. Please try again or use email instead.";
        setErrorMsg(msg);
      } finally {
        setAppleLoading(false);
      }
    } else {
      try {
        setAppleLoading(true);
        const {
          createdSessionId,
          setActive: ssoSetActive,
          signUp: ssoSignUp,
        } = await startSSOFlow({
          strategy: "oauth_apple",
          redirectUrl: Linking.createURL("/oauth-native-callback"),
        });
        if (createdSessionId && ssoSetActive) {
          await ssoSetActive({ session: createdSessionId });
          router.replace("/(tabs)");
        } else if (ssoSignUp && ssoSetActive) {
          if (ssoSignUp.createdSessionId) {
            await ssoSetActive({ session: ssoSignUp.createdSessionId });
            router.replace("/(tabs)");
          } else {
            setErrorMsg("Apple sign-up could not be completed. Please try again.");
          }
        } else {
          setErrorMsg("Apple sign-in could not complete. Please try again.");
        }
      } catch (e: any) {
        const msg =
          e?.errors?.[0]?.longMessage ??
          e?.errors?.[0]?.message ??
          e?.message ??
          "Apple sign-in failed. Please try again or use email instead.";
        setErrorMsg(msg);
      } finally {
        setAppleLoading(false);
      }
    }
  }, [signUp, setActive, signIn, signInSetActive, startSSOFlow]);

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
    appleBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      borderWidth: 1, borderColor: "#000", borderRadius: colors.radius,
      height: 50, backgroundColor: "#000", marginTop: 12,
    },
    appleBtnText: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#fff" },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 28, gap: 4 },
    footerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primary },
    legalNotice: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 18,
      marginTop: 18,
      paddingHorizontal: 8,
    },
    legalNoticeLink: {
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textDecorationLine: "underline",
    },
    verifyHint: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 24, lineHeight: 20 },
    resendBtn: { alignItems: "center", marginTop: 16 },
    resendText: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.primary },
    resendSuccessText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#22c55e", textAlign: "center", marginTop: 12 },
    signInLinkBtn: { alignItems: "center", marginTop: 8, marginBottom: 4 },
    signInLinkText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primary, textDecorationLine: "underline" },
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
          {showSignInLink && (
            <Pressable onPress={() => router.replace("/(auth)/sign-in")} style={styles.signInLinkBtn}>
              <Text style={styles.signInLinkText}>Go to sign in</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, (isLoading || pressed) && styles.primaryBtnDisabled]}
            onPress={handleVerify}
            disabled={isLoading || !code}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify</Text>}
          </Pressable>
          {resendSuccess && (
            <Text style={styles.resendSuccessText}>A new code has been sent to your email.</Text>
          )}
          {resendError && (
            <Text style={styles.errorText}>{resendError}</Text>
          )}
          {resendSessionExpired ? (
            <Pressable onPress={() => setPendingVerification(false)} style={styles.resendBtn}>
              <Text style={styles.resendText}>Back to sign up</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.resendBtn} onPress={handleResend} disabled={resendLoading}>
              {resendLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.resendText}>Resend code</Text>
              )}
            </Pressable>
          )}
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
        <Text style={styles.subtitle}>Join knowyourpit</Text>

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
          disabled={googleLoading || appleLoading}
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

        <Pressable
          style={({ pressed }) => [styles.appleBtn, pressed && { opacity: 0.7 }]}
          onPress={handleApple}
          disabled={appleLoading || googleLoading}
        >
          {appleLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={styles.appleBtnText}>Continue with Apple</Text>
            </>
          )}
        </Pressable>

        <View nativeID="clerk-captcha" />

        <Text style={styles.legalNotice}>
          By creating an account, you agree to our{" "}
          <Text
            style={styles.legalNoticeLink}
            onPress={() => Linking.openURL("https://knowyourpit.com/terms")}
          >
            Terms of Service
          </Text>
          {" "}and{" "}
          <Text
            style={styles.legalNoticeLink}
            onPress={() => Linking.openURL("https://knowyourpit.com/privacy")}
          >
            Privacy Policy
          </Text>
          .
        </Text>

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
