/** Earn With the Fam — BeaTrackFam affiliate program info + dashboard.
 *
 * The program now runs on the store's own built-in affiliate system
 * (GET /api/account/affiliate, resolved from the signed-in account's
 * email — the app never sends a code or id). This screen is info +
 * dashboard linkage only: it shows your link, rate, earnings and
 * recent commissions/payouts when an affiliate is linked to your
 * account, and the join path when none is. Joining is temporarily
 * disabled on the site, so no join flow is built here — the email
 * button below is the way in.
 */
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import {
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SectionLabel,
} from "../../components/ui";
import { Radius, Spacing } from "../../constants/theme";
import { useShop } from "../../store/shop";
import {
  fetchSiteAffiliate,
  type SiteAffiliate,
} from "../../lib/accounts";

const CONTACT_EMAIL = "contact@beatrackfam.info";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

export default function Affiliates() {
  const { colors } = useTheme();
  const { account } = useShop();
  const [affiliate, setAffiliate] = useState<SiteAffiliate | null | undefined>(
    undefined
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!account) {
      setAffiliate(undefined);
      return;
    }
    try {
      setError(null);
      setAffiliate(await fetchSiteAffiliate());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load that.");
      setAffiliate(null);
    }
  }, [account]);

  // useFocusEffect fires on focus, including the first mount — no
  // separate mount effect (lint: set-state-in-effect).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openLink = () => {
    if (!affiliate) return;
    Linking.openURL(affiliate.link).catch(() =>
      Alert.alert("Link", `Your referral link is ${affiliate.link}`)
    );
  };

  const emailUs = (subject: string) => {
    Linking.openURL(
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    ).catch(() =>
      Alert.alert("Email", `Write to us at ${CONTACT_EMAIL}`)
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Earn With the Fam" align="center" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          Loyalty Above All is how we grow. Join the BeaTrackFam affiliate
          program: share the brand with your people, and earn when they shop
          through your link.
        </Text>

        {!account ? (
          <>
            <SectionLabel text="SEE YOUR DASHBOARD" />
            <Text style={[styles.body, { color: colors.textMuted }]}>
              Your affiliate link, sales and earnings live on your
              BeaTrackFam account. Log in first, then come back here.
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              Not an affiliate yet? New sign-ups are paused right now —
              email us and we&apos;ll let you know when they reopen.
            </Text>
            <OutlineButton
              label="Email Us to Join"
              onPress={() => emailUs("Affiliate program — count me in")}
            />
          </>
        ) : affiliate === undefined ? (
          <ActivityIndicator color={colors.text} style={styles.spinner} />
        ) : error ? (
          <>
            <Text style={[styles.error, { color: colors.danger ?? "#E5484D" }]}>
              {error}
            </Text>
            <OutlineButton label="Try Again" onPress={() => void load()} />
          </>
        ) : affiliate === null ? (
          <>
            <SectionLabel text="NOT AN AFFILIATE YET?" />
            <Text style={[styles.body, { color: colors.textMuted }]}>
              No affiliate is linked to {account.email} yet. New
              sign-ups are paused right now — email us and we&apos;ll
              get you set up with your own affiliate link when they
              reopen.
            </Text>
            <OutlineButton
              label="Email Us to Join"
              onPress={() => emailUs("Affiliate program — count me in")}
            />
          </>
        ) : (
          <>
            <SectionLabel text="YOUR AFFILIATE DASHBOARD" />
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.kv}>
                <Text style={[styles.kvLabel, { color: colors.textMuted }]}>
                  Your code
                </Text>
                <Text style={[styles.kvValue, { color: colors.text }]}>
                  {affiliate.code}
                </Text>
              </View>
              <View style={styles.kv}>
                <Text style={[styles.kvLabel, { color: colors.textMuted }]}>
                  Commission rate
                </Text>
                <Text style={[styles.kvValue, { color: colors.text }]}>
                  {affiliate.rate}
                </Text>
              </View>
              <View style={styles.kv}>
                <Text style={[styles.kvLabel, { color: colors.textMuted }]}>
                  Total earnings
                </Text>
                <Text style={[styles.kvValue, { color: colors.text }]}>
                  {affiliate.totalEarnings}
                </Text>
              </View>
              {affiliate.paymentMethod ? (
                <View style={styles.kv}>
                  <Text style={[styles.kvLabel, { color: colors.textMuted }]}>
                    Payout method
                  </Text>
                  <Text style={[styles.kvValue, { color: colors.text }]}>
                    {affiliate.paymentMethod}
                    {affiliate.paymentHandle
                      ? ` · ${affiliate.paymentHandle}`
                      : ""}
                  </Text>
                </View>
              ) : null}
            </View>
            <PrimaryButton
              label="Open My Referral Link"
              onPress={openLink}
              icon={
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={colors.buttonText}
                />
              }
            />
            <Text style={[styles.linkNote, { color: colors.textDim }]}>
              {affiliate.link}
            </Text>

            {affiliate.orders.length > 0 && (
              <>
                <SectionLabel text="RECENT SALES" />
                <View
                  style={[styles.card, { backgroundColor: colors.surface }]}
                >
                  {affiliate.orders.map((o) => (
                    <View key={`${o.order_number}-${o.date}`} style={styles.kv}>
                      <View style={styles.orderMain}>
                        <Text
                          style={[styles.orderTitle, { color: colors.text }]}
                        >
                          Order {o.order_number}
                        </Text>
                        <Text
                          style={[styles.orderSub, { color: colors.textMuted }]}
                        >
                          {formatDate(o.date)} · {o.status}
                        </Text>
                      </View>
                      <Text style={[styles.kvValue, { color: colors.text }]}>
                        {o.commission}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {affiliate.payouts.length > 0 && (
              <>
                <SectionLabel text="PAYOUTS" />
                <View
                  style={[styles.card, { backgroundColor: colors.surface }]}
                >
                  {affiliate.payouts.map((p, i) => (
                    <View key={`${p.created_at}-${i}`} style={styles.kv}>
                      <View style={styles.orderMain}>
                        <Text
                          style={[styles.orderTitle, { color: colors.text }]}
                        >
                          {p.amount}
                        </Text>
                        <Text
                          style={[styles.orderSub, { color: colors.textMuted }]}
                        >
                          {formatDate(p.created_at)} · {p.status}
                          {p.note ? ` · ${p.note}` : ""}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={[styles.body, { color: colors.textMuted }]}>
              Questions about a payout or your link? Email us and
              we&apos;ll sort it out.
            </Text>
            <OutlineButton
              label="Email Us"
              onPress={() => emailUs("Affiliate question")}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  intro: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.md },
  spinner: { marginVertical: Spacing.xl },
  error: { fontSize: 13, textAlign: "center", marginVertical: Spacing.md },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    gap: Spacing.sm,
  },
  kvLabel: { fontSize: 14 },
  kvValue: { fontSize: 14, fontWeight: "700" },
  orderMain: { flex: 1, gap: 2 },
  orderTitle: { fontSize: 14, fontWeight: "700" },
  orderSub: { fontSize: 12 },
  linkNote: { fontSize: 12, textAlign: "center", marginTop: Spacing.sm },
});
