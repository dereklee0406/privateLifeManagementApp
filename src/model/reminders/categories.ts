import type { ReminderCategoryPath } from './Reminder';
import {
  activeReminderTypes,
  reminderTypeCustomLabel,
  type ConfigurableReminderType,
} from './reminderTypes';

/**
 * Purpose: hierarchical reminder taxonomy (Financial / Health / … then subcategory then type).
 * Inputs: picker and templates; optional You → Reminder types configuration for top-level chips.
 * Outputs: CategoryNode tree plus path helpers.
 * Side effects: none.
 * Design decisions: ids are stable strings stored on Reminder.categoryPath; labels are English UI copy in Model so Controller can apply templates without View knowledge.
 *   Top-level chips come from AppSettings.reminderTypes when provided; Financial/Health children stay in this tree.
 */
export interface CategoryNode {
  id: string;
  label: string;
  children?: CategoryNode[];
}

export const REMINDER_CATEGORY_TREE: CategoryNode[] = [
  {
    id: 'financial',
    label: 'Financial',
    children: [
      { id: 'credit-card', label: 'Credit Card' },
      {
        id: 'loan',
        label: 'Loan',
        children: [
          { id: 'mortgage', label: 'Mortgage' },
          { id: 'personal-loan', label: 'Personal loan' },
          { id: 'car-loan', label: 'Car loan' },
        ],
      },
      {
        id: 'bills',
        label: 'Bills',
        children: [
          { id: 'electricity', label: 'Electricity' },
          { id: 'water', label: 'Water' },
          { id: 'gas', label: 'Gas' },
          { id: 'internet', label: 'Internet' },
          { id: 'mobile', label: 'Mobile' },
        ],
      },
      {
        id: 'investments',
        label: 'Investments',
        children: [
          { id: 'monthly-etf', label: 'Monthly ETF purchase' },
          { id: 'mpf-review', label: 'MPF review' },
          { id: 'portfolio-review', label: 'Portfolio review' },
        ],
      },
    ],
  },
  {
    id: 'health',
    label: 'Health',
    children: [
      {
        id: 'medication',
        label: 'Medication',
        children: [
          { id: 'daily-medicine', label: 'Daily medicine' },
          { id: 'vitamins', label: 'Vitamins' },
        ],
      },
      {
        id: 'exercise',
        label: 'Exercise',
        children: [
          { id: 'gym', label: 'Gym' },
          { id: 'running', label: 'Running' },
          { id: 'walking', label: 'Walking' },
        ],
      },
      {
        id: 'medical',
        label: 'Medical',
        children: [
          { id: 'dental-check', label: 'Dental check' },
          { id: 'eye-check', label: 'Eye check' },
          { id: 'body-check', label: 'Body check' },
        ],
      },
    ],
  },
  { id: 'household', label: 'Household' },
  { id: 'family', label: 'Family' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'work', label: 'Work' },
  { id: 'personal', label: 'Personal' },
  { id: 'other', label: 'Other' },
];

/**
 * Purpose: top-level chips for list filters and the compose Group picker.
 * Inputs: optional resolved reminder types (from resolveReminderTypes); omit = full built-in tree.
 * Outputs: enabled tops (Financial, Health, … plus customs); builtins keep subcategory children.
 * Side effects: none.
 * Design decisions: when settings are passed, only enabled types appear — deleted/disabled never crash.
 */
export function listTopCategories(configured?: ConfigurableReminderType[]): CategoryNode[] {
  if (!configured) {
    return REMINDER_CATEGORY_TREE;
  }
  return activeReminderTypes(configured).map((row) => {
    const tree = findCategoryNode(row.id, REMINDER_CATEGORY_TREE);
    return {
      id: row.id,
      label: row.label ?? tree?.label ?? row.id,
      ...(tree?.children ? { children: tree.children } : {}),
    };
  });
}

/**
 * Purpose: look up a node by id anywhere in the tree.
 * Inputs: node id.
 * Outputs: node or undefined.
 * Side effects: none.
 */
export function findCategoryNode(id: string, nodes: CategoryNode[] = REMINDER_CATEGORY_TREE): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const nested = findCategoryNode(id, node.children);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

/**
 * Purpose: children of a top or subcategory for the stepped picker.
 * Inputs: parent id (or empty for top-level).
 * Outputs: child nodes.
 * Side effects: none.
 */
export function categoryChildren(parentId?: string): CategoryNode[] {
  if (!parentId) {
    return REMINDER_CATEGORY_TREE;
  }
  return findCategoryNode(parentId)?.children ?? [];
}

/**
 * Purpose: build a stored path from picker selections.
 * Inputs: top id plus optional sub and type.
 * Outputs: ReminderCategoryPath.
 * Side effects: none.
 */
export function makeCategoryPath(top: string, subcategory?: string, type?: string): ReminderCategoryPath {
  return {
    top,
    subcategory: subcategory || undefined,
    type: type || undefined,
  };
}

/**
 * Purpose: human breadcrumb for list rows (Financial · Bills · Water).
 * Inputs: stored path; optional configured types so custom tops show their label.
 * Outputs: label string (English / stored custom text — Views may still prefer i18n for builtins).
 * Side effects: none.
 * Design decisions: unknown / deleted tops fall back to the raw id so rows never crash.
 */
export function describeCategoryPath(
  path: ReminderCategoryPath | undefined,
  configured?: ConfigurableReminderType[],
): string {
  if (!path?.top) {
    return 'Other';
  }
  const custom = reminderTypeCustomLabel(path.top, configured);
  const parts = [custom ?? findCategoryNode(path.top)?.label ?? path.top];
  if (path.subcategory) {
    parts.push(findCategoryNode(path.subcategory)?.label ?? path.subcategory);
  }
  if (path.type) {
    parts.push(findCategoryNode(path.type)?.label ?? path.type);
  }
  return parts.join(' · ');
}

/**
 * Purpose: whether this path is the Credit Card leaf (structured account form).
 * Inputs: category path.
 * Outputs: true for Financial → Credit Card.
 * Side effects: none.
 */
export function isCreditCardPath(path: ReminderCategoryPath | undefined): boolean {
  return path?.top === 'financial' && path.subcategory === 'credit-card';
}

/**
 * Purpose: default path when applying a smart template.
 * Inputs: template id.
 * Outputs: category path (uncatalogued templates land in Other).
 * Side effects: none.
 */
export function categoryPathForTemplate(templateId: string): ReminderCategoryPath {
  switch (templateId) {
    case 'credit-card':
      return makeCategoryPath('financial', 'credit-card');
    case 'loan':
      return makeCategoryPath('financial', 'loan');
    case 'health':
      return makeCategoryPath('health');
    case 'vehicle':
      return makeCategoryPath('vehicle');
    case 'family':
      return makeCategoryPath('family');
    case 'household':
      return makeCategoryPath('household');
    case 'goal':
    case 'follow-up':
      return makeCategoryPath('personal');
    case 'anniversary':
      return makeCategoryPath('family');
    case 'certification':
    case 'subscription':
      return makeCategoryPath('other');
    default:
      return makeCategoryPath('other');
  }
}

/**
 * Purpose: filter reminders by top-level category (list chips).
 * Inputs: path and selected top id (`all` skips).
 * Outputs: true when the row should show.
 * Side effects: none.
 */
export function matchesTopCategory(path: ReminderCategoryPath | undefined, top: string | 'all'): boolean {
  if (top === 'all') {
    return true;
  }
  return (path?.top ?? 'other') === top;
}
