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
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import { useSSO } from "@clerk/expo";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import { Link, useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useAuthColors } from "@/hooks/useAuthColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { useLayout } from "@/hooks/useLayout";
import { LogoBackground } from "@/components/LogoBackground";

const logoImg = require("@/assets/images/logo.png");

WebBrowser.maybeCompleteAuthSession();

type Step = "signin" | "forgot_request" | "forgot_verify" | "second_factor";

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const colors = useAuthColors();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const { isTablet, authMaxWidth } = useLayout();
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { signUp, setActive: signUpSetActive } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [step, setStep] = React.useState<Step>("signin");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [appleAvailable, setAppleAvailable] = React.useState(Platform.OS === "ios");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [showForgotSuggestion, setShowForgotSuggestion] = React.useState(false);

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

  const [forgotEmail, setForgotEmail] = React.useState("");
  const [resetCode, setResetCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [showNewPass, setShowNewPass] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [secondFactorCode, setSecondFactorCode] = React.useState("");

  const handleSignIn = async () => {
    if (!signIn) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      setShowForgotSuggestion(false);
      const attempt = await signIn.create({ identifier: email, password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(tabs)");
        return;
      }
      // Status is not "complete" but no error was thrown — give a specific
      // reason instead of the catch-all "could not be completed".
      switch (attempt.status) {
        case "needs_identifier":
          setErrorMsg("Please enter your email address.");
          break;
        case "needs_first_factor":
          setErrorMsg(
            "We need to verify it's you. Check your email for a verification code, or reset your password to continue.",
          );
          setShowForgotSuggestion(true);
          break;
        case "needs_second_factor":
          try {
            await attempt.prepareSecondFactor({ strategy: "email_code" });
          } catch {
            // ignore — the code may already be in-flight
          }
          setSecondFactorCode("");
          setErrorMsg(null);
          setStep("second_factor");
          break;
        case "needs_new_password":
          setErrorMsg("Your password needs to be reset before you can sign in.");
          setShowForgotSuggestion(true);
          break;
        default:
          setErrorMsg("Sign in could not be completed. Please try again or reset your password.");
          setShowForgotSuggestion(true);
      }
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      const code: string = clerkErr?.code ?? "";
      const longMsg: string = clerkErr?.longMessage ?? clerkErr?.message ?? "";
      let friendly: string;
      switch (code) {
        case "form_identifier_not_found":
          friendly = "We couldn't find an account with that email. Double-check the address or sign up.";
          break;
        case "form_password_incorrect":
          friendly = "That password isn't right. Try again or reset your password.";
          break;
        case "form_param_format_invalid":
          friendly = "That email address doesn't look right. Please check it and try again.";
          break;
        case "session_exists":
          friendly = "You're already signed in. Restart the app if you don't see your account.";
          break;
        case "too_many_requests":
        case "user_locked":
          friendly = "Too many sign-in attempts. Please wait a minute and try again.";
          break;
        case "strategy_for_user_invalid":
          friendly = "This account was created with Google or Apple sign-in. Please use that option above.";
          break;
        case "identification_deleted":
          friendly = "This account has been removed. Please sign up to create a new one.";
          break;
        case "captcha_invalid":
        case "captcha_unavailable":
          friendly = "Couldn't verify the request. Please try again.";
          break;
        default:
          friendly = longMsg || "Sign in failed. Please check your email and password and try again.";
      }
      setErrorMsg(friendly);
      setShowForgotSuggestion(
        code === "form_password_incorrect" ||
          code === "form_identifier_not_found" ||
          !code,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotRequest = async () => {
    if (!signIn) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: forgotEmail.trim(),
      });
      setStep("forgot_verify");
    } catch (e: any) {
      const msg =
        e?.errors?.[0]?.longMessage ??
        e?.errors?.[0]?.message ??
        "Could not send reset email. Check that the email is correct.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotVerify = async () => {
    if (!signIn) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const attempt = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: resetCode.trim(),
        password: newPassword,
      });
      if (attempt.status === "complete") {
        setSuccessMsg("Password reset! Signing you in…");
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setErrorMsg("Could not complete the reset. Please try again.");
      }
    } catch (e: any) {
      const msg =
        e?.errors?.[0]?.longMessage ??
        e?.errors?.[0]?.message ??
        "Reset failed. Check the code and try again.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const goBackToSignIn = () => {
    setStep("signin");
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowForgotSuggestion(false);
    setForgotEmail("");
    setResetCode("");
    setNewPassword("");
    setSecondFactorCode("");
  };

  const handleSecondFactor = async () => {
    if (!signIn) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const attempt = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code: secondFactorCode.trim(),
      });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setErrorMsg("Verification failed. Please try again.");
      }
    } catch (e: any) {
      const code: string = e?.errors?.[0]?.code ?? "";
      const longMsg: string = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "";
      if (code === "verification_failed" || code === "form_code_incorrect") {
        setErrorMsg("That code is incorrect. Please check your email and try again.");
      } else if (code === "verification_expired") {
        setErrorMsg("That code has expired. Go back and sign in again to request a new one.");
      } else {
        setErrorMsg(longMsg || "Verification failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = useCallback(async () => {
    try {
      setGoogleLoading(true);
      const {
        createdSessionId,
        setActive: ssoSetActive,
        signUp: ssoSignUp,
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
      if (!signIn || !setActive || !signUp || !signUpSetActive) return;
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
          const attempt = await signIn.create({
            strategy: "oauth_token_apple",
            token: credential.identityToken,
          });
          if (attempt.status === "complete") {
            await setActive({ session: attempt.createdSessionId });
            router.replace("/(tabs)");
          } else {
            setErrorMsg("Apple sign-in could not be completed. Please try again.");
          }
        } catch (signInErr: any) {
          const code = signInErr?.errors?.[0]?.code;
          if (
            code === "form_identifier_not_found" ||
            code === "strategy_for_user_invalid" ||
            code === "external_account_not_found"
          ) {
            const attempt = await signUp.create({
              strategy: "oauth_token_apple",
              token: credential.identityToken,
            });
            if (attempt.status === "complete") {
              await signUpSetActive({ session: attempt.createdSessionId });
              router.replace("/(tabs)");
            } else if (attempt.status === "missing_requirements") {
              const missing = attempt.missingFields ?? [];
              if (missing.includes("username")) {
                const base = (
                  attempt.emailAddress?.split("@")[0] ??
                  credential.fullName?.givenName ??
                  "user"
                )
                  .replace(/[^a-z0-9]/gi, "")
                  .toLowerCase()
                  .slice(0, 15);
                const suffix = Math.floor(Math.random() * 9000 + 1000);
                const updated = await attempt.update({ username: `${base}${suffix}` });
                if (updated.status === "complete" && updated.createdSessionId) {
                  await signUpSetActive({ session: updated.createdSessionId });
                  router.replace("/(tabs)");
                } else {
                  setErrorMsg("Apple sign-in could not be completed. Please try again.");
                }
              } else if (missing.includes("email_address")) {
                setErrorMsg("Apple couldn't share your email this time. Please sign in with email instead.");
              } else {
                setErrorMsg("Apple sign-in could not be completed. Please try again.");
              }
            } else {
              setErrorMsg("Apple sign-in could not be completed. Please try again.");
            }
          } else {
            throw signInErr;
          }
        }
      } catch (e: any) {
        if ((e as any).code === "ERR_REQUEST_CANCELED") return;
        const rawMsg: string =
          e?.errors?.[0]?.longMessage ??
          e?.errors?.[0]?.message ??
          e?.message ??
          "";
        const friendly = /oauth_token_apple|allowed values for parameter strategy/i.test(rawMsg)
          ? "Apple sign-in is temporarily unavailable. Please use email or Google to sign in."
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
  }, [signIn, setActive, signUp, signUpSetActive, startSSOFlow]);

  const canSubmit = !!email && !!password && !isLoading;
  const canRequestReset = !!forgotEmail.trim() && !isLoading;
  const canVerifyReset = !!resetCode.trim() && !!newPassword && !isLoading;
  const canVerifySecondFactor = !!secondFactorCode.trim() && !isLoading;

  const styles = StyleSheet.create({
    outer: {
      flex: 1,
      backgroundColor: colors.background,
    },
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
      width: 96,
      height: 96,
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 36,
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
      marginBottom: 16,
      paddingHorizontal: 14,
    },
    input: {
      flex: 1,
      height: 48,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    eyeBtn: {
      padding: 4,
    },
    errorBlock: {
      marginTop: -10,
      marginBottom: 12,
    },
    errorText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.destructive,
      marginBottom: 4,
    },
    errorForgotLink: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    successText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.primary,
      marginTop: -10,
      marginBottom: 12,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    primaryBtnDisabled: {
      opacity: 0.5,
    },
    primaryBtnText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    forgotLink: {
      alignSelf: "flex-end",
      marginTop: -8,
      marginBottom: 16,
    },
    forgotLinkText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.primary,
    },
    backLink: {
      alignSelf: "center",
      marginTop: 16,
    },
    backLinkText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 20,
      gap: 10,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    googleBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      height: 50,
      backgroundColor: colors.card,
    },
    googleBtnText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    appleBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: "#000",
      borderRadius: colors.radius,
      height: 50,
      backgroundColor: "#000",
      marginTop: 12,
    },
    appleBtnText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: "#fff",
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 28,
      gap: 4,
    },
    footerText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    footerLink: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
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
    hintText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 20,
      lineHeight: 20,
    },
  });

  if (step === "forgot_request") {
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
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.hintText}>
            Enter the email address for your account and we'll send you a one-time code to reset your password.
          </Text>

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
            />
          </View>
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              (!canRequestReset || pressed) && styles.primaryBtnDisabled,
            ]}
            onPress={handleForgotRequest}
            disabled={!canRequestReset}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Send Reset Code</Text>
            )}
          </Pressable>

          <Pressable style={styles.backLink} onPress={goBackToSignIn}>
            <Text style={styles.backLinkText}>Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (step === "forgot_verify") {
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
          <Text style={styles.title}>Set new password</Text>
          <Text style={styles.hintText}>
            Check your email for the reset code we sent to {forgotEmail}, then choose a new password.
          </Text>

          <Text style={styles.label}>Reset code</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={resetCode}
              onChangeText={setResetCode}
              placeholder="123456"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              autoFocus
            />
          </View>

          <Text style={styles.label}>New password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showNewPass}
              autoComplete="new-password"
            />
            <Pressable style={styles.eyeBtn} onPress={() => setShowNewPass((v) => !v)}>
              <Feather name={showNewPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
          {successMsg && <Text style={styles.successText}>{successMsg}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              (!canVerifyReset || pressed) && styles.primaryBtnDisabled,
            ]}
            onPress={handleForgotVerify}
            disabled={!canVerifyReset}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Reset Password</Text>
            )}
          </Pressable>

          <Pressable style={styles.backLink} onPress={goBackToSignIn}>
            <Text style={styles.backLinkText}>Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (step === "second_factor") {
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
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.hintText}>
            We sent a verification code to {email}. Enter it below to finish signing in.
          </Text>

          <Text style={styles.label}>Verification code</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={secondFactorCode}
              onChangeText={setSecondFactorCode}
              placeholder="123456"
              placeholderTextColor={styles.hintText.color as string}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              autoFocus
            />
          </View>
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              (!canVerifySecondFactor || pressed) && styles.primaryBtnDisabled,
            ]}
            onPress={handleSecondFactor}
            disabled={!canVerifySecondFactor}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Verify</Text>
            )}
          </Pressable>

          <Pressable style={styles.backLink} onPress={goBackToSignIn}>
            <Text style={styles.backLinkText}>Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to knowyourpit</Text>

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
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPass}
            autoComplete="password"
          />
          <Pressable style={styles.eyeBtn} onPress={() => setShowPass((v) => !v)}>
            <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <Pressable
          style={styles.forgotLink}
          onPress={() => {
            setForgotEmail(email);
            setErrorMsg(null);
            setStep("forgot_request");
          }}
        >
          <Text style={styles.forgotLinkText}>Forgot password?</Text>
        </Pressable>

        {errorMsg && (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            {showForgotSuggestion && (
              <Pressable
                onPress={() => {
                  setForgotEmail(email);
                  setErrorMsg(null);
                  setShowForgotSuggestion(false);
                  setStep("forgot_request");
                }}
              >
                <Text style={styles.errorForgotLink}>Forgot your password? Reset it here.</Text>
              </Pressable>
            )}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (!canSubmit || pressed) && styles.primaryBtnDisabled,
          ]}
          onPress={handleSignIn}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Sign In</Text>
          )}
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

        <Text style={styles.legalNotice}>
          By continuing, you agree to our{" "}
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
          <Text style={styles.footerText}>No account?</Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign up</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
