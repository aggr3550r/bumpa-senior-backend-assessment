import { EntityManager } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';

export const PURCHASE_COMPLETED_OUTBOX_EVENT = 'purchase.completed';
export const ACHIEVEMENT_UNLOCKED_OUTBOX_EVENT = 'achievement.unlocked';
export const BADGE_UNLOCKED_OUTBOX_EVENT = 'badge.unlocked';

export interface PurchaseCompletedOutboxPayload {
  purchaseId: string;
  userId: string;
  totalCompletedPurchases: number;
}

export interface AchievementUnlockedOutboxPayload {
  achievementId: string;
  achievementName: string;
  userId: string;
}

export interface BadgeUnlockedOutboxPayload {
  badgeId: string;
  badgeName: string;
  userId: string;
}

export type DomainOutboxPayload =
  | PurchaseCompletedOutboxPayload
  | AchievementUnlockedOutboxPayload
  | BadgeUnlockedOutboxPayload;

export interface CreateOutboxEventInput {
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  payload: DomainOutboxPayload;
}

export interface ClaimedOutboxEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  attemptCount: number;
}

export interface OutboxWriter {
  create(manager: EntityManager, input: CreateOutboxEventInput): Promise<OutboxEvent>;
}
