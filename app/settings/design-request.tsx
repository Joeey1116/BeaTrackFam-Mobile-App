/** Custom Design Request — form that composes an email to the brand. */
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../components/ThemeProvider";
import { PrimaryButton, ScreenHeader, TextField } from "../../components/ui";
import { Radius, Spacing } from "../../constants/theme";

const DESIGN_TYPES = ["T-Shirt", "Hoodie", "Sweatshirt", "Hat", "Other"];

export default function DesignRequest() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [designType, setDesignType] = useState("T-Shirt");
  const [details, setDetails] = useState("");

  const onSend = () => {
    if (!name.trim() || !email.trim() || !details.trim()) {
      Alert.alert("Almost there", "Fill in your name, email and design idea.");
      return;
    }
    const subject = encodeURIComponent(
      `Custom Design Request — ${designType}`
    );
    const body = encodeURIComponent(
      `Name: ${name.trim()}\nEmail: ${email.trim()}\nDesign type: ${designType}\n\nDesign idea:\n${details.trim()}`
    );
    Linking.openURL(
      `mailto:contact@beatrackfam.info?subject=${subject}&body=${body}`
    ).catch(() =>
      Alert.alert("Email", "Write to us at contact@beatrackfam.info")
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title="Design Request" align="center" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          Got an idea for a one-of-a-kind piece? Tell us what you&apos;re
          picturing — we&apos;ll reply by email to talk it through.
        </Text>

        <TextField
          label="Your name"
          placeholder="What should we call you?"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TextField
          label="Email"
          placeholder="Where should we reply?"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: colors.text }]}>Design type</Text>
        <View style={styles.chips}>
          {DESIGN_TYPES.map((t) => {
            const active = designType === t;
            return (
              <Pressable
                key={t}
                onPress={() => setDesignType(t)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.text : colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.background : colors.text },
                  ]}
                >
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label="Your design idea"
          placeholder="Colors, text, vibe, references — anything that helps"
          value={details}
          onChangeText={setDetails}
        />

        <View style={styles.cta}>
          <PrimaryButton
            label="Send Request"
            onPress={onSend}
            icon={<Ionicons name="mail-outline" size={18} color={colors.buttonText} />}
          />
        </View>
        <Text style={[styles.note, { color: colors.textDim }]}>
          This opens your email app addressed to contact@beatrackfam.info.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.lg },
  label: { fontSize: 14, fontWeight: "700", marginBottom: Spacing.xs },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chip: { borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  chipText: { fontSize: 13, fontWeight: "700" },
  cta: { marginTop: Spacing.sm },
  note: { fontSize: 12, textAlign: "center", marginTop: Spacing.sm },
});
