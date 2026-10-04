/** Home tab — banner slideshow, search, greeting, guest banner, featured collections, new arrivals. */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import {
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
} from "../../components/ui";
import { CartButton } from "../../components/CartButton";
import { ProductImage } from "../../components/ProductImage";
import { useShop } from "../../store/shop";
import { fetchCollectionProducts } from "../../data/mock";
import type { Collection, Product } from "../../data/mock";
import { Radius, Spacing, TabBarClearance } from "../../constants/theme";

const BANNER_KEY = "beatrackfam-guest-banner-dismissed";

/** Homepage slideshow banners — the same wide banners as beatrackfam.info. */
const BANNERS: {
  image: ImageSourcePropType;
  collectionTitle: string;
  subtitle: string;
}[] = [
  {
    image: require("../../assets/banners/slideshow-loyalty-wide.jpg"),
    collectionTitle: "Loyalty Above All",
    subtitle: "The official brand collection",
  },
  {
    image: require("../../assets/banners/slideshow-fall-wide.jpg"),
    collectionTitle: "Fall For Yourself",
    subtitle: "The new fall drop",
  },
  {
    image: require("../../assets/banners/slideshow-never-forget-wide.jpg"),
    collectionTitle: "Never Forget",
    subtitle: "In loving memory",
  },
  {
    image: require("../../assets/banners/slideshow-you-are-not-alone-wide.jpg"),
    collectionTitle: "You Are Not Alone",
    subtitle: "988 · Mental health matters",
  },
];

const SLIDE_INTERVAL_MS = 5000;

function BannerSlideshow() {
  const { colors } = useTheme();
  const router = useRouter();
  const { collections } = useShop();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const width = Dimensions.get("window").width - Spacing.md * 2;

  useEffect(() => {
    if (BANNERS.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % BANNERS.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [width]);

  const openBanner = (banner: (typeof BANNERS)[number]) => {
    const norm = (s: string) =>
      s.trim().toLowerCase().replace(/\s+collection$/, "");
    const match = collections.find(
      (c) => norm(c.title) === norm(banner.collectionTitle)
    );
    if (match) {
      router.push({
        pathname: "/(tabs)/collections",
        params: { collection: match.handle },
      });
    } else {
      router.push("/(tabs)/collections");
    }
  };

  return (
    <View style={styles.slideshowWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {BANNERS.map((b, i) => (
          <Pressable key={i} onPress={() => openBanner(b)}>
            <View>
              <Image
                source={b.image}
                style={[
                  styles.slide,
                  { width, height: (width * 5) / 12 },
                ]}
                resizeMode="cover"
              />
              <View
                style={[
                  styles.slideOverlay,
                  { width, height: (width * 5) / 12 },
                ]}
              >
                <View style={styles.slideTextWrap}>
                  <Text style={styles.slideTitle}>{b.collectionTitle}</Text>
                  <Text style={styles.slideSubtitle}>{b.subtitle}</Text>
                  <View style={styles.slideCta}>
                    <Text style={styles.slideCtaText}>Shop now</Text>
                    <Ionicons name="arrow-forward" size={14} color="#111" />
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {BANNERS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === index ? colors.text : colors.textDim + "55",
                width: i === index ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function HomeSearchBar() {
  const { colors } = useTheme();
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    setValue("");
    router.push({ pathname: "/(tabs)/collections", params: { q } });
  };

  return (
    <View style={[styles.searchRow, { backgroundColor: colors.input }]}>
      <Ionicons name="search-outline" size={20} color={colors.textDim} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder="Search the shop..."
        placeholderTextColor={colors.textDim}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        returnKeyType="search"
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable onPress={() => setValue("")} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={colors.textDim} />
        </Pressable>
      )}
    </View>
  );
}

function GuestBanner({ onDismiss }: { onDismiss: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.banner, { backgroundColor: colors.surface }]}>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        style={styles.bannerClose}
        accessibilityLabel="Dismiss"
      >
        <Ionicons name="close" size={18} color={colors.textDim} />
      </Pressable>
      <View style={[styles.bannerIcon, { backgroundColor: colors.surfaceRaised }]}>
        <Ionicons name="person-circle-outline" size={28} color={colors.text} />
      </View>
      <Text style={[styles.bannerTitle, { color: colors.text }]}>
        Log in or create an account
      </Text>
      <Text style={[styles.bannerBody, { color: colors.textMuted }]}>
        Track orders, save addresses and manage your profile across devices.
      </Text>
      <View style={styles.bannerCtas}>
        <View style={styles.bannerCta}>
          <PrimaryButton
            label="Log In"
            onPress={() => router.push("/(onboarding)/login")}
          />
        </View>
        <View style={styles.bannerCta}>
          <OutlineButton
            label="Sign Up"
            onPress={() => router.push("/(onboarding)/signup")}
          />
        </View>
      </View>
    </View>
  );
}

function CollectionCard({ collection }: { collection: Collection }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(tabs)/collections",
          params: { collection: collection.handle },
        })
      }
      style={({ pressed }) => [
        styles.collectionCard,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <ProductImage
        image={collection.image}
        size={140}
        rounded={Radius.lg}
        iconSize={40}
      />
      <View
        style={[styles.collectionLabel, { backgroundColor: colors.button }]}
      >
        <Text
          style={[styles.collectionLabelText, { color: colors.buttonText }]}
          numberOfLines={1}
        >
          {collection.title}
        </Text>
      </View>
    </Pressable>
  );
}

function ProductCard({ product }: { product: Product }) {
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

export default function Home() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const {
    products,
    collections,
    catalogLoading,
    catalogError,
    refreshCatalog,
    account,
    isGuest,
    profile,
  } = useShop();
  const [bannerVisible, setBannerVisible] = useState(false);

  /** The user's interest collection — the first interest matching a real
      collection becomes the default collection spotlighted on Home.
      Titles are normalized ("Fall For Yourself" matches
      "Fall For Yourself Collection"). */
  const interestCollection: Collection | null = React.useMemo(() => {
    const norm = (s: string) =>
      s.trim().toLowerCase().replace(/\s+collection$/, "");
    const picks = (profile.interests ?? []).map(norm).filter(Boolean);
    if (picks.length === 0 || collections.length === 0) return null;
    for (const pick of picks) {
      const match = collections.find(
        (c) => norm(c.title) === pick || c.handle.toLowerCase() === pick
      );
      if (match) return match;
    }
    return null;
  }, [profile.interests, collections]);

  const [spotlight, setSpotlight] = useState<{
    handle: string;
    products: Product[];
  } | null>(null);

  useEffect(() => {
    if (!interestCollection) return;
    const handle = interestCollection.handle;
    let live = true;
    fetchCollectionProducts(handle)
      .then((ps) => {
        if (live) setSpotlight({ handle, products: ps });
      })
      .catch(() => {
        if (live) setSpotlight({ handle, products: [] });
      });
    return () => {
      live = false;
    };
  }, [interestCollection]);

  const spotlightProducts =
    interestCollection &&
    spotlight?.handle === interestCollection.handle &&
    spotlight.products.length > 0
      ? spotlight.products
      : null;

  useEffect(() => {
    AsyncStorage.getItem(BANNER_KEY)
      .then((v) => setBannerVisible(v !== "1"))
      .catch(() => setBannerVisible(true));
  }, []);

  const dismissBanner = () => {
    setBannerVisible(false);
    AsyncStorage.setItem(BANNER_KEY, "1").catch(() => {});
  };

  const greeting = account?.profile.firstName
    ? `Welcome, ${account.profile.firstName}`
    : "Welcome to BeaTrackFam";

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="BeaTrackFam"
        logo={
          isDark
            ? require("../../assets/logo-eye-circle.png")
            : require("../../assets/logo-eye-circle-light.png")
        }
        right={<CartButton />}
      />
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
          <BannerSlideshow />

          <HomeSearchBar />

          <Text style={[styles.greeting, { color: colors.text }]}>
            {greeting}
          </Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Loyalty Above All
          </Text>

          {isGuest && bannerVisible && (
            <GuestBanner onDismiss={dismissBanner} />
          )}

          {spotlightProducts && interestCollection && (
            <View>
              <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
                Picked for you
              </Text>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {interestCollection.title}
                </Text>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/collections",
                      params: { collection: interestCollection.handle },
                    })
                  }
                  hitSlop={8}
                >
                  <Text style={[styles.seeAll, { color: colors.textMuted }]}>
                    See all
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
              >
                {spotlightProducts.slice(0, 8).map((p) => (
                  <View key={p.id} style={styles.railItem}>
                    <ProductCard product={p} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Featured Collections
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/collections")}
              hitSlop={8}
            >
              <Text style={[styles.seeAll, { color: colors.textMuted }]}>
                See all
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {collections.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </ScrollView>

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              New Arrivals
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/collections")}
              hitSlop={8}
            >
              <Text style={[styles.seeAll, { color: colors.textMuted }]}>
                Shop all
              </Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {products.slice(0, 8).map((p) => (
              <View key={p.id} style={styles.gridItem}>
                <ProductCard product={p} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  centerText: { fontSize: 14, textAlign: "center" },
  retryWrap: { marginTop: Spacing.sm, minWidth: 140 },
  content: { padding: Spacing.md, paddingBottom: TabBarClearance },
  slideshowWrap: { marginBottom: Spacing.md },
  slide: { borderRadius: Radius.lg },
  slideOverlay: {
    position: "absolute",
    borderRadius: Radius.lg,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  slideTextWrap: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  slideTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  slideSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  slideCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
    gap: 4,
  },
  slideCtaText: { color: "#111", fontSize: 12, fontWeight: "800" },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },
  dot: { height: 8, borderRadius: 4 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  greeting: { fontSize: 24, fontWeight: "800" },
  tagline: { fontSize: 14, marginTop: 2, marginBottom: Spacing.md },
  banner: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  bannerClose: { position: "absolute", top: 10, right: 10, zIndex: 1 },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  bannerTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  bannerBody: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  bannerCtas: { flexDirection: "row", gap: Spacing.sm, width: "100%" },
  bannerCta: { flex: 1 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  seeAll: { fontSize: 13, fontWeight: "600" },
  rail: { gap: Spacing.md, paddingRight: Spacing.md },
  railItem: { width: 160 },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: Spacing.md,
  },
  collectionCard: { width: 140, borderRadius: Radius.lg },
  collectionLabel: {
    borderRadius: Radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginTop: Spacing.xs,
    alignItems: "center",
  },
  collectionLabelText: { fontSize: 12, fontWeight: "700" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
  },
  gridItem: {
    width: "50%",
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.md,
  },
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
});
