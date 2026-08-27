import { useCallback } from "react";
import { useSSO } from "@clerk/expo";
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import * as WebBrowser from "expo-web-browser";
import { isReplitPreviewBundle } from "@/lib/clerkDiagnostics";

type SSOFlowOptions = NonNullable<
  Parameters<ReturnType<typeof useSSO>["startSSOFlow"]>[0]
>;

/**
 * Clerk Expo 3 lazy-loads its OAuth dependencies with dynamic imports. Replit's
 * no-dev Expo Go preview cannot resolve that lazy bundle even though both Expo
 * packages are installed. Use the same browser-based SSO sequence only in that
 * preview; all development-client and release builds stay on Clerk's hook.
 */
export function usePreviewSafeSSO() {
  const { startSSOFlow: startClerkSSOFlow } = useSSO();
  const {
    signIn,
    setActive,
    isLoaded: isSignInLoaded,
  } = useSignIn();
  const {
    signUp,
    isLoaded: isSignUpLoaded,
  } = useSignUp();

  const startSSOFlow = useCallback(
    async (options: SSOFlowOptions) => {
      if (!isReplitPreviewBundle(process.env.EXPO_PUBLIC_BROWSER_PREVIEW_MODE)) {
        return startClerkSSOFlow(options);
      }

      if (!isSignInLoaded || !isSignUpLoaded || !signIn || !signUp) {
        return {
          createdSessionId: null,
          authSessionResult: null,
          signIn,
          signUp,
          setActive,
        };
      }

      const { strategy, unsafeMetadata, authSessionOptions, redirectUrl } = options;
      if (!redirectUrl) {
        throw new Error("A redirect URL is required to continue with social sign-in.");
      }

      // Clerk 3's legacy SignIn type omits the OAuth strategies supported by
      // useSSO, even though its implementation invokes this exact operation.
      if (options.strategy === "enterprise_sso") {
        await (signIn.create as any)({
          strategy,
          redirectUrl,
          identifier: options.identifier,
        });
      } else {
        await (signIn.create as any)({ strategy, redirectUrl });
      }

      const externalVerificationRedirectURL =
        signIn.firstFactorVerification?.externalVerificationRedirectURL;
      if (!externalVerificationRedirectURL) {
        throw new Error("Could not start the secure sign-in session. Please try again.");
      }

      const authSessionResult = await WebBrowser.openAuthSessionAsync(
        externalVerificationRedirectURL.toString(),
        redirectUrl,
        authSessionOptions,
      );
      if (authSessionResult.type !== "success" || !authSessionResult.url) {
        return {
          createdSessionId: null,
          setActive,
          signIn,
          signUp,
          authSessionResult,
        };
      }

      const rotatingTokenNonce =
        new URL(authSessionResult.url).searchParams.get("rotating_token_nonce") ?? "";
      await signIn.reload({ rotatingTokenNonce });

      if (signIn.firstFactorVerification?.status === "transferable") {
        await signUp.create({ transfer: true, unsafeMetadata });
      }

      return {
        createdSessionId: signUp.createdSessionId ?? signIn.createdSessionId,
        setActive,
        signIn,
        signUp,
        authSessionResult,
      };
    },
    [
      isSignInLoaded,
      isSignUpLoaded,
      setActive,
      signIn,
      signUp,
      startClerkSSOFlow,
    ],
  );

  return { startSSOFlow };
}