export const MED_SLOTS = ['morning', 'evening', 'bp'];

export function isValidMedSlot(slot) {
  return MED_SLOTS.includes(slot);
}
