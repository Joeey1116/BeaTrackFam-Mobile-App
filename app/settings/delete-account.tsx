/** Delete Account — removes the device-local app account. */
import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import {
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  TextField,
} from "../../components/ui";
import { useShop } from "../../store/shop";
import { Radius, Spacing } from "../../constants/theme";

export default function DeleteAccount() {
  const { colors } = useTheme();
  const router = useRouter();
  const { account, deleteAccount, eraseLocalData } = useShop();
  const [deleting, setDeleting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [password, setPassword] = useState("");

  const onRequestShopifyDelete = () => {
    const email = account?.email ?? "";
    const subject = encodeURIComponent("Delete my BeaTrackFam customer data");
    const body = encodeURIComponent(
      `Hi BeaTrackFam,\n\nPlease delete the Shopify customer record associated with this email: ${email}\n\nThanks.`
    );
    Linking.openURL(
      `mailto:contact@beatrackfam.info?subject=${subject}&body=${body}`
    ).catch(() =>
      Alert.alert("Email", "Write to us at contact@beatrackfam.info")
    );
  };

  const onDeleteAccount = () => {
    if (!password) {
      Alert.alert(
        "Password needed",
        "Enter your password to confirm it's you — then your account is gone for good."
      );
      return;
    }
    Alert.alert(
      "Delete your account?",
      "This permanently removes your BeaTrackFam account — your registration, profile, saved addresses and order history in the app. Your email is freed up, so coming back means signing up again. Orders already placed stay in Shopify's records (email us below if you want those removed too).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const result = await deleteAccount(password);
            setDeleting(false);
            if (!result.ok) {
              Alert.alert("Account not deleted", result.reason ?? "");
              return;
            }
            router.replace("/(tabs)");
          },
        },
      ]
    );
  };

  const onEraseDevice = () => {
    Alert.alert(
      "Erase this device's data?",
      "This signs you out and clears everything this app stored on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase",
          style: "destructive",
          onPress: async () => {
            setErasing(true);
            await eraseLocalData();
            setErasing(false);
            router.replace("/(tabs)");
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Delete Account" align="center" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Ionicons
            name="warning-outline"
            size={28}
            color={colors.danger}
          />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            How account deletion works
          </Text>
          <Text style={[styles.cardBody, { color: colors.textMuted }]}>
            Your BeaTrackFam account is registered with us (that&apos;s how
            logging back in works after a reinstall) — deleting removes
            that registration and everything on this phone with it. Enter
            your password below so a borrowed phone can&apos;t do this to
            you.
          </Text>
        </View>

        {account && (
          <>
            <TextField
              label="Your password"
              placeholder="Enter your password to confirm"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.gap} />
            <PrimaryButton
              label={deleting ? "Deleting…" : "Delete My Account"}
              onPress={onDeleteAccount}
            />
          </>
        )}

        <View style={styles.divider} />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Shopify order records
        </Text>
        <Text style={[styles.cardBody, { color: colors.textMuted }]}>
          Orders you placed live in Shopify&apos;s records too. Email us and
          we&apos;ll remove your customer data there by hand.
        </Text>
        <View style={styles.gap} />
        <OutlineButton
          label="Request Shopify Data Deletion"
          onPress={onRequestShopifyDelete}
        />

        <View style={styles.divider} />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Just this device
        </Text>
        <Text style={[styles.cardBody, { color: colors.textMuted }]}>
          Want a fresh start on this phone? Erase everything this app stored
          locally.
        </Text>
        <View style={styles.gap} />
        <OutlineButton
          label={erasing ? "Erasing…" : "Erase My Data on This Device"}
          onPress={onEraseDevice}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  cardBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  divider: { height: Spacing.lg },
  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: Spacing.xs },
  gap: { height: Spacing.sm },
});
