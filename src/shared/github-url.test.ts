import { describe, expect, it } from 'vitest'
import { parseGitHubPrUrl } from './github-url.js'

describe('parseGitHubPrUrl', () => {
  it('parses a plain PR URL', () => {
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/123')).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 123,
      canonicalUrl: 'https://github.com/octocat/hello-world/pull/123',
    })
  })

  it('accepts http instead of https', () => {
    expect(parseGitHubPrUrl('http://github.com/octocat/hello-world/pull/1')?.canonicalUrl).toBe(
      'https://github.com/octocat/hello-world/pull/1',
    )
  })

  it('accepts an optional www prefix', () => {
    expect(
      parseGitHubPrUrl('https://www.github.com/octocat/hello-world/pull/42')?.canonicalUrl,
    ).toBe('https://github.com/octocat/hello-world/pull/42')
  })

  it('is case-insensitive about the host', () => {
    expect(parseGitHubPrUrl('HTTPS://GITHUB.COM/octocat/hello-world/pull/9')?.canonicalUrl).toBe(
      'https://github.com/octocat/hello-world/pull/9',
    )
  })

  it('accepts trailing path segments', () => {
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/7/files')).toEqual(
      expect.objectContaining({ number: 7 }),
    )
    expect(
      parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/7/review/comments'),
    ).toEqual(expect.objectContaining({ number: 7 }))
  })

  it('accepts query strings', () => {
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/7?diff=split')).toEqual(
      expect.objectContaining({ number: 7 }),
    )
    expect(
      parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/7/files?diff=split'),
    ).toEqual(expect.objectContaining({ number: 7 }))
  })

  it('accepts fragments', () => {
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/7#files')).toEqual(
      expect.objectContaining({ number: 7 }),
    )
  })

  it('accepts a trailing slash', () => {
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/7/')).toEqual(
      expect.objectContaining({ number: 7 }),
    )
  })

  it('accepts repo names with dots and underscores', () => {
    expect(parseGitHubPrUrl('https://github.com/octocat/hello.world_pkg/pull/3')).toEqual(
      expect.objectContaining({ repo: 'hello.world_pkg', number: 3 }),
    )
  })

  it('trims surrounding whitespace', () => {
    expect(parseGitHubPrUrl('  https://github.com/octocat/hello-world/pull/7  ')).toEqual(
      expect.objectContaining({ number: 7 }),
    )
  })

  it('rejects a URL without a scheme', () => {
    expect(parseGitHubPrUrl('github.com/octocat/hello-world/pull/7')).toBeNull()
  })

  it('rejects non-github hosts', () => {
    expect(parseGitHubPrUrl('https://gitlab.com/octocat/hello-world/pull/7')).toBeNull()
    expect(parseGitHubPrUrl('https://gist.github.com/octocat/hello/pull/7')).toBeNull()
  })

  it('rejects issue and repo URLs', () => {
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world')).toBeNull()
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/issues/7')).toBeNull()
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/tree/main')).toBeNull()
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/commit/abc')).toBeNull()
  })

  it('rejects non-pull paths under /pull', () => {
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/')).toBeNull()
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/abc')).toBeNull()
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/0')).toBeNull()
    expect(parseGitHubPrUrl('https://github.com/octocat/hello-world/pull/007')).toBeNull()
  })

  it('rejects nonsense and empty input', () => {
    expect(parseGitHubPrUrl('')).toBeNull()
    expect(parseGitHubPrUrl('   ')).toBeNull()
    expect(parseGitHubPrUrl('not a url at all')).toBeNull()
  })
})
