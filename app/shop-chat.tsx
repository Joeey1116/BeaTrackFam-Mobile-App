/**
 * Chat with us — live human help through the shop site's own chat.
 *
 * The Cloudflare storefront (beatrackfam.info) carries its own chat
 * panel, so this loads the storefront home in a WebView and best-effort
 * pops that panel open on arrival; if that doesn't take, the hint bar
 * points at the bubble. Business hours come from lib/supportConfig.ts.
 */
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../components/ThemeProvider";
import {
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
} from "../components/ui";
import { Radius, Spacing, Type } from "../constants/theme";
import {
  SHOP_CHAT_URL,
  SUPPORT_EMAIL,
  supportStatusLine,
} from "../lib/supportConfig";

/**
 * Best-effort: open the storefront's own chat panel once the page has
 * loaded. The panel is opened by the site's chat bubble button
 * ([data-chat-open] / .btf-chat-btn); every step is guarded so a miss
 * just leaves the page as-is (the bubble stays tappable).
 */
const AUTO_OPEN_JS = `
(function () {
  try {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      try {
        var chatBtn = document.querySelector(
          '[data-chat-open], .btf-chat-btn,' +
          'button[aria-label*="chat" i], a[aria-label*="chat" i]'
        );
        if (chatBtn) {
          chatBtn.click();
          clearInterval(timer);
          return;
        }
      } catch (e) { /* keep polling */ }
      if (attempts >= 24) clearInterval(timer); // ~12s of tries
    }, 500);
  } catch (e) { /* never break the page */ }
})();
true;
`;

function mailUs() {
  Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() =>
    Alert.alert("Email", `Write to us at ${SUPPORT_EMAIL}`)
  );
}

export default function ShopChat() {
  const { colors } = useTheme();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Chat with us" align="center" showBack />

      <View
        style={[
          styles.hintBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Ionicons name="chatbubbles-outline" size={17} color={colors.text} />
        <View style={styles.hintTextWrap}>
          <Text style={[styles.hintText, { color: colors.text }]}>
            {supportStatusLine()}
          </Text>
          <Text style={[styles.hintSub, { color: colors.textMuted }]}>
            Tap the chat bubble in the corner to start.
          </Text>
        </View>
      </View>

      {failed ? (
        <View style={styles.errorWrap}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[Type.title, { color: colors.text }]}>
              Chat didn&apos;t load
            </Text>
            <Text style={[styles.cardBody, { color: colors.textMuted }]}>
              The shop page didn&apos;t come up — check your connection and
              try again, or email us and we&apos;ll take care of you there.
            </Text>
            <PrimaryButton
              label="Try again"
              onPress={() => {
                setFailed(false);
                setLoading(true);
                setAttempt((a) => a + 1);
              }}
            />
            <OutlineButton label="Email us instead" onPress={mailUs} />
          </View>
        </View>
      ) : (
        <View style={styles.flex}>
          <WebView
            key={attempt}
            ref={webRef}
            source={{ uri: SHOP_CHAT_URL }}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            injectedJavaScript={AUTO_OPEN_JS}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
            style={{ backgroundColor: colors.background }}
          />
          {loading && (
            <View
              style={[
                styles.loadingOverlay,
                { backgroundColor: colors.background },
              ]}
            >
              <ActivityIndicator size="large" color={colors.text} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                Opening the shop…
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  hintBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  hintTextWrap: { flex: 1, gap: 1 },
  hintText: { fontSize: 13, fontWeight: "700", lineHeight: 17 },
  hintSub: { fontSize: 12, lineHeight: 16 },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  loadingText: { fontSize: 14 },
  errorWrap: { padding: Spacing.md },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardBody: { fontSize: 14, lineHeight: 20 },
});
