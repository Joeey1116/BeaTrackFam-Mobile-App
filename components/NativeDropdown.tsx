/**
 * NativeDropdown — tapping the field opens an anchored dropdown menu:
 * a frosted card the FULL WIDTH of the field, hanging right off it,
 * with a checkmark + bold label on the current choice — the same look
 * as his Shopify site's dropdown in Safari.
 *
 * Oct 4 2026 history: first shipped as @react-native-picker's wheel
 * (Joey hated it, and it threw "Unimplemented component: <RNCPicker>"
 * on his phone), then as @expo/ui's MenuView — the real OS menu, but
 * iOS draws it as a small popup hugging the left edge. Joey's call:
 * full wide, not small to the left. So the anchored menu (pure JS,
 * renders identically on iOS/Android/web, can never throw a native
 * linking error) is the dropdown everywhere.
 */
import React, { useRef, useState, type ComponentType } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import { Radius, Spacing } from "../constants/theme";

// expo-blur's native view (the menu card's frost), loaded lazily so a
// build without it falls back to the solid card instead of crashing.
let BlurView: ComponentType<any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  BlurView = require("expo-blur").BlurView ?? null;
} catch {
  BlurView = null;
}

export interface NativeDropdownOption {
  value: string;
  label: string;
}

type DropdownProps = {
  /** Currently selected option value. */
  value: string;
  options: NativeDropdownOption[];
  onSelect: (value: string) => void;
  /** Kept for call-site compatibility — the OS menu doesn't use it. */
  sheetTitle?: string;
  accessibilityLabel?: string;
};

export function NativeDropdown(props: DropdownProps) {
  // The full-width anchored menu is the dropdown on every platform —
  // see the header comment for why the small OS popup was replaced.
  return <AnchoredMenuDropdown {...props} />;
}

type FieldPos = { x: number; y: number; width: number; height: number };

/**
 * The anchored menu: a frosted card the full width of the field,
 * hanging right off it, checkmark + bold on the current choice.
 */
function AnchoredMenuDropdown({ value, options, onSelect, accessibilityLabel }: DropdownProps) {
  const { colors, isDark } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const fieldRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FieldPos | null>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  const openMenu = () => {
    if (fieldRef.current && typeof fieldRef.current.measureInWindow === "function") {
      fieldRef.current.measureInWindow((x, y, width, height) => {
        setPos({ x, y, width, height });
        setOpen(true);
      });
    } else {
      setPos(null);
      setOpen(true);
    }
  };

  const pick = (optionValue: string) => {
    setOpen(false);
    onSelect(optionValue);
  };

  // Menu geometry: same width as the field (clamped to the screen with a
  // margin), opening below the field — or above it when space runs out.
  const menuWidth = pos ? Math.min(pos.width, screenW - Spacing.md * 2) : 0;
  const menuLeft = pos
    ? Math.max(Spacing.md, Math.min(pos.x, screenW - menuWidth - Spacing.md))
    : Spacing.md;
  const maxMenuH = Math.round(screenH * 0.52);
  // Estimated natural height (rows are ~48pt) so an upward-opening menu sits
  // flush against the field instead of floating at the max-height offset.
  const contentH = Math.min(maxMenuH, options.length * 48);
  const belowTop = pos ? pos.y + pos.height + 6 : 0;
  const spaceBelow = screenH - belowTop - Spacing.md;
  const openUpward = pos !== null && spaceBelow < Math.min(maxMenuH, 220) && pos.y > maxMenuH;
  const menuTop = openUpward && pos ? Math.max(Spacing.md, pos.y - contentH - 6) : belowTop;

  return (
    <>
      <View ref={fieldRef} collapsable={false}>
        <Pressable
          onPress={openMenu}
          style={[
            styles.field,
            { borderColor: colors.border, backgroundColor: colors.input },
          ]}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: open }}
        >
          <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
            {selectedLabel}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close menu"
        >
          {pos ? (
            <View
              style={[
                styles.menuShadow,
                { left: menuLeft, top: menuTop, width: menuWidth, maxHeight: maxMenuH },
              ]}
            >
              <View
                style={[
                  styles.menuCard,
                  { borderColor: colors.border },
                  !BlurView && { backgroundColor: colors.surfaceRaised },
                ]}
              >
                {BlurView ? (
                  <BlurView
                    intensity={85}
                    tint={isDark ? "dark" : "light"}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                <ScrollView
                  bounces={false}
                  showsVerticalScrollIndicator={options.length > 8}
                >
                  {options.map((option, idx) => {
                    const selected = option.value === value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => pick(option.value)}
                        style={({ pressed }) => [
                          styles.row,
                          idx > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                          },
                          selected && { backgroundColor: colors.input },
                          pressed && { backgroundColor: colors.surface },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <View style={styles.checkSlot}>
                          {selected ? (
                            <Ionicons name="checkmark" size={18} color={colors.text} />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.rowText,
                            { color: colors.text },
                            selected && { fontWeight: "700" },
                          ]}
                          numberOfLines={2}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

const MENU_RADIUS = 22;

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 48,
  },
  fieldValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    marginRight: 8,
  },
  backdrop: { flex: 1 },
  menuShadow: {
    position: "absolute",
    borderRadius: MENU_RADIUS,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  menuCard: {
    borderRadius: MENU_RADIUS,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  checkSlot: { width: 26, alignItems: "flex-start", justifyContent: "center" },
  rowText: { flex: 1, fontSize: 16, fontWeight: "500" },
});
