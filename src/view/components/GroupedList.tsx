import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { groupedRadius } from '../theme/tokens';
import { GlassSurface } from './GlassSurface';

/**
 * Purpose: iOS Settings inset-grouped table — Halo clay card, hairline rows, optional header/footer.
 * Inputs: optional header/footer copy; optional leading header icon; row children.
 * Outputs: one raised group. Does not persist anything.
 * Side effects: none.
 * Design decisions: overflow stays visible so dual shadows are not clipped; separators are
 *   inset 16pt like UITableView grouped. ≥52pt min row height for comfortable finger taps.
 *   Headers/footers/rows use useTypography so Settings → Text size scales cleanly.
 *   Optional header icon is decorative (15pt, muted) beside the uppercase title.
 */
export function GroupedSection({
  header,
  icon,
  footer,
  children,
  style,
}: {
  header?: string;
  /** Compact Ionicons glyph beside the uppercase section title. */
  icon?: TypeIconName;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const { type } = useTypography();
  const rows = Children.toArray(children);
  const headerStyle = [
    type.footnote,
    {
      fontWeight: '400' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.4,
    },
  ];
  const footerStyle = [type.footnote, { marginTop: 8, marginHorizontal: 16 }];
  return (
    <View style={[styles.section, style]}>
      {header ? (
        <View style={styles.headerRow} accessibilityRole="header">
          {icon ? (
            <Ionicons
              name={icon}
              size={15}
              color={colors.muted}
              accessible={false}
              importantForAccessibility="no"
            />
          ) : null}
          <Text style={[headerStyle, { color: colors.muted }]}>{header}</Text>
        </View>
      ) : null}
      <GlassSurface radius={groupedRadius} style={styles.group}>
        {rows.map((child, index) => (
          <View key={isValidElement(child) && child.key != null ? String(child.key) : `row-${index}`}>
            {index > 0 ? (
              <View style={[styles.hairline, { backgroundColor: colors.line, marginLeft: 16 }]} />
            ) : null}
            {child}
          </View>
        ))}
      </GlassSurface>
      {footer ? <Text style={[footerStyle, { color: colors.faint }]}>{footer}</Text> : null}
    </View>
  );
}

interface GroupedRowProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  accessory?: ReactNode;
  leading?: ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  /** Strike-through + muted title for completed-today rows. */
  completed?: boolean;
}

/**
 * Purpose: one grouped settings / list row (≥52pt).
 * Inputs: title, optional subtitle, optional press, optional leading type icon, trailing accessory or disclosure chevron.
 * Outputs: tappable or static row. Subtitle stays footnote, not a second primary line.
 * Side effects: none.
 * Design decisions: title fontSize comes from type.headline so user font preference applies.
 */
export function GroupedRow({
  title,
  subtitle,
  onPress,
  accessory,
  leading,
  chevron,
  destructive,
  completed,
}: GroupedRowProps) {
  const colors = useThemeColors();
  const { type } = useTypography();
  const titleColor = destructive ? colors.danger : completed ? colors.faint : colors.ink;
  const inner = (
    <View style={styles.row}>
      {leading}
      <View style={styles.copy}>
        <Text
          style={[
            type.headline,
            {
              color: titleColor,
              fontSize: type.headline.fontSize,
              fontWeight: '400',
              textDecorationLine: completed ? 'line-through' : 'none',
            },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.footnote, { color: colors.muted, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {accessory}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginLeft: 16,
  },
  group: {
    paddingVertical: 2,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
});
