import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../controller/FinanceProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  formatFriendlyMoney,
  formatMoney,
  resolveExpenseCategories,
} from '../../model/finance/Expense';
import {
  calculateSplitRemaining,
  createDefaultSplit,
  isSplitDraftValid,
  recalculateEqualShares,
  summarizeSplit,
  type ExpenseSplit,
  type ExpenseSplitDraft,
  type ExpenseSplitMode,
  type ExpenseSplitShare,
} from '../../model/finance/ExpenseSplit';
import { createId } from '../../utils/idUtils';
import { leaveScreen } from '../../utils/navigation';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { BackButton } from '../components/BackButton';
import { Chip } from '../components/Chip';
import { FormCard, FormCardGroup } from '../components/FormCardGroup';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SectionActionButton } from '../components/SectionActionButton';
import { iconForExpenseCategory, expenseCategoryLabel, TYPE_ICON_SIZE } from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts, insetSurface } from '../theme/tokens';

const CENT_EPS = 0.005;

/**
 * Purpose: split an existing spend among friends/family and track settlements.
 * Inputs: route `id` = expenseId; finance splits + expenses; i18n + typography.
 * Outputs: FormCardGroup sheet — equal/custom allocation, participants, settlement toggles.
 * Side effects: saveSplit / deleteSplit via FinanceProvider; leaves screen on success.
 * Design decisions: all money math stays in ExpenseSplit helpers; View only wires UI state.
 *   First share is always "Me" (payer) — not removable; settlement UI excludes Me.
 */
export function ExpenseSplitScreen() {
  const { id: routeId } = useLocalSearchParams<{ id?: string }>();
  const expenseId = typeof routeId === 'string' ? routeId : undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const colors = useThemeColors();
  const { type, scaleFontSize } = useTypography();
  const { settings } = useSettings();
  const {
    ready,
    expenses,
    splitsByExpenseId,
    saveSplit,
    deleteSplit,
  } = useFinance();

  const expenseCatalog = useMemo(() => resolveExpenseCategories(settings), [settings]);
  const expense = expenseId ? expenses.find((item) => item.id === expenseId) : undefined;
  const existingSplit = expenseId ? splitsByExpenseId.get(expenseId) : undefined;

  const [draft, setDraft] = useState<ExpenseSplitDraft | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  useEffect(() => {
    if (!ready || !expense || seeded) {
      return;
    }
    if (existingSplit) {
      setDraft({
        id: existingSplit.id,
        expenseId: existingSplit.expenseId,
        totalAmount: existingSplit.totalAmount,
        currency: existingSplit.currency,
        splitMode: existingSplit.splitMode,
        shares: existingSplit.shares.map((share) => ({ ...share })),
      });
    } else {
      setDraft(
        createDefaultSplit(expense.id, expense.amount, expense.currency, [
          t('split.me'),
          t('split.personDefault', { number: 2 }),
        ]),
      );
    }
    setSeeded(true);
  }, [ready, expense, existingSplit, seeded, t]);

  const sectionLabelStyle = [
    styles.sectionLabel,
    type.footnote,
    { color: colors.muted, fontSize: scaleFontSize(13) },
  ];
  const metaStyle = [styles.meta, type.footnote, { color: colors.muted, fontSize: scaleFontSize(14) }];
  const bodyStyle = [
    styles.body,
    {
      color: colors.ink,
      fontSize: scaleFontSize(16),
      lineHeight: Math.round(scaleFontSize(16) * 1.35),
    },
  ];
  const amountInputSize = scaleFontSize(16);

  const remaining = draft ? calculateSplitRemaining(draft.totalAmount, draft.shares) : 0;
  const canSave = Boolean(draft && isSplitDraftValid(draft) && !saving);

  const summary = useMemo(() => {
    if (!draft) {
      return null;
    }
    const asSplit: ExpenseSplit = {
      id: draft.id ?? 'draft',
      expenseId: draft.expenseId,
      totalAmount: draft.totalAmount,
      currency: draft.currency,
      splitMode: draft.splitMode,
      shares: draft.shares,
      createdAt: '',
      updatedAt: '',
    };
    const base = summarizeSplit(asSplit);
    const collected = Math.round(
      (draft.shares.filter((share) => share.isSettled).reduce((sum, share) => sum + share.amount, 0) +
        Number.EPSILON) *
        100,
    ) / 100;
    return { ...base, collected };
  }, [draft]);

  const setMode = (mode: ExpenseSplitMode) => {
    if (!draft || draft.splitMode === mode) {
      return;
    }
    void hapticLight();
    setDraft({
      ...draft,
      splitMode: mode,
      shares: mode === 'equal' ? recalculateEqualShares(draft.totalAmount, draft.shares) : draft.shares,
    });
  };

  const updateShareName = (shareId: string, name: string) => {
    if (!draft) {
      return;
    }
    setDraft({
      ...draft,
      shares: draft.shares.map((share) => (share.id === shareId ? { ...share, name } : share)),
    });
  };

  const updateShareAmount = (shareId: string, amount: number) => {
    if (!draft || draft.splitMode !== 'custom') {
      return;
    }
    setDraft({
      ...draft,
      shares: draft.shares.map((share) =>
        share.id === shareId ? { ...share, amount: Number.isFinite(amount) ? Math.max(0, amount) : 0 } : share,
      ),
    });
  };

  const removeShare = (shareId: string) => {
    if (!draft || draft.shares.length <= 2) {
      return;
    }
    const index = draft.shares.findIndex((share) => share.id === shareId);
    if (index <= 0) {
      return;
    }
    void hapticLight();
    const nextShares = draft.shares.filter((share) => share.id !== shareId);
    setDraft({
      ...draft,
      shares:
        draft.splitMode === 'equal' ? recalculateEqualShares(draft.totalAmount, nextShares) : nextShares,
    });
  };

  const addPerson = () => {
    if (!draft) {
      return;
    }
    const name = newPersonName.trim() || t('split.personDefault', { number: draft.shares.length + 1 });
    const nextShare: ExpenseSplitShare = {
      id: createId(),
      name,
      amount: 0,
      isSettled: false,
    };
    const nextShares = [...draft.shares, nextShare];
    void hapticLight();
    setDraft({
      ...draft,
      shares:
        draft.splitMode === 'equal' ? recalculateEqualShares(draft.totalAmount, nextShares) : nextShares,
    });
    setNewPersonName('');
    setAddingPerson(false);
  };

  const toggleSettled = (shareId: string) => {
    if (!draft) {
      return;
    }
    const index = draft.shares.findIndex((share) => share.id === shareId);
    if (index <= 0) {
      return;
    }
    void hapticLight();
    setDraft({
      ...draft,
      shares: draft.shares.map((share) => {
        if (share.id !== shareId) {
          return share;
        }
        const nextSettled = !share.isSettled;
        return {
          ...share,
          isSettled: nextSettled,
          settledAt: nextSettled ? new Date().toISOString() : undefined,
        };
      }),
    });
  };

  const onSave = async () => {
    if (!draft || !canSave) {
      return;
    }
    setSaving(true);
    try {
      await saveSplit(draft);
      await hapticSuccess();
      leaveScreen(router);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!existingSplit) {
      return;
    }
    const run = () => {
      void deleteSplit(existingSplit.id).then(() => leaveScreen(router));
    };
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        window.confirm(`${t('split.deleteConfirmTitle')} ${t('split.deleteConfirmBody')}`)
      ) {
        run();
      }
      return;
    }
    Alert.alert(t('split.deleteConfirmTitle'), t('split.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('split.deleteSplit'), style: 'destructive', onPress: run },
    ]);
  };

  if (!ready || (expenseId && !expense && ready)) {
    return (
      <ScreenScaffold>
        <View style={[styles.missing, { paddingTop: insets.top + 24 }]}>
          <BackButton />
          {!expense && ready ? (
            <Text style={[styles.missingText, type.title1, { color: colors.muted }]}>{t('spend.missing')}</Text>
          ) : null}
        </View>
      </ScreenScaffold>
    );
  }

  if (!expense || !draft) {
    return (
      <ScreenScaffold>
        <View style={[styles.missing, { paddingTop: insets.top + 24 }]}>
          <BackButton />
        </View>
      </ScreenScaffold>
    );
  }

  const categoryIcon = iconForExpenseCategory(expense.category, expenseCatalog);
  const categoryLabel = expenseCategoryLabel(t, expense.category, expenseCatalog);
  const balanceAlert =
    draft.splitMode === 'custom' && Math.abs(remaining) >= CENT_EPS
      ? remaining > 0
        ? t('split.remaining', { amount: formatFriendlyMoney(remaining, draft.currency) })
        : t('split.overAllocated', { amount: formatFriendlyMoney(Math.abs(remaining), draft.currency) })
      : null;

  return (
    <FormCardGroup
      title={t('split.title')}
      stickyButtonLabel={saving ? t('common.saving') : t('split.saveSplit')}
      stickyButtonIcon="people-outline"
      onStickyButtonPress={() => void onSave()}
      stickyButtonDisabled={!canSave}
      stickyButtonBusy={saving}
    >
      {/* Card 1: Expense Summary Hero */}
      <FormCard>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: colors.paper, borderColor: colors.line }]}>
            <Ionicons name={categoryIcon} size={TYPE_ICON_SIZE} color={colors.accent} />
          </View>
          <View style={styles.heroCopy}>
            <Text
              style={[
                styles.heroAmount,
                {
                  color: colors.ink,
                  fontSize: scaleFontSize(28),
                  lineHeight: Math.round(scaleFontSize(28) * 1.15),
                },
              ]}
            >
              {formatMoney(expense.amount, expense.currency)}
            </Text>
            <Text style={metaStyle}>
              {categoryLabel} · {expense.dayKey}
            </Text>
            {expense.note ? (
              <Text style={[metaStyle, { color: colors.faint }]} numberOfLines={2}>
                {expense.note}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={sectionLabelStyle}>{t('split.paidByYou')}</Text>
        <View style={styles.wrap}>
          <Chip
            label={t('split.equalMode')}
            selected={draft.splitMode === 'equal'}
            onPress={() => setMode('equal')}
          />
          <Chip
            label={t('split.customMode')}
            selected={draft.splitMode === 'custom'}
            onPress={() => setMode('custom')}
          />
        </View>
      </FormCard>

      {/* Card 2: Participants & Allocation */}
      <FormCard>
        <Text style={sectionLabelStyle}>{t('split.participants')}</Text>
        {draft.shares.map((share, index) => {
          const isMe = index === 0;
          return (
            <View key={share.id} style={[insetSurface(colors, 16), styles.shareRow]}>
              <View style={styles.shareMain}>
                {isMe ? (
                  <Text style={bodyStyle}>{t('split.me')}</Text>
                ) : (
                  <TextInput
                    value={share.name}
                    onChangeText={(name) => updateShareName(share.id, name)}
                    placeholder={t('split.personName')}
                    placeholderTextColor={colors.faint}
                    style={[
                      styles.nameInput,
                      {
                        color: colors.ink,
                        fontSize: amountInputSize,
                        lineHeight: Math.round(amountInputSize * 1.35),
                      },
                    ]}
                    returnKeyType="done"
                    blurOnSubmit
                  />
                )}
                {draft.splitMode === 'equal' ? (
                  <Text style={[bodyStyle, styles.shareAmount]}>
                    {formatFriendlyMoney(share.amount, draft.currency)}
                  </Text>
                ) : (
                  <TextInput
                    value={share.amount === 0 ? '' : String(share.amount)}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9.]/g, '');
                      const parsed = cleaned === '' ? 0 : Number.parseFloat(cleaned);
                      updateShareAmount(share.id, parsed);
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.faint}
                    keyboardType="decimal-pad"
                    style={[
                      styles.amountInput,
                      {
                        color: colors.ink,
                        borderColor: colors.line,
                        fontSize: amountInputSize,
                        lineHeight: Math.round(amountInputSize * 1.35),
                      },
                    ]}
                    returnKeyType="done"
                    blurOnSubmit
                  />
                )}
              </View>
              {!isMe && draft.shares.length > 2 ? (
                <Pressable
                  onPress={() => removeShare(share.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  hitSlop={8}
                  style={styles.removeHit}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          );
        })}

        {addingPerson ? (
          <View style={[insetSurface(colors, 16), styles.addRow]}>
            <TextInput
              value={newPersonName}
              onChangeText={setNewPersonName}
              placeholder={t('split.personName')}
              placeholderTextColor={colors.faint}
              autoFocus
              style={[
                styles.nameInput,
                {
                  color: colors.ink,
                  fontSize: amountInputSize,
                  lineHeight: Math.round(amountInputSize * 1.35),
                  flex: 1,
                },
              ]}
              returnKeyType="done"
              onSubmitEditing={addPerson}
              blurOnSubmit
            />
            <Chip label={t('common.add')} selected onPress={addPerson} />
            <Chip
              label={t('common.cancel')}
              selected={false}
              onPress={() => {
                setAddingPerson(false);
                setNewPersonName('');
              }}
            />
          </View>
        ) : (
          <Chip
            leadingIcon="person-add-outline"
            label={t('split.addPerson')}
            selected={false}
            onPress={() => setAddingPerson(true)}
          />
        )}

        {balanceAlert ? (
          <Text
            style={[
              styles.balanceAlert,
              {
                color: remaining < 0 ? colors.danger : colors.accent,
                fontSize: scaleFontSize(14),
                lineHeight: Math.round(scaleFontSize(14) * 1.35),
              },
            ]}
          >
            {balanceAlert}
          </Text>
        ) : null}
      </FormCard>

      {/* Card 3: Settlement Tracker */}
      <FormCard>
        <Text style={sectionLabelStyle}>{t('split.settlementStatus')}</Text>
        {summary ? (
          <View style={[insetSurface(colors, 16), styles.summaryBanner]}>
            <Text
              style={[
                styles.summaryText,
                {
                  color: summary.allSettled ? colors.accent : colors.ink,
                  fontSize: scaleFontSize(14),
                  lineHeight: Math.round(scaleFontSize(14) * 1.4),
                },
              ]}
            >
              {summary.allSettled
                ? t('split.allSettled')
                : t('split.summary', {
                    settled: summary.settledCount,
                    total: summary.totalCount,
                    collected: formatFriendlyMoney(summary.collected, draft.currency),
                    pending: formatFriendlyMoney(summary.pendingAmount, draft.currency),
                  })}
            </Text>
          </View>
        ) : null}

        {draft.shares.slice(1).map((share) => (
          <View key={share.id} style={styles.settleRow}>
            <View style={styles.settleCopy}>
              <Text style={bodyStyle} numberOfLines={1}>
                {share.name.trim() || t('split.personName')}
              </Text>
              <Text style={metaStyle}>{formatFriendlyMoney(share.amount, draft.currency)}</Text>
            </View>
            <Chip
              label={share.isSettled ? t('split.settled') : t('split.pending')}
              selected={share.isSettled}
              leadingIcon={share.isSettled ? 'checkmark-circle-outline' : 'time-outline'}
              onPress={() => toggleSettled(share.id)}
            />
          </View>
        ))}

        {existingSplit ? (
          <SectionActionButton
            icon="trash-outline"
            label={t('split.deleteSplit')}
            tone="accent"
            style={{ borderColor: colors.danger }}
            onPress={onDelete}
          />
        ) : null}
      </FormCard>
    </FormCardGroup>
  );
}

const styles = StyleSheet.create({
  missing: { paddingHorizontal: 24, gap: 12 },
  missingText: { fontFamily: fonts.display },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  meta: { fontFamily: fonts.body },
  body: { fontFamily: fonts.bodyMedium },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  heroAmount: { fontFamily: fonts.display },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shareMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  shareAmount: { marginLeft: 'auto' },
  nameInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body,
    paddingVertical: 4,
    minHeight: 36,
  },
  amountInput: {
    minWidth: 88,
    maxWidth: 120,
    fontFamily: fonts.bodyMedium,
    textAlign: 'right',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
  },
  removeHit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  balanceAlert: { fontFamily: fonts.bodyMedium },
  summaryBanner: { paddingHorizontal: 14, paddingVertical: 12 },
  summaryText: { fontFamily: fonts.bodyMedium },
  settleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  settleCopy: { flex: 1, minWidth: 0, gap: 2 },
});
