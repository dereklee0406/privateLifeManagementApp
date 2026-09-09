import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKeyFromDate } from '../../controller/dateFieldValue';
import { useFinance } from '../../controller/FinanceProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  calculateCardMonthlyRebateSummary,
  groupCardsByBank,
  resolveBuiltinBank,
  type BankCardGroup,
  type CardMonthlyRebateSummary,
} from '../../model/finance/creditCardRebates';
import { formatFriendlyMoney } from '../../model/finance/Expense';
import type { CardBankPromotion, CreditCardAccount } from '../../model/reminders/creditCards';
import type { MoneyCurrency } from '../../model/settings/AppSettings';
import { toDayKey } from '../../utils/dateUtils';
import { hapticSuccess } from '../../utils/haptics';
import { createId } from '../../utils/idUtils';
import { appHref } from '../../utils/navigation';
import { CardPickerForPromoModal } from '../components/CardPickerForPromoModal';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { GlassSurface } from '../components/GlassSurface';
import { KeyboardDismissScrollView } from '../components/KeyboardDismissScrollView';
import { PrimaryButton } from '../components/PrimaryButton';
import { PromoEditorModal } from '../components/PromoEditorModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { expenseCategoryLabel, TYPE_ICON_SIZE, type TypeIconName } from '../icons/typeIcons';
import { useI18n, type Translate } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, type ThemeColors } from '../theme/tokens';
import { useTypography } from '../theme/TypographyProvider';

type CardsViewMode = 'all' | 'bank' | 'promotions';

interface ActivePromoRow {
  card: CreditCardAccount;
  promo: CardBankPromotion;
  bankName: string;
  brandColor: string;
  daysLeft: number;
}

/**
 * Purpose: You → Money → Payment cards — view / add / edit CreditCard accounts with bank
 *   grouping, monthly rebate health, and bank-promotion registration.
 * Inputs: ReminderProvider.creditCards + toggle/upsert; FinanceProvider.expenses; settings currency.
 * Outputs: neumorph list with All / By Bank / Promotions segments; Promotions tab can add/edit
 *   promos via PromoEditorModal (+ card picker when multiple cards).
 * Side effects: navigation; promotion registration/upsert via ReminderProvider; success haptic.
 * Design decisions: pure rebate math stays in creditCardRebates; this View only formats and
 *   orchestrates. Promotions list uses date-window eligibility (not registration) so users can
 *   1-tap register. Cap bar prefers monthlyRebateCap, then monthlySpendCap.
 */
export function PaymentCardsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { type } = useTypography();
  const { settings } = useSettings();
  const { creditCards, toggleCardPromotionRegistration, upsertCardPromotion } = useReminders();
  const { expenses } = useFinance();
  const [viewMode, setViewMode] = useState<CardsViewMode>('all');
  const [promoDraft, setPromoDraft] = useState<CardBankPromotion | null>(null);
  const [promoTargetCardId, setPromoTargetCardId] = useState<string | null>(null);
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const currency = settings.defaultCurrency;

  const rebateExpenses = useMemo(
    () =>
      expenses.map((expense) => ({
        amount: expense.amount,
        category: expense.category,
        cardId: expense.cardId,
        dayKey: expense.dayKey,
      })),
    [expenses],
  );

  const summaryByCardId = useMemo(() => {
    const map = new Map<string, CardMonthlyRebateSummary>();
    for (const card of creditCards) {
      map.set(card.id, calculateCardMonthlyRebateSummary(card, rebateExpenses));
    }
    return map;
  }, [creditCards, rebateExpenses]);

  const bankGroups = useMemo(() => groupCardsByBank(creditCards), [creditCards]);

  const activePromos = useMemo(
    () => collectActivePromotions(creditCards, toDayKey(new Date())),
    [creditCards],
  );

  const promoTargetCard = useMemo(
    () => creditCards.find((card) => card.id === promoTargetCardId) ?? null,
    [creditCards, promoTargetCardId],
  );

  const openCard = (cardId: string) => {
    router.push(appHref(`/reminders/card/${cardId}`));
  };

  const openNewPromoForCard = (cardId: string) => {
    const today = dayKeyFromDate(new Date());
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    setPromoTargetCardId(cardId);
    setPromoDraft({
      id: createId(),
      title: '',
      extraRebateRate: 0.03,
      startDate: today,
      endDate: dayKeyFromDate(end),
      requiresRegistration: true,
      isRegistered: false,
    });
  };

  const startAddPromotion = () => {
    if (creditCards.length === 0) {
      router.push(appHref('/reminders/card/new'));
      return;
    }
    if (creditCards.length === 1) {
      openNewPromoForCard(creditCards[0]!.id);
      return;
    }
    setCardPickerOpen(true);
  };

  const openEditPromotion = (card: CreditCardAccount, promo: CardBankPromotion) => {
    setPromoTargetCardId(card.id);
    setPromoDraft({ ...promo });
  };

  const closePromoEditor = () => {
    setPromoDraft(null);
    setPromoTargetCardId(null);
  };

  const savePromotion = async (promo: CardBankPromotion) => {
    if (!promoTargetCardId) {
      return;
    }
    await upsertCardPromotion(promoTargetCardId, promo);
    void hapticSuccess();
    closePromoEditor();
  };

  const promotionsMode = viewMode === 'promotions';
  const primaryIsAddPromo = promotionsMode && creditCards.length > 0;

  return (
    <ScreenScaffold>
      <ScreenHeader title={t('money.paymentCardsTitle')} />
      <KeyboardDismissScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type.subhead, { color: colors.muted }]}>{t('money.paymentCardsLede')}</Text>

        <View style={styles.segmentRow}>
          <Chip
            label={t('cardRewards.allCards')}
            selected={viewMode === 'all'}
            onPress={() => setViewMode('all')}
          />
          <Chip
            label={t('cardRewards.groupByBank')}
            selected={viewMode === 'bank'}
            onPress={() => setViewMode('bank')}
          />
          <Chip
            label={t('cardRewards.viewPromotions')}
            selected={viewMode === 'promotions'}
            onPress={() => setViewMode('promotions')}
          />
        </View>

        {promotionsMode ? (
          <PromotionsSection
            rows={activePromos}
            cardCount={creditCards.length}
            currency={currency}
            colors={colors}
            t={t}
            onToggle={(cardId, promoId) => {
              void toggleCardPromotionRegistration(cardId, promoId);
            }}
            onEditPromo={openEditPromotion}
          />
        ) : creditCards.length === 0 ? (
          <EmptyState
            message={t('money.paymentCardsEmpty')}
            backdropIcon="card-outline"
          />
        ) : viewMode === 'bank' ? (
          <BankGroupedList
            groups={bankGroups}
            summaryByCardId={summaryByCardId}
            currency={currency}
            colors={colors}
            t={t}
            onOpenCard={openCard}
          />
        ) : (
          <View style={styles.list}>
            {creditCards.map((card) => (
              <PaymentCardRow
                key={card.id}
                card={card}
                summary={summaryByCardId.get(card.id)}
                currency={currency}
                colors={colors}
                t={t}
                onPress={() => openCard(card.id)}
              />
            ))}
          </View>
        )}

        <PrimaryButton
          icon={primaryIsAddPromo ? 'sparkles-outline' : 'card-outline'}
          label={primaryIsAddPromo ? t('cardRewards.addPromotion') : t('money.addCard')}
          onPress={() => {
            if (primaryIsAddPromo) {
              startAddPromotion();
              return;
            }
            router.push(appHref('/reminders/card/new'));
          }}
        />
      </KeyboardDismissScrollView>

      <CardPickerForPromoModal
        visible={cardPickerOpen}
        cards={creditCards}
        onClose={() => setCardPickerOpen(false)}
        onSelect={(cardId) => {
          setCardPickerOpen(false);
          openNewPromoForCard(cardId);
        }}
      />

      <PromoEditorModal
        draft={promoDraft}
        currency={currency}
        cardName={promoTargetCard?.name}
        onClose={closePromoEditor}
        onSave={(promo) => {
          void savePromotion(promo);
        }}
      />
    </ScreenScaffold>
  );
}

/**
 * Purpose: render bank sections with header totals and nested card rows.
 * Inputs: bank groups + per-card rebate summaries.
 * Outputs: neumorph bank headers + card list.
 * Side effects: none (onOpenCard owned by parent).
 */
function BankGroupedList({
  groups,
  summaryByCardId,
  currency,
  colors,
  t,
  onOpenCard,
}: {
  groups: BankCardGroup[];
  summaryByCardId: Map<string, CardMonthlyRebateSummary>;
  currency: MoneyCurrency;
  colors: ThemeColors;
  t: Translate;
  onOpenCard: (cardId: string) => void;
}) {
  const { type } = useTypography();
  return (
    <View style={styles.list}>
      {groups.map((group) => {
        const bankRebate = group.cards.reduce(
          (sum, card) => sum + (summaryByCardId.get(card.id)?.totalRebate ?? 0),
          0,
        );
        const iconName = (group.icon || 'business-outline') as TypeIconName;
        return (
          <View key={group.bankId} style={styles.bankBlock}>
            <GlassSurface style={styles.bankHeader} radius={18}>
              <View style={[styles.bankDot, { backgroundColor: group.brandColor }]}>
                <Ionicons name={iconName} size={14} color="#FFFFFF" />
              </View>
              <View style={styles.bankHeaderText}>
                <Text style={[type.headline, styles.bankName, { color: colors.ink }]}>
                  {localizeBankName(t, group.bankId, group.bankName)}
                </Text>
                <Text style={[type.footnote, { color: colors.muted }]}>
                  {t('cardRewards.bankCardCount', { count: group.cards.length })}
                  {' · '}
                  {t('cardRewards.earnedThisMonth', {
                    amount: formatFriendlyMoney(bankRebate, currency),
                  })}
                </Text>
              </View>
            </GlassSurface>
            {group.cards.map((card) => (
              <PaymentCardRow
                key={card.id}
                card={card}
                summary={summaryByCardId.get(card.id)}
                currency={currency}
                colors={colors}
                t={t}
                onPress={() => onOpenCard(card.id)}
                compactBank
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Purpose: one payment-card glass row with mini card hero, rates, rebate badge, due day.
 * Inputs: card account + optional monthly summary.
 * Outputs: tappable GlassSurface; presentation only.
 * Side effects: onPress navigation.
 */
function PaymentCardRow({
  card,
  summary,
  currency,
  colors,
  t,
  onPress,
  compactBank = false,
}: {
  card: CreditCardAccount;
  summary?: CardMonthlyRebateSummary;
  currency: MoneyCurrency;
  colors: ThemeColors;
  t: Translate;
  onPress: () => void;
  compactBank?: boolean;
}) {
  const { type, scaleFontSize } = useTypography();
  const bank = resolveBuiltinBank(card.bankId);
  const bankLabel = localizeBankName(t, card.bankId ?? bank.id, card.bankName || bank.name);
  const baseRate = (card.baseRebateRate ?? 0.004) * 100;
  const baseRateLabel = t('cardRewards.baseRateBadge', {
    rate: formatRatePercent(baseRate),
  });
  const topRules = [...(card.rebateRules ?? [])]
    .sort((left, right) => right.rebateRate - left.rebateRate)
    .slice(0, 3);
  const earned = summary?.totalRebate ?? 0;
  const capProgress = resolveCapProgress(summary, card);
  const earnedLabel = formatFriendlyMoney(earned, currency);
  const cycleBadgeLabel =
    card.billingCycleType === 'statement'
      ? t('cardRewards.cycleBadge', {
          range: `${formatDueDay((card.statementDayOfMonth % 31) + 1, t)}–${formatDueDay(card.statementDayOfMonth, t)}`,
        })
      : t('cardRewards.cycleTypeCalendar');

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <GlassSurface style={styles.card} radius={18}>
        <View style={styles.cardHead}>
          <MiniCardHero
            brandColor={bank.brandColor}
            icon={(bank.icon || 'card-outline') as TypeIconName}
            tierAbbrev={tierAbbreviation(card.cardTier)}
            colors={colors}
          />
          <View style={styles.cardTitleBlock}>
            <Text style={[type.headline, { color: colors.ink }]} numberOfLines={1}>
              {card.name}
            </Text>
            <View style={styles.metaRow}>
              {!compactBank ? (
                <View style={[styles.bankBadge, { backgroundColor: `${bank.brandColor}22` }]}>
                  <View style={[styles.bankBadgeDot, { backgroundColor: bank.brandColor }]} />
                  <Text
                    style={[
                      styles.bankBadgeText,
                      { color: colors.ink, fontSize: scaleFontSize(12) },
                    ]}
                    numberOfLines={1}
                  >
                    {bankLabel}
                  </Text>
                </View>
              ) : null}
              {card.cardTier ? (
                <Text style={[type.footnote, { color: colors.muted }]} numberOfLines={1}>
                  {card.cardTier}
                </Text>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={TYPE_ICON_SIZE} color={colors.faint} />
        </View>

        <View style={styles.chipWrap}>
          <View style={[styles.earnedBadge, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="sparkles" size={12} color={colors.accent} />
            <Text
              style={[
                styles.earnedBadgeText,
                { color: colors.accent, fontSize: scaleFontSize(12) },
              ]}
              numberOfLines={1}
            >
              {t('cardRewards.earnedThisMonth', { amount: earnedLabel })}
            </Text>
          </View>
          <View style={[styles.rateChip, { backgroundColor: colors.well }]}>
            <Text style={[styles.rateChipText, { color: colors.ink, fontSize: scaleFontSize(12) }]}>
              {baseRateLabel}
            </Text>
          </View>
          <View style={[styles.rateChip, { backgroundColor: colors.well }]}>
            <Text style={[styles.rateChipText, { color: colors.muted, fontSize: scaleFontSize(12) }]}>
              {cycleBadgeLabel}
            </Text>
          </View>
          {topRules.map((rule) => (
            <View key={rule.id} style={[styles.rateChip, { backgroundColor: colors.well }]}>
              <Text style={[styles.rateChipText, { color: colors.ink, fontSize: scaleFontSize(12) }]}>
                {`${rebateCategoryLabel(t, rule.category)} ${formatRatePercent(rule.rebateRate * 100)}%`}
              </Text>
            </View>
          ))}
        </View>

        {capProgress ? (
          <View style={styles.capBlock}>
            <View style={[insetSurface(colors, 999), styles.capTrack]}>
              <View
                style={[
                  styles.capFill,
                  {
                    width: `${Math.round(capProgress.ratio * 100)}%`,
                    backgroundColor: capProgress.ratio >= 1 ? colors.danger : colors.accent,
                  },
                ]}
              />
            </View>
            <Text style={[type.caption, { color: colors.muted }]}>
              {t('cardRewards.capProgress', {
                used: formatFriendlyMoney(capProgress.used, currency),
                limit: formatFriendlyMoney(capProgress.limit, currency),
                percent: Math.round(capProgress.ratio * 100),
              })}
            </Text>
          </View>
        ) : null}

        <Text style={[type.footnote, { color: colors.muted }]}>
          {t('money.paymentCardsDue', { day: formatDueDay(card.dueDayOfMonth, t) })}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}

/**
 * Purpose: miniature virtual credit-card chip for list glanceability.
 * Inputs: bank brand color, Ionicons name, optional tier abbreviation, theme colors.
 * Outputs: ~56×36 (≈1.56:1) mini card with accent bar, logo, tier, chip glyph.
 * Side effects: none.
 * Design decisions: brand-tinted face + left accent bar keep bank identity without a full hero;
 *   chip glyph and tier abbrev sell “real card” at a glance in All / By Bank lists.
 */
function MiniCardHero({
  brandColor,
  icon,
  tierAbbrev,
  colors,
}: {
  brandColor: string;
  icon: TypeIconName;
  tierAbbrev: string;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        styles.miniCard,
        {
          backgroundColor: brandColor,
          borderColor: colors.glassBorder,
          boxShadow: colors.insetShadow,
        },
      ]}
      accessible={false}
      importantForAccessibility="no"
    >
      <View style={styles.miniCardAccent} />
      <View style={styles.miniCardBody}>
        <View style={styles.miniCardTop}>
          <Ionicons name={icon} size={11} color="rgba(255,255,255,0.95)" />
          {tierAbbrev ? (
            <Text style={styles.miniCardTier} numberOfLines={1}>
              {tierAbbrev}
            </Text>
          ) : null}
        </View>
        <View style={styles.miniCardChip}>
          <View style={styles.miniCardChipInner} />
        </View>
      </View>
    </View>
  );
}

/**
 * Purpose: compact tier label for the mini card (e.g. Visa Signature → VS).
 * Inputs: optional cardTier string.
 * Outputs: 1–3 uppercase letters, or empty when missing.
 * Side effects: none.
 */
function tierAbbreviation(cardTier?: string): string {
  const trimmed = cardTier?.trim();
  if (!trimmed) {
    return '';
  }
  const parts = trimmed.split(/[\s/-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts
      .slice(0, 3)
      .map((part) => part[0]!.toUpperCase())
      .join('');
  }
  return trimmed.slice(0, 3).toUpperCase();
}

/**
 * Purpose: aggregate active bank promotions with registration toggle and inline edit/add.
 * Inputs: promo rows across cards; card count for empty-state branch.
 * Outputs: promo cards, or neumorph empty state with CTA.
 * Side effects: toggle / edit / add callbacks owned by parent.
 */
function PromotionsSection({
  rows,
  cardCount,
  currency,
  colors,
  t,
  onToggle,
  onEditPromo,
}: {
  rows: ActivePromoRow[];
  cardCount: number;
  currency: MoneyCurrency;
  colors: ThemeColors;
  t: Translate;
  onToggle: (cardId: string, promoId: string) => void;
  onEditPromo: (card: CreditCardAccount, promo: CardBankPromotion) => void;
}) {
  const { type, scaleFontSize } = useTypography();

  if (rows.length === 0) {
    const noCards = cardCount === 0;
    return (
      <GlassSurface style={styles.emptyPromo} radius={18}>
        <View style={styles.emptyPromoIconWrap} accessible={false} importantForAccessibility="no">
          <Ionicons
            name={noCards ? 'card-outline' : 'megaphone-outline'}
            size={36}
            color={colors.faint}
          />
        </View>
        <Text style={[type.subhead, { color: colors.muted, textAlign: 'center' }]}>
          {noCards ? t('cardRewards.noCardsForPromo') : t('cardRewards.noPromotionsHint')}
        </Text>
      </GlassSurface>
    );
  }

  return (
    <View style={styles.list}>
      <Text style={[type.footnote, { color: colors.muted }]}>{t('cardRewards.activePromotions')}</Text>
      {rows.map(({ card, promo, bankName, brandColor, daysLeft }) => {
        const stopToggleBubble = (event: GestureResponderEvent) => {
          event.stopPropagation?.();
        };
        return (
          <Pressable
            key={`${card.id}:${promo.id}`}
            onPress={() => onEditPromo(card, promo)}
            accessibilityRole="button"
            accessibilityLabel={t('cardRewards.editPromotion')}
          >
            <GlassSurface style={styles.promoCard} radius={18}>
              <View style={styles.promoHead}>
                <View style={[styles.bankBadgeDot, { backgroundColor: brandColor }]} />
                <Text style={[type.footnote, { color: colors.muted, flex: 1 }]} numberOfLines={1}>
                  {`${bankName} · ${card.name}`}
                </Text>
                <Ionicons name="create-outline" size={18} color={colors.faint} />
              </View>
              <Text style={[type.headline, { color: colors.ink }]}>{promo.title}</Text>
              <View style={styles.chipWrap}>
                {promo.category ? (
                  <View style={[styles.rateChip, { backgroundColor: colors.well }]}>
                    <Text
                      style={[styles.rateChipText, { color: colors.ink, fontSize: scaleFontSize(12) }]}
                    >
                      {rebateCategoryLabel(t, promo.category)}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.rateChip, { backgroundColor: colors.accentSoft }]}>
                  <Text
                    style={[
                      styles.rateChipText,
                      { color: colors.accent, fontSize: scaleFontSize(12) },
                    ]}
                  >
                    {t('cardRewards.promoExtraRate', {
                      rate: formatRatePercent(promo.extraRebateRate * 100),
                    })}
                  </Text>
                </View>
                {promo.minSpendPerTx ? (
                  <View style={[styles.rateChip, { backgroundColor: colors.well }]}>
                    <Text
                      style={[styles.rateChipText, { color: colors.muted, fontSize: scaleFontSize(12) }]}
                    >
                      {t('cardRewards.promoMinSpendBadge', {
                        amount: formatFriendlyMoney(promo.minSpendPerTx, currency),
                      })}
                    </Text>
                  </View>
                ) : null}
                {promo.minTotalSpend ? (
                  <View style={[styles.rateChip, { backgroundColor: colors.well }]}>
                    <Text
                      style={[styles.rateChipText, { color: colors.muted, fontSize: scaleFontSize(12) }]}
                    >
                      {t('cardRewards.promoMinTotalBadge', {
                        amount: formatFriendlyMoney(promo.minTotalSpend, currency),
                      })}
                    </Text>
                  </View>
                ) : null}
                {promo.maxRebateCap ? (
                  <View style={[styles.rateChip, { backgroundColor: colors.well }]}>
                    <Text
                      style={[styles.rateChipText, { color: colors.muted, fontSize: scaleFontSize(12) }]}
                    >
                      {t('cardRewards.promoCapBadge', {
                        amount: formatFriendlyMoney(promo.maxRebateCap, currency),
                      })}
                    </Text>
                  </View>
                ) : null}
                {promo.maxSpendCap ? (
                  <View style={[styles.rateChip, { backgroundColor: colors.well }]}>
                    <Text
                      style={[styles.rateChipText, { color: colors.muted, fontSize: scaleFontSize(12) }]}
                    >
                      {t('cardRewards.promoSpendCapBadge', {
                        amount: formatFriendlyMoney(promo.maxSpendCap, currency),
                      })}
                    </Text>
                  </View>
                ) : null}
                {promo.isStackable ? (
                  <View style={[styles.rateChip, { backgroundColor: colors.accentSoft }]}>
                    <Text
                      style={[
                        styles.rateChipText,
                        { color: colors.accent, fontSize: scaleFontSize(12) },
                      ]}
                    >
                      {t('cardRewards.stackableBadge')}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.rateChip, { backgroundColor: colors.well }]}>
                  <Text
                    style={[styles.rateChipText, { color: colors.muted, fontSize: scaleFontSize(12) }]}
                  >
                    {promoCountdownLabel(daysLeft, t)}
                  </Text>
                </View>
              </View>
              <Text style={[type.caption, { color: colors.faint }]}>
                {`${promo.startDate} → ${promo.endDate}`}
              </Text>
              <View
                style={styles.promoToggleRow}
                onStartShouldSetResponder={() => true}
                onTouchEnd={stopToggleBubble}
              >
                <Text style={[type.footnote, { color: colors.ink, flex: 1 }]}>
                  {promo.isRegistered
                    ? t('cardRewards.registeredPromo')
                    : t('cardRewards.registerPromo')}
                </Text>
                <Switch
                  value={promo.isRegistered}
                  onValueChange={() => onToggle(card.id, promo.id)}
                  trackColor={{ false: colors.line, true: colors.accent }}
                  thumbColor={colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2'}
                />
              </View>
            </GlassSurface>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Purpose: collect date-window promotions across all cards for the Promotions segment.
 * Inputs: cards + civil today key.
 * Outputs: sorted promo rows (soonest end first); ignores registration so users can enroll.
 * Side effects: none.
 */
function collectActivePromotions(cards: CreditCardAccount[], todayKey: string): ActivePromoRow[] {
  const rows: ActivePromoRow[] = [];
  for (const card of cards) {
    const bank = resolveBuiltinBank(card.bankId);
    const bankName = card.bankName?.trim() || bank.name;
    for (const promo of card.promotions ?? []) {
      if (todayKey < promo.startDate || todayKey > promo.endDate) {
        continue;
      }
      const endMs = Date.parse(`${promo.endDate}T12:00:00`);
      const todayMs = Date.parse(`${todayKey}T12:00:00`);
      const daysLeft = Number.isFinite(endMs)
        ? Math.max(0, Math.ceil((endMs - todayMs) / 86_400_000))
        : 0;
      rows.push({
        card,
        promo,
        bankName,
        brandColor: bank.brandColor,
        daysLeft,
      });
    }
  }
  return rows.sort((left, right) => left.daysLeft - right.daysLeft);
}

/**
 * Purpose: prefer rebate-cap progress, else spend-cap, for the sleek track.
 * Inputs: monthly summary + card caps.
 * Outputs: used/limit/ratio or null when no cap.
 * Side effects: none.
 */
function resolveCapProgress(
  summary: CardMonthlyRebateSummary | undefined,
  card: CreditCardAccount,
): { used: number; limit: number; ratio: number } | null {
  if (summary?.rebateCapLimit !== undefined && summary.rebateCapLimit > 0) {
    const used = summary.rebateCapUsed ?? summary.totalRebate;
    return {
      used,
      limit: summary.rebateCapLimit,
      ratio: Math.min(1, Math.max(0, used / summary.rebateCapLimit)),
    };
  }
  if (summary?.spendCapLimit !== undefined && summary.spendCapLimit > 0) {
    const used = summary.spendCapUsed ?? summary.totalSpend;
    return {
      used,
      limit: summary.spendCapLimit,
      ratio: Math.min(1, Math.max(0, used / summary.spendCapLimit)),
    };
  }
  if (card.monthlyRebateCap !== undefined && card.monthlyRebateCap > 0) {
    const used = summary?.totalRebate ?? 0;
    return {
      used,
      limit: card.monthlyRebateCap,
      ratio: Math.min(1, Math.max(0, used / card.monthlyRebateCap)),
    };
  }
  if (card.monthlySpendCap !== undefined && card.monthlySpendCap > 0) {
    const used = summary?.totalSpend ?? 0;
    return {
      used,
      limit: card.monthlySpendCap,
      ratio: Math.min(1, Math.max(0, used / card.monthlySpendCap)),
    };
  }
  return null;
}

/**
 * Purpose: localize rebate/promo category ids (expense types + cardRewards extras).
 * Inputs: translator + category id.
 * Outputs: human label for chips.
 * Side effects: none.
 */
function rebateCategoryLabel(t: Translate, category: string): string {
  const normalized = category.trim().toLowerCase() || 'other';
  if (normalized === 'online') {
    return t('cardRewards.categoryOnline');
  }
  if (normalized === 'overseas') {
    return t('cardRewards.categoryOverseas');
  }
  if (normalized === 'all') {
    return t('cardRewards.categoryAll');
  }
  return expenseCategoryLabel(t, normalized, []);
}

/**
 * Purpose: map builtin bank id to localized cardRewards.bank* label.
 * Inputs: translator, bank id, fallback display name.
 * Outputs: localized bank name.
 * Side effects: none.
 */
function localizeBankName(t: Translate, bankId: string, fallback: string): string {
  const keyById: Record<string, string> = {
    hsbc: 'cardRewards.bankHsbc',
    scb: 'cardRewards.bankScb',
    hangseng: 'cardRewards.bankHangseng',
    boc: 'cardRewards.bankBoc',
    citi: 'cardRewards.bankCiti',
    dbs: 'cardRewards.bankDbs',
    mox: 'cardRewards.bankMox',
    bea: 'cardRewards.bankBea',
    ccb: 'cardRewards.bankCcb',
    amex: 'cardRewards.bankAmex',
    chase: 'cardRewards.bankChase',
    other: 'cardRewards.bankOther',
  };
  const key = keyById[bankId];
  if (!key) {
    return fallback;
  }
  const label = t(key);
  return label === key ? fallback : label;
}

/**
 * Purpose: trim trailing zeros on percent labels (5, 1.5, 0.4).
 * Inputs: percent number (already ×100).
 * Outputs: compact string without % sign.
 * Side effects: none.
 */
function formatRatePercent(rate: number): string {
  if (!Number.isFinite(rate)) {
    return '0';
  }
  const rounded = Math.round(rate * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Purpose: due-day token for money.paymentCardsDue (e.g. 15th).
 * Inputs: day of month 1–31.
 * Outputs: ordinal-ish day string (English suffix; other locales get plain day).
 * Side effects: none.
 */
function formatDueDay(day: number, t: Translate): string {
  const safe = Math.min(31, Math.max(1, Math.round(day) || 1));
  const localeHint = t('cardRewards.allCards');
  if (localeHint !== 'All Cards') {
    return String(safe);
  }
  const mod100 = safe % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${safe}th`;
  }
  const mod10 = safe % 10;
  if (mod10 === 1) {
    return `${safe}st`;
  }
  if (mod10 === 2) {
    return `${safe}nd`;
  }
  if (mod10 === 3) {
    return `${safe}rd`;
  }
  return `${safe}th`;
}

/**
 * Purpose: human countdown for promo end date.
 * Inputs: days remaining.
 * Outputs: localized countdown string.
 * Side effects: none.
 */
function promoCountdownLabel(daysLeft: number, t: Translate): string {
  if (daysLeft <= 0) {
    return t('cardRewards.promoEndsToday');
  }
  return t('cardRewards.promoDaysLeft', { days: daysLeft });
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  list: {
    gap: 10,
  },
  bankBlock: {
    gap: 8,
  },
  bankHeader: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bankDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bankName: {
    fontFamily: fonts.bodySemi,
  },
  card: {
    padding: 16,
    gap: 10,
    minHeight: 56,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniCard: {
    width: 56,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
  },
  miniCardAccent: {
    width: 3,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  miniCardBody: {
    flex: 1,
    paddingHorizontal: 5,
    paddingVertical: 4,
    justifyContent: 'space-between',
  },
  miniCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  miniCardTier: {
    fontFamily: fonts.bodySemi,
    fontSize: 8,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.95)',
    flexShrink: 1,
  },
  miniCardChip: {
    width: 14,
    height: 10,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardChipInner: {
    width: 8,
    height: 6,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  bankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '70%',
  },
  bankBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bankBadgeText: {
    fontFamily: fonts.bodyMedium,
    flexShrink: 1,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  earnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: '100%',
  },
  earnedBadgeText: {
    fontFamily: fonts.bodySemi,
    flexShrink: 1,
  },
  rateChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rateChipText: {
    fontFamily: fonts.bodyMedium,
  },
  capBlock: {
    gap: 6,
  },
  capTrack: {
    height: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  capFill: {
    height: '100%',
    borderRadius: 999,
  },
  emptyPromo: {
    paddingVertical: 26,
    paddingHorizontal: 20,
    gap: 12,
    alignItems: 'center',
  },
  emptyPromoIconWrap: {
    alignItems: 'center',
    marginBottom: 2,
    opacity: 0.85,
  },
  promoCard: {
    padding: 16,
    gap: 10,
  },
  promoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
});
