/**
 * Ask Bea (12.1.0 redesign, Phase 2) — chat with the store assistant.
 *
 * Bea answers from live store data only (lib/bea.ts): real product
 * search + prices, your real order status/tracking, and the store's
 * actual FAQ/policy answers — no generative AI, no invented answers.
 * Anything beyond that hands off to the Fam at
 * contact@beatrackfam.info.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../components/ThemeProvider";
import { ScreenHeader } from "../components/ui";
import { ProductImage } from "../components/ProductImage";
import { Radius, Spacing, Type } from "../constants/theme";
import { useShop, formatMoney } from "../store/shop";
import type { Product } from "../data/mock";
import type { FaqEntry } from "../data/faq";
import {
  answerBea,
  answerProductQuery,
  type BeaAction,
  type BeaReply,
} from "../lib/bea";
import { loadShopifySession } from "../lib/inbox";
import type { CustomerOrder } from "../lib/customer";

interface ChatMessage {
  id: number;
  from: "bea" | "user";
  text: string;
  products?: Product[];
  actions?: BeaAction[];
  faqs?: FaqEntry[];
}

const CHIPS = [
  "Track my order",
  "Shipping & returns",
  "Find a product",
  "Promo codes",
  "Talk to a human",
] as const;

let msgSeq = 0;
const nextId = () => ++msgSeq;

function BeaAvatar() {
  const { colors } = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: colors.button }]}>
      <Ionicons name="sparkles" size={15} color={colors.buttonText} />
    </View>
  );
}

export default function AskBea() {
  const { colors } = useTheme();
  const router = useRouter();
  const { products, account, orders: localOrders } = useShop();
  const [shopifyOrders, setShopifyOrders] = useState<CustomerOrder[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: nextId(),
      from: "bea",
      text: "Hey, I'm Bea — I help right from the shop's live info. I can find products and prices, check your orders and tracking, and answer shipping & returns questions. What do you need?",
    },
  ]);
  const [input, setInput] = useState("");
  const [awaitProduct, setAwaitProduct] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await loadShopifySession({ refresh: true });
      if (!cancelled) setShopifyOrders(session?.customer.orders ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      50
    );
    return () => clearTimeout(t);
  }, [messages]);

  const ctx = useMemo(
    () => ({ products, account, localOrders, shopifyOrders }),
    [products, account, localOrders, shopifyOrders]
  );

  const pushReply = useCallback((reply: BeaReply) => {
    setAwaitProduct(reply.awaitInput === "product");
    setMessages((m) => [
      ...m,
      {
        id: nextId(),
        from: "bea",
        text: reply.text,
        products: reply.products,
        actions: reply.actions,
        faqs: reply.faqs,
      },
    ]);
  }, []);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setMessages((m) => [...m, { id: nextId(), from: "user", text }]);
      setInput("");
      const reply = awaitProduct
        ? answerProductQuery(text, ctx)
        : answerBea(text, ctx);
      // Small beat so the reply reads like a reply, not an echo.
      setTimeout(() => pushReply(reply), 250);
    },
    [awaitProduct, ctx, pushReply]
  );

  const openAction = (action: BeaAction) => {
    if (action.url) {
      Linking.openURL(action.url).catch(() => {});
    } else if (action.route) {
      router.push(action.route);
    }
  };

  const openProduct = (p: Product) =>
    router.push({ pathname: "/product/[id]", params: { id: p.numericId } });

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Ask Bea" align="center" showBack />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg) =>
            msg.from === "user" ? (
              <View key={msg.id} style={styles.userRow}>
                <View
                  style={[
                    styles.userBubble,
                    { backgroundColor: colors.button },
                  ]}
                >
                  <Text style={[styles.msgText, { color: colors.buttonText }]}>
                    {msg.text}
                  </Text>
                </View>
              </View>
            ) : (
              <View key={msg.id} style={styles.beaRow}>
                <BeaAvatar />
                <View style={styles.beaContent}>
                  <View
                    style={[
                      styles.beaBubble,
                      { backgroundColor: colors.surface },
                    ]}
                  >
                    <Text style={[styles.msgText, { color: colors.text }]}>
                      {msg.text}
                    </Text>
                  </View>

                  {msg.products?.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => openProduct(p)}
                      style={({ pressed }) => [
                        styles.productCard,
                        {
                          backgroundColor: colors.surface,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <ProductImage
                        image={p.images[0] ?? null}
                        size={52}
                        rounded={Radius.sm}
                      />
                      <View style={styles.productText}>
                        <Text
                          style={[Type.title, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {p.title}
                        </Text>
                        <Text
                          style={[Type.caption, { color: colors.textMuted }]}
                        >
                          {formatMoney(p.price)}
                          {p.availableForSale ? "" : " · sold out"}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color={colors.textDim}
                      />
                    </Pressable>
                  ))}

                  {msg.faqs?.map((f) => (
                    <Pressable
                      key={f.q}
                      onPress={() => router.push("/settings/faq")}
                      style={({ pressed }) => [
                        styles.linkRow,
                        {
                          backgroundColor: colors.surface,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.linkLabel, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {f.q}
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={colors.textDim}
                      />
                    </Pressable>
                  ))}

                  {msg.actions?.map((a) => (
                    <Pressable
                      key={a.label}
                      onPress={() => openAction(a)}
                      style={({ pressed }) => [
                        styles.actionPill,
                        {
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.actionText, { color: colors.text }]}>
                        {a.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )
          )}
        </ScrollView>

        <View style={styles.chipsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {CHIPS.map((chip) => (
              <Pressable
                key={chip}
                onPress={() => send(chip)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>
                  {chip}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View style={[styles.inputPill, { backgroundColor: colors.input }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.text }]}
              placeholder="Ask anything…"
              placeholderTextColor={colors.textDim}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => send(input)}
              disabled={!input.trim()}
              hitSlop={6}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: colors.button,
                  opacity: !input.trim() ? 0.35 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={colors.buttonText}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  thread: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  beaRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start" },
  beaContent: { flex: 1, gap: Spacing.sm, maxWidth: "88%" },
  beaBubble: {
    borderRadius: Radius.lg,
    borderTopLeftRadius: Radius.sm,
    padding: Spacing.md,
  },
  userRow: { alignItems: "flex-end" },
  userBubble: {
    borderRadius: Radius.lg,
    borderTopRightRadius: Radius.sm,
    padding: Spacing.md,
    maxWidth: "85%",
  },
  msgText: { fontSize: 15, lineHeight: 21 },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  productText: { flex: 1, gap: 2 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
  },
  linkLabel: { flex: 1, fontSize: 13, fontWeight: "700" },
  actionPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
  },
  actionText: { fontSize: 13, fontWeight: "700" },
  chipsBar: { paddingTop: Spacing.sm },
  chipsRow: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  chip: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  inputBar: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    paddingLeft: Spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
