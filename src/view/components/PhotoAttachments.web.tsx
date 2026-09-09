import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppConfig } from '../../config/appConfig';
import { scanReceiptFromImage } from '../../model/ocr/ocrEngine';
import type { OcrReceiptResult } from '../../model/ocr/receiptOcr';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { JournalMediaImage } from './JournalMediaImage';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';

export interface PhotoAttachmentsProps {
  uris: string[];
  onChange: (uris: string[]) => void;
  /** When set, enables Take photo & scan + per-thumb scan actions. */
  onOcrText?: (text: string, parsed: OcrReceiptResult) => void;
}

export interface PhotoAttachmentsHandle {
  /** Capture with the camera (or environment capture on web) and OCR into `onOcrText`. */
  takePhotoAndScan: () => Promise<void>;
}

/**
 * Purpose: web photo attachments with real camera capture + optional on-device OCR.
 * Inputs: URI list, change handler, optional OCR callback.
 * Outputs: library picker, environment camera input, scan actions; imperative `takePhotoAndScan`.
 * Side effects: creates blob URLs; runs tesseract via `scanReceiptFromImage` when OCR is requested.
 * Design decisions: `capture="environment"` unlocks phone browser cameras; never imports expo-image-picker.
 */
export const PhotoAttachments = forwardRef<PhotoAttachmentsHandle, PhotoAttachmentsProps>(
  function PhotoAttachments({ uris, onChange, onOcrText }, ref) {
    const colors = useThemeColors();
    const { t } = useI18n();
    const canAdd = uris.length < AppConfig.writing.maxPhotos;
    const [isScanning, setIsScanning] = useState(false);
    const urisRef = useRef(uris);
    urisRef.current = uris;

    const runOcr = useCallback(
      async (uri: string) => {
        if (!onOcrText) {
          return;
        }
        setIsScanning(true);
        try {
          const parsed = await scanReceiptFromImage(uri);
          const text = parsed.cleanDescription.trim() || parsed.rawText.trim();
          if (!text) {
            return;
          }
          onOcrText(parsed.cleanDescription.trim() || text, parsed);
          void hapticSuccess();
          Alert.alert(t('compose.scannedSuccess'));
        } catch {
          // Browser OCR failures: fail closed without crashing the form.
        } finally {
          setIsScanning(false);
        }
      },
      [onOcrText, t],
    );

    const pickFile = useCallback(
      (opts: { capture?: boolean; andScan?: boolean }) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (opts.capture) {
          input.setAttribute('capture', 'environment');
        }
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) {
            return;
          }
          const uri = URL.createObjectURL(file);
          const next = [...urisRef.current, uri];
          onChange(next);
          if (opts.andScan) {
            void runOcr(uri);
          }
        };
        input.click();
      },
      [onChange, runOcr],
    );

    const takePhoto = useCallback(() => {
      if (!canAdd) {
        return;
      }
      void hapticLight();
      pickFile({ capture: true });
    }, [canAdd, pickFile]);

    const takePhotoAndScan = useCallback(async () => {
      if (!canAdd || !onOcrText) {
        return;
      }
      void hapticLight();
      pickFile({ capture: true, andScan: true });
    }, [canAdd, onOcrText, pickFile]);

    useImperativeHandle(ref, () => ({ takePhotoAndScan }), [takePhotoAndScan]);

    const chooseFromLibrary = () => {
      if (!canAdd) {
        return;
      }
      void hapticLight();
      pickFile({});
    };

    return (
      <View style={styles.wrap}>
        <Text style={[styles.heading, { color: colors.faint }]}>{t('compose.photo')}</Text>
        {uris.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {uris.map((uri) => (
              <View key={uri} style={styles.thumbWrap}>
                <JournalMediaImage uri={uri} style={styles.thumb} thumbnail />
                <Pressable
                  onPress={() => onChange(uris.filter((item) => item !== uri))}
                  style={[styles.remove, { backgroundColor: colors.paper }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('compose.removePhoto')}
                >
                  <Ionicons name="close" size={14} color={colors.danger} accessible={false} importantForAccessibility="no" />
                </Pressable>
                {onOcrText ? (
                  <Pressable
                    onPress={() => void runOcr(uri)}
                    disabled={isScanning}
                    style={[styles.scanThumb, { backgroundColor: colors.paper }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('compose.scanPhoto')}
                  >
                    {isScanning ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Ionicons name="scan-outline" size={14} color={colors.accent} accessible={false} importantForAccessibility="no" />
                    )}
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            onPress={takePhoto}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityLabel={t('compose.takePhoto')}
            style={[raisedSurface(colors, 16), styles.action, { opacity: canAdd ? 1 : 0.4 }]}
          >
            <Ionicons name="camera-outline" size={20} color={colors.ink} accessible={false} importantForAccessibility="no" />
            <Text style={[styles.actionLabel, { color: colors.ink }]}>{t('compose.takePhoto')}</Text>
          </Pressable>
          {onOcrText ? (
            <Pressable
              onPress={() => void takePhotoAndScan()}
              disabled={!canAdd || isScanning}
              accessibilityRole="button"
              accessibilityLabel={t('compose.takePhotoScan')}
              style={[
                raisedSurface(colors, 16),
                styles.action,
                { opacity: canAdd && !isScanning ? 1 : 0.4 },
              ]}
            >
              {isScanning ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons name="scan-outline" size={20} color={colors.ink} accessible={false} importantForAccessibility="no" />
              )}
              <Text style={[styles.actionLabel, { color: colors.ink }]}>
                {isScanning ? t('compose.scanningText') : t('compose.takePhotoScan')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={chooseFromLibrary}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityLabel={t('compose.chooseLibrary')}
            style={[raisedSurface(colors, 16), styles.action, { opacity: canAdd ? 1 : 0.4 }]}
          >
            <Ionicons name="images-outline" size={20} color={colors.ink} accessible={false} importantForAccessibility="no" />
            <Text style={[styles.actionLabel, { color: colors.ink }]}>{t('compose.chooseLibrary')}</Text>
          </Pressable>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  heading: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  strip: { gap: 10 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 88, height: 88, borderRadius: 16 },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanThumb: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  action: {
    flexGrow: 1,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center' },
});
