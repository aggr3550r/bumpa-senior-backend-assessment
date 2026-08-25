import { ConfigService } from '@nestjs/config';
import {
  ACHIEVEMENT_UNLOCKED_OUTBOX_EVENT,
  BADGE_UNLOCKED_OUTBOX_EVENT,
  PURCHASE_COMPLETED_OUTBOX_EVENT,
} from '../outbox/outbox-event.types';
import { OutboxService } from '../outbox/outbox.service';
import { OutboxDispatcherService } from './outbox-dispatcher.service';

describe('OutboxDispatcherService', () => {
  it('publishes claimed outbox events to the matching BullMQ queue', async () => {
    const purchaseQueue = buildQueue();
    const achievementQueue = buildQueue();
    const badgeQueue = buildQueue();
    const outbox = {
      claimPublishableBatch: jest.fn(async () => [
        {
          id: 'purchase-event-id',
          eventType: PURCHASE_COMPLETED_OUTBOX_EVENT,
          payload: { userId: 'user-id' },
          attemptCount: 1,
        },
        {
          id: 'achievement-event-id',
          eventType: ACHIEVEMENT_UNLOCKED_OUTBOX_EVENT,
          payload: { userId: 'user-id' },
          attemptCount: 1,
        },
        {
          id: 'badge-event-id',
          eventType: BADGE_UNLOCKED_OUTBOX_EVENT,
          payload: { userId: 'user-id' },
          attemptCount: 1,
        },
      ]),
      markPublished: jest.fn(async () => undefined),
      markFailed: jest.fn(async () => undefined),
    };
    const dispatcher = buildDispatcher({
      outbox,
      purchaseQueue,
      achievementQueue,
      badgeQueue,
    });

    await dispatcher.dispatchOnce();

    expect(purchaseQueue.add).toHaveBeenCalledWith(
      PURCHASE_COMPLETED_OUTBOX_EVENT,
      { userId: 'user-id' },
      expect.objectContaining({ jobId: 'purchase-event-id' }),
    );
    expect(achievementQueue.add).toHaveBeenCalledWith(
      ACHIEVEMENT_UNLOCKED_OUTBOX_EVENT,
      { userId: 'user-id' },
      expect.objectContaining({ jobId: 'achievement-event-id' }),
    );
    expect(badgeQueue.add).toHaveBeenCalledWith(
      BADGE_UNLOCKED_OUTBOX_EVENT,
      { userId: 'user-id' },
      expect.objectContaining({ jobId: 'badge-event-id' }),
    );
    expect(outbox.markPublished).toHaveBeenCalledTimes(3);
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('marks an outbox event failed when enqueueing fails', async () => {
    const enqueueError = new Error('redis unavailable');
    const purchaseQueue = buildQueue({ error: enqueueError });
    const outbox = {
      claimPublishableBatch: jest.fn(async () => [
        {
          id: 'purchase-event-id',
          eventType: PURCHASE_COMPLETED_OUTBOX_EVENT,
          payload: { userId: 'user-id' },
          attemptCount: 3,
        },
      ]),
      markPublished: jest.fn(async () => undefined),
      markFailed: jest.fn(async () => undefined),
    };
    const dispatcher = buildDispatcher({
      outbox,
      purchaseQueue,
      achievementQueue: buildQueue(),
      badgeQueue: buildQueue(),
    });

    await dispatcher.dispatchOnce();

    expect(outbox.markPublished).not.toHaveBeenCalled();
    expect(outbox.markFailed).toHaveBeenCalledWith(
      'purchase-event-id',
      3,
      enqueueError,
    );
  });
});

function buildDispatcher(input: {
  outbox: Partial<OutboxService>;
  purchaseQueue: FakeQueue;
  achievementQueue: FakeQueue;
  badgeQueue: FakeQueue;
}) {
  const configService = {
    get: jest.fn((_key: string, fallback: number) => fallback),
  };

  return new OutboxDispatcherService(
    input.outbox as OutboxService,
    configService as unknown as ConfigService,
    input.purchaseQueue as never,
    input.achievementQueue as never,
    input.badgeQueue as never,
  );
}

interface FakeQueue {
  add: jest.Mock;
}

function buildQueue(options: { error?: Error } = {}) {
  return {
    add: jest.fn(async () => {
      if (options.error) {
        throw options.error;
      }
    }),
  };
}
