import type { Context, Next } from 'hono'
import type { Database } from '../db/client.js'
import type { Member } from '../db/schema.js'
import { AppError } from '../errors.js'
import { getMemberById } from '../services/members.js'

export type ActorContext = { Variables: { member: Member } }

export function actorMiddleware(db: Database) {
  return async (c: Context<ActorContext>, next: Next): Promise<Response | void> => {
    const memberId = c.req.header('x-member-id')
    if (!memberId) {
      throw new AppError('unknown_member', 'Pick an identity first.')
    }
    const member = await getMemberById(db, memberId)
    if (!member || member.removedAt) {
      throw new AppError('unknown_member', 'That identity no longer exists.')
    }
    c.set('member', member)
    await next()
  }
}
