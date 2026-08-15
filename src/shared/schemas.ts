import { z } from 'zod'

export const createMemberSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(40, 'Name must be 40 characters or fewer')
    .refine((name) => name.length > 0 && /\S/.test(name), 'Name cannot be blank'),
})

export type CreateMemberInput = z.infer<typeof createMemberSchema>

export function toNameKey(displayName: string): string {
  return displayName.trim().toLowerCase().replace(/\s+/g, ' ')
}
