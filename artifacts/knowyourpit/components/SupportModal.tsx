import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { Feather } from "@expo/vector-icons";
import { fetch as expoFetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
  prefillName?: string;
  prefillEmail?: string;
}

type Step = "form" | "success";

export function SupportModal({ visible, onClose, prefillName = "", prefillEmail = "" }: SupportModalProps) {
  const colors = useColors();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");

  const reset = () => {
    setSubject("");
    setMessage("");
    setError(null);
    setSubmitting(false);
    setStep("form");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Message must be at least 10 characters.");
      return;
    }

    setError(null);
    setSubmitting(true);

    if (!API_BASE_URL) {
      setError("The app isn't configured to reach the server. Please email support@knowyourpit.com directly.");
      setSubmitting(false);
      return;
    }

    const name = prefillName.trim() || "App User";
    const email = prefillEmail.trim() || "noreply@knowyourpit.com";

    try {
      const res = await expoFetch(`${API_BASE_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject: subject.trim(),
          message: message.trim(),
          source: "in-app",
        }),
      });

      if (!res.ok) {
        let body: { error?: string } = {};
        try { body = (await res.json()) as typeof body; } catch {}
        if (res.status === 429) {
          setError("Too many requests. Please wait a few minutes and try again.");
        } else {
          setError(body.error ?? "Something went wrong. Please try again.");
        }
        return;
      }

      setStep("success");
    } catch {
      setError("Couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <AppKeyboardAvoidingView style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Contact Support</Text>
          <Pressable onPress={handleClose} style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.6 }]}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {step === "success" ? (
          <View style={s.successContainer}>
            <View style={[s.successIcon, { backgroundColor: "#4CAF5020" }]}>
              <Feather name="check-circle" size={40} color="#4CAF50" />
            </View>
            <Text style={[s.successTitle, { color: colors.foreground }]}>Message sent!</Text>
            <Text style={[s.successBody, { color: colors.mutedForeground }]}>
              We received your message and will get back to you at{"\n"}
              <Text style={{ color: colors.foreground }}>{prefillEmail || "the email on your account"}</Text>.
            </Text>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [s.doneBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }, pressed && { opacity: 0.85 }]}
            >
              <Text style={s.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.formContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[s.label, { color: colors.mutedForeground }]}>SUBJECT</Text>
            <TextInput
              style={[
                s.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                  borderRadius: colors.radius,
                },
              ]}
              placeholder="What can we help you with?"
              placeholderTextColor={colors.mutedForeground}
              value={subject}
              onChangeText={(t) => { setSubject(t); setError(null); }}
              returnKeyType="next"
              maxLength={200}
              editable={!submitting}
            />

            <Text style={[s.label, { color: colors.mutedForeground, marginTop: 16 }]}>MESSAGE</Text>
            <TextInput
              style={[
                s.textArea,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                  borderRadius: colors.radius,
                },
              ]}
              placeholder="Describe your issue or question in detail…"
              placeholderTextColor={colors.mutedForeground}
              value={message}
              onChangeText={(t) => { setMessage(t); setError(null); }}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={5000}
              editable={!submitting}
            />
            <Text style={[s.charCount, { color: colors.mutedForeground }]}>{message.length} / 5000</Text>

            {!!prefillEmail && (
              <Text style={[s.replyNote, { color: colors.mutedForeground }]}>
                We'll reply to <Text style={{ color: colors.foreground }}>{prefillEmail}</Text>
              </Text>
            )}

            {!!error && (
              <View style={[s.errorBanner, { backgroundColor: "#E8452015", borderColor: "#E8452040", borderRadius: colors.radius }]}>
                <Feather name="alert-circle" size={14} color="#E84520" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                s.submitBtn,
                { backgroundColor: colors.primary, borderRadius: colors.radius },
                (pressed || submitting) && { opacity: 0.75 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="send" size={16} color="#fff" />
                  <Text style={s.submitBtnText}>Send Message</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        )}
      </AppKeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center" },
  closeBtn: { position: "absolute", right: 20, top: 20, padding: 4 },
  formContainer: { padding: 20, paddingBottom: 40 },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 140,
  },
  charCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginTop: 4,
  },
  replyNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 12,
    textAlign: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 16,
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#E84520" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    marginTop: 24,
    minHeight: 50,
  },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  successBody: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  doneBtn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 160,
  },
  doneBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
