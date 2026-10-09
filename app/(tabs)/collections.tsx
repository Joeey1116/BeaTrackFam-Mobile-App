/** Collections tab — search, collections rail, product grid. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import { PrimaryButton } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { ProductImage } from "../../components/ProductImage";
import { useShop } from "../../store/shop";
import { fetchCollectionProducts, type Collection, type Product } from "../../data/mock";
import { Radius, Spacing, TabBarClearance } from "../../constants/theme";

function ShopProductCard({ product }: { product: Product }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { isWishlisted, toggleWishlist } = useShop();
  const wished = isWishlisted(product.id);

  return (
    <Pressable
      onPress={() => router.push(`/product/${product.numericId}`)}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View>
        <ProductImage
          image={product.images[0] ?? null}
          fullWidth
          aspectRatio={0.85}
          rounded={Radius.lg}
        />
        <Pressable
          onPress={() => toggleWishlist(product.id)}
          hitSlop={10}
          style={[styles.heart, { backgroundColor: colors.surfaceRaised }]}
        >
          <Ionicons
            name={wished ? "heart" : "heart-outline"}
            size={18}
            color={wished ? "#E5484D" : colors.text}
          />
        </Pressable>
      </View>
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
        {product.title}
      </Text>
      <Text style={[styles.cardPrice, { color: colors.text }]}>
        ${Number(product.price.amount).toFixed(2)}
      </Text>
    </Pressable>
  );
}

export default function Collections() {
  const { colors } = useTheme();
  const {
    products,
    collections,
    catalogLoading,
    catalogError,
    refreshCatalog,
  } = useShop();
  const { collection: collectionParam, q: qParam } = useLocalSearchParams<{
    collection?: string;
    q?: string;
  }>();
  const [query, setQuery] = useState("");
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [collectionProducts, setCollectionProducts] = useState<Product[] | null>(null);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const cache = useRef(new Map<string, Product[]>());
  const handledCollectionParam = useRef<string | undefined>(undefined);
  const handledQParam = useRef<string | undefined>(undefined);

  const loadCollection = async (c: Collection) => {
    setActiveCollection(c);
    const cached = cache.current.get(c.handle);
    if (cached) {
      setCollectionProducts(cached);
      return;
    }
    setCollectionLoading(true);
    try {
      const ps = await fetchCollectionProducts(c.handle);
      cache.current.set(c.handle, ps);
      setCollectionProducts(ps);
    } catch {
      setCollectionProducts([]);
    } finally {
      setCollectionLoading(false);
    }
  };

  const onSelectCollection = (c: Collection) => {
    if (activeCollection?.id === c.id) {
      setActiveCollection(null);
      setCollectionProducts(null);
      return;
    }
    void loadCollection(c);
  };

  const clearCollection = () => {
    setActiveCollection(null);
    setCollectionProducts(null);
  };

  // Deep link from Home (featured collections, banner slideshow): open that collection.
  useEffect(() => {
    if (
      collectionParam &&
      collectionParam !== handledCollectionParam.current &&
      collections.length > 0
    ) {
      handledCollectionParam.current = collectionParam;
      const match = collections.find((c) => c.handle === collectionParam);
      if (match) {
        // Defer a tick: route params are an external system, so the
        // selection sync runs outside the effect body.
        const t = setTimeout(() => void loadCollection(match), 0);
        return () => clearTimeout(t);
      }
    }
    return undefined;
  }, [collectionParam, collections]);

  // Search handed off from the Home search bar.
  useEffect(() => {
    if (typeof qParam === "string" && qParam !== handledQParam.current) {
      handledQParam.current = qParam;
      setQuery(qParam);
    }
  }, [qParam]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Search always spans the whole catalog — never just the open collection.
    const base = q ? products : activeCollection ? collectionProducts ?? [] : products;
    if (!q) return base;
    return base.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, collectionProducts, activeCollection, query]);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <TopBar hideSearch />
      {catalogLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={[styles.centerText, { color: colors.textMuted }]}>
            Loading the latest drops…
          </Text>
        </View>
      ) : catalogError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textDim} />
          <Text style={[styles.centerText, { color: colors.textMuted }]}>
            Couldn&apos;t load the shop. Check your connection and try again.
          </Text>
          <View style={styles.retryWrap}>
            <PrimaryButton label="Retry" onPress={refreshCatalog} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.searchRow, { backgroundColor: colors.input }]}>
            <Ionicons name="search-outline" size={20} color={colors.textDim} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search products..."
              placeholderTextColor={colors.textDim}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textDim} />
              </Pressable>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRail}
          >
            <Pressable
              onPress={clearCollection}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: !activeCollection
                    ? colors.button
                    : colors.input,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: !activeCollection
                      ? colors.buttonText
                      : colors.text,
                  },
                ]}
                numberOfLines={1}
              >
                All
              </Text>
            </Pressable>
            {collections.map((c) => {
              const active = activeCollection?.id === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onSelectCollection(c)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: active ? colors.button : colors.input,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.buttonText : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {c.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.gridHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {query
                ? `Results for "${query.trim()}"`
                : activeCollection
                  ? activeCollection.title
                  : "All Products"}
            </Text>
          </View>

          {collectionLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.text}
              style={styles.gridLoader}
            />
          ) : (
            <View style={styles.grid}>
              {visible.map((p) => (
                <View key={p.id} style={styles.gridItem}>
                  <ShopProductCard product={p} />
                </View>
              ))}
            </View>
          )}
          {!collectionLoading && visible.length === 0 && (
            <Text style={[styles.noResults, { color: colors.textMuted }]}>
              {query
                ? `No products match "${query}".`
                : "No products in this collection yet."}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: Spacing.sm },
  centerText: { fontSize: 14, textAlign: "center" },
  retryWrap: { marginTop: Spacing.sm, minWidth: 140 },
  content: { padding: Spacing.md, paddingBottom: TabBarClearance },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginVertical: Spacing.sm },
  chipRail: { gap: Spacing.sm, paddingRight: Spacing.md, marginBottom: Spacing.sm },
  chip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  gridHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gridLoader: { marginVertical: Spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -Spacing.xs },
  gridItem: { width: "50%", paddingHorizontal: Spacing.xs, marginBottom: Spacing.md },
  card: { gap: 6 },
  heart: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 13, fontWeight: "600", lineHeight: 17 },
  cardPrice: { fontSize: 14, fontWeight: "800" },
  noResults: { textAlign: "center", marginTop: Spacing.lg, fontSize: 14 },
});
