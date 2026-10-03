/** In-app policy reader — renders the store's real policy text. */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "../../../components/ThemeProvider";
import { ScreenHeader } from "../../../components/ui";
import { getPolicy } from "../../../data/policies";
import { Spacing } from "../../../constants/theme";

export default function PolicyScreen() {
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const policy = getPolicy(slug ?? "");

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={policy?.title ?? "Policy"}
        align="center"
        showBack
      />
      <ScrollView contentContainerStyle={styles.content}>
        {!policy ? (
          <Text style={[styles.body, { color: colors.textMuted }]}>
            This policy couldn&apos;t be found.
          </Text>
        ) : (
          <>
            {policy.updated ? (
              <Text style={[styles.updated, { color: colors.textDim }]}>
                {policy.updated}
              </Text>
            ) : null}
            {policy.sections.map((section, i) => (
              <View key={i} style={styles.section}>
                {section.heading ? (
                  <Text style={[styles.heading, { color: colors.text }]}>
                    {section.heading}
                  </Text>
                ) : null}
                {section.body
                  .filter(
                    (para, j) =>
                      // The "Last updated" date is already shown above —
                      // drop the duplicate first paragraph.
                      !(j === 0 && /^last updated/i.test(para.trim()))
                  )
                  .map((para, j) => (
                  <Text
                    key={j}
                    style={[styles.body, { color: colors.textMuted }]}
                  >
                    {para}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  updated: { fontSize: 12, marginBottom: Spacing.md },
  section: { marginBottom: Spacing.md },
  heading: { fontSize: 17, fontWeight: "800", marginBottom: Spacing.xs },
  body: { fontSize: 14, lineHeight: 21, marginBottom: Spacing.sm },
});
