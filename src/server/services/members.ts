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

export function getMemberById(db: Database, id: string): Member | undefined {
  return db.select().from(members).where(eq(members.id, id)).get()
}

export function listMembers(db: Database, includeRemoved = false): MemberView[] {
  const rows = db
    .select()
    .from(members)
    .where(includeRemoved ? undefined : isNull(members.removedAt))
    .orderBy(members.displayName)
    .all()
  return rows.map(toMemberView)
}

export function findOrCreate(db: Database, displayName: string): MemberView {
  const nameKey = toNameKey(displayName)
  const existing = db.select().from(members).where(eq(members.nameKey, nameKey)).get()
  if (existing) {
    if (existing.removedAt) {
      db.update(members).set({ removedAt: null }).where(eq(members.id, existing.id)).run()
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
  db.insert(members).values(created).run()
  return toMemberView(created)
}

export function removeMember(db: Database, id: string): MemberView {
  const member = db.select().from(members).where(eq(members.id, id)).get()
  if (!member) {
    throw new AppError('not_found', 'No member with that id.')
  }

  db.transaction((tx) => {
    tx.update(members).set({ removedAt: new Date() }).where(eq(members.id, id)).run()
    tx.delete(assignments).where(eq(assignments.memberId, id)).run()
  })

  return toMemberView({ ...member, removedAt: new Date() })
}
