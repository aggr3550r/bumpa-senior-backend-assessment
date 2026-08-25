import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { quoteTablePath } from '../database/quote-table-path';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxEventStatus } from './outbox-event-status.enum';
import {
  ClaimedOutboxEvent,
  CreateOutboxEventInput,
} from './outbox-event.types';

type OutboxEventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempt_count: number;
};

@Injectable()
export class OutboxService {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxEventRepository: Repository<OutboxEvent>,
  ) {}

  async create(
    manager: EntityManager,
    input: CreateOutboxEventInput,
  ): Promise<OutboxEvent> {
    const repository = manager.getRepository(OutboxEvent);

    return repository.save(
      repository.create({
        eventType: input.eventType,
        aggregateType: input.aggregateType ?? null,
        aggregateId: input.aggregateId ?? null,
        payload: { ...input.payload },
        status: OutboxEventStatus.Pending,
        nextAttemptAt: new Date(),
      }),
    );
  }

  async claimPublishableBatch(limit: number): Promise<ClaimedOutboxEvent[]> {
    const outboxTable = quoteTablePath(
      this.outboxEventRepository.metadata.tablePath,
    );

    /*
     * SKIP LOCKED lets multiple dispatcher processes cooperate without
     * blocking each other. The status update is the claim; if a dispatcher
     * crashes, the retry path can safely pick the row up later.
     */
    const queryResult = (await this.outboxEventRepository.query(
      `
        UPDATE ${outboxTable}
        SET
          status = $1,
          locked_at = now(),
          attempt_count = attempt_count + 1,
          updated_at = now()
        WHERE id IN (
          SELECT id
          FROM ${outboxTable}
          WHERE status IN ($2, $3)
            AND next_attempt_at <= now()
          ORDER BY created_at ASC
          LIMIT $4
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, event_type, payload, attempt_count
      `,
      [
        OutboxEventStatus.Processing,
        OutboxEventStatus.Pending,
        OutboxEventStatus.Failed,
        limit,
      ],
    )) as Array<OutboxEventRow> | [Array<OutboxEventRow>, number];
    const rows = Array.isArray(queryResult[0])
      ? queryResult[0]
      : (queryResult as Array<OutboxEventRow>);

    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      payload: row.payload,
      attemptCount: row.attempt_count,
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.outboxEventRepository.update(
      { id },
      {
        status: OutboxEventStatus.Published,
        publishedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    );
  }

  async markFailed(
    id: string,
    attemptCount: number,
    error: unknown,
  ): Promise<void> {
    const failureReason =
      error instanceof Error ? error.message : 'Outbox dispatch failed';
    const normalizedAttemptCount =
      Number.isInteger(attemptCount) && attemptCount > 0 ? attemptCount : 1;
    const retryDelayMs = Math.min(
      60_000,
      2 ** Math.max(normalizedAttemptCount - 1, 0) * 1000,
    );

    await this.outboxEventRepository.update(
      { id },
      {
        status: OutboxEventStatus.Failed,
        lockedAt: null,
        lastError: failureReason,
        nextAttemptAt: new Date(Date.now() + retryDelayMs),
      },
    );
  }
}
