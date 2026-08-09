import { describe, expect, it } from 'vitest'
import { createBroadcastSchema } from '../src/modules/broadcasts/broadcast.schemas.js'

describe('createBroadcastSchema', () => {
  it('keeps text-only broadcasts backward compatible', () => {
    expect(createBroadcastSchema.safeParse({ message: 'Тестовая рассылка' }).success).toBe(true)
  })

  it('accepts an image and a complete button', () => {
    const result = createBroadcastSchema.safeParse({
      message: 'Тестовая рассылка',
      imageUrl: '/uploads/broadcast.webp',
      buttonText: 'Подробнее',
      buttonUrl: 'https://example.com/details',
    })

    expect(result.success).toBe(true)
  })

  it('accepts a relative Web App path', () => {
    const result = createBroadcastSchema.safeParse({
      message: 'Тестовая рассылка',
      buttonText: 'Открыть событие',
      buttonUrl: '/events/event-id',
    })

    expect(result.success).toBe(true)
  })

  it('rejects a button without a URL', () => {
    const result = createBroadcastSchema.safeParse({
      message: 'Тестовая рассылка',
      buttonText: 'Подробнее',
    })

    expect(result.success).toBe(false)
  })

  it('rejects unsafe button URL protocols', () => {
    const result = createBroadcastSchema.safeParse({
      message: 'Тестовая рассылка',
      buttonText: 'Подробнее',
      buttonUrl: 'javascript:alert(1)',
    })

    expect(result.success).toBe(false)
  })
})
