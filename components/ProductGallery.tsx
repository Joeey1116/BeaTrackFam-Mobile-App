/**
 * ProductGallery — swipeable product image carousel.
 *
 * Horizontal FlatList with paging + snap, interactive dots, and a "2 / 8"
 * counter. Reuses the ProductImage tile visuals. When the selected variant
 * has its own linked image, the carousel scrolls to it automatically.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useTheme } from "./ThemeProvider";
import { ProductImage } from "./ProductImage";
import { Radius, Spacing } from "../constants/theme";
import type { ShopifyImage } from "../lib/shopify";

interface ProductGalleryProps {
  images: ShopifyImage[];
  /** URL of the selected variant's linked image (null when it has none). */
  variantImageUrl?: string | null;
  rounded?: number;
  aspectRatio?: number;
}

export function ProductGallery({
  images,
  variantImageUrl = null,
  rounded = Radius.lg,
  aspectRatio = 0.9,
}: ProductGalleryProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<ShopifyImage>>(null);
  const [index, setIndex] = useState(0);
  // The list sits inside the page's horizontal padding, so its real width is
  // narrower than the window. Measure it and size every page to match —
  // otherwise pages overflow and paging lands between images.
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const pageWidth = measuredWidth ?? windowWidth;

  const safeIndex = images.length > 0 ? Math.min(index, images.length - 1) : 0;

  // When the selected variant has its own image, scroll the carousel to it.
  // This only drives the native list (an external system); the index state
  // syncs back via onScroll, since programmatic scrolls emit scroll events.
  useEffect(() => {
    if (!variantImageUrl || images.length === 0) return;
    const i = images.findIndex((img) => img.url === variantImageUrl);
    if (i < 0) return;
    try {
      listRef.current?.scrollToIndex({ index: i, animated: true });
    } catch {
      // Item not laid out yet — a later scroll event will sync state.
    }
  }, [variantImageUrl, images]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const i = Math.round(offsetX / pageWidth);
      const next = Math.max(0, Math.min(i, images.length - 1));
      setIndex((prev) => (prev === next ? prev : next));
    },
    [pageWidth, images.length]
  );

  const goToIndex = useCallback(
    (i: number) => {
      if (i < 0 || i >= images.length) return;
      setIndex(i);
      try {
        listRef.current?.scrollToIndex({ index: i, animated: true });
      } catch {
        // Item not laid out yet — onScroll will sync state instead.
      }
    },
    [images.length]
  );

  if (images.length === 0) {
    return (
      <ProductImage
        image={null}
        fullWidth
        aspectRatio={aspectRatio}
        rounded={rounded}
        iconSize={72}
      />
    );
  }

  return (
    <View>
      <FlatList
        ref={listRef}
        data={images}
        keyExtractor={(item) => item.url}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          setMeasuredWidth((prev) => (prev === w ? prev : w));
        }}
        getItemLayout={(_, i) => ({
          length: pageWidth,
          offset: pageWidth * i,
          index: i,
        })}
        renderItem={({ item }) => (
          <View style={{ width: pageWidth }}>
            <ProductImage
              image={item}
              fullWidth
              aspectRatio={aspectRatio}
              rounded={rounded}
              iconSize={72}
            />
          </View>
        )}
      />

      {images.length > 1 && (
        <View style={styles.metaRow}>
          <View style={styles.dots}>
            {images.map((img, i) => (
              <Pressable
                key={img.url}
                onPress={() => goToIndex(i)}
                hitSlop={8}
                accessibilityLabel={`Go to image ${i + 1}`}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === safeIndex ? colors.text : colors.border,
                    width: i === safeIndex ? 20 : 7,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.counter, { color: colors.textMuted }]}>
            {safeIndex + 1} / {images.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
    minHeight: 20,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  counter: {
    position: "absolute",
    right: 4,
    fontSize: 12,
    fontWeight: "600",
  },
});
