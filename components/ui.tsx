/**
 * Shared UI primitives used across screens.
 * All styling resolves through useTheme() so light/dark toggle just works.
 */
import React, { useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "./ThemeProvider";
import { Radius, Spacing } from "../constants/theme";

/* ---------------------------------- Header --------------------------------- */

interface ScreenHeaderProps {
  title: string;
  /** "left" for tab-style headers, "center" for stacked screens (matches screenshots). */
  align?: "left" | "center";
  showBack?: boolean;
  /** Extra control on the right (defaults to the theme toggle). */
  right?: React.ReactNode;
  hideThemeToggle?: boolean;
  /** Small logo image rendered next to the title (e.g. the app icon). */
  logo?: ImageSourcePropType;
}

export function ThemeToggle() {
  const { isDark, toggleTheme, colors } = useTheme();
  return (
    <Pressable
      onPress={toggleTheme}
      hitSlop={12}
      accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Ionicons
        name={isDark ? "sunny-outline" : "moon-outline"}
        size={22}
        color={colors.text}
      />
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  align = "left",
  showBack = false,
  right,
  hideThemeToggle = false,
  logo,
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const rightNode = right ?? (hideThemeToggle ? null : <ThemeToggle />);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.headerSafe, { backgroundColor: colors.header }]}
    >
      <View
        style={[
          styles.headerRow,
          { borderBottomColor: colors.border },
          align === "center" && styles.headerRowCenter,
        ]}
      >
        {showBack && (
          <View style={styles.headerSide}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          </View>
        )}
        <View style={styles.headerTitleWrap}>
          {logo ? <Image source={logo} style={styles.headerLogo} /> : null}
          <Text
            style={[
              styles.headerTitle,
              { color: colors.text },
              align === "center" && styles.headerTitleCenter,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          {rightNode}
        </View>
      </View>
    </SafeAreaView>
  );
}

/* --------------------------------- Buttons --------------------------------- */

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, icon, disabled }: PrimaryButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: colors.button,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon}
      <Text style={[styles.primaryButtonLabel, { color: colors.buttonText }]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface OutlineButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function OutlineButton({ label, onPress, disabled }: OutlineButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outlineButton,
        {
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={[styles.outlineButtonLabel, { color: colors.outlineButtonText }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* --------------------------------- TextField -------------------------------- */

interface TextFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  /** System autofill hints (iOS textContentType / Android autoComplete). */
  textContentType?: TextInputProps["textContentType"];
  autoComplete?: TextInputProps["autoComplete"];
}

export function TextField({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  textContentType,
  autoComplete,
}: TextFieldProps) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(secureTextEntry);
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <View
        style={[
          styles.fieldInputRow,
          { backgroundColor: colors.input },
        ]}
      >
        <TextInput
          style={[styles.fieldInput, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          textContentType={textContentType}
          autoComplete={autoComplete}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={colors.textDim}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/* --------------------------------- MenuRow ---------------------------------- */

interface MenuRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}

export function MenuRow({ icon, title, subtitle, onPress }: MenuRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View
        style={[styles.menuIconWrap, { backgroundColor: colors.surfaceRaised }]}
      >
        {icon}
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
    </Pressable>
  );
}

/* --------------------------------- Misc ------------------------------------ */

export function SectionLabel({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.sectionLabel, { color: colors.textDim }]}>{text}</Text>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      {icon}
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        {subtitle}
      </Text>
    </View>
  );
}

interface SettingRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}

export function SettingRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
}: SettingRowProps) {
  const { colors } = useTheme();
  const Inner = (
    <View
      style={[styles.menuRow, { backgroundColor: colors.surface }]}
    >
      <View
        style={[styles.menuIconWrap, { backgroundColor: colors.surfaceRaised }]}
      >
        {icon}
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
        ) : null)}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        {Inner}
      </Pressable>
    );
  }
  return Inner;
}

export function ToggleSetting({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <SettingRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: colors.text }}
        />
      }
    />
  );
}

/* --------------------------------- Styles ----------------------------------- */

const styles = StyleSheet.create({
  headerSafe: {
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerRowCenter: {
    justifyContent: "space-between",
  },
  headerSide: {
    width: 40,
    justifyContent: "center",
  },
  headerSideRight: {
    alignItems: "flex-end",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
  },
  headerTitleCenter: {
    textAlign: "center",
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    paddingVertical: 17,
    paddingHorizontal: Spacing.lg,
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: "800",
  },
  outlineButton: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: 15,
    alignItems: "center",
  },
  outlineButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  fieldWrap: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  fieldInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  menuSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
