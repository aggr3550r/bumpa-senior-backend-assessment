import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Purchase } from './entities/purchase.entity';
import { PurchaseCompletedEvent } from './events/purchase-completed.event';
import { PURCHASE_COMPLETED_EVENT } from './events/purchase.events';
import { PurchaseStatus } from './purchase-status.enum';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createCompletedPurchase(userId: string, amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive integer');
    }

    const { purchase, user, totalCompletedPurchases } =
      await this.purchaseRepository.manager.transaction(async (manager) => {
        const userRepository = manager.getRepository(User);
        const purchaseRepository = manager.getRepository(Purchase);

        const user = await userRepository.findOne({ where: { id: userId } });

        if (!user) {
          throw new NotFoundException('user not found');
        }

        const purchase = await purchaseRepository.save(
          purchaseRepository.create({
            userId,
            amount,
            status: PurchaseStatus.Completed,
            completedAt: new Date(),
          }),
        );
        const totalCompletedPurchases = await purchaseRepository.count({
          where: {
            userId,
            status: PurchaseStatus.Completed,
          },
        });

        return {
          purchase,
          user,
          totalCompletedPurchases,
        };
      });

    await this.eventEmitter.emitAsync(
      PURCHASE_COMPLETED_EVENT,
      new PurchaseCompletedEvent(user, totalCompletedPurchases),
    );

    return {
      purchase,
      totalCompletedPurchases,
    };
  }
}
