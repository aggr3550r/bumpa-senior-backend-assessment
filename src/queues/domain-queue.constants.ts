export const PURCHASE_EVENTS_QUEUE = 'purchase-events';
export const ACHIEVEMENT_EVENTS_QUEUE = 'achievement-events';
export const BADGE_EVENTS_QUEUE = 'badge-events';

export const DOMAIN_EVENT_QUEUES = [
  PURCHASE_EVENTS_QUEUE,
  ACHIEVEMENT_EVENTS_QUEUE,
  BADGE_EVENTS_QUEUE,
] as const;
