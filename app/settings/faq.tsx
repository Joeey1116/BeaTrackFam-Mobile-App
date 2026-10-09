/** FAQ — honest in-app answers to common questions. */
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../components/ThemeProvider";
import { ScreenHeader } from "../../components/ui";
import { Radius, Spacing } from "../../constants/theme";
import { FAQS } from "../../data/faq";

function FaqItem({ q, a }: { q: string; a: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      style={[styles.card, { backgroundColor: colors.surface }]}
    >
      <View style={styles.row}>
        <Text style={[styles.question, { color: colors.text }]}>{q}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textDim}
        />
      </View>
      {open && (
        <Text style={[styles.answer, { color: colors.textMuted }]}>{a}</Text>
      )}
    </Pressable>
  );
}

export default function Faq() {
  const { colors } = useTheme();
  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="FAQ" align="center" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {FAQS.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  question: { flex: 1, fontSize: 15, fontWeight: "700" },
  answer: { fontSize: 14, lineHeight: 20, marginTop: Spacing.sm },
});
