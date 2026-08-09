import type { PrismaClient } from '@prisma/client'
import { sendEventNotification } from '../telegram-bot/telegram-bot.api.js'

const MAX_ATTEMPTS = 3

export class NotificationQueueService {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueue(payload: {
    userId?: string
    telegramUserId: number
    message: string
    type: 'warmup' | 'broadcast' | 'event_reminder'
    scheduledAt?: Date
  }) {
    return this.prisma.notificationQueue.create({
      data: {
        type: payload.type,
        message: payload.message,
        telegramUserId: payload.telegramUserId,
        scheduledAt: payload.scheduledAt ?? new Date(),
        ...(!!payload.userId && { userId: payload.userId }),
      },
    })
  }

  async processPending(limit = 20) {
    const notifications = await this.prisma.notificationQueue.findMany({
      where: {
        status: 'pending',
        scheduledAt: {
          lte: new Date(),
        },
        attempts: {
          lt: MAX_ATTEMPTS,
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
      take: limit,
    })

    for (const notification of notifications) {
      await this.processOne(notification.id)

      // безопасная задержка между сообщениями
      await this.sleep(300)
    }
  }

  private async processOne(id: string) {
    const notification = await this.prisma.notificationQueue.update({
      where: { id },
      data: {
        status: 'processing',
        attempts: {
          increment: 1,
        },
      },
      include: {
        broadcast: {
          select: {
            imageUrl: true,
            buttonText: true,
            buttonUrl: true,
          },
        },
      },
    })

    try {
      await sendEventNotification(
        {
          telegramUserId: notification.telegramUserId,
          message: notification.message,
          ...(notification.broadcast?.imageUrl && { imageUrl: notification.broadcast.imageUrl }),
          ...(notification.broadcast?.buttonText && {
            buttonText: notification.broadcast.buttonText,
          }),
          ...(notification.broadcast?.buttonUrl && { buttonUrl: notification.broadcast.buttonUrl }),
        },
        {
          throwOnError: true,
          timeoutMs: 30_000,
        },
      )

      await this.prisma.notificationQueue.update({
        where: { id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          error: null,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'

      await this.prisma.notificationQueue.update({
        where: { id },
        data: {
          status: notification.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          failedAt: notification.attempts >= MAX_ATTEMPTS ? new Date() : null,
          error: message,
          scheduledAt: this.getNextRetryDate(message),
        },
      })
    }
  }

  private getNextRetryDate(errorMessage: string) {
    const retryAfterMatch = errorMessage.match(/retry_after["']?:\s?(\d+)/i)
    const retryAfterSeconds = retryAfterMatch?.[1] ? Number(retryAfterMatch[1]) : 60

    return new Date(Date.now() + retryAfterSeconds * 1000)
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
