/** Wishlist tab — screen-06 blueprint. TODO: persist via customer metafields. */
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import { EmptyState } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { ProductImage } from "../../components/ProductImage";
import { useShop } from "../../store/shop";
import type { Product } from "../../data/mock";
import { Radius, Spacing, TabBarClearance } from "../../constants/theme";

function WishlistRow({ product }: { product: Product }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { removeFromWishlist } = useShop();
  const routeId = product.numericId;

  return (
    <Pressable
      onPress={() => router.push(`/product/${routeId}`)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <ProductImage image={product.images[0] ?? null} size={72} rounded={Radius.md} iconSize={28} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
          {product.title}
        </Text>
        <Text style={[styles.rowPrice, { color: colors.text }]}>
          ${Number(product.price.amount).toFixed(2)}
        </Text>
        {product.compareAtPrice && (
          <Text style={[styles.rowCompare, { color: colors.textDim }]}>
            Up to ${Number(product.compareAtPrice.amount).toFixed(2)}
          </Text>
        )}
      </View>
      <Pressable
        onPress={() => removeFromWishlist(product.id)}
        hitSlop={12}
        accessibilityLabel={`Remove ${product.title} from wishlist`}
      >
        <Ionicons name="close" size={20} color={colors.textDim} />
      </Pressable>
    </Pressable>
  );
}

export default function Wishlist() {
  const { colors } = useTheme();
  const { wishlistIds, products, catalogLoading, refreshCatalog } = useShop();
  const items = products.filter((p) => wishlistIds.includes(p.id));
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    refreshCatalog();
  };

  // End the pull-to-refresh spin once the catalog settles (min 400ms).
  useEffect(() => {
    if (!refreshing || catalogLoading) return;
    const t = setTimeout(() => setRefreshing(false), 400);
    return () => clearTimeout(t);
  }, [refreshing, catalogLoading]);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <TopBar />
      <Text style={[styles.count, { color: colors.textMuted }]}>
        {items.length} item{items.length === 1 ? "" : "s"} saved
      </Text>
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <WishlistRow product={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
            progressBackgroundColor={colors.surface}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon={
              <Ionicons name="heart-outline" size={48} color={colors.textDim} />
            }
            title="Your wishlist is empty"
            subtitle="Tap the heart on any product to save it here."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  count: { fontSize: 14, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  list: { paddingHorizontal: Spacing.md, paddingBottom: TabBarClearance, gap: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    gap: Spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: "600", lineHeight: 18 },
  rowPrice: { fontSize: 15, fontWeight: "800" },
  rowCompare: { fontSize: 12 },
});
