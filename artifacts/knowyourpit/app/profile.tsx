import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  LayoutAnimation,
  Alert,
} from "react-native";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { useBottomInset } from "@/hooks/useBottomInset";
import {
  useListGrills,
  useListCooks,
  type Cook,
} from "@workspace/api-client-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { usePaywall } from "@/contexts/PaywallContext";

function StarRating({ score, color }: { score: number; color: string }) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const pos = i + 1;
    if (score >= pos) return "star" as const;
    if (score >= pos - 0.5) return "star-half" as const;
    return "star-border" as const;
  });
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {stars.map((icon, i) => (
        <MaterialIcons key={i} name={icon} size={15} color={color} />
      ))}
    </View>
  );
}

type DateRange = "30d" | "90d" | "all";

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: "30 Days", value: "30d" },
  { label: "3 Months", value: "90d" },
  { label: "All Time", value: "all" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const { user } = useUser();
  const { data: grills } = useListGrills();
  const { data: cooks } = useListCooks();
  const { isPro, isIdentityLinked, expirationDate } = useSubscription();
  const effectivePro = useEffectivePro();
  const { showPaywall } = usePaywall();

  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [qualityExpanded, setQualityExpanded] = useState(true);

  // ── Name editing ──────────────────────────────────────────────────────────
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  // ── Change password ───────────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const pwSuccessTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = (user?.unsafeMetadata?.displayName as string | undefined)
    || user?.fullName || user?.firstName || "";

  const openNameEdit = useCallback(() => {
    const current = (user?.unsafeMetadata?.displayName as string | undefined)
      || user?.fullName || user?.firstName || "";
    setEditName(current);
    setNameEditOpen(true);
  }, [user?.unsafeMetadata?.displayName, user?.fullName, user?.firstName]);

  const saveNameEdit = useCallback(async () => {
    if (!user) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    setNameSaving(true);
    try {
      await user.update({ unsafeMetadata: { ...((user.unsafeMetadata as object) ?? {}), displayName: trimmed } });
      setNameEditOpen(false);
    } catch (err: any) {
      Alert.alert("Couldn't save name", err?.errors?.[0]?.longMessage || err?.message || "Please try again.");
    } finally {
      setNameSaving(false);
    }
  }, [user, editName]);

  const closePwModal = useCallback(() => {
    if (pwSuccessTimer.current) {
      clearTimeout(pwSuccessTimer.current);
      pwSuccessTimer.current = null;
    }
    setPwOpen(false);
    setPwSuccess(false);
  }, []);

  const openChangePassword = useCallback(() => {
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwError(null);
    setPwSuccess(false);
    setPwOpen(true);
  }, []);

  const saveChangePassword = useCallback(async () => {
    setPwError(null);
    if (!currentPw) {
      setPwError("Please enter your current password.");
      return;
    }
    if (!newPw || newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New passwords don't match.");
      return;
    }
    if (!user) return;
    setPwSaving(true);
    try {
      await user.updatePassword({ currentPassword: currentPw, newPassword: newPw });
      setPwSuccess(true);
      pwSuccessTimer.current = setTimeout(() => {
        setPwOpen(false);
        setPwSuccess(false);
        pwSuccessTimer.current = null;
      }, 1500);
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || "Please try again.";
      setPwError(msg);
    } finally {
      setPwSaving(false);
    }
  }, [user, currentPw, newPw, confirmPw]);

  // ── Cook quality calculations ─────────────────────────────────────────────
  const allRatedCooks = cooks?.filter(
    (c) =>
      c.status === "completed" &&
      (c.ratingTenderness != null || c.ratingBark != null || c.ratingFlavor != null)
  ) ?? [];

  const ratedCooks = (() => {
    if (dateRange === "all") return allRatedCooks;
    const days = dateRange === "30d" ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return allRatedCooks.filter((c) => new Date(c.createdAt) >= cutoff);
  })();

  const avg = (
    key: keyof Pick<Cook, "ratingTenderness" | "ratingBark" | "ratingFlavor">,
    pool: Cook[] = ratedCooks,
  ): string | null => {
    const values = pool.map((c) => c[key]).filter((v): v is number => v != null);
    if (values.length === 0) return null;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  };

  const avgTenderness = avg("ratingTenderness");
  const avgBark = avg("ratingBark");
  const avgFlavor = avg("ratingFlavor");
  const showQuality = ratedCooks.length > 0;

  const overallScore = (t: string | null, b: string | null, f: string | null): string | null => {
    const nums = [t, b, f].filter((v): v is string => v != null).map(parseFloat);
    if (nums.length === 0) return null;
    return (nums.reduce((a, n) => a + n, 0) / nums.length).toFixed(1);
  };

  const overallAvg = overallScore(avgTenderness, avgBark, avgFlavor);

  const meatTypeMap = ratedCooks.reduce<Record<string, Cook[]>>((acc, c) => {
    const key = c.foodType ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});
  const meatTypes = Object.keys(meatTypeMap).sort();
  const showByMeatType = meatTypes.length > 1;

  const botPad = useBottomInset();

  const initials = (
    displayName?.[0] ||
    user?.username?.[0] ||
    user?.emailAddresses?.[0]?.emailAddress?.[0] ||
    "P"
  ).toUpperCase();

  const toggleQuality = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setQualityExpanded((v) => !v);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />

      <AppHeader title="Profile" showBack dark />

      <ScrollView
        contentContainerStyle={{ paddingBottom: botPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={[s.profileSection, { borderBottomColor: colors.border }]}>
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>

          {/* Name row with edit button */}
          <View style={s.nameRow}>
            <Text style={[s.profileName, { color: colors.foreground }]}>
              {displayName || "Pitmaster"}
            </Text>
            <Pressable
              onPress={openNameEdit}
              hitSlop={10}
              style={({ pressed }) => [s.editBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="edit-2" size={15} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[s.profileEmail, { color: colors.mutedForeground }]}>
            {user?.emailAddresses?.[0]?.emailAddress || ""}
          </Text>
          <Text style={[s.memberSince, { color: colors.mutedForeground }]}>
            Member since{" "}
            {user?.createdAt ? new Date(user.createdAt).getFullYear() : "—"}
          </Text>
        </View>

        {/* Plan status row — skeleton while identity-linked RC check is pending */}
        {!isIdentityLinked ? (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 12,
              padding: 14,
              borderRadius: colors.radius,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border, marginRight: 12, opacity: 0.4 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ height: 14, width: 100, backgroundColor: colors.border, borderRadius: 4, opacity: 0.5 }} />
              <View style={{ height: 11, width: 60, backgroundColor: colors.border, borderRadius: 4, opacity: 0.3 }} />
            </View>
          </View>
        ) : (
          <Pressable
            onPress={effectivePro ? undefined : () => showPaywall({ trigger: "pro_required" })}
            style={({ pressed }) => [
              {
                marginHorizontal: 16,
                marginTop: 12,
                padding: 14,
                borderRadius: colors.radius,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: effectivePro ? colors.primary : colors.border,
                flexDirection: "row",
                alignItems: "center",
                opacity: pressed && !effectivePro ? 0.7 : 1,
              },
            ]}
          >
            <MaterialIcons
              name={effectivePro ? "verified" : "lock-outline"}
              size={22}
              color={effectivePro ? colors.primary : colors.mutedForeground}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: colors.foreground,
                }}
              >
                {effectivePro ? "knowyourpit Pro" : "Free plan"}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.mutedForeground,
                  marginTop: 2,
                }}
              >
                {effectivePro
                  ? isPro && expirationDate
                    ? `Renews ${new Date(expirationDate).toLocaleDateString()}`
                    : "Active"
                  : "Tap to unlock unlimited cooks, AI chat & analyses"}
              </Text>
            </View>
            {!effectivePro && (
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            )}
          </Pressable>
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: "Grills", value: (grills as any[])?.length ?? 0 },
            { label: "Recipes Saved", value: "—" },
            { label: "Cooks Done", value: "—" },
          ].map((stat) => (
            <View
              key={stat.label}
              style={[
                s.statCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={[s.statValue, { color: colors.primary }]}>
                {stat.value}
              </Text>
              <Text style={[s.statLabel, { color: colors.mutedForeground }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Cook Quality — collapsible. Visible to all users; analytics body is
            Pro-only (free users see a locked overlay with upgrade CTA). */}
        {allRatedCooks.length > 0 && (
          <>
            <Pressable
              onPress={toggleQuality}
              style={({ pressed }) => [s.sectionHeader, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="star" size={16} color={colors.primary} />
              <Text style={[s.sectionTitle, { color: colors.foreground, flex: 1 }]}>
                Your Cook Quality
              </Text>
              {isIdentityLinked && !effectivePro && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: colors.primary + "22",
                    marginRight: 6,
                  }}
                >
                  <Feather name="lock" size={10} color={colors.primary} />
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: "Inter_600SemiBold",
                      color: colors.primary,
                    }}
                  >
                    PRO
                  </Text>
                </View>
              )}
              <Feather
                name={qualityExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>

            {/* Skeleton placeholder while RC identity is being linked, so Pro
                users never see the locked card flash before isIdentityLinked
                resolves. */}
            {qualityExpanded && !isIdentityLinked && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 8,
                  height: 92,
                  borderRadius: colors.radius,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: 0.4,
                }}
              />
            )}

            {qualityExpanded && isIdentityLinked && !effectivePro && (
              <Pressable
                onPress={() =>
                  showPaywall({
                    trigger: "pro_required",
                    featureName: "Cook Quality Analytics",
                  })
                }
                style={({ pressed }) => [
                  {
                    marginHorizontal: 16,
                    marginTop: 8,
                    padding: 18,
                    borderRadius: colors.radius,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.muted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="lock" size={20} color={colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 14,
                      color: colors.foreground,
                    }}
                  >
                    Unlock Cook Quality Analytics
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: colors.mutedForeground,
                      marginTop: 2,
                      lineHeight: 16,
                    }}
                  >
                    See tenderness, bark, and flavor trends across all your cooks with Pro.
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            )}

            {qualityExpanded && isIdentityLinked && effectivePro && (
              <>
                <View style={s.pillRow}>
                  {DATE_RANGE_OPTIONS.map((opt) => {
                    const active = dateRange === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setDateRange(opt.value)}
                        style={[
                          s.pill,
                          {
                            backgroundColor: active ? colors.primary : colors.card,
                            borderColor: active ? colors.primary : colors.border,
                            borderRadius: 999,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.pillText,
                            { color: active ? "#fff" : colors.mutedForeground },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View
                  style={[
                    s.qualityCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  {!showQuality ? (
                    <Text style={[s.qualitySubtitle, { color: colors.mutedForeground, textAlign: "center", paddingVertical: 16 }]}>
                      No rated cooks in this period.
                    </Text>
                  ) : showByMeatType ? (
                    <>
                      <Text style={[s.qualitySubtitle, { color: colors.mutedForeground }]}>
                        Based on {ratedCooks.length} rated {ratedCooks.length === 1 ? "cook" : "cooks"} · by meat type
                      </Text>
                      {meatTypes.map((meatType, idx) => {
                        const pool = meatTypeMap[meatType];
                        const t = avg("ratingTenderness", pool);
                        const b = avg("ratingBark", pool);
                        const f = avg("ratingFlavor", pool);
                        const overall = overallScore(t, b, f);
                        return (
                          <View
                            key={meatType}
                            style={[
                              s.meatTypeSection,
                              idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                            ]}
                          >
                            <View style={s.meatTypeHeader}>
                              <Text style={[s.meatTypeLabel, { color: colors.foreground }]}>
                                {meatType}
                              </Text>
                              <Text style={[s.meatTypeCount, { color: colors.mutedForeground }]}>
                                {pool.length} {pool.length === 1 ? "cook" : "cooks"}
                              </Text>
                            </View>
                            {overall != null && (
                              <View style={[s.overallRow, { borderBottomColor: colors.border }]}>
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.overallLabel, { color: colors.mutedForeground }]}>
                                    Overall
                                  </Text>
                                  <View style={s.overallScoreRow}>
                                    <Text style={[s.overallScore, { color: colors.primary }]}>
                                      {overall}
                                    </Text>
                                    <Text style={[s.overallScoreMax, { color: colors.mutedForeground }]}>
                                      / 5
                                    </Text>
                                  </View>
                                  <StarRating score={parseFloat(overall)} color={colors.primary} />
                                </View>
                              </View>
                            )}
                            <View style={s.qualityRow}>
                              {[
                                { label: "T", fullLabel: "Tenderness", value: t },
                                { label: "B", fullLabel: "Bark", value: b },
                                { label: "F", fullLabel: "Flavor", value: f },
                              ].map((item) => (
                                <View key={item.label} style={s.qualityItemCompact}>
                                  <Text style={[s.qualityLabelCompact, { color: colors.mutedForeground }]}>
                                    {item.label}
                                  </Text>
                                  <View style={s.qualityScoreRow}>
                                    <Text style={[s.qualityScoreCompact, { color: colors.primary }]}>
                                      {item.value ?? "—"}
                                    </Text>
                                    {item.value != null && (
                                      <Text style={[s.qualityScoreMaxCompact, { color: colors.mutedForeground }]}>
                                        /5
                                      </Text>
                                    )}
                                  </View>
                                  {item.value != null && (
                                    <StarRating score={parseFloat(item.value)} color={colors.primary} />
                                  )}
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <Text style={[s.qualitySubtitle, { color: colors.mutedForeground }]}>
                        Based on {ratedCooks.length} rated {ratedCooks.length === 1 ? "cook" : "cooks"} · per-metric averages
                      </Text>
                      {overallAvg != null && (
                        <View style={[s.overallRow, { borderBottomColor: colors.border }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.overallLabel, { color: colors.mutedForeground }]}>
                              Overall Score
                            </Text>
                            <View style={s.overallScoreRow}>
                              <Text style={[s.overallScore, { color: colors.primary }]}>
                                {overallAvg}
                              </Text>
                              <Text style={[s.overallScoreMax, { color: colors.mutedForeground }]}>
                                / 5
                              </Text>
                            </View>
                            <StarRating score={parseFloat(overallAvg)} color={colors.primary} />
                          </View>
                        </View>
                      )}
                      <View style={s.qualityRow}>
                        {[
                          { label: "Tenderness", value: avgTenderness },
                          { label: "Bark", value: avgBark },
                          { label: "Flavor", value: avgFlavor },
                        ].map((item) => (
                          <View key={item.label} style={s.qualityItem}>
                            <View style={s.qualityScoreRow}>
                              <Text style={[s.qualityScore, { color: colors.primary }]}>
                                {item.value ?? "—"}
                              </Text>
                              {item.value != null && (
                                <Text style={[s.qualityScoreMax, { color: colors.mutedForeground }]}>
                                  /5
                                </Text>
                              )}
                            </View>
                            {item.value != null && (
                              <StarRating score={parseFloat(item.value)} color={colors.primary} />
                            )}
                            <Text style={[s.qualityLabel, { color: colors.mutedForeground }]}>
                              {item.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              </>
            )}
          </>
        )}

        {/* Account info — name + email only, no user ID */}
        <View
          style={[
            s.infoSection,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          {[
            { label: "Name", value: displayName || "—" },
            { label: "Email address", value: user?.emailAddresses?.[0]?.emailAddress || "—" },
          ].map((row) => (
            <View
              key={row.label}
              style={[
                s.infoRow,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>
                {row.label}
              </Text>
              <Text
                style={[s.infoValue, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {row.value}
              </Text>
            </View>
          ))}
          <Pressable
            onPress={user?.passwordEnabled ? openChangePassword : () => Alert.alert("No password set", "Your account uses a social login (Google, Apple, etc.) and doesn't have a password to change.")}
            style={({ pressed }) => [s.infoRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Password</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.infoValue, { color: colors.primary }]}>Change</Text>
              <Feather name="chevron-right" size={14} color={colors.primary} />
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Edit Name Modal ─────────────────────────────────────────── */}
      <Modal visible={nameEditOpen} transparent animationType="fade" onRequestClose={() => setNameEditOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setNameEditOpen(false)}>
          <Pressable
            style={[s.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Edit Name</Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Name</Text>
            <TextInput
              style={[s.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveNameEdit}
            />

            <View style={s.modalActions}>
              <Pressable
                onPress={() => setNameEditOpen(false)}
                style={[s.modalBtn, s.modalBtnCancel, { borderColor: colors.border }]}
              >
                <Text style={[s.modalBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveNameEdit}
                disabled={nameSaving}
                style={[s.modalBtn, s.modalBtnSave, { backgroundColor: colors.primary, opacity: nameSaving ? 0.7 : 1 }]}
              >
                {nameSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[s.modalBtnText, { color: "#fff" }]}>Save</Text>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Change Password Modal ────────────────────────────────────── */}
      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={closePwModal}>
        <Pressable style={s.modalBackdrop} onPress={closePwModal}>
          <Pressable
            style={[s.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Change Password</Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Current password</Text>
            <TextInput
              style={[s.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={currentPw}
              onChangeText={setCurrentPw}
              placeholder="Current password"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoFocus
              returnKeyType="next"
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>New password</Text>
            <TextInput
              style={[s.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={newPw}
              onChangeText={setNewPw}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              returnKeyType="next"
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Confirm new password</Text>
            <TextInput
              style={[s.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={confirmPw}
              onChangeText={setConfirmPw}
              placeholder="Repeat new password"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={saveChangePassword}
            />

            {pwError ? (
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.destructive, marginTop: 8 }}>
                {pwError}
              </Text>
            ) : null}

            {pwSuccess ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <Feather name="check-circle" size={14} color="#22c55e" />
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#22c55e" }}>
                  Password updated!
                </Text>
              </View>
            ) : null}

            <View style={s.modalActions}>
              <Pressable
                onPress={closePwModal}
                style={[s.modalBtn, s.modalBtnCancel, { borderColor: colors.border }]}
              >
                <Text style={[s.modalBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveChangePassword}
                disabled={pwSaving || pwSuccess}
                style={[s.modalBtn, s.modalBtnSave, { backgroundColor: colors.primary, opacity: (pwSaving || pwSuccess) ? 0.7 : 1 }]}
              >
                {pwSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[s.modalBtnText, { color: "#fff" }]}>Update</Text>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  profileSection: {
    alignItems: "center",
    padding: 28,
    borderBottomWidth: 1,
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  editBtn: { padding: 4 },
  profileEmail: { fontSize: 14, fontFamily: "Inter_400Regular" },
  memberSince: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", gap: 10, padding: 16 },
  statCard: { flex: 1, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  infoSection: { margin: 16, marginBottom: 0, borderWidth: 1, overflow: "hidden" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  infoLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  infoValue: { fontSize: 14, fontFamily: "Inter_400Regular", maxWidth: "60%", textAlign: "right" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  pillRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
  pillText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  qualityCard: { marginHorizontal: 16, borderWidth: 1, overflow: "hidden", padding: 16, gap: 14 },
  qualitySubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  qualityRow: { flexDirection: "row", justifyContent: "space-around" },
  qualityItem: { alignItems: "center", gap: 4 },
  qualityScoreRow: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  qualityScore: { fontSize: 26, fontFamily: "Inter_700Bold" },
  qualityScoreMax: { fontSize: 13, fontFamily: "Inter_400Regular", paddingBottom: 3 },
  qualityLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  meatTypeSection: { paddingTop: 12, gap: 10 },
  meatTypeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  meatTypeLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  meatTypeCount: { fontSize: 11, fontFamily: "Inter_400Regular" },
  qualityItemCompact: { alignItems: "center", gap: 3, flex: 1 },
  qualityLabelCompact: { fontSize: 11, fontFamily: "Inter_500Medium" },
  qualityScoreCompact: { fontSize: 18, fontFamily: "Inter_700Bold" },
  qualityScoreMaxCompact: { fontSize: 11, fontFamily: "Inter_400Regular", paddingBottom: 2 },
  overallRow: { borderBottomWidth: 1, paddingBottom: 14, gap: 4 },
  overallLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 2 },
  overallScoreRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  overallScore: { fontSize: 36, fontFamily: "Inter_700Bold" },
  overallScoreMax: { fontSize: 16, fontFamily: "Inter_400Regular", paddingBottom: 5 },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalSheet: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 24, gap: 4 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4, marginTop: 8 },
  nameInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modalBtnCancel: { borderWidth: 1 },
  modalBtnSave: {},
  modalBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
