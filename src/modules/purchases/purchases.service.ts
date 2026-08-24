import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Purchase } from './entities/purchase.entity';
import { PurchaseCompletedEvent } from './events/purchase-completed.event';
import { PURCHASE_COMPLETED_EVENT } from './events/purchase.events';
import { PurchaseStatus } from './types/purchase-status.enum';

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createCompletedPurchase(userId: string, amount: number) {
    this.logger.log(
      `Creating completed purchase: userId=${userId}, amount=${amount}`,
    );

    const { purchase, user, totalCompletedPurchases } =
      await this.purchaseRepository.manager.transaction(async (manager) => {
        const userRepository = manager.getRepository(User);
        const purchaseRepository = manager.getRepository(Purchase);

        const user = await userRepository.findOne({ where: { id: userId } });

        if (!user) {
          this.logger.warn(
            `Purchase creation rejected because user does not exist: userId=${userId}`,
          );

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

    this.logger.log(
      `Completed purchase persisted: purchaseId=${purchase.id}, userId=${userId}, totalCompletedPurchases=${totalCompletedPurchases}`,
    );
    this.logger.debug(
      `Emitting purchase completed event: purchaseId=${purchase.id}, userId=${userId}, totalCompletedPurchases=${totalCompletedPurchases}`,
    );

    await this.eventEmitter.emitAsync(
      PURCHASE_COMPLETED_EVENT,
      new PurchaseCompletedEvent(user, totalCompletedPurchases),
    );

    this.logger.debug(
      `Purchase completed event handlers finished: purchaseId=${purchase.id}, userId=${userId}`,
    );

    return {
      purchase,
      totalCompletedPurchases,
    };
  }
}
