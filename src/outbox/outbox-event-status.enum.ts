export enum OutboxEventStatus {
  Pending = 'pending',
  Processing = 'processing',
  Published = 'published',
  Failed = 'failed',
}
