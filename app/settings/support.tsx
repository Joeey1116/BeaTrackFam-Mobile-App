/** Support — email the team or read the in-app FAQ. */
import React from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import { MenuRow, ScreenHeader } from "../../components/ui";
import { Spacing } from "../../constants/theme";

export default function Support() {
  const { colors } = useTheme();
  const router = useRouter();

  const icon = (name: React.ComponentProps<typeof Ionicons>["name"]) => (
    <Ionicons name={name} size={20} color={colors.text} />
  );

  const mail = () => {
    Linking.openURL("mailto:contact@beatrackfam.info").catch(() =>
      Alert.alert("Email", "Write to us at contact@beatrackfam.info")
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Support" align="center" showBack />
      <View style={styles.content}>
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          Dedicated support for the fam — reach out any time.
        </Text>
        <MenuRow
          icon={icon("mail-outline")}
          title="Email Us"
          subtitle="contact@beatrackfam.info"
          onPress={mail}
        />
        <MenuRow
          icon={icon("help-circle-outline")}
          title="FAQ"
          subtitle="Quick answers to common questions"
          onPress={() => router.push("/settings/faq")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md },
  intro: { fontSize: 14, marginBottom: Spacing.md },
});
