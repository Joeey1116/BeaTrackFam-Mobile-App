/**
 * Checkout — screen-05 blueprint.
 *
 * The buyer fills in contact + shipping details right here in the app,
 * then Shopify's real checkout opens as a native sheet (no browser).
 * If a Storefront API token is configured (see lib/storefront.ts), the
 * details are attached to the cart so Shopify pre-fills them and the
 * buyer just pays. Payment is always processed by Shopify — the app
 * never sees card numbers.
 */
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "../components/ThemeProvider";
import { PrimaryButton, ScreenHeader, TextField } from "../components/ui";
import { formatMoney, useShop } from "../store/shop";
import { buildCartPermalink } from "../data/mock";
import { Radius, Spacing } from "../constants/theme";
import {
  createCartCheckoutUrl,
  isStorefrontConfigured,
  type CheckoutBuyer,
} from "../lib/storefront";
import {
  onCheckoutEvent,
  presentNativeCheckout,
} from "../lib/nativeCheckout";

const PAYMENT_METHODS = [
  { label: "Apple Pay", icon: "logo-apple" },
  { label: "Google Pay", icon: "logo-google" },
  { label: "Shop Pay", icon: "bag-outline" },
  { label: "PayPal", icon: "logo-paypal" },
  { label: "Credit / Debit Card", icon: "card-outline" },
] as const;

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "MX", label: "Mexico" },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Opens the Shopify checkout URL outside the native sheet.
 * Prefers the in-app browser; if that native module is also missing
 * (older dev build), falls back to the system browser via Linking,
 * which is core React Native and always available.
 */
async function openCheckoutInBrowser(checkoutUrl: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(checkoutUrl);
  } catch {
    await Linking.openURL(checkoutUrl);
  }
}

export default function Checkout() {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    cartLines,
    cartCount,
    subtotal,
    clearCart,
    account,
    profile,
    addOrderReceipt,
  } = useShop();

  // Pre-fill from the signed-in account + default saved address. Values are
  // read lazily at first render, so no effect/setState dance is needed.
  const initialAddress = React.useMemo(
    () =>
      profile.addresses.find((a) => a.isDefault) ?? profile.addresses[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const nameParts = initialAddress
    ? initialAddress.name.split(" ").filter(Boolean)
    : [];
  const [email, setEmail] = useState(account?.email ?? "");
  const [firstName, setFirstName] = useState(
    profile.firstName ||
      (profile.lastName ? "" : nameParts[0] ?? "") ||
      ""
  );
  const [lastName, setLastName] = useState(
    profile.lastName || nameParts.slice(1).join(" ")
  );
  const [address1, setAddress1] = useState(initialAddress?.street ?? "");
  const [address2, setAddress2] = useState(initialAddress?.street2 ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [province, setProvince] = useState(initialAddress?.province ?? "");
  const [zip, setZip] = useState(initialAddress?.zip ?? "");
  const [country, setCountry] = useState<string>(
    initialAddress?.country ?? "US"
  );
  const [phone, setPhone] = useState(profile.phone || "");
  const [busy, setBusy] = useState(false);

  // Pre-fill from the signed-in account + default saved address.

  const fillFromSavedAddress = () => {
    const def =
      profile.addresses.find((a) => a.isDefault) ?? profile.addresses[0];
    if (!def) return;
    setAddress1(def.street);
    setAddress2(def.street2);
    setCity(def.city);
    setProvince(def.province);
    setZip(def.zip);
    if (def.phone) setPhone(def.phone);
  };

  const validate = (): string | null => {
    if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
    if (!firstName.trim()) return "Enter your first name.";
    if (!lastName.trim()) return "Enter your last name.";
    if (!address1.trim()) return "Enter your street address.";
    if (!city.trim()) return "Enter your city.";
    if (!province.trim()) return "Enter your state or province.";
    if (!zip.trim()) return "Enter your ZIP / postal code.";
    return null;
  };

  const onPay = async () => {
    if (cartLines.length === 0 || busy) return;
    const problem = validate();
    if (problem) {
      Alert.alert("Check your details", problem);
      return;
    }
    setBusy(true);
    try {
      let checkoutUrl: string;
      if (isStorefrontConfigured()) {
        const buyer: CheckoutBuyer = {
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          address1: address1.trim(),
          address2: address2.trim() || undefined,
          city: city.trim(),
          provinceCode: province.trim(),
          zip: zip.trim(),
          countryCode: country,
          phone: phone.trim() || undefined,
        };
        checkoutUrl = await createCartCheckoutUrl(
          cartLines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          buyer
        );
      } else {
        checkoutUrl = buildCartPermalink(cartLines);
      }

      const presented = await presentNativeCheckout(checkoutUrl);
      if (!presented) {
        // Native sheet unavailable (e.g. older dev build, web preview) —
        // fall back to the browser so checkout always works.
        await openCheckoutInBrowser(checkoutUrl);
      }
    } catch (e) {
      Alert.alert(
        "Couldn't start checkout",
        e instanceof Error ? e.message : "Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  // When the native sheet reports a completed order: record a detailed
  // receipt on the account (so Order History works), clear the cart, and
  // send the buyer to the thank-you page. A failed checkout gets an
  // apology popup; a dismissed sheet is left alone.
  // A ref keeps the receipt snapshot fresh regardless of when the
  // completion event fires.
  const cartSnapshot = React.useRef({
    lines: cartLines,
    subtotal,
    email: account?.email ?? "",
  });
  React.useEffect(() => {
    cartSnapshot.current = {
      lines: cartLines,
      subtotal,
      email: account?.email ?? "",
    };
  }, [cartLines, subtotal, account]);
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    onCheckoutEvent(async (outcome) => {
      if (outcome.type === "completed") {
        const snap = cartSnapshot.current;
        await addOrderReceipt({
          id: outcome.orderId ?? `local-${Date.now()}`,
          totalAmount: snap.subtotal.amount,
          currencyCode: snap.subtotal.currencyCode,
          itemCount: snap.lines.reduce((n, l) => n + l.quantity, 0),
          email: snap.email,
          status: "completed",
          items: snap.lines.map((l) => ({
            productTitle: l.product.title,
            variantTitle: l.variantTitle,
            quantity: l.quantity,
            unitAmount: l.unitPrice.amount,
            currencyCode: l.unitPrice.currencyCode,
            imageUrl: l.product.images[0]?.url ?? null,
          })),
        });
        clearCart();
        router.replace("/thank-you");
      } else if (outcome.type === "failed") {
        Alert.alert(
          "Order didn't go through",
          "We're sorry, but your order didn't go through. Please try again."
        );
      }
    }).then((fn) => {
      unsubscribe = fn;
    });
    return () => {
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Checkout" align="center" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Checkout</Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.secureRow}>
            <View
              style={[styles.lockWrap, { backgroundColor: colors.surfaceRaised }]}
            >
              <Ionicons name="lock-closed-outline" size={22} color={colors.text} />
            </View>
            <View style={styles.secureText}>
              <Text style={[styles.secureTitle, { color: colors.text }]}>
                Secure In-App Checkout
              </Text>
              <Text style={[styles.secureSub, { color: colors.textMuted }]}>
                Powered by Shopify
              </Text>
            </View>
          </View>
          <Text style={[styles.secureBody, { color: colors.textMuted }]}>
            Fill in your details below, then pay right here in the app —
            Shopify handles the payment securely and the app never sees your
            card numbers.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Your Details
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {profile.addresses.length > 0 && (
            <Pressable
              style={[styles.savedAddrBtn, { borderColor: colors.border }]}
              onPress={fillFromSavedAddress}
            >
              <Ionicons name="home-outline" size={18} color={colors.text} />
              <Text style={[styles.savedAddrLabel, { color: colors.text }]}>
                Use my saved address
              </Text>
            </Pressable>
          )}
          <TextField
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <TextField
                label="First name"
                placeholder="Jane"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.half}>
              <TextField
                label="Last name"
                placeholder="Doe"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>
          <TextField
            label="Street address"
            placeholder="123 Main St"
            value={address1}
            onChangeText={setAddress1}
          />
          <TextField
            label="Apt, suite, etc. (optional)"
            placeholder=""
            value={address2}
            onChangeText={setAddress2}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <TextField
                label="City"
                placeholder="New York"
                value={city}
                onChangeText={setCity}
              />
            </View>
            <View style={styles.quarter}>
              <TextField
                label="State"
                placeholder="NY"
                value={province}
                onChangeText={setProvince}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.quarter}>
              <TextField
                label="ZIP"
                placeholder="10301"
                value={zip}
                onChangeText={setZip}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>
            Country
          </Text>
          <View style={styles.countryRow}>
            {COUNTRIES.map((c) => {
              const selected = country === c.code;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => setCountry(c.code)}
                  style={[
                    styles.countryChip,
                    {
                      borderColor: selected ? colors.text : colors.border,
                      backgroundColor: selected
                        ? colors.surfaceRaised
                        : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countryLabel,
                      { color: colors.text, fontWeight: selected ? "800" : "400" },
                    ]}
                  >
                    {c.code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextField
            label="Phone (optional)"
            placeholder="(555) 123-4567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Order Summary
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
              Items
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {cartCount}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
              Subtotal
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatMoney(subtotal)}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formatMoney(subtotal)}
            </Text>
          </View>
          {cartLines.length === 0 && (
            <Text style={[styles.emptyNote, { color: colors.textDim }]}>
              Your cart is empty — add items before checking out.
            </Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Accepted Payment Methods
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {PAYMENT_METHODS.map((m) => (
            <View key={m.label} style={styles.payRow}>
              <Ionicons name={m.icon} size={20} color={colors.text} />
              <Text style={[styles.payLabel, { color: colors.text }]}>
                {m.label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        <PrimaryButton
          label={busy ? "Starting checkout…" : "Continue to Payment"}
          onPress={onPay}
          disabled={cartLines.length === 0 || busy}
          icon={
            <Ionicons name="lock-closed-outline" size={18} color={colors.buttonText} />
          }
        />
        <Text style={[styles.terms, { color: colors.textDim }]}>
          By completing checkout, you agree to our terms and conditions
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  pageTitle: { fontSize: 24, fontWeight: "800", marginBottom: Spacing.md },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  secureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  secureText: { flex: 1 },
  lockWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  secureTitle: { fontSize: 16, fontWeight: "800" },
  secureSub: { fontSize: 13, marginTop: 2 },
  secureBody: { fontSize: 13, lineHeight: 19, marginTop: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginVertical: Spacing.sm },
  savedAddrBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  savedAddrLabel: { fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", gap: Spacing.sm },
  half: { flex: 1 },
  quarter: { flex: 0.7 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  countryRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
  countryChip: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  countryLabel: { fontSize: 14 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: "600" },
  divider: { height: 1, marginVertical: Spacing.sm },
  totalLabel: { fontSize: 16, fontWeight: "800" },
  totalValue: { fontSize: 16, fontWeight: "800" },
  emptyNote: { fontSize: 13, marginTop: Spacing.sm },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: 8,
  },
  payLabel: { fontSize: 14, fontWeight: "600" },
  footer: { padding: Spacing.md, borderTopWidth: 1, gap: Spacing.sm },
  terms: { fontSize: 11, textAlign: "center" },
});
