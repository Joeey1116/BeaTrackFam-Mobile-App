/** Earn With the Fam — BeaTrackFam affiliate program info + hand-off to the Pro Affiliates app. */
import React from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../components/ThemeProvider";
import {
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SectionLabel,
} from "../../components/ui";
import { Radius, Spacing } from "../../constants/theme";

// "Pro Affiliates" (by Anuj Tenani) is GoAffPro's affiliate-side app — it is
// NOT our app. Affiliates use it to see their link, sales and earnings.
// App Store listing URL confirmed by Joey (Oct 6, 2026). The Play URL is
// still a store search URL — paste the exact listing URL here before release.
const AFFILIATE_APP_STORE_URL =
  "https://apps.apple.com/us/app/pro-affiliates/id1489316147";
const AFFILIATE_APP_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.goaffpro.app";

const LOGIN_STEPS = [
  "Download and open the Pro Affiliates app.",
  "Sign in with the email you registered as an affiliate with — or tap Apple or Google if that's how you signed up.",
  "Pick the BeaTrackFam store from your registered stores.",
  "Your dashboard shows your affiliate link, your sales, and your earnings.",
];

export default function Affiliates() {
  const { colors } = useTheme();

  const downloadApp = () => {
    const url =
      Platform.OS === "ios" ? AFFILIATE_APP_STORE_URL : AFFILIATE_APP_PLAY_URL;
    Linking.openURL(url).catch(() =>
      Alert.alert(
        "Pro Affiliates",
        "Couldn't open the store — search for \"Pro Affiliates\" in the App Store or Google Play."
      )
    );
  };

  const joinProgram = () => {
    const subject = encodeURIComponent("Affiliate program — count me in");
    Linking.openURL(
      `mailto:contact@beatrackfam.info?subject=${subject}`
    ).catch(() => Alert.alert("Email", "Write to us at contact@beatrackfam.info"));
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

        <SectionLabel text="ALREADY AN AFFILIATE?" />
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Your affiliate link, sales and earnings live in the Pro Affiliates
          app — that&rsquo;s the separate app from our affiliate platform where your
          dashboard is.
        </Text>
        <PrimaryButton
          label="Download Pro Affiliates"
          onPress={downloadApp}
          icon={
            <Ionicons
              name="download-outline"
              size={18}
              color={colors.buttonText}
            />
          }
        />

        <SectionLabel text="HOW TO LOG IN" />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {LOGIN_STEPS.map((step, i) => (
            <View
              key={step}
              style={[styles.stepRow, i > 0 && styles.stepRowSpaced]}
            >
              <View
                style={[
                  styles.stepBadge,
                  { backgroundColor: colors.surfaceRaised },
                ]}
              >
                <Text style={[styles.stepNumber, { color: colors.text }]}>
                  {i + 1}
                </Text>
              </View>
              <Text style={[styles.stepText, { color: colors.text }]}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        <SectionLabel text="NOT AN AFFILIATE YET?" />
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Want in? Email us at contact@beatrackfam.info and we&rsquo;ll get you set
          up with your own affiliate link.
        </Text>
        <OutlineButton label="Email Us to Join" onPress={joinProgram} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  intro: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.md },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  stepRowSpaced: { marginTop: Spacing.md },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: { fontSize: 14, fontWeight: "800" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
