/**
 * Onboarding pager — screen-01 blueprint ("Shop Exclusive Merch").
 * The screenshot's pagination dots imply multiple slides; the other two
 * are drawn from the App Store description (order tracking, loyalty perks).
 */
import React, { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import { PrimaryButton } from "../../components/ui";
import { Spacing } from "../../constants/theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "bag-handle-outline" as const,
    title: "Shop Exclusive Merch",
    body: "Discover unique BeaTrackFam merchandise and streetwear. Get access to exclusive drops and limited editions.",
  },
  {
    icon: "cube-outline" as const,
    title: "Order History (Coming Soon)",
    body: "In-app order history is on the way — every purchase will live right here in the app. You'll always get confirmation and tracking emails from the shop too.",
  },
  {
    icon: "heart-outline" as const,
    title: "Loyalty Above All",
    body: "Join the fam. Early access to drops, app-exclusive sales, and member perks.",
  },
];

export default function Onboarding() {
  const { colors } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  const goWelcome = () => router.replace("/(onboarding)/appearance");

  const onNext = () => {
    if (last) {
      goWelcome();
    } else {
      scrollRef.current?.scrollTo({ x: width * (page + 1), animated: true });
    }
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(next);
  };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <Pressable onPress={goWelcome} hitSlop={12} style={styles.skipWrap}>
        <Text style={[styles.skip, { color: colors.text }]}>Skip</Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        style={styles.pager}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.accent + "22" },
              ]}
            >
              <Ionicons name={s.icon} size={56} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{s.title}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.title}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === page ? colors.text : colors.border,
                width: i === page ? 22 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.ctaWrap}>
        <PrimaryButton label="Next" onPress={onNext} />
      </View>

      <View style={styles.brandWrap}>
        <Text style={[styles.brand, { color: colors.text }]}>BeaTrackFam</Text>
        <Text style={[styles.tagline, { color: colors.textDim }]}>
          Loyalty Above All
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  skipWrap: { alignSelf: "flex-end", padding: Spacing.md },
  skip: { fontSize: 15, fontWeight: "600" },
  pager: { flex: 1 },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: { height: 8, borderRadius: 4 },
  ctaWrap: { paddingHorizontal: Spacing.lg },
  brandWrap: { alignItems: "center", paddingVertical: Spacing.lg },
  brand: { fontSize: 14, fontWeight: "800" },
  tagline: { fontSize: 12, marginTop: 2 },
});
