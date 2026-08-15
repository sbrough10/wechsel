import { customAlphabet } from 'nanoid'

const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16)

export function newId(): string {
  return makeId()
}
