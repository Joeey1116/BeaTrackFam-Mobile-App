/**
 * SelectDropdown — a dropdown field + bottom-sheet option list.
 *
 * Used where a horizontal chip row would overflow (long variant option
 * lists on the product screen) and for settings pickers (Appearance).
 * Pure theme tokens, no native deps.
 */
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import { Radius, Spacing } from "../constants/theme";

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectSheet({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title?: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close options"
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {title ? (
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {title}
            </Text>
          ) : null}
          <ScrollView style={styles.sheetList}>
            {options.map((opt) => {
              const selected = opt.value === selectedValue;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.sheetRow,
                    {
                      backgroundColor: pressed
                        ? colors.surfaceRaised
                        : "transparent",
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.sheetRowText,
                      {
                        color: colors.text,
                        fontWeight: selected ? "800" : "600",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark" size={20} color={colors.text} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            onPress={onClose}
            style={[styles.cancelRow, { borderTopColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function SelectDropdown({
  value,
  options,
  onSelect,
  sheetTitle,
  accessibilityLabel,
}: {
  /** Currently selected option value ("" when nothing chosen). */
  value: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  sheetTitle?: string;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? value;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? "Choose an option"}
      >
        <Text style={[styles.fieldText, { color: colors.text }]}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      <SelectSheet
        visible={open}
        title={sheetTitle}
        options={options}
        selectedValue={value}
        onSelect={onSelect}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: "70%",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sheetList: { flexGrow: 0 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
  },
  sheetRowText: { fontSize: 16 },
  cancelRow: {
    borderTopWidth: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  cancelText: { fontSize: 15, fontWeight: "700" },
});
