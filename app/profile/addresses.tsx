/** Saved Addresses — full CRUD, persisted on the device. */
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../components/ThemeProvider";
import {
  EmptyState,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  TextField,
} from "../../components/ui";
import { useShop } from "../../store/shop";
import type { LocalAddress } from "../../lib/customer";
import { Radius, Spacing } from "../../constants/theme";

const EMPTY_FORM = {
  label: "Home",
  name: "",
  street: "",
  street2: "",
  city: "",
  province: "",
  zip: "",
  country: "United States",
  phone: "",
  isDefault: false,
};

function AddressForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Partial<LocalAddress>;
  onSave: (a: Omit<LocalAddress, "id">) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const set = (k: keyof typeof EMPTY_FORM) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.name.trim() || !form.street.trim() || !form.city.trim()) {
      Alert.alert("Almost there", "Add a name, street and city.");
      return;
    }
    onSave(form as Omit<LocalAddress, "id">);
  };

  return (
    <View style={[styles.form, { backgroundColor: colors.surface }]}>
      <TextField label="Label" placeholder="Home, Work…" value={form.label} onChangeText={set("label")} />
      <TextField label="Full name" placeholder="Recipient name" value={form.name} onChangeText={set("name")} autoCapitalize="words" />
      <TextField label="Street" placeholder="Street address" value={form.street} onChangeText={set("street")} />
      <TextField label="Apt / Suite (optional)" placeholder="" value={form.street2} onChangeText={set("street2")} />
      <TextField label="City" placeholder="City" value={form.city} onChangeText={set("city")} autoCapitalize="words" />
      <View style={styles.row2}>
        <View style={styles.half}>
          <TextField label="State" placeholder="NY" value={form.province} onChangeText={set("province")} />
        </View>
        <View style={styles.half}>
          <TextField label="ZIP" placeholder="10301" value={form.zip} onChangeText={set("zip")} />
        </View>
      </View>
      <TextField label="Country" placeholder="United States" value={form.country} onChangeText={set("country")} autoCapitalize="words" />
      <TextField label="Phone (optional)" placeholder="" value={form.phone} onChangeText={set("phone")} />
      <Pressable
        onPress={() => set("isDefault")(!form.isDefault)}
        style={styles.checkRow}
        hitSlop={8}
      >
        <Ionicons
          name={form.isDefault ? "checkbox" : "square-outline"}
          size={22}
          color={form.isDefault ? colors.text : colors.textDim}
        />
        <Text style={[styles.checkLabel, { color: colors.text }]}>
          Make this my default address
        </Text>
      </Pressable>
      <View style={styles.formCtas}>
        <View style={styles.formCta}>
          <OutlineButton label="Cancel" onPress={onCancel} />
        </View>
        <View style={styles.formCta}>
          <PrimaryButton label="Save Address" onPress={save} />
        </View>
      </View>
    </View>
  );
}

export default function Addresses() {
  const { colors } = useTheme();
  const {
    profile,
    addAddress,
    updateAddress,
    removeAddress,
    setDefaultAddress,
  } = useShop();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const onDelete = (id: string) => {
    Alert.alert("Delete address?", "This removes it from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeAddress(id),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title="Saved Addresses" align="center" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {formOpen && (
          <AddressForm
            initial={editingId ? profile.addresses.find((a) => a.id === editingId) ?? {} : {}}
            onSave={async (a) => {
              if (editingId) await updateAddress(editingId, a);
              else await addAddress(a);
              setFormOpen(false);
              setEditingId(null);
            }}
            onCancel={() => {
              setFormOpen(false);
              setEditingId(null);
            }}
          />
        )}

        {!formOpen && profile.addresses.length === 0 && (
          <EmptyState
            icon={
              <Ionicons name="location-outline" size={48} color={colors.textDim} />
            }
            title="No saved addresses"
            subtitle="Add your shipping address so checkout is quicker."
          />
        )}

        {!formOpen &&
          profile.addresses.map((a) => (
            <View
              key={a.id}
              style={[styles.card, { backgroundColor: colors.surface }]}
            >
              <View style={styles.cardTop}>
                <Text style={[styles.cardLabel, { color: colors.text }]}>
                  {a.label || "Address"}
                </Text>
                {a.isDefault && (
                  <View
                    style={[styles.badge, { backgroundColor: colors.text }]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: colors.background },
                      ]}
                    >
                      DEFAULT
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.addr, { color: colors.textMuted }]}>
                {a.name}
                {"\n"}
                {a.street}
                {a.street2 ? `\n${a.street2}` : ""}
                {"\n"}
                {a.city}, {a.province} {a.zip}
                {"\n"}
                {a.country}
              </Text>
              <View style={styles.cardActions}>
                {!a.isDefault && (
                  <Pressable
                    onPress={() => setDefaultAddress(a.id)}
                    hitSlop={8}
                  >
                    <Text
                      style={[styles.action, { color: colors.textMuted }]}
                    >
                      Set default
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => {
                    setEditingId(a.id);
                    setFormOpen(true);
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.action, { color: colors.text }]}>
                    Edit
                  </Text>
                </Pressable>
                <Pressable onPress={() => onDelete(a.id)} hitSlop={8}>
                  <Text style={[styles.action, { color: colors.danger }]}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}

        {!formOpen && (
          <View style={styles.addWrap}>
            <OutlineButton
              label="Add New Address"
              onPress={() => {
                setEditingId(null);
                setFormOpen(true);
              }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  cardLabel: { fontSize: 16, fontWeight: "800" },
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "800" },
  addr: { fontSize: 14, lineHeight: 21 },
  cardActions: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  action: { fontSize: 14, fontWeight: "600" },
  addWrap: { marginTop: Spacing.sm },
  form: { borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  row2: { flexDirection: "row", gap: Spacing.sm },
  half: { flex: 1 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  checkLabel: { fontSize: 14, fontWeight: "600" },
  formCtas: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  formCta: { flex: 1 },
});
