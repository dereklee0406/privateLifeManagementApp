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
import * as ImagePicker from 'expo-image-picker';
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
  /** Capture with the camera and OCR into `onOcrText`. */
  takePhotoAndScan: () => Promise<void>;
}

/**
 * Purpose: attach photos from camera/library on Android and iOS, with optional on-device OCR.
 * Inputs: URI list, change handler, optional OCR callback.
 * Outputs: thumbnail strip, Take photo / Take photo & scan / Library; imperative `takePhotoAndScan`.
 * Side effects: camera + library permissions; ImagePicker; OCR via `scanReceiptFromImage`.
 * Design decisions: expo-image-picker stays in this .native.tsx file so web Metro never loads it.
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
          // Expo Go / WASM gaps: fail closed without crashing the form.
        } finally {
          setIsScanning(false);
        }
      },
      [onOcrText, t],
    );

    const captureFromCamera = useCallback(async (): Promise<string | undefined> => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('compose.cameraNeededTitle'), t('compose.cameraNeededBody'));
        return undefined;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]?.uri) {
        return undefined;
      }
      return result.assets[0].uri;
    }, [t]);

    const takePhoto = async () => {
      if (!canAdd) {
        return;
      }
      void hapticLight();
      const uri = await captureFromCamera();
      if (uri) {
        onChange([...urisRef.current, uri]);
      }
    };

    const takePhotoAndScan = useCallback(async () => {
      if (!canAdd || !onOcrText) {
        return;
      }
      void hapticLight();
      const uri = await captureFromCamera();
      if (!uri) {
        return;
      }
      onChange([...urisRef.current, uri]);
      await runOcr(uri);
    }, [canAdd, captureFromCamera, onChange, onOcrText, runOcr]);

    useImperativeHandle(ref, () => ({ takePhotoAndScan }), [takePhotoAndScan]);

    const chooseFromLibrary = async () => {
      if (!canAdd) {
        return;
      }
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('compose.photosNeededTitle'), t('compose.photosNeededBody'));
        return;
      }
      void hapticLight();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        onChange([...urisRef.current, result.assets[0].uri]);
      }
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
            onPress={() => void takePhoto()}
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
            onPress={() => void chooseFromLibrary()}
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
    minWidth: '30%',
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center' },
});
