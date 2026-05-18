import React from "react";
import {
  Alert,
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SUPPORT_EMAIL = "support@knowyourpit.com";

interface BetaWelcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function BetaWelcomeModal({ visible, onDismiss }: BetaWelcomeModalProps) {
  const insets = useSafeAreaInsets();

  function handleEmailPress() {
    const url = `mailto:${SUPPORT_EMAIL}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        }
        Alert.alert(
          "No mail app found",
          `Please email us at ${SUPPORT_EMAIL} — we'd love to hear from you.`,
        );
      })
      .catch(() => {
        Alert.alert(
          "No mail app found",
          `Please email us at ${SUPPORT_EMAIL} — we'd love to hear from you.`,
        );
      });
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              paddingTop: Math.max(insets.top + 8, 24),
              paddingBottom: Math.max(insets.bottom + 8, 24),
            },
          ]}
        >
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.heading}>Welcome to knowyourpit!</Text>

          <Text style={styles.body}>
            You're one of the first to try the app — we're actively building and improving it every day, so you may run into rough edges.
          </Text>

          <Text style={styles.body}>
            Your feedback makes a real difference. Email us at any time — especially if something breaks or feels off:
          </Text>

          <Pressable
            onPress={handleEmailPress}
            style={styles.emailButton}
            android_ripple={{ color: "#E8452044" }}
            accessibilityRole="link"
            accessibilityLabel={`Send feedback email to ${SUPPORT_EMAIL}`}
          >
            <Text style={styles.emailText}>{SUPPORT_EMAIL}</Text>
          </Pressable>

          <Text style={styles.hint}>
            Screenshots are incredibly helpful — attach them to your email and we'll sort things out fast.
          </Text>

          <Pressable
            style={styles.dismissButton}
            onPress={onDismiss}
            android_ripple={{ color: "#ffffff33" }}
            accessibilityRole="button"
            accessibilityLabel="Got it — let's cook!"
          >
            <Text style={styles.dismissText}>Got it — let's cook!</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "#1C1915",
    borderRadius: 20,
    width: "100%",
    maxWidth: 420,
    paddingHorizontal: 28,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2C2520",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  logo: {
    width: 100,
    height: 40,
    marginBottom: 20,
    tintColor: undefined,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F0E8D5",
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "Inter_700Bold",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#A89880",
    textAlign: "center",
    marginBottom: 12,
    fontFamily: "Inter_400Regular",
  },
  emailButton: {
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E84520",
    backgroundColor: "#1C1915",
  },
  emailText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E84520",
    fontFamily: "Inter_600SemiBold",
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B5E52",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    fontFamily: "Inter_400Regular",
  },
  dismissButton: {
    backgroundColor: "#E84520",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  dismissText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    fontFamily: "Inter_700Bold",
  },
});
