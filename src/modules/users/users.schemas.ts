import { z } from 'zod'
import { enumValues, GameTypes } from '../../common/types/domain'

const nicknameSchema = z
  .string()
  .trim()
  .min(3, 'nickname должен содержать минимум 3 символа')
  .max(30, 'nickname слишком длинный')
  .regex(/^[a-zA-Z0-9_]+$/, 'nickname может содержать только буквы, цифры и "_"')

const profileFieldsSchema = z.object({
  phone: z.string().trim().min(6, 'Введите корректный номер телефона'),
  nickname: nicknameSchema,
  avatarUrl: z.string().trim().or(z.literal('')),
  avatarHash: z.string().trim().or(z.literal('')),
})

export const updateProfileSchema = profileFieldsSchema.partial()

export const getProfileByNicknameQuerySchema = z.object({
  nickname: nicknameSchema,
})

export const getProfileByTelegramIdParamsSchema = z.object({
  telegramId: z.string().trim().min(1, 'telegramId обязателен'),
})

export const getProfileByIdParamsSchema = z.object({
  id: z.string().trim().min(1, 'id пользователя обязателен'),
})

export const updateUserGameStatsParamsSchema = z.object({
  id: z.string().trim().min(1, 'id пользователя обязателен'),
  game: z.enum(enumValues(GameTypes)),
})

export const updateUserGameStatsSchema = z
  .object({
    points: z.number().int().min(0).max(1_000_000).optional(),
    bounty: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((value) => value.points !== undefined || value.bounty !== undefined, {
    message: 'Требуется заполнить points или bounty',
  })

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>
export type UpdateUserGameStatsDto = z.infer<typeof updateUserGameStatsSchema>
export type UpdateUserGameStatsParamsDto = z.infer<typeof updateUserGameStatsParamsSchema>
export type GetProfileByNicknameQueryDto = z.infer<typeof getProfileByNicknameQuerySchema>
export type GetProfileByTelegramIdParamsDto = z.infer<typeof getProfileByTelegramIdParamsSchema>
export type GetProfileByIdParamsDto = z.infer<typeof getProfileByIdParamsSchema>
