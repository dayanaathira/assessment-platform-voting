/** Seeded `status` ids. */
export const STATUS_ID = {
  UNDER_REVIEW: 1,
  PLANNED: 2,
  IN_PROGRESS: 3,
  RELEASED: 4,
  DECLINED: 5,
} as const;

/** Statuses where a decision is made, so votes can no longer change. */
export const CLOSED_STATUS_IDS: readonly number[] = [
  STATUS_ID.RELEASED,
  STATUS_ID.DECLINED,
];
