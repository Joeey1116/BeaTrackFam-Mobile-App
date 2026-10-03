/** Edit Profile — name, phone (stored on your app account or this device). */
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import { PrimaryButton, ScreenHeader, TextField } from "../../components/ui";
import { useShop } from "../../store/shop";
import { Spacing } from "../../constants/theme";

export default function EditProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { account, profile, updateProfile } = useShop();

  const [firstName, setFirstName] = useState(profile.firstName || "");
  const [lastName, setLastName] = useState(profile.lastName || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    await updateProfile({ firstName, lastName, phone });
    setSaving(false);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title="Edit Profile" align="center" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {account?.email ? (
          <Text style={[styles.email, { color: colors.textMuted }]}>
            {account.email}
          </Text>
        ) : null}
        <TextField
          label="First name"
          placeholder="Your first name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
        />
        <TextField
          label="Last name"
          placeholder="Your last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
        />
        <TextField
          label="Phone"
          placeholder="Your phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="default"
        />
        <Text style={[styles.note, { color: colors.textDim }]}>
          Your sign-in email is managed securely by Shopify and can&apos;t be
          changed here.
        </Text>
        <View style={styles.cta}>
          <PrimaryButton
            label={saving ? "Saving…" : "Save Changes"}
            onPress={onSave}
            disabled={saving}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  email: { fontSize: 14, marginBottom: Spacing.md },
  note: { fontSize: 12, lineHeight: 17, marginBottom: Spacing.lg },
  cta: { marginTop: Spacing.xs },
});
