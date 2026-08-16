import { eq, isNull } from 'drizzle-orm'
import { toNameKey } from '../../shared/schemas.js'
import type { MemberView } from '../../shared/types.js'
import type { Database } from '../db/client.js'
import { newId } from '../db/id.js'
import { assignments, members, type Member } from '../db/schema.js'
import { AppError } from '../errors.js'

export function toMemberView(member: Member): MemberView {
  return {
    id: member.id,
    displayName: member.displayName,
    nameKey: member.nameKey,
    createdAt: member.createdAt.getTime(),
    removedAt: member.removedAt ? member.removedAt.getTime() : null,
  }
}

export async function getMemberById(db: Database, id: string): Promise<Member | undefined> {
  return db.select().from(members).where(eq(members.id, id)).get()
}

export async function listMembers(db: Database, includeRemoved = false): Promise<MemberView[]> {
  const rows = await db
    .select()
    .from(members)
    .where(includeRemoved ? undefined : isNull(members.removedAt))
    .orderBy(members.displayName)
    .all()
  return rows.map(toMemberView)
}

export async function findOrCreate(db: Database, displayName: string): Promise<MemberView> {
  const nameKey = toNameKey(displayName)
  const existing = await db.select().from(members).where(eq(members.nameKey, nameKey)).get()
  if (existing) {
    if (existing.removedAt) {
      await db.update(members).set({ removedAt: null }).where(eq(members.id, existing.id))
    }
    return toMemberView({ ...existing, removedAt: null })
  }

  const created: Member = {
    id: newId(),
    displayName: displayName.trim(),
    nameKey,
    createdAt: new Date(),
    removedAt: null,
  }
  await db.insert(members).values(created)
  return toMemberView(created)
}

export async function removeMember(db: Database, id: string): Promise<MemberView> {
  const member = await db.select().from(members).where(eq(members.id, id)).get()
  if (!member) {
    throw new AppError('not_found', 'No member with that id.')
  }

  await db.update(members).set({ removedAt: new Date() }).where(eq(members.id, id))
  await db.delete(assignments).where(eq(assignments.memberId, id))

  return toMemberView({ ...member, removedAt: new Date() })
}
