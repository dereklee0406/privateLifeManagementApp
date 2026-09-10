import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appHref } from '../../utils/navigation';
import { hapticLight } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';
import { SheetChrome, sheetTopRadius } from './SheetChrome';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type CaptureActionId = 'write' | 'spend' | 'habit' | 'transfer';

interface CaptureAction {
  id: CaptureActionId;
  icon: IoniconName;
  titleKey: 'capture.write' | 'capture.spend' | 'capture.habit' | 'capture.transfer';
  descKey:
    | 'capture.writeDesc'
    | 'capture.spendDesc'
    | 'capture.habitDesc'
    | 'capture.transferDesc';
}

const ACTIONS: CaptureAction[] = [
  {
    id: 'write',
    icon: 'create-outline',
    titleKey: 'capture.write',
    descKey: 'capture.writeDesc',
  },
  {
    id: 'spend',
    icon: 'wallet-outline',
    titleKey: 'capture.spend',
    descKey: 'capture.spendDesc',
  },
  {
    id: 'habit',
    icon: 'checkbox-outline',
    titleKey: 'capture.habit',
    descKey: 'capture.habitDesc',
  },
  {
    id: 'transfer',
    icon: 'swap-horizontal-outline',
    titleKey: 'capture.transfer',
    descKey: 'capture.transferDesc',
  },
];

interface GlobalFastCaptureSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Parent closes this sheet then opens QuickSpendSheet for seamless handoff. */
  onSelectSpend: () => void;
}

/**
 * Purpose: universal Fast Capture hub — four contextual creation paths from Today FAB.
 * Inputs: visible + onClose; onSelectSpend for Quick Spend handoff (parent owns QuickSpendSheet).
 * Outputs: modal bottom sheet with neumorphic 2×2 action tiles.
 * Side effects: hapticLight on tile press; router.push for write / habit / transfer; onSelectSpend for spend.
 * Design decisions: SheetChrome grabber for iOS page-sheet feel; spend stays in-sheet layer
 *   (no route) so Money’s QuickSpendSheet pattern is reused; tiles use raisedSurface + scale 0.97.
 */
export function GlobalFastCaptureSheet({
  visible,
  onClose,
  onSelectSpend,
}: GlobalFastCaptureSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const topRadius = sheetTopRadius();

  const onAction = (id: CaptureActionId) => {
    void hapticLight();
    if (id === 'spend') {
      onSelectSpend();
      return;
    }
    onClose();
    if (id === 'write') {
      router.push('/compose?mode=text');
      return;
    }
    if (id === 'habit') {
      router.push(appHref('/reminders/new'));
      return;
    }
    router.push('/transfer/new');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.paper,
              borderColor: colors.glassBorder,
              borderTopLeftRadius: Math.max(topRadius, 24),
              borderTopRightRadius: Math.max(topRadius, 24),
              paddingBottom: insets.bottom + 20,
            },
          ]}
          accessibilityViewIsModal
        >
          <SheetChrome>
            <View style={styles.headRow}>
              <View style={styles.headCopy}>
                <Text style={[styles.title, { color: colors.ink }]}>{t('capture.title')}</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={2}>
                  {t('capture.subtitle')}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={({ pressed }) => [
                  insetSurface(colors, 16),
                  styles.closeHit,
                  {
                    opacity: pressed ? 0.75 : 1,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  },
                ]}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={colors.muted}
                  accessible={false}
                  importantForAccessibility="no"
                />
              </Pressable>
            </View>

            <View style={styles.grid}>
              {ACTIONS.map((action) => (
                <Pressable
                  key={action.id}
                  onPress={() => onAction(action.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(action.titleKey)}. ${t(action.descKey)}`}
                  style={({ pressed }) => [
                    raisedSurface(colors, 20),
                    styles.tile,
                    {
                      backgroundColor: action.id === 'write' ? colors.accentSoft : colors.paper,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconWell,
                      {
                        backgroundColor:
                          action.id === 'write' ? colors.paper : colors.accentSoft,
                      },
                    ]}
                  >
                    <Ionicons
                      name={action.icon}
                      size={22}
                      color={colors.accent}
                      accessible={false}
                      importantForAccessibility="no"
                    />
                  </View>
                  <Text style={[styles.tileTitle, { color: colors.ink }]} numberOfLines={2}>
                    {t(action.titleKey)}
                  </Text>
                  <Text style={[styles.tileDesc, { color: colors.muted }]} numberOfLines={3}>
                    {t(action.descKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SheetChrome>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  sheet: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 4,
    paddingBottom: 16,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
  closeHit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    minWidth: '42%',
    minHeight: 148,
    padding: 16,
    gap: 10,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 21,
  },
  tileDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
});
