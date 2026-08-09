import type { PrismaClient } from "@prisma/client";
import { notFound } from "../../common/errors/app-error.js";
import { getPagination, paginated } from "../../common/utils/pagination.js";
import type {
  BroadcastListQuery,
  CreateBroadcastDto,
} from "./broadcast.schemas.js";

export class BroadcastService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(dto: CreateBroadcastDto) {
    const users = await this.prisma.user.findMany({
      where: {
        telegramId: {
          not: null,
        },
      },
      select: {
        id: true,
        telegramId: true,
      },
    });

    const recipients = users.flatMap((user) => {
      const telegramUserId = Number(user.telegramId);

      if (!telegramUserId) {
        return [];
      }

      return [
        {
          userId: user.id,
          telegramUserId,
          type: "broadcast",
          message: dto.message,
        } as const,
      ];
    });

    return this.prisma.$transaction(async (tx) => {
      const broadcast = await tx.broadcast.create({
        data: {
          message: dto.message,
          imageUrl: dto.imageUrl ?? null,
          buttonText: dto.buttonText ?? null,
          buttonUrl: dto.buttonUrl ?? null,
          totalUsers: users.length,
          createdCount: recipients.length,
          skippedCount: users.length - recipients.length,
        },
      });

      if (recipients.length) {
        await tx.notificationQueue.createMany({
          data: recipients.map((recipient) => ({
            ...recipient,
            broadcastId: broadcast.id,
          })),
        });
      }

      return broadcast;
    });
  }

  async findAll(query: BroadcastListQuery) {
    const pagination = getPagination(query);
    const [broadcasts, total] = await this.prisma.$transaction([
      this.prisma.broadcast.findMany({
        ...pagination,
        orderBy: { createdAt: "desc" },
        include: {
          notifications: {
            select: { status: true },
          },
        },
      }),
      this.prisma.broadcast.count(),
    ]);

    return paginated(
      broadcasts.map(({ notifications, ...broadcast }) => ({
        ...broadcast,
        delivery: this.getDeliveryStats(notifications),
      })),
      total,
      query,
    );
  }

  async findById(id: string) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id },
      include: {
        notifications: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!broadcast) throw notFound("Рассылка не найдена");

    const { notifications, ...data } = broadcast;

    return {
      ...data,
      delivery: this.getDeliveryStats(notifications),
      recipients: notifications.map((notification) => ({
        id: notification.id,
        user: notification.user,
        telegramUserId: notification.telegramUserId,
        deliveryStatus: notification.status === "sent" ? "sent" : "not_sent",
        queueStatus: notification.status,
        attempts: notification.attempts,
        sentAt: notification.sentAt,
        error: notification.error,
      })),
    };
  }

  private getDeliveryStats(notifications: Array<{ status: string }>) {
    const sent = notifications.filter(({ status }) => status === "sent").length;

    return {
      total: notifications.length,
      sent,
      notSent: notifications.length - sent,
    };
  }
}
