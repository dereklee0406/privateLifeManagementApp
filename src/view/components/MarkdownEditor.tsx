import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppConfig } from '../../config/appConfig';
import { applyMarkdownList, applyMarkdownWrap } from '../../model/journal/markdown';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';

interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

/**
 * Purpose: cross-platform markdown editor with bold, italic, and list shortcuts.
 * Inputs: body string and change handler.
 * Outputs: icon toolbar + multiline TextInput. Persists markdown, not HTML.
 * Side effects: none besides onChange.
 * Design decisions: no native-only rich-text package; B/I stay letter glyphs (no Ionicons format-*);
 *   list uses list-outline; tools are ≥44pt for thumb reach.
 */
export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const [selection, setSelection] = useState({ start: value.length, end: value.length });

  const applyWrap = (before: string, after: string) => {
    const result = applyMarkdownWrap(value, selection, before, after);
    onChange(result.text);
    setSelection(result.selection);
  };

  const applyList = () => {
    const result = applyMarkdownList(value, selection);
    onChange(result.text);
    setSelection(result.selection);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => applyWrap('**', '**')}
          style={[raisedSurface(colors, 12), styles.tool]}
          accessibilityRole="button"
          accessibilityLabel={t('compose.bold')}
        >
          <Text style={[styles.toolBold, { color: colors.ink }]} accessible={false}>
            B
          </Text>
        </Pressable>
        <Pressable
          onPress={() => applyWrap('*', '*')}
          style={[raisedSurface(colors, 12), styles.tool]}
          accessibilityRole="button"
          accessibilityLabel={t('compose.italic')}
        >
          <Text style={[styles.toolItalic, { color: colors.ink }]} accessible={false}>
            I
          </Text>
        </Pressable>
        <Pressable
          onPress={applyList}
          style={[raisedSurface(colors, 12), styles.tool]}
          accessibilityRole="button"
          accessibilityLabel={t('compose.list')}
        >
          <Ionicons name="list-outline" size={20} color={colors.ink} accessible={false} importantForAccessibility="no" />
        </Pressable>
        <Text style={[styles.hint, { color: colors.faint }]}>{t('compose.markdown')}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        maxLength={AppConfig.writing.maxBodyLength}
        multiline
        textAlignVertical="top"
        onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
        style={[insetSurface(colors, 22), styles.body, { color: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  tool: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toolBold: {
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    fontWeight: '700',
  },
  toolItalic: {
    fontFamily: fonts.body,
    fontSize: 18,
    fontStyle: 'italic',
  },
  hint: {
    marginLeft: 'auto',
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 28,
    minHeight: 220,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
