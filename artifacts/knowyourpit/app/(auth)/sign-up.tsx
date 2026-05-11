import React, { useCallback, useEffect, useRef } from "react";
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
import * as Crypto from "expo-crypto";
import { Link, useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useAuthColors } from "@/hooks/useAuthColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { useLayout } from "@/hooks/useLayout";
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

async function autoSetUsername(
  signUp: NonNullable<ReturnType<typeof useSignUp>["signUp"]>,
  emailHint: string,
): Promise<"complete" | "failed"> {
  const base = emailHint
    .split("@")[0]
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .slice(0, 15);
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  try {
    const updated = await signUp.update({ username: `${base}${suffix}` });
    return updated.status === "complete" && updated.createdSessionId ? "complete" : "failed";
  } catch {
    return "failed";
  }
}

export default function SignUpScreen() {
  useWarmUpBrowser();
  const colors = useAuthColors();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const { isTablet, authMaxWidth } = useLayout();
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { signIn, setActive: signInSetActive } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [appleAvailable, setAppleAvailable] = React.useState(Platform.OS === "ios");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState("");
  const [verifyLoading, setVerifyLoading] = React.useState(false);
  const codeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync()
        .then((available) => { if (!cancelled) setAppleAvailable(available); })
        .catch(() => { if (!cancelled) setAppleAvailable(false); });
    } else {
      setAppleAvailable(false);
    }
    return () => { cancelled = true; };
  }, []);

  const handleSignUp = async () => {
    if (!signUp) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const result = await signUp.create({ emailAddress: email, password });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
        return;
      }

      if (
        result.unverifiedFields?.includes("email_address") ||
        result.verifications?.emailAddress?.status === "unverified"
      ) {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setPendingVerification(true);
        setTimeout(() => codeInputRef.current?.focus(), 300);
        return;
      }

      if (result.status === "missing_requirements") {
        const missing = result.missingFields ?? [];
        if (missing.includes("username")) {
          const outcome = await autoSetUsername(signUp, email);
          if (outcome === "complete" && signUp.createdSessionId) {
            await setActive({ session: signUp.createdSessionId });
            router.replace("/(tabs)");
            return;
          }
        }
        setErrorMsg("Sign up could not be completed. Please contact support.");
        return;
      }

      setErrorMsg("Sign up could not be completed. Please try again.");
    } catch (e: any) {
      const code: string = e?.errors?.[0]?.code ?? "";
      const longMsg: string = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? "";
      let friendly: string;
      switch (code) {
        case "form_identifier_exists":
          friendly = "An account with that email already exists. Try signing in instead.";
          break;
        case "form_password_pwned":
          friendly = "That password has been found in a data breach. Please choose a different one.";
          break;
        case "form_password_length_too_short":
        case "form_password_size_in_bytes_exceeded":
          friendly = "Password must be at least 8 characters.";
          break;
        case "form_password_not_strong_enough":
          friendly = "Please choose a stronger password (mix letters, numbers, and symbols).";
          break;
        case "form_param_format_invalid":
          friendly = "That email address doesn't look right. Please check it and try again.";
          break;
        case "captcha_invalid":
        case "captcha_unavailable":
          friendly = "Couldn't verify the request. Please try again.";
          break;
        case "too_many_requests":
          friendly = "Too many sign-up attempts. Please wait a minute and try again.";
          break;
        default:
          friendly = longMsg || "Sign up failed. Please check your email and password and try again.";
      }
      setErrorMsg(friendly);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!signUp) return;
    try {
      setVerifyLoading(true);
      setErrorMsg(null);
      const result = await signUp.attemptEmailAddressVerification({ code: verificationCode });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
        return;
      }

      if (result.status === "missing_requirements") {
        const missing = result.missingFields ?? [];
        if (missing.includes("username")) {
          const outcome = await autoSetUsername(signUp, email);
          if (outcome === "complete" && signUp.createdSessionId) {
            await setActive({ session: signUp.createdSessionId });
            router.replace("/(tabs)");
            return;
          }
        }
        setErrorMsg("Sign up could not be completed. Please contact support.");
        return;
      }

      setErrorMsg("Verification failed. Please try again.");
    } catch (e: any) {
      const code: string = e?.errors?.[0]?.code ?? "";
      const longMsg: string = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "";
      if (code === "form_code_incorrect") {
        setErrorMsg("That code is incorrect. Please check the email and try again.");
      } else if (code === "verification_expired") {
        setErrorMsg("That code has expired. Go back and request a new one.");
      } else if (code === "too_many_requests") {
        setErrorMsg("Too many attempts. Please wait a moment and try again.");
      } else {
        setErrorMsg(longMsg || "Verification failed. Please try again.");
      }
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    if (!signUp) return;
    try {
      setErrorMsg(null);
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerificationCode("");
      setErrorMsg("A new code has been sent to your email.");
    } catch {
      setErrorMsg("Couldn't resend the code. Please try again.");
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
      const log = (step: string, data: Record<string, unknown> = {}) => {
        console.log(`[apple-signin] ${step}`, data);
      };
      try {
        setAppleLoading(true);

        const nonce = Crypto.randomUUID();
        log("apple.request", { hasNonce: true });
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce,
        });
        if (!credential.identityToken) {
          log("apple.no_identity_token");
          throw new Error("No identity token from Apple.");
        }
        log("apple.credential", {
          hasFullName: !!credential.fullName?.givenName,
          hasEmail: !!credential.email,
          userPresent: !!credential.user,
        });

        let signInResult: typeof signIn | null = null;
        let signInThrewTransferable = false;
        try {
          signInResult = await signIn.create({
            strategy: "oauth_token_apple",
            token: credential.identityToken,
          });
        } catch (signInErr: any) {
          const code = signInErr?.errors?.[0]?.code;
          log("signin.create.threw", { code, message: signInErr?.errors?.[0]?.message });
          if (
            code === "form_identifier_not_found" ||
            code === "strategy_for_user_invalid" ||
            code === "external_account_not_found"
          ) {
            signInThrewTransferable = true;
          } else {
            throw signInErr;
          }
        }
        const ffvStatus = signInResult?.firstFactorVerification?.status;
        const createdSessionId = signInResult?.createdSessionId;
        log("signin.create.result", {
          status: signInResult?.status,
          firstFactorVerificationStatus: ffvStatus,
          hasCreatedSessionId: !!createdSessionId,
          threwTransferable: signInThrewTransferable,
        });

        if (createdSessionId) {
          log("signin.complete.set_active");
          await signInSetActive({ session: createdSessionId });
          router.replace("/(tabs)");
          return;
        }

        if (ffvStatus !== "transferable" && !signInThrewTransferable) {
          log("signin.not_transferable", { status: ffvStatus });
          setErrorMsg("Apple sign-in could not be completed. Please try again.");
          return;
        }

        log("signup.transfer.create");
        const signUpAttempt = await signUp.create({
          transfer: true,
          unsafeMetadata: { signInProvider: "apple" },
        });
        log("signup.transfer.result", {
          status: signUpAttempt.status,
          missingFields: signUpAttempt.missingFields,
          hasCreatedSessionId: !!signUpAttempt.createdSessionId,
          hasEmailAddress: !!signUpAttempt.emailAddress,
        });

        if (signUpAttempt.status === "complete" && signUpAttempt.createdSessionId) {
          log("signup.complete.set_active");
          await setActive({ session: signUpAttempt.createdSessionId });
          router.replace("/(tabs)");
          return;
        }

        if (signUpAttempt.status === "missing_requirements") {
          const missing = signUpAttempt.missingFields ?? [];
          if (missing.includes("username")) {
            const base = (
              signUpAttempt.emailAddress?.split("@")[0] ??
              credential.fullName?.givenName ??
              "user"
            )
              .replace(/[^a-z0-9]/gi, "")
              .toLowerCase()
              .slice(0, 15);
            const suffix = Math.floor(Math.random() * 9000 + 1000);
            const generatedUsername = `${base}${suffix}`;
            log("signup.update.username", { length: generatedUsername.length });
            const updated = await signUp.update({ username: generatedUsername });
            log("signup.update.result", {
              status: updated.status,
              hasCreatedSessionId: !!updated.createdSessionId,
            });
            if (updated.status === "complete" && updated.createdSessionId) {
              log("signup.complete.set_active.route_set_username");
              await setActive({ session: updated.createdSessionId });
              router.replace("/(auth)/set-username");
              return;
            }
            setErrorMsg("Apple sign-in could not be completed. Please try again.");
            return;
          }
          if (missing.includes("email_address")) {
            setErrorMsg("Apple couldn't share your email this time. Please sign up with email instead.");
            return;
          }
        }

        log("signup.unhandled", { status: signUpAttempt.status });
        setErrorMsg("Apple sign-in could not be completed. Please try again.");
      } catch (e: any) {
        if ((e as any).code === "ERR_REQUEST_CANCELED") {
          log("apple.cancelled");
          return;
        }
        const clerkErr = e?.errors?.[0];
        log("apple.error", {
          name: e?.name,
          code: clerkErr?.code,
          longMessage: clerkErr?.longMessage,
          message: clerkErr?.message ?? e?.message,
          metaSessionId: e?.meta?.session_id,
        });
        const rawMsg: string =
          clerkErr?.longMessage ??
          clerkErr?.message ??
          e?.message ??
          "";
        const friendly = /oauth_token_apple|allowed values for parameter strategy/i.test(rawMsg)
          ? "Apple sign-in is temporarily unavailable. Please use email or Google to sign up."
          : rawMsg || "Apple sign-in failed. Please try again or use email instead.";
        setErrorMsg(friendly);
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
      ...(isTablet
        ? { maxWidth: authMaxWidth, alignSelf: "center", width: "100%" }
        : null),
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
    successText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#4ade80", marginTop: -10, marginBottom: 12 },
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
    verifyHint: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 28,
      lineHeight: 20,
    },
    verifyEmail: {
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    codeInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      height: 56,
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      textAlign: "center",
      letterSpacing: 8,
      marginBottom: 16,
      paddingHorizontal: 14,
    },
    resendRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 20,
      gap: 4,
    },
    resendText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    resendLink: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primary },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 24,
    },
    backBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
  });

  const canSubmit = !!email && !!password && !isLoading;
  const canVerify = verificationCode.length >= 6 && !verifyLoading;
  const isSuccess = errorMsg?.startsWith("A new code");

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView style={styles.outer} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <LogoBackground opacity={0.04} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Image source={logoImg} style={styles.logo} resizeMode="contain" />

          <Pressable style={styles.backBtn} onPress={() => { setPendingVerification(false); setErrorMsg(null); setVerificationCode(""); }}>
            <Feather name="arrow-left" size={16} color={colors.mutedForeground} />
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>

          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.verifyHint}>
            We sent a 6-digit code to{" "}
            <Text style={styles.verifyEmail}>{email}</Text>
            {". "}Enter it below to verify your account.
          </Text>

          <Text style={styles.label}>Verification code</Text>
          <TextInput
            ref={codeInputRef}
            style={styles.codeInput}
            value={verificationCode}
            onChangeText={(v) => { setVerificationCode(v.replace(/[^0-9]/g, "").slice(0, 6)); setErrorMsg(null); }}
            placeholder="000000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
          />

          {errorMsg && (
            <Text style={isSuccess ? styles.successText : styles.errorText}>{errorMsg}</Text>
          )}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, (!canVerify || pressed) && styles.primaryBtnDisabled]}
            onPress={handleVerify}
            disabled={!canVerify}
          >
            {verifyLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify Email</Text>}
          </Pressable>

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't get it?</Text>
            <Pressable onPress={handleResend}>
              <Text style={styles.resendLink}>Resend code</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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

        {appleAvailable && (
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
        )}

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
            <Pressable><Text style={styles.footerLink}>Sign in</Text></Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
