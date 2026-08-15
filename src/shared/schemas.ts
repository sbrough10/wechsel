import { z } from 'zod'
import { parseGitHubPrUrl } from './github-url.js'

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

const requirementsField = z
  .number({ message: 'Pick a number between 0 and 10' })
  .int({ message: 'Must be a whole number' })
  .min(0, 'Must be 0 or more')
  .max(10, 'Must be 10 or fewer')

export const createPullRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'A GitHub pull request URL is required')
    .refine((url) => parseGitHubPrUrl(url) !== null, 'That is not a valid GitHub pull request URL'),
  reviewersRequired: requirementsField,
  testersRequired: requirementsField,
  note: z.string().trim().max(200, 'Note must be 200 characters or fewer').optional(),
})

export type CreatePullRequestInput = z.infer<typeof createPullRequestSchema>

export const updatePullRequestSchema = z.object({
  reviewersRequired: requirementsField.optional(),
  testersRequired: requirementsField.optional(),
  note: z.string().trim().max(200, 'Note must be 200 characters or fewer').optional(),
})

export type UpdatePullRequestInput = z.infer<typeof updatePullRequestSchema>

export const roleSchema = z.enum(['review', 'acceptance'], {
  message: 'Pick a role',
})

export type Role = z.infer<typeof roleSchema>

export const createAssignmentSchema = z.object({
  role: roleSchema,
})

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>
