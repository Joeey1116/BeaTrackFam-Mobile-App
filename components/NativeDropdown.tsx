/**
 * NativeDropdown — the BUILT-IN OS dropdown (@react-native-picker/picker).
 * No custom option list (Joey, Oct 4 2026):
 * - Android / web: the native dropdown field itself (mode="dropdown").
 * - iOS: a field that opens a sheet holding the native wheel picker
 *   with a Done button — the standard iOS presentation of the built-in
 *   picker control.
 */
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import { Radius, Spacing } from "../constants/theme";

export interface NativeDropdownOption {
  value: string;
  label: string;
}

export function NativeDropdown({
  value,
  options,
  onSelect,
  sheetTitle,
  accessibilityLabel,
}: {
  /** Currently selected option value. */
  value: string;
  options: NativeDropdownOption[];
  onSelect: (value: string) => void;
  sheetTitle?: string;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? value;

  // Android + web: the picker IS the dropdown field.
  if (Platform.OS !== "ios") {
    return (
      <View
        style={[
          styles.androidField,
          { borderColor: colors.border, backgroundColor: colors.input },
        ]}
      >
        <Picker
          selectedValue={value}
          onValueChange={(v) => onSelect(String(v))}
          mode="dropdown"
          dropdownIconColor={colors.textMuted}
          style={{ color: colors.text }}
          accessibilityLabel={accessibilityLabel}
        >
          {options.map((opt) => (
            <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>
    );
  }

  // iOS: field → sheet with the native wheel picker.
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          { borderColor: colors.border, backgroundColor: colors.input },
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? "Choose an option"}
      >
        <Text style={[styles.fieldText, { color: colors.text }]}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close options"
          />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {sheetTitle ?? "Choose"}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <Text style={[styles.doneText, { color: colors.text }]}>
                  Done
                </Text>
              </Pressable>
            </View>
            <Picker
              selectedValue={value}
              onValueChange={(v) => onSelect(String(v))}
              itemStyle={{ color: colors.text, fontSize: 19 }}
              accessibilityLabel={accessibilityLabel}
            >
              {options.map((opt) => (
                <Picker.Item
                  key={opt.value}
                  label={opt.label}
                  value={opt.value}
                />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  androidField: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    overflow: "hidden",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  fieldText: { fontSize: 15, fontWeight: "600" },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  sheetTitle: { fontSize: 16, fontWeight: "800" },
  doneText: { fontSize: 16, fontWeight: "700" },
});
