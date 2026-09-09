import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import type { JournalLocation } from '../../model/journal/JournalEntry';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';

interface LocationFieldProps {
  value?: JournalLocation;
  onChange: (next: JournalLocation | undefined) => void;
}

/**
 * Purpose: optional place on a journal page using GPS + reverse geocode on device.
 * Inputs: current location and change handler.
 * Outputs: Use current place / clear actions plus the place name.
 * Side effects: location permission and expo-location read.
 * Design decisions: lives in .native.tsx so web Metro never loads expo-location.
 */
export function LocationField({ value, onChange }: LocationFieldProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('location.locationNeededTitle'), t('location.locationNeededBody'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const place = places[0];
      const name = [place?.name, place?.city, place?.region].filter(Boolean).join(', ') || t('location.place');
      onChange({
        name,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      Alert.alert(t('location.locationErrorTitle'), t('location.locationErrorBody'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.faint }]}>{t('location.place')}</Text>
      {value ? (
        <Text style={[styles.name, { color: colors.ink }]}>{value.name}</Text>
      ) : (
        <Text style={[styles.name, { color: colors.muted }]}>{t('location.noPlace')}</Text>
      )}
      <View style={styles.row}>
        <Pressable
          onPress={() => void capture()}
          disabled={busy}
          style={[raisedSurface(colors, 16), styles.action]}
        >
          <Text style={[styles.actionLabel, { color: colors.ink }]}>
            {busy ? t('location.finding') : t('location.useCurrent')}
          </Text>
        </Pressable>
        {value ? (
          <Pressable onPress={() => onChange(undefined)} style={[raisedSurface(colors, 16), styles.action]}>
            <Text style={[styles.actionLabel, { color: colors.danger }]}>{t('location.clear')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  heading: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  name: { fontFamily: fonts.body, fontSize: 15 },
  row: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 44, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center' },
});
