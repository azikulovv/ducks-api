import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'
import { env } from '../../config/env.js'

const MAX_EMBEDDED_IMAGE_SIZE = 8 * 1024 * 1024

export const EventRegistrationNotificationTypes = {
  registeredAsParticipant: 'REGISTERED_AS_PARTICIPANT',
  addedToWaitingList: 'ADDED_TO_WAITING_LIST',
  waitingListPromoted: 'WAITING_LIST_PROMOTED',
} as const

export type EventRegistrationNotificationType =
  (typeof EventRegistrationNotificationTypes)[keyof typeof EventRegistrationNotificationTypes]

export type EventRegistrationNotificationPayload = {
  message: string
  telegramUserId: number
  imageUrl?: string
  buttonText?: string
  buttonUrl?: string
}

type SendEventNotificationOptions = {
  throwOnError?: boolean
  timeoutMs?: number
}

export async function sendEventNotification(
  payload: EventRegistrationNotificationPayload,
  options: SendEventNotificationOptions = {},
) {
  try {
    const requestPayload = await embedLocalImage(payload)
    const { data } = await axios.post(`${env.TELEGRAM_BOT_API_URL}/notification`, requestPayload, {
      timeout: options.timeoutMs ?? 10_000,
      maxBodyLength: 12 * 1024 * 1024,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('Telegram bot notification response:', data)
    console.log('Telegram bot notification payload:', payload)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Telegram bot notification failed', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      })

      if (options.throwOnError) {
        const responseData =
          error.response?.data === undefined ? '' : `: ${JSON.stringify(error.response.data)}`

        throw new Error(`${error.message}${responseData}`)
      }

      return
    }

    console.error('Telegram bot notification failed', error)

    if (options.throwOnError) throw error
  }
}

async function embedLocalImage(payload: EventRegistrationNotificationPayload) {
  if (!payload.imageUrl?.startsWith('/uploads/')) return payload

  const fileName = path.basename(payload.imageUrl)
  const filePath = path.join(process.cwd(), 'uploads', fileName)
  const image = await fs.readFile(filePath)

  if (image.length > MAX_EMBEDDED_IMAGE_SIZE) {
    throw new Error('Изображение рассылки превышает допустимый размер 8 МБ')
  }

  return {
    ...payload,
    imageBase64: image.toString('base64'),
    imageFilename: fileName,
  }
}
