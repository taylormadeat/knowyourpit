/**
 * PlanSubmitArea
 *
 * The submit / CTA area at the bottom of the Plan screen's single-cook form.
 * Extracted from plan.tsx so the button disable logic can be unit-tested
 * without rendering the full screen's 30+ dependency tree.
 *
 * Contains:
 *   1. Primary CTA — "Start Cooking Now" / "Save Cook Plan" / "Begin Thawing Now"
 *   2. Slow-submit watchdog row (Cancel escape hatch after 6 s)
 *   3. Frozen-thaw informational callout (frozen + Cook-Now path only)
 *   4. Secondary "Save Cook Plan" button (frozen + Cook-Now path only)
 *
 * Critical invariant:
 *   Both Pressables use `disabled={isSubmitting}`. The local-first flow owns
 *   this state; an unrelated legacy server mutation must not leave the primary
 *   cook-start CTA permanently spinning.
 */

import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

export interface PlanSubmitAreaColors {
  /** Primary brand colour — used for the button background and border. */
  primary: string;
  /** Muted text/icon colour — used in the watchdog row. */
  mutedForeground: string;
  /** Main text colour — used in the callout body. */
  foreground: string;
  /** Border-radius value shared with the rest of the form. */
  radius: number;
}

export interface PlanSubmitAreaProps {
  // ── Core button state ───────────────────────────────────────────────────
  /**
   * True while handleSubmit / handleSaveFrozenPlan is running.
   * Sourced from usePlanLoadingState().isSubmitting in plan.tsx.
   */
  isSubmitting: boolean;
  // ── Handlers ───────────────────────────────────────────────────────────
  /** handleSubmit() in plan.tsx */
  onSubmit: () => void;
  /** handleSaveFrozenPlan() in plan.tsx — only used when showSavePlan is true */
  onSavePlan?: () => void;
  /** cancelSubmitWait() in plan.tsx */
  onCancelSubmitWait: () => void;

  // ── Layout / content ───────────────────────────────────────────────────
  /** Label for the primary button */
  submitLabel: string;
  /**
   * Whether to render the secondary "Save Cook Plan" button and the
   * frozen-thaw callout. Corresponds to: frozenEnabled && cookNowMode === "now"
   */
  showSavePlan?: boolean;
  /**
   * Whether the frozen-thaw informational callout should be visible.
   * Corresponds to: showBeginThawCallout in plan.tsx.
   * Only relevant when showSavePlan is true.
   */
  showThawCallout?: boolean;
  /**
   * Whether the slow-submit watchdog row should be visible.
   * Corresponds to: isSubmitting && submitSlow in plan.tsx.
   */
  submitSlow?: boolean;

  // ── Theme ──────────────────────────────────────────────────────────────
  colors: PlanSubmitAreaColors;
}

/**
 * PlanSubmitArea renders the submit area at the bottom of the Plan screen.
 *
 * Disable expression (identical to plan.tsx):
 *   disabled={isSubmitting}     ← primary button
 *   disabled={isSubmitting}     ← secondary button
 *
 * Both buttons share the same lock so a user can never trigger duplicate
 * creates by tapping one while the other's request is in flight.
 */
export function PlanSubmitArea({
  isSubmitting,
  onSubmit,
  onSavePlan,
  onCancelSubmitWait,
  submitLabel,
  showSavePlan = false,
  showThawCallout = false,
  submitSlow = false,
  colors,
}: PlanSubmitAreaProps) {
  const isLocked = isSubmitting;

  return (
    <View>
      {/* ── Primary CTA ── (plan.tsx ~line 3613) ──────────────────────────── */}
      <Pressable
        testID="submit-cook-btn"
        disabled={isLocked}
        accessibilityState={{ disabled: isLocked }}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.submitBtn,
          { backgroundColor: colors.primary, borderRadius: colors.radius },
          (isLocked || pressed) && { opacity: 0.7 },
        ]}
      >
        {/* Keep Text always mounted to avoid the react@19 + RN@0.81 mock crash
            where the class-based Text mock's constructor fails during unmount/
            remount cycles. ActivityIndicator and Feather can still be toggled
            safely since only the class-based Text mock exhibits this issue. */}
        {isLocked
          ? <ActivityIndicator testID="submit-spinner" color="#fff" />
          : <Feather name="play" size={18} color="#fff" />}
        <Text style={[styles.submitText, isLocked && styles.labelHidden]}>
          {isLocked ? "" : submitLabel}
        </Text>
      </Pressable>

      {/* ── Slow-submit watchdog row ── (plan.tsx ~line 3637) ──────────────── */}
      {isSubmitting && submitSlow && (
        <View
          testID="submit-slow-row"
          style={styles.slowRow}
        >
          <ActivityIndicator size="small" color={colors.mutedForeground} />
          <Text style={[styles.slowText, { color: colors.mutedForeground }]}>
            Still working — your connection looks slow. Keep waiting, or cancel and try again.
          </Text>
          <Pressable testID="submit-slow-cancel" onPress={onCancelSubmitWait} hitSlop={8}>
            <Text style={[styles.slowCancelText, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* ── Frozen-thaw informational callout ── (plan.tsx ~line 3668) ──────── */}
      {showSavePlan && showThawCallout && (
        <View
          style={[
            styles.thawCallout,
            { backgroundColor: "#3B82F615", borderColor: "#3B82F640", borderRadius: colors.radius },
          ]}
        >
          <Feather name="info" size={13} color="#3B82F6" style={styles.thawCalloutIcon} />
          <Text style={[styles.thawCalloutText, { color: colors.foreground }]}>
            Starting this plan begins your thaw countdown. Notifications will fire when it&apos;s
            time to move the meat to the counter, then to the grill.
          </Text>
        </View>
      )}

      {/* ── Secondary CTA "Save Cook Plan" ── (plan.tsx ~line 3701) ──────────── */}
      {showSavePlan && (
        <Pressable
          testID="save-cook-plan-btn"
          disabled={isLocked}
          accessibilityState={{ disabled: isLocked }}
          onPress={onSavePlan}
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: "transparent",
              borderRadius: colors.radius,
              borderWidth: 1.5,
              borderColor: colors.primary,
              marginTop: 10,
            },
            (isLocked || pressed) && { opacity: 0.6 },
          ]}
        >
          {/* Same always-mounted Text pattern as the primary button */}
          <Feather name="bookmark" size={18} color={colors.primary} />
          <Text style={[styles.submitText, { color: colors.primary }, isLocked && styles.labelHidden]}>
            {isLocked ? "" : "Save Cook Plan"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  slowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  slowText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  slowCancelText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  // Hides the Text label while the spinner is shown without unmounting the
  // Text node — avoids the react@19 + RN@0.81 class-mock crash on re-render.
  labelHidden: {
    width: 0,
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
  thawCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  thawCalloutIcon: {
    marginTop: 1,
  },
  thawCalloutText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 17,
  },
});
