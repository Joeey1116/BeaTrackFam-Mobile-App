/** Product Details — live Cloudflare catalog data. The /product/[id]
 *  route param is the product HANDLE (not a Shopify numeric id). */
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import { PrimaryButton, ScreenHeader } from "../../components/ui";
import { CartButton } from "../../components/CartButton";
import { NativeDropdown } from "../../components/NativeDropdown";
import { ProductGallery } from "../../components/ProductGallery";
import { Reviews } from "../../components/Reviews";
import { useShop } from "../../store/shop";
import { Radius, Spacing, Type } from "../../constants/theme";
import {
  formatMoney,
  productAvailable,
  productOptionGroups,
} from "../../lib/shopify";
import { isReviewsConfigured } from "../../lib/reviews";

export default function ProductDetails() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getProduct,
    addToCart,
    toggleWishlist,
    isWishlisted,
    catalogLoading,
    refreshCatalog,
  } = useShop();

  // Route param is the product handle.
  const product = getProduct(id ?? "");

  const firstAvailable =
    product?.variants.find((v) => v.available) ?? product?.variants[0];

  const [selected, setSelected] = useState<Record<string, string> | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Option groups derived from variant positions (D1 carries no option
  // names): group i = distinct values at options[i] across variants.
  const optionGroups = useMemo(
    () => (product ? productOptionGroups(product) : []),
    [product]
  );

  // Pull-to-refresh: reload the catalog (fresh product record).
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    refreshCatalog();
  };

  useEffect(() => {
    if (!refreshing || catalogLoading) return;
    const t = setTimeout(() => setRefreshing(false), 400);
    return () => clearTimeout(t);
  }, [refreshing, catalogLoading]);

  // Resolve the variant matching the chosen options (default: first
  // available). No fallback to a different variant: an unmatched
  // combination is genuinely unavailable, not a silent substitution.
  const variant = useMemo(() => {
    if (!product) return undefined;
    if (!selected) return firstAvailable;
    return product.variants.find((v) =>
      optionGroups.every(
        (group, i) =>
          selected[group.name] === undefined ||
          v.options[i] === selected[group.name]
      )
    );
  }, [product, selected, firstAvailable, optionGroups]);

  const effectiveSelected = useMemo(() => {
    if (selected) return selected;
    if (!product || !firstAvailable) return {};
    const s: Record<string, string> = {};
    optionGroups.forEach((group, i) => {
      const val = firstAvailable.options[i];
      if (val) s[group.name] = val;
    });
    return s;
  }, [product, selected, firstAvailable, optionGroups]);

  // A value is unselectable when no AVAILABLE variant carries it at
  // this position together with the other current selections.
  const isValueUnavailable = (groupIndex: number, value: string) => {
    if (!product) return true;
    return !product.variants.some(
      (v) =>
        v.available &&
        v.options[groupIndex] === value &&
        optionGroups.every(
          (group, i) =>
            i === groupIndex ||
            effectiveSelected[group.name] === undefined ||
            v.options[i] === effectiveSelected[group.name]
        )
    );
  };

  if (!product || !variant) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Product Details" align="center" showBack right={<CartButton />} />
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: colors.textMuted }]}>
            {product && product.variants.length === 0
              ? "This item isn't available yet."
              : "Product not found."}
          </Text>
        </View>
      </View>
    );
  }

  const wished = isWishlisted(product.handle);
  const soldOut = !productAvailable(product);
  const purchasable = variant.available && !soldOut;

  const MAX_QTY = 10;

  const onAdd = () => {
    if (!purchasable) return;
    addToCart(product, variant, quantity);
    router.push("/cart");
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Product Details" align="center" showBack right={<CartButton />} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <View style={styles.galleryBleed}>
          {/* Product images only — D1 has no per-variant images. */}
          <ProductGallery images={product.images} rounded={0} />
          <Pressable
            onPress={() => toggleWishlist(product.handle)}
            hitSlop={10}
            style={[styles.heart, { backgroundColor: colors.surfaceRaised }]}
            accessibilityLabel="Toggle wishlist"
          >
            <Ionicons
              name={wished ? "heart" : "heart-outline"}
              size={22}
              color={wished ? "#E5484D" : colors.text}
            />
          </Pressable>
        </View>

        <Text style={[styles.title, Type.headline, { color: colors.text }]}>
          {product.title}
        </Text>
        {product.vendor.length > 0 && (
          <Text style={[styles.vendor, Type.caption, { color: colors.textMuted }]}>
            {product.vendor}
          </Text>
        )}
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.text }]}>
            {formatMoney(variant.price_cents)}
          </Text>
          {variant.compare_at_price_cents !== null &&
            variant.compare_at_price_cents > variant.price_cents && (
              <Text style={[styles.compare, { color: colors.textDim }]}>
                {formatMoney(variant.compare_at_price_cents)}
              </Text>
            )}
        </View>
        {!variant.available && (
          <Text style={[styles.unavailable, { color: colors.danger }]}>
            This option is currently sold out.
          </Text>
        )}

        {optionGroups.map((opt, groupIndex) => {
          // Long option lists (e.g. 8 sizes) would force a sideways
          // swipe through chips — those become a dropdown instead.
          const useDropdown = opt.values.length > 5;
          return (
            <View key={opt.name}>
              <Text style={[styles.optionLabel, Type.title, { color: colors.text }]}>
                {opt.name}:{" "}
                <Text style={styles.optionValue}>
                  {effectiveSelected[opt.name] ?? ""}
                </Text>
              </Text>
              {useDropdown ? (
                <NativeDropdown
                  value={effectiveSelected[opt.name] ?? ""}
                  options={opt.values.map((v) => ({
                    value: v,
                    label: isValueUnavailable(groupIndex, v)
                      ? `${v} — sold out`
                      : v,
                    disabled: isValueUnavailable(groupIndex, v),
                  }))}
                  onSelect={(val) =>
                    setSelected((s) => ({
                      ...(s ?? effectiveSelected),
                      [opt.name]: val,
                    }))
                  }
                  sheetTitle={opt.name}
                  accessibilityLabel={`Choose ${opt.name}`}
                />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {opt.values.map((val) => {
                    const isSelected = effectiveSelected[opt.name] === val;
                    const unavailable = isValueUnavailable(groupIndex, val);
                    return (
                      <Pressable
                        key={val}
                        disabled={unavailable}
                        onPress={() =>
                          setSelected((s) => ({ ...(s ?? effectiveSelected), [opt.name]: val }))
                        }
                        style={[
                          styles.chip,
                          {
                            borderColor: isSelected ? colors.button : colors.border,
                            backgroundColor: isSelected
                              ? colors.button
                              : "transparent",
                            opacity: unavailable ? 0.4 : 1,
                          },
                        ]}
                        accessibilityState={{ disabled: unavailable }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: isSelected ? colors.buttonText : colors.text,
                              fontWeight: isSelected ? "800" : "600",
                            },
                          ]}
                        >
                          {val}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          );
        })}

        {product.description.length > 0 && (
          <Text style={[styles.description, Type.body, { color: colors.textMuted }]}>
            {product.description}
          </Text>
        )}

        {isReviewsConfigured() && (
          <Reviews
            productHandle={product.handle}
            productTitle={product.title}
          />
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        {purchasable && (
          <View style={styles.qtyRow}>
            <Text style={[styles.qtyLabel, Type.title, { color: colors.text }]}>
              Quantity
            </Text>
            <View style={[styles.stepper, { borderColor: colors.border }]}>
              <Pressable
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                hitSlop={10}
                style={styles.stepperBtn}
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons
                  name="remove"
                  size={18}
                  color={quantity <= 1 ? colors.textDim : colors.text}
                />
              </Pressable>
              <Text style={[styles.qty, { color: colors.text }]}>{quantity}</Text>
              <Pressable
                onPress={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))}
                hitSlop={10}
                style={styles.stepperBtn}
                accessibilityLabel="Increase quantity"
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={quantity >= MAX_QTY ? colors.textDim : colors.text}
                />
              </Pressable>
            </View>
          </View>
        )}
        <PrimaryButton
          label={soldOut ? "Sold Out" : "Add to Cart"}
          onPress={onAdd}
          disabled={soldOut || !variant.available}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  missing: { flex: 1, alignItems: "center", justifyContent: "center" },
  missingText: { fontSize: 15 },
  heart: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryBleed: { marginHorizontal: -Spacing.md },
  title: { marginTop: Spacing.md },
  vendor: { marginTop: 4 },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  price: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3 },
  compare: { fontSize: 16, textDecorationLine: "line-through" },
  unavailable: { fontSize: 13, fontWeight: "600", marginTop: Spacing.xs },
  optionLabel: { marginTop: Spacing.lg },
  optionValue: { fontWeight: "400" },
  chipRow: { gap: Spacing.sm, marginTop: Spacing.sm, paddingRight: Spacing.md },
  chip: {
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  chipText: { fontSize: 14 },
  description: { marginTop: Spacing.lg },
  footer: { padding: Spacing.md, borderTopWidth: 1, gap: Spacing.sm },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qtyLabel: { fontSize: 15, fontWeight: "700" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 4,
  },
  stepperBtn: { padding: 10 },
  qty: { fontSize: 16, fontWeight: "700", minWidth: 28, textAlign: "center" },
});
