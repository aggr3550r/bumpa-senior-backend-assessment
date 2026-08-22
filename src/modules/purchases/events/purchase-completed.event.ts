import { User } from '../../users/entities/user.entity';

export class PurchaseCompletedEvent {
  constructor(
    public readonly user: User,
    public readonly totalCompletedPurchases: number,
  ) {}
}
