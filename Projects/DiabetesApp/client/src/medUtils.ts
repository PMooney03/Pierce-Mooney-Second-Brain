export const MED_SLOTS = ['morning', 'evening', 'bp'] as const;
export type MedSlot = (typeof MED_SLOTS)[number];
export const TABLET_COUNT = MED_SLOTS.length;

export function countTabletsTaken(taken: { morning: boolean; evening: boolean; bp: boolean }) {
  return (taken.morning ? 1 : 0) + (taken.evening ? 1 : 0) + (taken.bp ? 1 : 0);
}

export function tabletsDayLabel(morningTaken: boolean, eveningTaken: boolean, bpTaken: boolean) {
  const taken = countTabletsTaken({ morning: morningTaken, evening: eveningTaken, bp: bpTaken });
  if (taken === TABLET_COUNT) return { text: 'All taken', tone: 'good' as const };
  if (taken === 0) return { text: 'All missed', tone: 'bad' as const };
  return { text: `${TABLET_COUNT - taken} missed`, tone: 'warn' as const };
}
