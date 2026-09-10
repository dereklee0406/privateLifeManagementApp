import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { ReminderController } from './ReminderController';
import { RemindersLocalStore } from '../data/RemindersLocalStore';
import { useSettings } from './SettingsProvider';
import { resolveReminderSoundEnabled } from '../model/settings/AppSettings';
import type {
  CardBankPromotion,
  CreditCardAccount,
  CreditCardPingDraft,
} from '../model/reminders/creditCards';
import type { Reminder, ReminderDraft } from '../model/reminders/Reminder';
import type { ReminderTemplate, ReminderTemplateId } from '../model/reminders/templates';
import type { CreditCardCreateInput } from './ReminderController';
import { useI18n } from '../view/i18n';

interface ReminderContextValue {
  ready: boolean;
  reminders: Reminder[];
  creditCards: CreditCardAccount[];
  notificationsLive: boolean;
  syncSchedules: () => Promise<boolean>;
  /** User tap — may show the OS notification permission dialog. */
  requestOsPings: () => Promise<boolean>;
  listTemplates: () => ReminderTemplate[];
  applyTemplate: (id: ReminderTemplateId | string) => ReminderDraft;
  nextFire: (reminder: Reminder) => Date | null;
  createReminder: (draft: ReminderDraft) => Promise<Reminder>;
  updateReminder: (id: string, draft: ReminderDraft) => Promise<Reminder>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  completeReminder: (id: string, now?: Date) => Promise<Reminder>;
  uncompleteReminder: (id: string, now?: Date) => Promise<Reminder>;
  deleteReminder: (id: string) => Promise<void>;
  createCreditCard: (input: CreditCardCreateInput) => Promise<CreditCardAccount>;
  updateCreditCard: (id: string, input: CreditCardCreateInput) => Promise<CreditCardAccount>;
  addCreditCardPing: (accountId: string, ping: CreditCardPingDraft) => Promise<Reminder>;
  deleteCreditCard: (id: string) => Promise<void>;
  toggleCardPromotionRegistration: (cardId: string, promoId: string) => Promise<void>;
  upsertCardPromotion: (cardId: string, promo: CardBankPromotion) => Promise<void>;
  deleteCardPromotion: (cardId: string, promoId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ReminderContext = createContext<ReminderContextValue | null>(null);

/**
 * Purpose: bind ReminderController to React.
 * Inputs: children tree; settings (sound + lockMode); i18n for private tray copy.
 * Outputs: reminder list, cards, and mutators.
 * Side effects: loads JSON; resyncs OS notifications on launch, lock/sound change, and foreground.
 * Design decisions: when App Lock is on, scheduled tray text is generic so health/money notes
 *   do not sit on the OS lock screen; full titles stay inside the unlocked app.
 */
export function ReminderProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => new ReminderController(new RemindersLocalStore()), []);
  const { ready: settingsReady, settings } = useSettings();
  const { t } = useI18n();
  const playSound = resolveReminderSoundEnabled(settings);
  const redactLockScreen = settings.lockMode !== 'off';
  const privateTitle = t('reminder.privateTitle');
  const privateBody = t('reminder.privateBody');
  const [ready, setReady] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardAccount[]>([]);
  const [notificationsLive, setNotificationsLive] = useState(true);

  const scheduleOptions = useMemo(
    () => ({
      playSound,
      redactLockScreen,
      privateTitle,
      privateBody,
    }),
    [playSound, redactLockScreen, privateTitle, privateBody],
  );

  const refresh = async () => {
    const [nextReminders, nextCards] = await Promise.all([
      controller.listReminders(),
      controller.listCreditCards(),
    ]);
    setReminders(nextReminders);
    setCreditCards(nextCards);
    setReady(true);
  };

  useEffect(() => {
    controller.configureSound(playSound);
    controller.configureTrayPrivacy({
      redact: redactLockScreen,
      title: privateTitle,
      body: privateBody,
    });
  }, [controller, playSound, redactLockScreen, privateTitle, privateBody]);

  useEffect(() => {
    void (async () => {
      await refresh();
      if (!settingsReady) {
        return;
      }
      controller.configureSound(playSound);
      controller.configureTrayPrivacy({
        redact: redactLockScreen,
        title: privateTitle,
        body: privateBody,
      });
      const live = await controller.syncSchedules({ ...scheduleOptions, permissionTrigger: 'coldStart' });
      setNotificationsLive(live);
    })();
  }, [controller, settingsReady, scheduleOptions]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        controller.configureSound(playSound);
        controller.configureTrayPrivacy({
          redact: redactLockScreen,
          title: privateTitle,
          body: privateBody,
        });
        void controller
          .syncSchedules({ ...scheduleOptions, permissionTrigger: 'foreground' })
          .then(setNotificationsLive);
      }
    });
    return () => sub.remove();
  }, [controller, playSound, redactLockScreen, privateTitle, privateBody, scheduleOptions]);

  const value = useMemo<ReminderContextValue>(
    () => ({
      ready,
      reminders,
      creditCards,
      notificationsLive,
      syncSchedules: async () => {
        controller.configureSound(playSound);
        const live = await controller.syncSchedules({
          ...scheduleOptions,
          permissionTrigger: 'soundChange',
        });
        setNotificationsLive(live);
        return live;
      },
      requestOsPings: async () => {
        controller.configureSound(playSound);
        const live = await controller.syncSchedules({
          ...scheduleOptions,
          permissionTrigger: 'userEnable',
        });
        setNotificationsLive(live);
        return live;
      },
      listTemplates: () => controller.listTemplates(),
      applyTemplate: (id) => controller.applyTemplate(id),
      nextFire: (reminder) => controller.nextFire(reminder),
      createReminder: async (draft) => {
        const created = await controller.createReminder(draft);
        await refresh();
        return created;
      },
      updateReminder: async (id, draft) => {
        const updated = await controller.updateReminder(id, draft);
        await refresh();
        return updated;
      },
      setEnabled: async (id, enabled) => {
        await controller.setEnabled(id, enabled);
        await refresh();
      },
      completeReminder: async (id, now) => {
        const updated = await controller.completeReminder(id, now);
        await refresh();
        return updated;
      },
      uncompleteReminder: async (id, now) => {
        const updated = await controller.uncompleteReminder(id, now);
        await refresh();
        return updated;
      },
      deleteReminder: async (id) => {
        await controller.deleteReminder(id);
        await refresh();
      },
      createCreditCard: async (input) => {
        const created = await controller.createCreditCard(input);
        await refresh();
        return created;
      },
      updateCreditCard: async (id, input) => {
        const updated = await controller.updateCreditCard(id, input);
        await refresh();
        return updated;
      },
      addCreditCardPing: async (accountId, ping) => {
        const created = await controller.addCreditCardPing(accountId, ping);
        await refresh();
        return created;
      },
      deleteCreditCard: async (id) => {
        await controller.deleteCreditCard(id);
        await refresh();
      },
      toggleCardPromotionRegistration: async (cardId, promoId) => {
        await controller.toggleCardPromotionRegistration(cardId, promoId);
        await refresh();
      },
      upsertCardPromotion: async (cardId, promo) => {
        await controller.upsertCardPromotion(cardId, promo);
        await refresh();
      },
      deleteCardPromotion: async (cardId, promoId) => {
        await controller.deleteCardPromotion(cardId, promoId);
        await refresh();
      },
      refresh,
    }),
    [ready, reminders, creditCards, notificationsLive, controller, playSound, scheduleOptions],
  );

  return createElement(ReminderContext.Provider, { value }, children);
}

/**
 * Purpose: access reminder use cases from views.
 */
export function useReminders(): ReminderContextValue {
  const value = useContext(ReminderContext);
  if (!value) {
    throw new Error('useReminders must be used inside ReminderProvider.');
  }
  return value;
}
