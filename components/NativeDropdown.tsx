/**
 * NativeDropdown — tapping the field opens the BUILT-IN OS dropdown
 * menu: Apple's own popup on iOS (the frosted Liquid Glass list with a
 * checkmark on the current choice — the same control his Shopify site
 * uses in Safari) and the Material dropdown on Android.
 *
 * Implemented with MenuView from @expo/ui (first-party Expo UI). The
 * trigger is our usual bordered field; the menu itself is drawn 100%
 * by the operating system.
 *
 * Two fallbacks keep this from ever being the problem again:
 * - Web (previews): the anchored JS menu below.
 * - If the @expo/ui native view somehow isn't in a build, the error
 *   boundary swaps in that same JS menu instead of showing a red
 *   "Unimplemented component" banner. (Oct 4 2026: the old
 *   @react-native-picker wheel threw exactly that on Joey's phone.)
 */
import React, { useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MenuView } from "@expo/ui/community/menu";
import { useTheme } from "./ThemeProvider";
import { Radius, Spacing } from "../constants/theme";

// expo-blur's native view (for the web/fallback menu's frost), loaded
// lazily so a build without it falls back to the solid card instead
// of crashing (same pattern as the tab bar).
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

/**
 * If the native menu view throws while rendering (its native module
 * isn't in the running build), quietly swap in the JS menu — never a
 * red error banner.
 */
class MenuBoundary extends React.Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Native menu unavailable in this build — JS menu takes over.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function NativeDropdown(props: DropdownProps) {
  const { value, options, onSelect, sheetTitle, accessibilityLabel } = props;
  const { colors } = useTheme();

  const jsMenu = <AnchoredMenuDropdown {...props} />;

  // Web has no OS menu — use the anchored JS menu there (also what the
  // web preview shows).
  if (Platform.OS === "web") {
    return jsMenu;
  }

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <MenuBoundary fallback={jsMenu}>
      <MenuView
        style={{ alignSelf: "stretch" }}
        title={sheetTitle}
        actions={options.map((option) => ({
          id: option.value,
          title: option.label,
          state: option.value === value ? "on" : "off",
        }))}
        onPressAction={({ nativeEvent }) => {
          if (nativeEvent.event && nativeEvent.event !== value) {
            onSelect(nativeEvent.event);
          }
        }}
      >
        <View
          style={[
            styles.field,
            { borderColor: colors.border, backgroundColor: colors.input },
          ]}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: selectedLabel }}
          accessibilityHint="Opens a menu of choices"
        >
          <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
            {selectedLabel}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </View>
      </MenuView>
    </MenuBoundary>
  );
}

type FieldPos = { x: number; y: number; width: number; height: number };

/**
 * The anchored JS menu (frosted card, checkmark + bold on the current
 * choice). Used on web and as the emergency fallback if the native
 * menu view is ever unavailable in a build.
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
