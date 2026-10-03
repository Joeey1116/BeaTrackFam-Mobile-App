/** FAQ — honest in-app answers to common questions. */
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../components/ThemeProvider";
import { ScreenHeader } from "../../components/ui";
import { Radius, Spacing } from "../../constants/theme";

const FAQS = [
  {
    q: "Where do I track my order?",
    a: "In-app order history is coming soon — we're putting the finishing touches on it. You'll still get an order confirmation and a tracking email from the shop as soon as your order ships.",
  },
  {
    q: "How do returns and refunds work?",
    a: "If your item arrives damaged or there's a problem with your order, email contact@beatrackfam.info within a reasonable time and we'll make it right. Read the full Refund Policy under Settings → App Settings → Policies.",
  },
  {
    q: "When will my order ship?",
    a: "Custom merch is made to order — most pieces ship within the window listed in our Shipping Policy (Settings → App Settings → Policies). You'll get tracking as soon as it leaves.",
  },
  {
    q: "How do I change my shipping address?",
    a: "Log in, open your Profile → Saved Addresses, and edit or add addresses there. To change the address on an order that already shipped, email us right away and we'll try to catch it.",
  },
  {
    q: "Is my payment information safe?",
    a: "Yes. Checkout happens on Shopify's secure servers — cards, Apple Pay and Google Pay are all processed by Shopify. We never see or store your card numbers.",
  },
  {
    q: "How do custom design requests work?",
    a: "Open Settings → Custom Design Request and describe your idea. It opens an email to us with your details — we'll reply to talk through the design, pricing and timing.",
  },
];

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
