import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PURCHASE_COMPLETED_OUTBOX_EVENT } from '../../outbox/outbox-event.types';
import { OutboxService } from '../../outbox/outbox.service';
import { User } from '../users/entities/user.entity';
import { Purchase } from './entities/purchase.entity';
import { PurchaseStatus } from './types/purchase-status.enum';

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    private readonly outbox: OutboxService,
  ) {}

  async createCompletedPurchase(userId: string, amount: number) {
    this.logger.log(
      `Creating completed purchase: userId=${userId}, amount=${amount}`,
    );

    const { purchase, totalCompletedPurchases } =
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

        await this.outbox.create(manager, {
          eventType: PURCHASE_COMPLETED_OUTBOX_EVENT,
          aggregateType: 'purchase',
          aggregateId: purchase.id,
          payload: {
            purchaseId: purchase.id,
            userId,
            totalCompletedPurchases,
          },
        });
        this.logger.debug(
          `Purchase completed outbox event created: purchaseId=${purchase.id}, userId=${userId}, totalCompletedPurchases=${totalCompletedPurchases}`,
        );

        return {
          purchase,
          totalCompletedPurchases,
        };
      });

    this.logger.log(
      `Completed purchase persisted and queued for async processing: purchaseId=${purchase.id}, userId=${userId}, totalCompletedPurchases=${totalCompletedPurchases}`,
    );
    this.logger.debug(
      `Purchase response can return without waiting for achievement, badge, or cashback processing: purchaseId=${purchase.id}`,
    );

    return {
      purchase,
      totalCompletedPurchases,
    };
  }
}
