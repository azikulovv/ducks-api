import { z } from 'zod'
import { paginationSchema } from '../../common/utils/pagination.js'

const optionalTrimmedString = (schema: z.ZodType<string>) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value

      const trimmed = value.trim()
      return trimmed === '' ? undefined : trimmed
    },
    schema.optional(),
  )

const isHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

export const createBroadcastSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Текст рассылки обязателен')
    .max(4000, 'Текст рассылки слишком длинный'),
  imageUrl: optionalTrimmedString(
    z
      .string()
      .max(2048, 'Ссылка на изображение слишком длинная')
      .refine(
        (value) => value.startsWith('/uploads/') || isHttpUrl(value),
        'Некорректная ссылка на изображение',
      ),
  ),
  buttonText: optionalTrimmedString(
    z.string().min(1, 'Название кнопки обязательно').max(64, 'Название кнопки слишком длинное'),
  ),
  buttonUrl: optionalTrimmedString(
    z
      .string()
      .max(2048, 'Ссылка на кнопку слишком длинная')
      .refine(isHttpUrl, 'Ссылка на кнопку должна начинаться с http:// или https://'),
  ),
}).superRefine((data, ctx) => {
  if (Boolean(data.buttonText) === Boolean(data.buttonUrl)) return

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: data.buttonText ? ['buttonUrl'] : ['buttonText'],
    message: 'Название и ссылка кнопки должны быть заполнены вместе',
  })
})

export type CreateBroadcastDto = z.infer<typeof createBroadcastSchema>

export const broadcastListQuerySchema = paginationSchema

export const broadcastIdParamsSchema = z.object({
  id: z.string().min(1),
})

export type BroadcastListQuery = z.infer<typeof broadcastListQuerySchema>
