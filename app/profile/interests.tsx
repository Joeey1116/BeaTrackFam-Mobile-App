/** Interests — pick collections you're into, or add your own. */
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../components/ThemeProvider";
import { ScreenHeader } from "../../components/ui";
import { useShop } from "../../store/shop";
import { Radius, Spacing } from "../../constants/theme";

export default function Interests() {
  const { colors } = useTheme();
  const { collections, profile, toggleInterest } = useShop();
  const [custom, setCustom] = useState("");

  const suggestions = collections.map((c) => c.title);
  const selected = profile.interests;

  const addCustom = () => {
    const t = custom.trim();
    if (!t) return;
    if (!selected.includes(t)) void toggleInterest(t);
    setCustom("");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title="Interests" align="center" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          Tell us what you&apos;re into — it helps us show you drops
          you&apos;ll actually love.
        </Text>

        <Text style={[styles.label, { color: colors.text }]}>Collections</Text>
        <View style={styles.chips}>
          {suggestions.map((s) => {
            const active = selected.includes(s);
            return (
              <Pressable
                key={s}
                onPress={() => toggleInterest(s)}
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
                  {s}
                </Text>
                {active && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={colors.background}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>
          Your picks ({selected.length})
        </Text>
        {selected.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textDim }]}>
            Nothing picked yet — tap a collection above.
          </Text>
        ) : (
          <View style={styles.chips}>
            {selected.map((s) => (
              <Pressable
                key={s}
                onPress={() => toggleInterest(s)}
                style={[
                  styles.chip,
                  { backgroundColor: colors.surfaceRaised },
                ]}
                hitSlop={6}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>
                  {s}
                </Text>
                <Ionicons name="close" size={14} color={colors.textDim} />
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[styles.label, { color: colors.text }]}>
          Add your own
        </Text>
        <View style={[styles.customRow, { backgroundColor: colors.input }]}>
          <TextInput
            style={[styles.customInput, { color: colors.text }]}
            placeholder="e.g. Streetwear, Gifts…"
            placeholderTextColor={colors.textDim}
            value={custom}
            onChangeText={setCustom}
            onSubmitEditing={addCustom}
            returnKeyType="done"
          />
          <Pressable onPress={addCustom} hitSlop={10}>
            <Ionicons name="add-circle" size={26} color={colors.text} />
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.lg },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  empty: { fontSize: 14, marginBottom: Spacing.sm },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  customInput: { flex: 1, fontSize: 15, paddingVertical: 13 },
});
