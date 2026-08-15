import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export const errorCodes = [
  'unknown_member',
  'name_taken',
  'invalid_pr_url',
  'duplicate_pr',
  'not_found',
  'not_poster',
  'not_assignee',
  'self_assign_forbidden',
  'already_merged',
  'validation_failed',
] as const

export type AppErrorCode = (typeof errorCodes)[number]

export interface ErrorEnvelopeBody {
  error: {
    code: AppErrorCode | 'internal'
    message: string
  }
}

const statusByCode: Record<AppErrorCode, ContentfulStatusCode> = {
  unknown_member: 401,
  name_taken: 409,
  invalid_pr_url: 400,
  duplicate_pr: 409,
  not_found: 404,
  not_poster: 403,
  not_assignee: 403,
  self_assign_forbidden: 403,
  already_merged: 409,
  validation_failed: 400,
}

const messageByCode: Record<AppErrorCode, string> = {
  unknown_member: 'That identity is not recognised.',
  name_taken: 'That name is already taken.',
  invalid_pr_url: 'That is not a valid GitHub pull request URL.',
  duplicate_pr: 'That pull request has already been posted.',
  not_found: 'That was not found.',
  not_poster: 'Only the person who posted this PR can do that.',
  not_assignee: 'Only the person assigned to this role can do that.',
  self_assign_forbidden: 'You cannot volunteer for your own PR.',
  already_merged: 'This PR has already been merged.',
  validation_failed: 'Please check the form and try again.',
}

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message?: string,
  ) {
    super(message ?? messageByCode[code])
    this.name = 'AppError'
  }
}

export function toErrorEnvelope(err: AppError): ErrorEnvelopeBody {
  return { error: { code: err.code, message: err.message } }
}

export function handleError(err: Error, c: Context): Response {
  if (err instanceof AppError) {
    return c.json(toErrorEnvelope(err), statusByCode[err.code])
  }
  console.error('[app] unhandled error', err)
  return c.json({ error: { code: 'internal', message: 'Something went wrong.' } }, 500)
}

export function validationHook(
  result: { success: boolean; error?: { issues?: { message: string }[] } },
  _c: Context,
): void {
  if (!result.success) {
    const detail = result.error?.issues?.map((issue) => issue.message).join(' ')
    throw new AppError('validation_failed', detail ?? messageByCode.validation_failed)
  }
}
