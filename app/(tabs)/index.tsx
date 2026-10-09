/** Home tab — banner slideshow, search, greeting, guest banner, featured collections, new arrivals. */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  type ImageSourcePropType,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import { OutlineButton, PrimaryButton } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { LogoEye } from "../../components/LogoEye";
import { ProductImage } from "../../components/ProductImage";
import { useShop } from "../../store/shop";
import { fetchCollectionProducts } from "../../data/mock";
import type { Collection, Product } from "../../data/mock";
import { Radius, Spacing, TabBarClearance, Type } from "../../constants/theme";

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

function CollectionCircle({ collection }: { collection: Collection }) {
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
        styles.collectionCircle,
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <ProductImage
        image={collection.image}
        size={76}
        rounded={Radius.pill}
        iconSize={28}
      />
      <Text
        style={[styles.collectionCircleLabel, { color: colors.text }]}
        numberOfLines={2}
      >
        {collection.title}
      </Text>
    </Pressable>
  );
}

/** "There's more" — quick tiles into the app's real features. */
const FEATURE_TILES: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sub: string;
  route:
    | "/settings/order-history"
    | "/(tabs)/wishlist"
    | "/settings/affiliates"
    | "/settings/design-request";
}[] = [
  {
    icon: "cube-outline",
    label: "Orders",
    sub: "Track & history",
    route: "/settings/order-history",
  },
  {
    icon: "heart-outline",
    label: "Wishlist",
    sub: "Your saved picks",
    route: "/(tabs)/wishlist",
  },
  {
    icon: "cash-outline",
    label: "Earn With the Fam",
    sub: "Share & earn",
    route: "/settings/affiliates",
  },
  {
    icon: "color-palette-outline",
    label: "Design Request",
    sub: "One-of-a-kind",
    route: "/settings/design-request",
  },
];

function FeatureTiles() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.tileGrid}>
      {FEATURE_TILES.map((tile) => (
        <Pressable
          key={tile.label}
          onPress={() => router.push(tile.route)}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: colors.surface,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.tileIcon,
              { backgroundColor: colors.surfaceRaised },
            ]}
          >
            <Ionicons name={tile.icon} size={22} color={colors.text} />
          </View>
          <Text style={[styles.tileLabel, { color: colors.text }]}>
            {tile.label}
          </Text>
          <Text style={[styles.tileSub, { color: colors.textMuted }]}>
            {tile.sub}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Brand banner — the eye + the motto, inverse black/white card. */
function LoyaltyBanner() {
  const { colors } = useTheme();
  return (
    <View style={[styles.loyalty, { backgroundColor: colors.button }]}>
      <LogoEye size={44} />
      <View style={styles.loyaltyText}>
        <Text style={[styles.loyaltyTitle, { color: colors.buttonText }]}>
          Loyalty above all
        </Text>
        <Text
          style={[styles.loyaltySub, { color: colors.buttonText }]}
        >
          Community over profit — quality gear at fair prices, always.
        </Text>
      </View>
    </View>
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
  const { colors } = useTheme();
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
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    refreshCatalog();
  };

  // End the pull-to-refresh spin once the catalog settles (min 400ms so
  // it never just flickers), success or error alike.
  useEffect(() => {
    if (!refreshing || catalogLoading) return;
    const t = setTimeout(() => setRefreshing(false), 400);
    return () => clearTimeout(t);
  }, [refreshing, catalogLoading]);

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

  // "Fam favorites": the interest spotlight when one is picked, else
  // the back half of the catalog so the rail never just repeats drops.
  const famFavorites = spotlightProducts ?? products.slice(10, 20);
  const famFavoritesTitle =
    spotlightProducts && interestCollection
      ? interestCollection.title
      : "Fam favorites";
  const onFamFavoritesSeeAll = () => {
    if (spotlightProducts && interestCollection) {
      router.push({
        pathname: "/(tabs)/collections",
        params: { collection: interestCollection.handle },
      });
    } else {
      router.push("/(tabs)/collections");
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <TopBar />
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
          <Text style={[styles.greeting, { color: colors.text }]}>
            {greeting}
          </Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Loyalty Above All — let&apos;s find your next piece.
          </Text>

          {isGuest && bannerVisible && (
            <GuestBanner onDismiss={dismissBanner} />
          )}

          <BannerSlideshow />

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Shop by collection
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
              <CollectionCircle key={c.id} collection={c} />
            ))}
          </ScrollView>

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Newest drops
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {products.slice(0, 10).map((p) => (
              <View key={p.id} style={styles.railItem}>
                <ProductCard product={p} />
              </View>
            ))}
          </ScrollView>

          {famFavorites.length > 0 && (
            <View>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {famFavoritesTitle}
                </Text>
                <Pressable onPress={onFamFavoritesSeeAll} hitSlop={8}>
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
                {famFavorites.slice(0, 8).map((p) => (
                  <View key={p.id} style={styles.railItem}>
                    <ProductCard product={p} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              There&apos;s more
            </Text>
          </View>
          <FeatureTiles />

          <LoyaltyBanner />
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
  greeting: { ...Type.headline },
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
  sectionTitle: { ...Type.section },
  seeAll: { ...Type.link },
  rail: { gap: Spacing.md, paddingRight: Spacing.md },
  railItem: { width: 160 },
  collectionCircle: { width: 88, alignItems: "center", gap: 6 },
  collectionCircleLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 15,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: 3,
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  tileLabel: { fontSize: 15, fontWeight: "800" },
  tileSub: { fontSize: 12 },
  loyalty: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  loyaltyText: { flex: 1, gap: 2 },
  loyaltyTitle: { fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },
  loyaltySub: { fontSize: 12, lineHeight: 17, opacity: 0.85 },
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
