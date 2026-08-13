import type { MedStatus } from './types';
import type { MedSlot } from './medUtils';

export const MORNING_REMINDER_HOUR = 10;
export const BP_REMINDER_HOUR = 12;
export const EVENING_REMINDER_HOUR = 20;

export type TabletReminder = {
  slot: MedSlot;
  message: string;
};

export function getTabletReminder(meds: MedStatus, now = new Date()): TabletReminder | null {
  const hour = now.getHours();

  if (!meds.morning && hour >= MORNING_REMINDER_HOUR && hour < BP_REMINDER_HOUR) {
    return {
      slot: 'morning',
      message: "Morning tablet not logged yet — tap when you've taken it",
    };
  }

  if (!meds.bp && hour >= BP_REMINDER_HOUR && hour < EVENING_REMINDER_HOUR) {
    return {
      slot: 'bp',
      message: "BP tablet not logged yet — tap when you've taken it",
    };
  }

  if (!meds.evening && hour >= EVENING_REMINDER_HOUR) {
    return {
      slot: 'evening',
      message: "Evening tablet not logged yet — tap when you've taken it",
    };
  }

  return null;
}

export function getMissedTabletSummary(meds: MedStatus): MedSlot[] {
  const missed: MedSlot[] = [];
  if (!meds.morning) missed.push('morning');
  if (!meds.bp) missed.push('bp');
  if (!meds.evening) missed.push('evening');
  return missed;
}

const SLOT_LABELS: Record<MedSlot, string> = {
  morning: 'Morning',
  evening: 'Evening',
  bp: 'BP',
};

export function slotLabel(slot: MedSlot) {
  return SLOT_LABELS[slot];
}

export { TABLET_COUNT, tabletsDayLabel } from './medUtils';
