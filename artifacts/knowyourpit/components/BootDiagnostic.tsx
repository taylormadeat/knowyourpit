import Constants from "expo-constants";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getBreadcrumbs, formatBreadcrumbs } from "@/lib/bootBreadcrumbs";

export interface BootDiagnosticProps {
  clerkState: string;
  /** Full publishable key — used to decode the FAPI host for the probe. */
  publishableKey: string;
  extra?: string | null;
  onContinue?: () => void;
}

const BG = "#0e0e10";
const FG = "#ffffff";
const MUTED = "#9ca3af";
const DIM = "#6b7280";
const ACCENT = "#f97316";

type ProbeStatus = "pending" | "ok" | "fail" | "timeout";

interface ProbeResult {
  status: ProbeStatus;
  detail: string;
}

function decodeFapiHostFromKey(pk: string): string | null {
  try {
    const parts = pk.split("_");
    const encoded = parts[parts.length - 1];
    if (!encoded) return null;
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    const decoded = globalThis.atob ? globalThis.atob(padded) : null;
    if (!decoded) return null;
    return decoded.replace(/\$+$/, "");
  } catch {
    return null;
  }
}

function describeError(err: unknown): string {
  if (!err) return "unknown error";
  if (typeof err !== "object") return String(err);
  const e = err as {
    name?: string;
    message?: string;
    code?: string | number;
    cause?: unknown;
    toString?: () => string;
  };
  const parts: string[] = [];
  if (e.name && e.name !== "Error") parts.push(e.name);
  if (e.code !== undefined && e.code !== null) parts.push(`code=${e.code}`);
  if (e.message) parts.push(e.message);
  if (e.cause) {
    const cause =
      typeof e.cause === "object" && e.cause !== null
        ? (e.cause as { message?: string }).message ?? String(e.cause)
        : String(e.cause);
    parts.push(`cause=${cause}`);
  }
  // Also try toString in case it surfaces NSURLErrorDomain / -1003 etc.
  if (e.toString) {
    const s = e.toString();
    if (s && !parts.some((p) => p === s)) parts.push(s);
  }
  return parts.join(" | ").slice(0, 240) || "unknown error";
}

async function probeWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<ProbeResult> {
  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    const ms = Date.now() - startedAt;
    if (res.ok || res.status > 0) {
      return { status: "ok", detail: `HTTP ${res.status} in ${ms}ms` };
    }
    return { status: "fail", detail: `HTTP ${res.status} in ${ms}ms` };
  } catch (err) {
    const ms = Date.now() - startedAt;
    const desc = describeError(err);
    if (desc.toLowerCase().includes("abort")) {
      return { status: "timeout", detail: `timed out after ${ms}ms` };
    }
    return { status: "fail", detail: `${desc} (${ms}ms)` };
  }
}

function formatProbe(label: string, p: ProbeResult): string {
  const icon =
    p.status === "ok"
      ? "OK"
      : p.status === "timeout"
      ? "TIMEOUT"
      : p.status === "fail"
      ? "FAIL"
      : "...";
  return `${label}: ${icon} \u2014 ${p.detail}`;
}

export function BootDiagnostic({
  clerkState,
  publishableKey,
  extra,
  onContinue,
}: BootDiagnosticProps) {
  const publishableKeyPrefix = publishableKey ? publishableKey.slice(0, 12) : "";
  const [elapsedSec, setElapsedSec] = useState(0);
  const [reachProbe, setReachProbe] = useState<ProbeResult>({
    status: "pending",
    detail: "starting\u2026",
  });
  const [clerkProbe, setClerkProbe] = useState<ProbeResult>({
    status: "pending",
    detail: "starting\u2026",
  });
  const [cdnProbe, setCdnProbe] = useState<ProbeResult>({
    status: "pending",
    detail: "starting\u2026",
  });
  const probesStartedRef = useRef(false);

  const [breadcrumbsText, setBreadcrumbsText] = useState<string>(() =>
    formatBreadcrumbs(getBreadcrumbs()),
  );
  const [crumbCount, setCrumbCount] = useState<number>(
    () => getBreadcrumbs().length,
  );
  const breadcrumbsScrollRef = useRef<ScrollView | null>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSec((s) => s + 1);
      // Re-snapshot breadcrumbs on every tick so the on-device log stays
      // current. Cheap: just an array slice + map → string.
      const snap = getBreadcrumbs();
      setBreadcrumbsText(formatBreadcrumbs(snap));
      setCrumbCount(snap.length);
      // Auto-scroll to the bottom so the LATEST events are always visible.
      // Without this, the diagnostic shows the first ~7 lines and the user
      // has to manually scroll — which loses us the data we actually need
      // (what happened in the last few seconds).
      requestAnimationFrame(() => {
        breadcrumbsScrollRef.current?.scrollToEnd({ animated: false });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (probesStartedRef.current) return;
    probesStartedRef.current = true;

    let cancelled = false;
    (async () => {
      // Probe 1: Apple captive-portal — generic IPv4 reachability check.
      const generic = await probeWithTimeout(
        "https://www.apple.com/library/test/success.html",
        6000,
      );
      if (!cancelled) setReachProbe(generic);

      // Probe 2: the configured Clerk FAPI host (custom domain). This is
      // exactly the URL the Clerk SDK hits on init.
      const fapiHost = decodeFapiHostFromKey(
        publishableKey && publishableKey.startsWith("pk_") ? publishableKey : "",
      );
      const fapiUrl = fapiHost
        ? `https://${fapiHost}/v1/environment?_clerk_js_version=5.0.0&__clerk_api_version=2025-04-10`
        : "https://clerk.knowyourpit.com/v1/environment?_clerk_js_version=5.0.0&__clerk_api_version=2025-04-10";

      // Probe 3: bypass the custom domain and hit Clerk's underlying CDN
      // hostname directly. If probe 2 fails but probe 3 succeeds, the issue
      // is specifically the custom-domain TLS / SNI on iOS — not Clerk
      // network reachability in general. If both fail, it's iOS reaching
      // Cloudflare at all (ATS, cellular carrier, etc.). Run in parallel.
      const cdnUrl =
        "https://frontend-api.clerk.services/v1/environment?_clerk_js_version=5.0.0&__clerk_api_version=2025-04-10";

      const [clerk, cdn] = await Promise.all([
        probeWithTimeout(fapiUrl, 8000),
        probeWithTimeout(cdnUrl, 8000),
      ]);
      if (!cancelled) {
        setClerkProbe(clerk);
        setCdnProbe(cdn);
      }
    })().catch(() => {
      /* probes never throw outwardly */
    });

    return () => {
      cancelled = true;
    };
  }, [publishableKey]);

  let primaryMessage = "Connecting to PitMaster\u2026";
  if (elapsedSec >= 30) {
    primaryMessage =
      "Still trying to connect.\nIf this persists, please force-quit the app, check your internet connection, and reopen.";
  } else if (elapsedSec >= 15) {
    primaryMessage = "Having trouble connecting \u2014 checking your network\u2026";
  } else if (elapsedSec >= 5) {
    primaryMessage = "Still loading\u2014 almost there\u2026";
  }

  const version = Constants.expoConfig?.version ?? "?";
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    (Constants as unknown as { nativeBuildVersion?: string }).nativeBuildVersion ??
    "?";
  const buildLabel = `knowyourpit ${version} build ${buildNumber}`;

  const showContinue = onContinue !== undefined && elapsedSec >= 15;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>knowyourpit</Text>
        <ActivityIndicator color={FG} size="large" style={styles.spinner} />
        <Text style={styles.primary}>{primaryMessage}</Text>
        {showContinue ? (
          <Pressable
            onPress={onContinue}
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue without sign-in"
          >
            <Text style={styles.continueButtonText}>Continue without sign-in</Text>
          </Pressable>
        ) : null}
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
        <Text style={styles.footerLine} numberOfLines={2}>
          {formatProbe("Net", reachProbe)}
        </Text>
        <Text style={styles.footerLine} numberOfLines={3}>
          {formatProbe("Clerk-API", clerkProbe)}
        </Text>
        <Text style={styles.footerLine} numberOfLines={3}>
          {formatProbe("Clerk-CDN", cdnProbe)}
        </Text>
        {extra ? (
          <ScrollView style={styles.extraScroll} contentContainerStyle={styles.extraContent}>
            <Text style={styles.extraText}>{extra}</Text>
          </ScrollView>
        ) : null}
        {breadcrumbsText ? (
          <>
            <Text style={styles.footerLine}>
              {`Boot log (${crumbCount} events) — newest at bottom:`}
            </Text>
            <ScrollView
              ref={breadcrumbsScrollRef}
              style={styles.breadcrumbScroll}
              contentContainerStyle={styles.extraContent}
            >
              <Text style={styles.extraText}>{breadcrumbsText}</Text>
            </ScrollView>
          </>
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
  continueButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: "transparent",
  },
  continueButtonPressed: {
    backgroundColor: "rgba(249, 115, 22, 0.15)",
  },
  continueButtonText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: "600",
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
  breadcrumbScroll: {
    marginTop: 4,
    maxHeight: 240,
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
