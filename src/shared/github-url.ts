export interface ParsedGitHubPrUrl {
  owner: string
  repo: string
  number: number
  canonicalUrl: string
}

const GITHUB_PR_URL =
  /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)\/pull\/([1-9]\d*)(?:\/[^\s?#]*)?(?:[?#][^\s]*)?$/i

export function parseGitHubPrUrl(input: string): ParsedGitHubPrUrl | null {
  const match = GITHUB_PR_URL.exec(input.trim())
  if (!match) return null
  const [, owner = '', repo = '', number = ''] = match
  return {
    owner,
    repo,
    number: Number(number),
    canonicalUrl: `https://github.com/${owner}/${repo}/pull/${number}`,
  }
}
