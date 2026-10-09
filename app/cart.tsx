/** Cart — reachable via the cart button in tab headers and product pages. */
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../components/ThemeProvider";
import {
  EmptyState,
  PrimaryButton,
  ScreenHeader,
} from "../components/ui";
import { ProductImage } from "../components/ProductImage";
import { formatMoney, useShop } from "../store/shop";
import type { CartLine } from "../data/mock";
import { Radius, Spacing, Type } from "../constants/theme";

function CartRow({ line }: { line: CartLine }) {
  const { colors } = useTheme();
  const { updateQuantity, removeLine } = useShop();

  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <ProductImage image={line.product.images[0] ?? null} size={72} rounded={Radius.md} iconSize={28} />
      <View style={styles.rowMain}>
        <Text
          style={[Type.title, { color: colors.text }]}
          numberOfLines={2}
        >
          {line.product.title}
        </Text>
        <Text style={[styles.rowVariant, { color: colors.textMuted }]}>
          {line.variantTitle}
        </Text>
        <Text style={[styles.rowPrice, { color: colors.text }]}>
          {formatMoney(line.unitPrice)}
        </Text>
        <View style={styles.stepperRow}>
          <View style={[styles.stepper, { borderColor: colors.border }]}>
            <Pressable
              onPress={() => updateQuantity(line.id, line.quantity - 1)}
              hitSlop={10}
              style={styles.stepperBtn}
            >
              <Ionicons name="remove" size={16} color={colors.text} />
            </Pressable>
            <Text style={[styles.qty, { color: colors.text }]}>
              {line.quantity}
            </Text>
            <Pressable
              onPress={() => updateQuantity(line.id, line.quantity + 1)}
              hitSlop={10}
              style={styles.stepperBtn}
            >
              <Ionicons name="add" size={16} color={colors.text} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => removeLine(line.id)}
            hitSlop={10}
            accessibilityLabel="Remove item"
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function Cart() {
  const { colors } = useTheme();
  const router = useRouter();
  const { cartLines, subtotal } = useShop();

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Shopping Cart" align="center" showBack />
      {cartLines.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="cart-outline" size={48} color={colors.textDim} />}
          title="Your cart is empty"
          subtitle="Browse the shop and add some BeaTrackFam merch."
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.list}>
            {cartLines.map((line) => (
              <CartRow key={line.id} line={line} />
            ))}
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
                  Subtotal
                </Text>
                <Text style={[styles.totalValue, { color: colors.text }]}>
                  {formatMoney(subtotal)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.grandLabel, { color: colors.text }]}>
                  Total
                </Text>
                <Text style={[styles.grandValue, { color: colors.text }]}>
                  {formatMoney(subtotal)}
                </Text>
              </View>
            </View>
          </ScrollView>
          <View
            style={[
              styles.footer,
              { backgroundColor: colors.background, borderTopColor: colors.border },
            ]}
          >
            <PrimaryButton
              label="Proceed to Checkout"
              onPress={() => router.push("/checkout")}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.md },
  row: {
    flexDirection: "row",
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  rowMain: { flex: 1, gap: 2 },
  rowVariant: { fontSize: 13 },
  rowPrice: { fontSize: 16, fontWeight: "800", marginTop: 2 },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 4,
  },
  stepperBtn: { padding: 8 },
  qty: { fontSize: 15, fontWeight: "700", minWidth: 24, textAlign: "center" },
  totals: { marginTop: Spacing.md, gap: Spacing.xs },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 15 },
  totalValue: { fontSize: 15, fontWeight: "600" },
  grandLabel: { fontSize: 18, fontWeight: "800" },
  grandValue: { fontSize: 18, fontWeight: "800" },
  footer: { padding: Spacing.md, borderTopWidth: 1 },
});
