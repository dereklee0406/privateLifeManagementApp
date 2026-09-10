import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROMPT_PACKS, promptsInPack, type PromptId, type PromptPack } from '../../model/journal/prompts';
import { hapticLight } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';
import { SheetChrome, sheetTopRadius } from './SheetChrome';

const PACK_TITLE: Record<PromptPack, 'prompts.packToday' | 'prompts.packGratitude' | 'prompts.packReview' | 'prompts.packFocus'> = {
  today: 'prompts.packToday',
  gratitude: 'prompts.packGratitude',
  review: 'prompts.packReview',
  focus: 'prompts.packFocus',
};

/**
 * Purpose: Journal / Compose prompt picker — grouped packs, tap fills Compose.
 * Inputs: visible; onClose; onPick with localized prompt text.
 * Outputs: bottom sheet list.
 * Side effects: hapticLight on pick; onPick then onClose. No new tab.
 * Design decisions: field-notebook packs only. Strings from i18n. Keep date rotation elsewhere.
 */
export function PromptLibrarySheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (prompt: string, id: PromptId) => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const topRadius = sheetTopRadius();

  const pick = (id: PromptId) => {
    void hapticLight();
    onPick(t(`prompts.${id}`), id);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
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
              paddingBottom: insets.bottom + 12,
            },
          ]}
          accessibilityViewIsModal
        >
          <SheetChrome>
            <Text style={[styles.title, { color: colors.ink }]}>{t('prompts.library')}</Text>
            <Text style={[styles.lede, { color: colors.muted }]}>{t('prompts.libraryLede')}</Text>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {PROMPT_PACKS.map((pack) => (
                <View key={pack} style={styles.pack}>
                  <Text style={[styles.packTitle, { color: colors.accent }]}>{t(PACK_TITLE[pack])}</Text>
                  {promptsInPack(pack).map((id) => (
                    <Pressable
                      key={id}
                      onPress={() => pick(id)}
                      accessibilityRole="button"
                      accessibilityLabel={t('prompts.pickA11y', { prompt: t(`prompts.${id}`) })}
                      style={({ pressed }) => [
                        raisedSurface(colors, 16),
                        styles.row,
                        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                      ]}
                    >
                      <Text style={[styles.rowText, { color: colors.ink }]}>{t(`prompts.${id}`)}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
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
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '82%',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 32,
    marginTop: 4,
  },
  lede: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
    marginBottom: 12,
  },
  list: {
    maxHeight: 480,
  },
  listContent: {
    gap: 16,
    paddingBottom: 12,
  },
  pack: {
    gap: 8,
  },
  packTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  row: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  rowText: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
  },
});
