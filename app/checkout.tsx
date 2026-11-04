/**
 * Checkout — screen-05 blueprint.
 *
 * The buyer fills in contact + shipping details right here in the app,
 * picks a shipping option, then pays WITHOUT leaving the app — card,
 * Apple Pay, Google Pay, Affirm/Afterpay/Klarna — against a
 * PaymentIntent from the BeaTrackFam site backend
 * (lib/inAppCheckout.ts). The backend creates the site order
 * (pending_payment) at intent time and its Stripe webhook flips it to
 * paid once the money lands, so Printify fulfills it like any other
 * order. The receipt is keyed by the site order number
 * (BTF-YYYYMMDD-XXXX), never a Shopify id.
 *
 * Currency follows the ship-to country (US -> USD, CA -> CAD,
 * MX -> MXN). A PaymentIntent's currency can't change, so switching
 * country abandons the current intent and quotes a fresh one — the
 * same rule the website checkout page follows.
 */
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../components/ThemeProvider";
import { PrimaryButton, ScreenHeader, TextField } from "../components/ui";
import { useShop } from "../store/shop";
import { Radius, Spacing } from "../constants/theme";
import { useStripe } from "@stripe/stripe-react-native";
import { isInAppCheckoutEnabled } from "../lib/checkoutConfig";
import {
  currencyForCountry,
  getShippingRates,
  normalizeShipCountry,
  quoteInAppCheckout,
  confirmInAppOrder,
  validatePromoCodes,
  type CheckoutBuyer,
  type InAppQuote,
  type ShippingRateOption,
} from "../lib/inAppCheckout";

/** Methods handled by Stripe inside the app. */
const IN_APP_PAYMENT_METHODS = [
  { label: "Apple Pay", icon: "logo-apple" },
  { label: "Google Pay", icon: "logo-google" },
  { label: "Credit / Debit Card", icon: "card-outline" },
  { label: "Affirm / Afterpay / Klarna", icon: "cash-outline" },
] as const;

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "MX", label: "Mexico" },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fmtDollars = (n: number): string => `$${n.toFixed(2)}`;

/** Cart lines arrive in the data-layer shape (handle + variant title,
 * integer cents) — the intent mapping below reads exactly those. */
interface IntentLineInput {
  handle: string;
  variantTitle: string;
  price_cents: number;
  qty: number;
}

function toIntentLines(lines: IntentLineInput[]): {
  intent: { handle: string; variant: string; qty: number }[];
  subtotalCents: number;
  itemCount: number;
} {
  const intent: { handle: string; variant: string; qty: number }[] = [];
  let subtotalCents = 0;
  let itemCount = 0;
  for (const l of lines) {
    if (!l.handle) continue;
    intent.push({ handle: l.handle, variant: l.variantTitle, qty: l.qty });
    subtotalCents += l.price_cents * l.qty;
    itemCount += l.qty;
  }
  return { intent, subtotalCents, itemCount };
}

export default function Checkout() {
  const { colors } = useTheme();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { cartLines, clearCart, account, profile, addOrderReceipt } =
    useShop();

  const { intent: intentLines, subtotalCents, itemCount } =
    toIntentLines(cartLines);

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
    // Only a real US/CA/MX code counts as picked. A saved address
    // carries free text ("United States" is the address form's
    // default) — that used to fall through as an unpicked country
    // while the rates list still showed every zone's rates.
    normalizeShipCountry(initialAddress?.country) ?? ""
  );
  const [phone, setPhone] = useState(profile.phone || "");
  const [busy, setBusy] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoCodes, setPromoCodes] = useState<string[]>([]);
  const [promoBusy, setPromoBusy] = useState(false);
  /** Discounted totals from the site (set by promo validation / quotes). */
  const [promoTotals, setPromoTotals] = useState<InAppQuote["totals"] | null>(
    null
  );
  /** Pre-quoted + pre-initialized payment, ready to present instantly. */
  const [prepared, setPrepared] = useState<{
    key: string;
    quote: InAppQuote;
  } | null>(null);
  const [rates, setRates] = useState<ShippingRateOption[]>([]);
  const [ratesLoading, setRatesLoading] = useState(
    normalizeShipCountry(initialAddress?.country) !== null
  );
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);

  /** Country change (chip or saved address): drop the stale rates,
   * the stale rate selection, and the stale quote, and re-fetch
   * below. Loading is set here — in an event handler — not inside
   * the fetch effect (lint: set-state-in-effect). No fetch runs
   * for an unpicked country, so loading is false in that case. */
  const onCountryChange = (code: string) => {
    const normalized = normalizeShipCountry(code) ?? "";
    setCountry(normalized);
    setPrepared(null);
    setPromoTotals(null);
    setSelectedRateId(null);
    setRates([]);
    setRatesLoading(normalized !== "");
  };

  const currency = currencyForCountry(country);

  const applyPromoCode = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code || promoBusy) return;
    if (promoCodes.length >= 2) {
      Alert.alert(
        "Two-code limit",
        "You can use up to 2 promo codes per order."
      );
      return;
    }
    if (promoCodes.includes(code)) {
      Alert.alert("Already added", "That code is already on this order.");
      return;
    }
    if (isInAppCheckoutEnabled() && intentLines.length > 0) {
      setPromoBusy(true);
      try {
        const result = await validatePromoCodes(
          intentLines,
          [...promoCodes, code],
          { subtotalCents, email: email.trim() || undefined }
        );
        if (!result.appliedCodes.includes(code)) {
          Alert.alert(
            "Code didn't apply",
            `"${code}" isn't a valid code for this order. Check the spelling and try again.`
          );
          return;
        }
        setPromoCodes(result.appliedCodes);
        setPromoInput("");
        setPrepared(null);
      } catch {
        Alert.alert(
          "Couldn't check that code",
          "We couldn't reach the store to verify it. Check your connection and try again."
        );
      } finally {
        setPromoBusy(false);
      }
      return;
    }
    setPromoCodes((codes) => [...codes, code]);
    setPromoInput("");
  };

  const removePromoCode = async (code: string) => {
    const remaining = promoCodes.filter((c) => c !== code);
    setPromoCodes(remaining);
    setPrepared(null);
    if (!isInAppCheckoutEnabled() || remaining.length === 0) {
      setPromoTotals(null);
      return;
    }
    try {
      const result = await validatePromoCodes(intentLines, remaining, {
        subtotalCents,
        email: email.trim() || undefined,
      });
      setPromoCodes(result.appliedCodes);
      setPromoTotals(null);
    } catch {
      setPromoTotals(null);
    }
  };

  // Saved-address picker: "Use my saved address" fills the form and
  // shows which address is in use; with several saved, it opens a
  // dropdown so the shopper picks their preferred one.
  const [savedMenuOpen, setSavedMenuOpen] = useState(false);
  const [appliedAddrId, setAppliedAddrId] = useState<string | null>(
    initialAddress?.id ?? null
  );
  const appliedAddr =
    profile.addresses.find((a) => a.id === appliedAddrId) ?? null;

  const applyAddress = (addr: (typeof profile.addresses)[number]) => {
    const parts = addr.name.split(" ").filter(Boolean);
    if (parts.length > 0) {
      setFirstName(parts[0]);
      setLastName(parts.slice(1).join(" "));
    }
    setAddress1(addr.street);
    setAddress2(addr.street2);
    setCity(addr.city);
    setProvince(addr.province);
    setZip(addr.zip);
    onCountryChange(addr.country || "US");
    if (addr.phone) setPhone(addr.phone);
    setAppliedAddrId(addr.id);
    setSavedMenuOpen(false);
  };

  const onSavedAddressPress = () => {
    if (profile.addresses.length === 1) {
      applyAddress(profile.addresses[0]);
    } else {
      setSavedMenuOpen((open) => !open);
    }
  };

  const validate = (): string | null => {
    if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
    if (!firstName.trim()) return "Enter your first name.";
    if (!lastName.trim()) return "Enter your last name.";
    if (!address1.trim()) return "Enter your street address.";
    if (!city.trim()) return "Enter your city.";
    if (!province.trim()) return "Enter your state or province.";
    if (!zip.trim()) return "Enter your ZIP / postal code.";
    if (!country) return "Select a country for shipping.";
    return null;
  };

  /**
   * Full in-app payment: the site backend validates promo codes and
   * shipping first; Stripe takes the money in-app; the site webhook
   * then marks the order paid so Printify fulfills it like always.
   * A declined card shows Stripe's own error inside the payment
   * sheet — no order, no charge.
   */
  const buildBuyer = (): CheckoutBuyer => ({
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
  });

  const quoteKeyFor = (
    lines: typeof intentLines,
    buyer: CheckoutBuyer,
    rateId: string | null
  ): string =>
    JSON.stringify({
      l: lines.map((l) => [l.handle, l.variant, l.qty]),
      c: promoCodes,
      r: rateId,
      b: [
        buyer.email,
        buyer.firstName,
        buyer.lastName,
        buyer.address1,
        buyer.address2 ?? "",
        buyer.city,
        buyer.provinceCode,
        buyer.zip,
        buyer.countryCode,
        buyer.phone ?? "",
      ],
    });

  const initSheetFor = async (quote: InAppQuote, buyer: CheckoutBuyer) => {
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: "BeaTrackFam",
      paymentIntentClientSecret: quote.clientSecret,
      returnURL: "beatrackfam://stripe-redirect",
      ...(Platform.OS === "ios"
        ? {
            applePay: {
              merchantCountryCode: "US",
              cartItems: [
                {
                  paymentType: "Immediate" as const,
                  label: "BeaTrackFam",
                  amount: quote.totals.total.toFixed(2),
                },
              ],
            },
          }
        : {}),
      ...(Platform.OS === "android"
        ? {
            googlePay: {
              merchantCountryCode: "US",
              testEnv: false,
              currencyCode: quote.currency,
            },
          }
        : {}),
      defaultBillingDetails: {
        email: buyer.email,
        name: `${buyer.firstName} ${buyer.lastName}`.trim(),
        phone: buyer.phone,
      },
      defaultShippingDetails: {
        name: `${buyer.firstName} ${buyer.lastName}`.trim(),
        phone: buyer.phone,
        address: {
          line1: buyer.address1,
          line2: buyer.address2,
          city: buyer.city,
          state: buyer.provinceCode,
          postalCode: buyer.zip,
          country: buyer.countryCode,
        },
      },
    });
    return initError;
  };

  /** Present the sheet for an initialized quote and finish the order. */
  const presentAndFinish = async (quote: InAppQuote, buyer: CheckoutBuyer) => {
    const { error: payError } = await presentPaymentSheet();
    if (payError) {
      setPrepared(null);
      if ((payError as { code?: string }).code !== "Canceled") {
        Alert.alert("Payment didn't go through", payError.message);
      }
      return;
    }

    // Money landed. The site webhook marks the order paid; confirm the
    // order exists (best-effort) so the receipt carries the real site
    // order number.
    let orderNumber: string | null = quote.orderNumber;
    try {
      const order = await confirmInAppOrder(quote.paymentIntentId, {
        orderNumber: quote.orderNumber,
        email: buyer.email,
      });
      orderNumber = order.orderName || quote.orderNumber;
    } catch {
      orderNumber = quote.orderNumber;
    }

    await addOrderReceipt({
      id: orderNumber ?? `site-${quote.paymentIntentId}`,
      totalAmount: quote.totals.total.toFixed(2),
      currencyCode: quote.currency,
      itemCount: quote.lines.reduce((n, l) => n + l.quantity, 0),
      email: buyer.email,
      status: "completed",
      items: quote.lines.map((l) => ({
        productTitle: l.title,
        variantTitle: l.variantTitle,
        quantity: l.quantity,
        unitAmount: l.unitAmount.toFixed(2),
        currencyCode: quote.currency,
        imageUrl: l.imageUrl,
      })),
    });
    clearCart();
    router.replace("/thank-you");
  };

  const payInApp = async (
    liveLines: typeof intentLines,
    buyer: CheckoutBuyer
  ) => {
    // Fast path: the background prefetch already quoted + initialized
    // the sheet for exactly this cart and address — present instantly.
    const key = quoteKeyFor(liveLines, buyer, selectedRateId);
    if (
      prepared &&
      prepared.key === key &&
      prepared.quote.rejectedCodes.length === 0
    ) {
      await presentAndFinish(prepared.quote, buyer);
      return;
    }
    const quote = await quoteInAppCheckout(liveLines, promoCodes, buyer, {
      shippingRateId: selectedRateId,
    });
    if (quote.rejectedCodes.length > 0) {
      setPromoCodes((codes) =>
        codes.filter((c) => !quote.rejectedCodes.includes(c))
      );
      setPromoTotals(null);
      Alert.alert(
        "Promo code didn't apply",
        `${quote.rejectedCodes.join(", ")} ${
          quote.rejectedCodes.length === 1 ? "was" : "were"
        } removed. Review your total, then tap Pay again.`
      );
      return;
    }
    setPromoTotals(quote.totals);
    const initError = await initSheetFor(quote, buyer);
    if (initError) {
      Alert.alert("Couldn't start payment", initError.message);
      return;
    }
    await presentAndFinish(quote, buyer);
  };

  // Shipping options follow the ship-to country — and ONLY that
  // country. With no country picked there are no rates at all (the
  // server falls back to every zone's rates for an unrecognized
  // country, which is how all four rates used to show before any
  // chip was selected). Nothing is pre-selected: the shopper taps
  // a rate, which re-quotes (the prepared key includes the rate id).
  useEffect(() => {
    // No country picked: no fetch at all (the handler above already
    // cleared rates, selection, and loading for this state).
    if (!country) return;
    let cancelled = false;
    getShippingRates(country, currency, promoCodes.includes("FREESHIP"))
      .then((options) => {
        if (cancelled) return;
        setRates(options);
        setSelectedRateId((prev) =>
          prev && options.some((o) => o.id === prev) ? prev : null
        );
      })
      .catch(() => {
        if (!cancelled) setRates([]);
      })
      .finally(() => {
        if (!cancelled) setRatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, currency]);

  // Speed: while the shopper fills in their details, quietly fetch the
  // site quote and initialize the Stripe sheet in the background, so
  // "Continue to Payment" opens the sheet with no wait.
  const prepKey = isInAppCheckoutEnabled()
    ? quoteKeyFor(intentLines, buildBuyer(), selectedRateId)
    : "";
  React.useEffect(() => {
    if (!prepKey || intentLines.length === 0) return;
    if (!selectedRateId) return;
    if (validate() !== null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const buyer = buildBuyer();
          const quote = await quoteInAppCheckout(intentLines, promoCodes, buyer, {
            shippingRateId: selectedRateId,
          });
          if (cancelled || quote.rejectedCodes.length > 0) return;
          const err = await initSheetFor(quote, buyer);
          if (cancelled || err) return;
          setPrepared({ key: prepKey, quote });
          setPromoTotals(quote.totals);
        } catch {
          // Silent — tapping Pay runs the full flow and surfaces errors.
        }
      })();
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepKey]);

  const onPay = async () => {
    if (intentLines.length === 0 || busy) return;
    const problem = validate();
    if (problem) {
      Alert.alert("Check your details", problem);
      return;
    }
    setBusy(true);
    try {
      const buyer = buildBuyer();
      await payInApp(intentLines, buyer);
    } catch (e) {
      Alert.alert(
        "Couldn't start checkout",
        e instanceof Error ? e.message : "Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const subtotalDollars = subtotalCents / 100;

  /**
   * Summary shipping tracks the SELECTED rate instantly. The quoted
   * shipping lags the tap (900ms prefetch, and never when the address
   * is still incomplete) — without this override the summary kept
   * showing the previous rate's price after a change. The discount
   * and the server quote are untouched; the next quote replaces
   * these display values with server truth, and the PaymentSheet
   * charge always comes from the server quote at pay time.
   */
  const selectedRate = rates.find((r) => r.id === selectedRateId) ?? null;
  const displayShipping = promoTotals
    ? selectedRate
      ? selectedRate.priceCents / 100
      : promoTotals.shipping
    : null;
  const displayTotal =
    promoTotals && displayShipping !== null
      ? promoTotals.total - promoTotals.shipping + displayShipping
      : null;

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
                Powered by Stripe
              </Text>
            </View>
          </View>
          <Text style={[styles.secureBody, { color: colors.textMuted }]}>
            Fill in your details below, then pay right here in the app —
            Stripe handles the payment securely and the app never sees your
            card numbers.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Your Details
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {profile.addresses.length > 0 && (
            <>
              <Pressable
                style={[
                  styles.savedAddrBtn,
                  {
                    borderColor: appliedAddr ? colors.text : colors.border,
                    backgroundColor: appliedAddr
                      ? colors.surfaceRaised
                      : "transparent",
                  },
                ]}
                onPress={onSavedAddressPress}
              >
                <Ionicons
                  name={appliedAddr ? "checkmark-circle" : "home-outline"}
                  size={18}
                  color={colors.text}
                />
                <Text
                  style={[
                    styles.savedAddrLabel,
                    { color: colors.text, flex: 1 },
                  ]}
                >
                  {appliedAddr
                    ? `Using: ${appliedAddr.label}`
                    : "Use my saved address"}
                </Text>
                {profile.addresses.length > 1 && (
                  <Ionicons
                    name={savedMenuOpen ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.textMuted}
                  />
                )}
              </Pressable>
              {savedMenuOpen &&
                profile.addresses.map((addr) => {
                  const selected = addr.id === appliedAddrId;
                  return (
                    <Pressable
                      key={addr.id}
                      onPress={() => applyAddress(addr)}
                      style={[
                        styles.savedAddrOption,
                        {
                          borderColor: selected
                            ? colors.text
                            : colors.border,
                          backgroundColor: selected
                            ? colors.surfaceRaised
                            : "transparent",
                        },
                      ]}
                    >
                      <View style={styles.savedAddrMain}>
                        <Text
                          style={[
                            styles.savedAddrOptionLabel,
                            { color: colors.text },
                          ]}
                        >
                          {addr.label}
                          {addr.isDefault ? " · Default" : ""}
                        </Text>
                        <Text
                          style={[
                            styles.savedAddrOptionSub,
                            { color: colors.textMuted },
                          ]}
                        >
                          {addr.name} — {addr.street}, {addr.city}
                        </Text>
                      </View>
                      {selected && (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={colors.text}
                        />
                      )}
                    </Pressable>
                  );
                })}
            </>
          )}
          <TextField
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            autoComplete="email"
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <TextField
                label="First name"
                placeholder="Jane"
                value={firstName}
                onChangeText={setFirstName}
                textContentType="givenName"
                autoComplete="given-name"
              />
            </View>
            <View style={styles.half}>
              <TextField
                label="Last name"
                placeholder="Doe"
                value={lastName}
                onChangeText={setLastName}
                textContentType="familyName"
                autoComplete="family-name"
              />
            </View>
          </View>
          <TextField
            label="Street address"
            placeholder="123 Main St"
            value={address1}
            onChangeText={setAddress1}
            textContentType="streetAddressLine1"
            autoComplete="street-address"
          />
          <TextField
            label="Apt, suite, etc. (optional)"
            placeholder=""
            value={address2}
            onChangeText={setAddress2}
            textContentType="streetAddressLine2"
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <TextField
                label="City"
                placeholder="New York"
                value={city}
                onChangeText={setCity}
                textContentType="addressCity"
              />
            </View>
            <View style={styles.quarter}>
              <TextField
                label="State"
                placeholder="NY"
                value={province}
                onChangeText={setProvince}
                autoCapitalize="characters"
                textContentType="addressState"
              />
            </View>
            <View style={styles.quarter}>
              <TextField
                label="ZIP"
                placeholder="10301"
                value={zip}
                onChangeText={setZip}
                keyboardType="numbers-and-punctuation"
                textContentType="postalCode"
                autoComplete="postal-code"
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
                  onPress={() => onCountryChange(c.code)}
                  style={[
                    styles.countryChip,
                    {
                      borderColor: selected ? colors.button : colors.border,
                      backgroundColor: selected
                        ? colors.button
                        : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countryLabel,
                      {
                        color: selected ? colors.buttonText : colors.text,
                        fontWeight: selected ? "800" : "400",
                      },
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
            textContentType="telephoneNumber"
            autoComplete="tel"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Shipping
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {!country ? (
            <Text style={[styles.emptyNote, { color: colors.textDim }]}>
              Select a country above to see shipping options.
            </Text>
          ) : ratesLoading ? (
            <Text style={[styles.emptyNote, { color: colors.textDim }]}>
              Loading shipping options…
            </Text>
          ) : rates.length === 0 ? (
            <Text style={[styles.emptyNote, { color: colors.textDim }]}>
              Shipping options load at payment — the total updates before
              you pay.
            </Text>
          ) : (
            rates.map((r) => {
              const selected = r.id === selectedRateId;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    setSelectedRateId(r.id);
                    setPrepared(null);
                  }}
                  style={[
                    styles.shipRow,
                    {
                      borderColor: selected ? colors.button : colors.border,
                      backgroundColor: selected
                        ? colors.surfaceRaised
                        : "transparent",
                    },
                  ]}
                >
                  <View style={styles.shipMain}>
                    <Text style={[styles.shipName, { color: colors.text }]}>
                      {r.name}
                    </Text>
                    {r.deliveryText ? (
                      <Text
                        style={[styles.shipSub, { color: colors.textMuted }]}
                      >
                        {r.deliveryText}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.shipPrice, { color: colors.text }]}>
                    {r.priceCents === 0
                      ? "Free"
                      : fmtDollars(r.priceCents / 100)}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Promo Code
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.promoRow}>
            <View style={styles.promoField}>
              <TextField
                label=""
                placeholder="Promo code"
                value={promoInput}
                onChangeText={setPromoInput}
                autoCapitalize="characters"
              />
            </View>
            <Pressable
              onPress={applyPromoCode}
              disabled={promoBusy}
              style={[
                styles.promoButton,
                { backgroundColor: colors.text, opacity: promoBusy ? 0.55 : 1 },
              ]}
            >
              <Text style={[styles.promoButtonText, { color: colors.background }]}>
                {promoBusy ? "Checking…" : "Apply"}
              </Text>
            </Pressable>
          </View>
          {promoCodes.map((code) => (
            <View key={code} style={styles.promoChipRow}>
              <Ionicons name="pricetag" size={15} color={colors.text} />
              <Text style={[styles.promoChipText, { color: colors.text }]}>
                {code}
              </Text>
              <Pressable
                onPress={() => removePromoCode(code)}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          <Text style={[styles.promoNote, { color: colors.textMuted }]}>
            {promoCodes.length >= 2
              ? "Two codes on this order — that's the max."
              : "Add up to 2 codes — each one is checked against our store the moment you apply it. Only the first code rides the payment; extras are flagged at checkout."}
          </Text>
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
              {itemCount}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
              Subtotal
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {fmtDollars(subtotalDollars)}
            </Text>
          </View>
          {promoTotals && promoTotals.discount > 0.004 ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                Discount
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                −{fmtDollars(promoTotals.discount)}
              </Text>
            </View>
          ) : null}
          {promoTotals && displayShipping !== null ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                Shipping
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {displayShipping === 0
                  ? "Free"
                  : fmtDollars(displayShipping)}
              </Text>
            </View>
          ) : null}
          {promoTotals && promoTotals.tax > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                Tax
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {fmtDollars(promoTotals.tax)}
              </Text>
            </View>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {displayTotal !== null
                ? fmtDollars(displayTotal)
                : fmtDollars(subtotalDollars)}
            </Text>
          </View>
          {!promoTotals && (
            <Text style={[styles.emptyNote, { color: colors.textDim }]}>
              Shipping & tax calculated at payment.
            </Text>
          )}
          {intentLines.length === 0 && (
            <Text style={[styles.emptyNote, { color: colors.textDim }]}>
              Your cart is empty — add items before checking out.
            </Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Accepted Payment Methods
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {IN_APP_PAYMENT_METHODS.map((m) => (
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
          disabled={intentLines.length === 0 || busy}
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
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: Radius.xl,
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
  secureTitle: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  secureSub: { fontSize: 13, marginTop: 2 },
  secureBody: { fontSize: 13, lineHeight: 19, marginTop: Spacing.sm },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24,
    marginVertical: Spacing.sm,
  },
  savedAddrBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  savedAddrLabel: { fontSize: 14, fontWeight: "600" },
  savedAddrOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  savedAddrMain: { flex: 1, gap: 2 },
  savedAddrOptionLabel: { fontSize: 14, fontWeight: "700" },
  savedAddrOptionSub: { fontSize: 12 },
  row: { flexDirection: "row", gap: Spacing.sm },
  half: { flex: 1 },
  quarter: { flex: 0.7 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  countryRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
  countryChip: {
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  countryLabel: { fontSize: 14 },
  shipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  shipMain: { flex: 1, gap: 2 },
  shipName: { fontSize: 14, fontWeight: "700" },
  shipSub: { fontSize: 12 },
  shipPrice: { fontSize: 14, fontWeight: "800" },
  promoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  promoField: { flex: 1 },
  promoButton: {
    borderRadius: Radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  promoButtonText: { fontSize: 14, fontWeight: "800" },
  promoChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: Spacing.sm,
  },
  promoChipText: { flex: 1, fontSize: 14, fontWeight: "700" },
  promoNote: { fontSize: 12, marginTop: Spacing.sm },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: "600" },
  divider: { height: 1, marginVertical: Spacing.sm },
  totalLabel: { fontSize: 18, fontWeight: "800" },
  totalValue: { fontSize: 18, fontWeight: "800" },
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
