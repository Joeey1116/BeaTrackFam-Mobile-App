/** About BeaTrackFam — brand story, founder, socials, in-app. */
import React from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../components/ThemeProvider";
import { LogoEye } from "../../components/LogoEye";
import { ScreenHeader } from "../../components/ui";
import { Radius, Spacing } from "../../constants/theme";

const SOCIALS: { label: string; handle: string; icon: string; url: string }[] = [
  {
    label: "Instagram",
    handle: "@beatrackfam",
    icon: "logo-instagram",
    url: "https://instagram.com/beatrackfam",
  },
  {
    label: "Facebook",
    handle: "BeaTrackFam",
    icon: "logo-facebook",
    url: "https://facebook.com/beatrackfam",
  },
  {
    label: "Threads",
    handle: "@beatrackfam",
    icon: "at-outline",
    url: "https://threads.net/@beatrackfam",
  },
];

export default function About() {
  const { colors } = useTheme();

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="About" align="center" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <LogoEye size={112} style={{ marginBottom: Spacing.md }} />
          <Text style={[styles.name, { color: colors.text }]}>
            BeaTrackFam: Loyalty Above All
          </Text>
          <Text style={[styles.slogan, { color: colors.textMuted }]}>
            &ldquo;Loyalty Above All&rdquo;
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.founderPhotoWrap}>
            <Image
              source={require("../../assets/founder-joey-v2.png")}
              style={styles.founderPhoto}
              accessibilityLabel="Photo of Joey, founder of BeaTrackFam"
            />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Meet the founder
          </Text>
          <Text style={[styles.cardBody, { color: colors.textMuted }]}>
            Hi — I&apos;m Joseph, also known as Joey, and I&apos;m the founder
            of BeaTrackFam. If you&apos;re reading this, I want you to know who
            I am and what this brand stands for — because to me, you&apos;re
            not just opening an app. You&apos;re meeting a person.
          </Text>
          <Text style={[styles.cardBody, { color: colors.textMuted }]}>
            I launched BeaTrackFam in November of 2020 with no investors, no
            team, and no big business plan — just a passion for design and a
            belief that wouldn&apos;t leave me alone: that I could build
            something real by treating people the right way. There were long
            nights, tight budgets, and plenty of moments where quitting would
            have been easier. I kept going, because this was never just about
            selling shirts. It was about creating something that meant
            something — something people could feel proud to wear and proud to
            be part of.
          </Text>
          <Text style={[styles.cardBody, { color: colors.textMuted }]}>
            Designing merch is my passion — it&apos;s what I pour my energy
            into every single day. When I sit down to create, I don&apos;t ask
            &ldquo;what will sell?&rdquo; I ask &ldquo;what will matter?&rdquo;
            Some collections honor the people we&apos;ve lost; others stand
            behind causes that genuinely matter, like mental health awareness
            and suicide prevention — because if a design I create helps even
            one person feel seen, it was worth making.
          </Text>
          <Text style={[styles.cardBody, { color: colors.textMuted }]}>
            My goal is to make BeaTrackFam my full-time business — my
            life&apos;s work. I dream of our own physical store, of seeing
            these designs on shelves in major retailers. But no matter how big
            this gets, the foundation never changes: loyalty above all,
            community first, fair prices, real quality. And I&apos;m not
            chasing wealth — to me, being truly rich has nothing to do with
            money. It&apos;s about relationships, friendships, and knowledge.
          </Text>
          <Text style={[styles.signoff, { color: colors.text }]}>
            — Joey
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            What &ldquo;Loyalty Above All&rdquo; means
          </Text>
          <Text style={[styles.cardBody, { color: colors.textMuted }]}>
            It isn&apos;t just a slogan — it&apos;s the foundation of
            everything I do. Loyalty means honesty. It means I&apos;d rather
            earn your trust than earn your money. I&apos;d rather have 100
            people each find one product they love than one person buy 100
            products — because 100 people means 100 relationships.
          </Text>
          <Text style={[styles.cardBody, { color: colors.textMuted }]}>
            That&apos;s why prices stay fair and quality stays high: good
            people should be able to afford great designs without breaking the
            bank. When you spend your hard-earned money with me, you&apos;re
            placing your trust in me — and I protect that by doing things the
            right way, every single time.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Follow the fam
          </Text>
          {SOCIALS.map((s) => (
            <Pressable
              key={s.label}
              onPress={() => openLink(s.url)}
              style={styles.row}
              hitSlop={8}
            >
              <Ionicons name={s.icon as any} size={20} color={colors.text} />
              <View>
                <Text style={[styles.link, { color: colors.text }]}>
                  {s.label}
                </Text>
                <Text style={[styles.handle, { color: colors.textMuted }]}>
                  {s.handle}
                </Text>
              </View>
              <Ionicons
                name="open-outline"
                size={16}
                color={colors.textDim}
                style={styles.openIcon}
              />
            </Pressable>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Find us
          </Text>
          <Pressable
            onPress={() => openLink("https://beatrackfam.info")}
            style={styles.row}
            hitSlop={8}
          >
            <Ionicons name="globe-outline" size={20} color={colors.text} />
            <Text style={[styles.link, { color: colors.text }]}>
              beatrackfam.info
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Linking.openURL("mailto:contact@beatrackfam.info").catch(() => {})
            }
            style={styles.row}
            hitSlop={8}
          >
            <Ionicons name="mail-outline" size={20} color={colors.text} />
            <Text style={[styles.link, { color: colors.text }]}>
              contact@beatrackfam.info
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.version, { color: colors.textDim }]}>
          BeaTrackFam 11.0.12 (Build 1112)
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  hero: { alignItems: "center", marginBottom: Spacing.lg },
  logoImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    marginBottom: Spacing.md,
  },
  name: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  slogan: { fontSize: 14, fontStyle: "italic", marginTop: 4 },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", marginBottom: Spacing.sm },
  founderPhotoWrap: { alignItems: "center", marginBottom: Spacing.md },
  founderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cardBody: { fontSize: 14, lineHeight: 21, marginBottom: Spacing.sm },
  signoff: { fontSize: 15, fontWeight: "800", marginTop: Spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  link: { fontSize: 15, fontWeight: "600" },
  handle: { fontSize: 13, marginTop: 1 },
  openIcon: { marginLeft: "auto" },
  version: { fontSize: 12, textAlign: "center", marginTop: Spacing.md },
});
