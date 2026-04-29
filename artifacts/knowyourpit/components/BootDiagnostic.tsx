import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * Visible boot screen shown while Clerk is still loading or has timed out.
 *
 * Replaces the previous silent black `<View>` placeholder, which was
 * indistinguishable from a hung/crashed app and caused multiple App Store
 * rejections. By making the boot state visible we get an actionable signal
 * from any future failure: an Apple reviewer (or user) seeing this screen
 * can read the on-screen state instead of staring at a black void.
 *
 * The component is intentionally self-contained — it does not import any
 * theme, font, or context, so it can render even if every provider above it
 * has failed.
 */
export interface BootDiagnosticProps {
  /** Display label for the auth state, e.g. "ready", "not ready". */
  clerkState: string;
  /** Short prefix of the Clerk publishable key for at-a-glance verification. */
  publishableKeyPrefix: string;
  /** Build number / version label shown at the bottom for support. */
  buildLabel: string;
  /** Optional extra debug line, e.g. captured-error preview. */
  extra?: string | null;
}

const BG = "#0e0e10";
const FG = "#ffffff";
const MUTED = "#9ca3af";
const DIM = "#6b7280";

export function BootDiagnostic({
  clerkState,
  publishableKeyPrefix,
  buildLabel,
  extra,
}: BootDiagnosticProps) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  let primaryMessage = "Connecting to PitMaster\u2026";
  if (elapsedSec >= 30) {
    primaryMessage =
      "Still trying to connect.\nIf this persists, please force-quit the app, check your internet connection, and reopen.";
  } else if (elapsedSec >= 15) {
    primaryMessage = "Having trouble connecting \u2014 checking your network\u2026";
  } else if (elapsedSec >= 5) {
    primaryMessage = "Still loading\u2014 almost there\u2026";
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>knowyourpit</Text>
        <ActivityIndicator color={FG} size="large" style={styles.spinner} />
        <Text style={styles.primary}>{primaryMessage}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLine}>{buildLabel}</Text>
        <Text style={styles.footerLine}>
          {`${Platform.OS} ${Platform.Version}\u2002\u2022\u2002` +
            `idiom=${(Platform as unknown as { isPad?: boolean }).isPad ? "pad" : "phone"}\u2002\u2022\u2002` +
            `newArch=${(globalThis as unknown as { nativeFabricUIManager?: unknown }).nativeFabricUIManager ? "on" : "off"}`}
        </Text>
        <Text style={styles.footerLine}>
          {`Clerk: ${clerkState} \u2002\u2022\u2002 elapsed ${elapsedSec}s`}
        </Text>
        <Text style={styles.footerLine} numberOfLines={1}>
          Key: {publishableKeyPrefix || "(missing)"}
        </Text>
        {extra ? (
          <ScrollView style={styles.extraScroll} contentContainerStyle={styles.extraContent}>
            <Text style={styles.extraText}>{extra}</Text>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
    paddingVertical: 60,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  brand: {
    color: FG,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  spinner: {
    marginVertical: 8,
  },
  primary: {
    color: MUTED,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  footer: {
    alignItems: "center",
    gap: 4,
  },
  footerLine: {
    color: DIM,
    fontSize: 11,
    textAlign: "center",
  },
  extraScroll: {
    marginTop: 8,
    maxHeight: 120,
    width: "100%",
  },
  extraContent: {
    paddingBottom: 4,
  },
  extraText: {
    color: DIM,
    fontSize: 10,
    fontFamily: "Menlo",
    textAlign: "left",
  },
});
