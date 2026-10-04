/**
 * Product artwork — renders the real Shopify CDN image when available,
 * falling back to a tinted tile with a shirt glyph while loading or when
 * a product has no image.
 */
import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import type { ShopifyImage } from "../data/mock";

interface ProductImageProps {
  image?: ShopifyImage | null;
  /** Fallback tile color when there is no image (or while it loads). */
  tint?: string;
  size?: number;
  rounded?: number;
  iconSize?: number;
  fullWidth?: boolean;
  aspectRatio?: number;
}

/**
 * Downsample Shopify CDN images at the source: asking the CDN for a
 * width close to what the tile actually displays keeps decoded bitmaps
 * small (Google Play flags full-size bitmap decoding as a memory issue).
 * Non-Shopify URLs pass through untouched.
 */
function sizedShopifyUrl(url: string, displayWidth?: number): string {
  if (!url.includes("cdn.shopify.com") || /[?&]width=/.test(url)) return url;
  const target = Math.min(Math.max(Math.round(displayWidth ?? 720), 100), 1600);
  return `${url}${url.includes("?") ? "&" : "?"}width=${target}`;
}

export function ProductImage({
  image,
  tint,
  size,
  rounded = 12,
  iconSize,
  fullWidth = false,
  aspectRatio = 1,
}: ProductImageProps) {
  const { colors, isDark } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const showImage = !!image?.url && !failed;
  const tileColor = tint ?? colors.surfaceRaised;
  // 2x the tile's display width for retina sharpness, capped by the helper.
  const imageUrl = image?.url
    ? sizedShopifyUrl(image.url, fullWidth ? 1080 : size ? size * 2 : 720)
    : undefined;

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: tileColor,
          borderRadius: rounded,
          ...(fullWidth
            ? { width: "100%", aspectRatio }
            : { width: size, height: size }),
        },
      ]}
    >
      {!showImage || !loaded ? (
        <Ionicons
          name="shirt-outline"
          size={iconSize ?? (size ? size * 0.35 : 44)}
          color={isDark ? "rgba(255,255,255,0.75)" : colors.textDim}
        />
      ) : null}
      {showImage ? (
        <Image
          source={{ uri: imageUrl }}
          accessibilityLabel={image!.altText ?? undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: rounded, opacity: loaded ? 1 : 0 },
          ]}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
