/** Product Details — screen-08 blueprint, live Shopify data. */
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Linking from "expo-linking";
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
import { fetchProductMedia, type ProductMedia } from "../../lib/storefront";
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
    isVariantPurchasable,
    catalogLoading,
    refreshCatalog,
  } = useShop();

  const product = getProduct(id ?? "");

  const firstAvailable =
    product?.variants.find((v) => v.availableForSale) ??
    product?.variants[0];

  const [selected, setSelected] = useState<Record<string, string> | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Full gallery media (per-variant images) from Storefront GraphQL.
  // Falls back to the cached products.json images when the fetch fails.
  // The numeric id is stored alongside so a stale fetch from a previously
  // viewed product can never flash its images here.
  const [mediaState, setMediaState] = useState<{
    id: string;
    media: ProductMedia;
  } | null>(null);
  const [mediaNonce, setMediaNonce] = useState(0);
  const [mediaFetching, setMediaFetching] = useState(false);
  useEffect(() => {
    const numericId = product?.numericId;
    if (!numericId) return;
    let cancelled = false;
    fetchProductMedia(numericId)
      .then((m) => {
        if (!cancelled && m.images.length > 0) {
          setMediaState({ id: numericId, media: m });
        }
      })
      .catch(() => {
        // Fallback: keep using product.images from products.json.
      })
      .finally(() => {
        if (!cancelled) setMediaFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.numericId, mediaNonce]);

  // Pull-to-refresh: reload the catalog (fresh product record) and
  // re-fetch this product's gallery media.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    refreshCatalog();
    setMediaFetching(true);
    setMediaNonce((n) => n + 1);
  };

  // End the spin once both reloads settle (min 400ms, no flicker).
  useEffect(() => {
    if (!refreshing || catalogLoading || mediaFetching) return;
    const t = setTimeout(() => setRefreshing(false), 400);
    return () => clearTimeout(t);
  }, [refreshing, catalogLoading, mediaFetching]);

  const liveMedia =
    mediaState && product && mediaState.id === product.numericId
      ? mediaState.media
      : null;

  // Resolve the variant matching the chosen options (default: first available).
  const variant = useMemo(() => {
    if (!product) return undefined;
    if (!selected) return firstAvailable;
    const opts = [selected[product.options[0]?.name ?? ""], selected[product.options[1]?.name ?? ""], selected[product.options[2]?.name ?? ""]];
    return (
      product.variants.find(
        (v) =>
          (product.options[0] ? v.option1 === opts[0] : true) &&
          (product.options[1] ? v.option2 === opts[1] : true) &&
          (product.options[2] ? v.option3 === opts[2] : true)
      ) ?? firstAvailable
    );
  }, [product, selected, firstAvailable]);

  const effectiveSelected = useMemo(() => {
    if (selected) return selected;
    if (!product || !firstAvailable) return {};
    const s: Record<string, string> = {};
    product.options.forEach((opt, i) => {
      const val = [firstAvailable.option1, firstAvailable.option2, firstAvailable.option3][i];
      if (val) s[opt.name] = val;
    });
    return s;
  }, [product, selected, firstAvailable]);

  if (!product || !variant) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Product Details" align="center" showBack right={<CartButton />} />
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: colors.textMuted }]}>
            Product not found.
          </Text>
        </View>
      </View>
    );
  }

  const wished = isWishlisted(product.id);
  const soldOut = !product.availableForSale;
  // In the catalog (online-store channel) but not published to the app
  // sales channel: show it, but send buyers to the website instead of
  // into a checkout Shopify will refuse.
  const websiteOnly = !soldOut && !isVariantPurchasable(variant.id);
  const purchasable = variant.availableForSale && !soldOut;

  const galleryImages =
    liveMedia && liveMedia.images.length > 0 ? liveMedia.images : product.images;
  const variantImageUrl = liveMedia?.variantImageById[variant.id] ?? null;

  const MAX_QTY = 10;

  const onAdd = () => {
    addToCart(product, variant, quantity);
    router.push("/cart");
  };

  const onWebsite = () => {
    void Linking.openURL(`https://beatrackfam.info/products/${product.handle}`);
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
          <ProductGallery
            images={galleryImages}
            variantImageUrl={variantImageUrl}
            rounded={0}
          />
          <Pressable
            onPress={() => toggleWishlist(product.id)}
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
        <Text style={[styles.vendor, Type.caption, { color: colors.textMuted }]}>
          {product.vendor}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.text }]}>
            ${Number(variant.price.amount).toFixed(2)}
          </Text>
          {variant.compareAtPrice &&
            Number(variant.compareAtPrice.amount) >
              Number(variant.price.amount) && (
              <Text style={[styles.compare, { color: colors.textDim }]}>
                ${Number(variant.compareAtPrice.amount).toFixed(2)}
              </Text>
            )}
        </View>
        {!variant.availableForSale && (
          <Text style={[styles.unavailable, { color: colors.danger }]}>
            This option is currently sold out.
          </Text>
        )}

        {product.options.map((opt) => {
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
                  options={opt.values.map((v) => ({ value: v, label: v }))}
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
                    return (
                      <Pressable
                        key={val}
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
                          },
                        ]}
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
            productNumericId={product.numericId}
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
        {websiteOnly ? (
          <>
            <PrimaryButton
              label="Available on our website"
              onPress={onWebsite}
            />
            <Text style={[styles.websiteNote, { color: colors.textMuted }]}>
              This one is only on beatrackfam.info for now — app checkout for it
              is coming.
            </Text>
          </>
        ) : (
          <PrimaryButton
            label={soldOut ? "Sold Out" : "Add to Cart"}
            onPress={onAdd}
            disabled={soldOut || !variant.availableForSale}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  websiteNote: { fontSize: 12, textAlign: "center", marginTop: 10 },
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
