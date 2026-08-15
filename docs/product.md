# Wechsel - Product Requirements

_App name: **Wechsel**. "Review Rota" was the working name; the confirmed name is Wechsel._

## 1. Purpose

A small internal web app that makes it obvious when a teammate's pull request is waiting for help, and who has stepped up to give it. The team posts PRs that need review and/or acceptance testing, teammates volunteer for those jobs, and a leaderboard makes the invisible work of reviewing visible.

It is a **shared, trusted-network tool for one team** (expect 3-20 people). There is no login, no password, and no attempt to stop someone from acting as someone else. Identity is a convenience for attribution, not a security boundary. This is a deliberate trade-off, recorded in [architecture.md](architecture.md#12-security-posture).

## 2. Confirmed decisions

These were agreed before writing this document and drive the rules below:

- **Identity:** the member you pick is stored in browser `localStorage`; a "Switch user" control lets you change it. No passwords.
- **Freshness:** clients poll the API every 2 seconds (`POLL_INTERVAL_MS` in `src/client/lib/polling.ts`) and refetch when the window regains focus. No WebSockets.
- **GitHub:** the app parses `owner/repo/number` out of the pasted URL for display. It makes **no** GitHub API calls, so it cannot auto-detect a real merge. The poster may add an optional short note.
- **Role rules:** the poster of a PR may not review or acceptance-test their own PR. Anyone else may hold **both** roles on the same PR.
- **Removed members:** removing a member is a soft delete. They stay on the leaderboard marked as removed, but cannot be picked as an identity or assigned to anything.
- **Merging:** anyone can mark a PR merged. It leaves the active list and moves into a collapsed "Recently merged" list, still counting toward the leaderboard.
- **Requirements:** both "reviewers needed" and "acceptance testers needed" are numbers (0-10). `0` means "not needed".
- **Over-volunteering:** extra volunteers beyond the required count are allowed, and their completed work counts.
- **Leaderboard:** all-time totals only.

## 3. Glossary

- **Member** - a person on the team, identified only by a unique display name.
- **PR post** - a pasted GitHub PR URL plus its requirements, owned by the member who posted it (the **poster**).
- **Role** - either `review` or `acceptance` (acceptance testing).
- **Requirement** - how many people are needed for a role on a PR (`reviewersRequired`, `testersRequired`).
- **Assignment** - the live record that a member has volunteered for a role on a PR. It can be marked done, and it can be removed.
- **Completion credit** - an append-only record that a member finished a role on a PR. **Credit is never destroyed by removing an assignment or a member.** This is what the leaderboard counts.

The split between *assignment* (live, mutable) and *completion credit* (permanent) is the central idea of the product. It is what makes "the poster can clear a completed review because the PR changed" coexist with "reviewers never lose credit for work they actually did".

## 4. Core user flows

### 4.1 First visit - choose an identity

1. A visitor with no stored identity sees a single centered card: "Who are you?"
2. They can pick from a searchable list of existing active members, or type a brand-new name and confirm.
3. Names are unique, case-insensitively, and trimmed (`  Sam  ` and `sam` are the same name).
4. The chosen member id is saved to `localStorage`. Every later visit from that browser goes straight to the dashboard.
5. The header shows the current identity with a "Switch user" action that returns to this card.

Edge case: typing a name that matches a **removed** member reactivates that member and restores their history. See [decision D3](#8-edge-cases-and-decisions).

### 4.2 Post a PR

1. In the **Post a PR** section, the member pastes a GitHub PR URL.
2. They set **Reviewers needed** (default 1) and **Acceptance testers needed** (default 0), each 0-10.
3. Optional short note (max 200 chars), e.g. "config change only, quick look".
4. On submit the URL is validated and canonicalised to `https://github.com/{owner}/{repo}/pull/{number}`; anything that is not a GitHub PR URL is rejected with a clear inline message.
5. The PR appears immediately in the open list, attributed to the poster.

### 4.3 Volunteer and finish

1. In the **Open PRs** section each PR card shows its two role tracks with progress, e.g. `Review 1/2`, `Acceptance 0/1`, plus who is on each track and whether they are done.
2. Any active member who is not the poster can click **Review this** or **Acceptance test this** to take a slot. Volunteering is allowed even when the track is already full.
3. Once assigned, that person sees **Mark done** for that role. Marking done writes permanent completion credit.
4. They can **Undo done** if they clicked it by mistake - this removes that specific credit.
5. They can **Remove me** at any time, including after marking done. Removing themselves frees the slot but **keeps** their credit.

### 4.4 The poster keeps a PR honest

The poster of a PR can, at any time before or after it is merged:

- Change **Reviewers needed** and **Acceptance testers needed**.
- **Clear** any other member's assignment on their PR - assigned or already completed - because the PR has changed and needs a fresh pass. The cleared person keeps their credit; the slot reopens.

### 4.5 Merge

- Any member can **Mark merged**. The PR leaves the open list and appears in a collapsed **Recently merged** section (newest first, capped at the 20 most recent by default with a "show all" toggle).
- Merged PRs are read-only apart from **Undo merge** (which returns the PR to the open list) and the poster's ongoing controls from [section 4.4](#44-the-poster-keeps-a-pr-honest): they may still clear assignments and change requirements.
- Completion credit on merged PRs still counts on the leaderboard.

### 4.6 Delete a PR post

- Any member can delete any PR post. This always requires a confirmation dialog naming the PR (`owner/repo#123`) and warning that completion credit on it will stop counting.
- Deletion is a soft delete in the database, but the PR and its credit disappear from all views and leaderboard totals. See [decision D1](#8-edge-cases-and-decisions).

### 4.7 Remove a team member

- Any member can remove any member, including themselves, from a **Team** control in the leaderboard section.
- This always requires a confirmation dialog naming the member and stating exactly what happens.
- Effects: the member can no longer be picked or assigned; **all** their live assignments are dropped, freeing those slots on every affected PR; every completion credit they earned is preserved; they remain on the leaderboard with a "removed" badge.
- If the removed member is the identity stored in the current browser, that browser is returned to the identity card on its next request.

## 5. Screens

One page, three stacked sections, plus a header. No routing.

### 5.1 Header

Current identity, "Switch user", a theme toggle (system / light / dark), and a subtle "updated Xs ago" indicator so people trust that the page is live. When the connection is lost the indicator stops pretending: it turns red and reads "Offline · last update Xs ago", showing the age of the last successful update until polling recovers.

### 5.2 Section 1 - Post a PR

Compact card: URL field, two number steppers, optional note, submit. Inline validation errors. Success clears the form and toasts.

### 5.3 Section 2 - PRs

Open PRs first, then the collapsed **Recently merged** list.

Each open PR card shows:

- `owner/repo#number` as a link opening GitHub in a new tab, plus the optional note.
- Who posted it and how long ago.
- A **status badge**, derived (see [section 6](#6-derived-pr-status)).
- Two role tracks. Each track shows `done/required`, a chip per assignee (initials or name, with a check when done), and the actions available to the current viewer.
- Actions, shown only when permitted: **Review this** / **Acceptance test this**, **Mark done** / **Undo done** / **Remove me** on your own assignment, **Clear** on others' assignments if you are the poster, requirement steppers if you are the poster, **Mark merged**, **Delete**.

Default ordering of open PRs: PRs with unfilled slots first (oldest posted first, so nothing rots), then PRs where everyone assigned is still working, then PRs whose requirements are fully met.

Empty state: a friendly "No open PRs - post one above."

### 5.4 Section 3 - Leaderboard

Two side-by-side ranked lists, **Reviews completed** and **Acceptance tests completed**:

- Every active member appears, including those with `0`.
- Removed members appear **only** if they have at least one credit, with a "removed" badge.
- Sorted by count descending, then display name ascending. Ties share a rank number.
- The current user's row is highlighted.
- A **Team** area lists members with a remove action per member.

## 6. Derived PR status

Computed by the server, never stored:

- `merged` - `mergedAt` is set.
- `needs_volunteers` - either track has fewer assignees than required.
- `in_progress` - both tracks are fully staffed, but not all required work is marked done.
- `ready` - completed count meets or exceeds required for both tracks. Shown as "Ready to merge".

A track with a requirement of `0` is always satisfied and renders as "not needed".

## 7. Permissions

Actor is the current identity, sent on every mutation.

- Pick or create identity: anyone.
- Post a PR: any active member.
- Assign self to a role: any active member **except** the poster of that PR.
- Mark done / undo done / remove own assignment: only the assignee.
- Clear another member's assignment: only the poster of that PR.
- Change requirement counts: only the poster of that PR.
- Mark merged / undo merge: any active member.
- Delete a PR: any active member (with confirmation).
- Remove a member: any active member (with confirmation).

Every rule is enforced on the server; the UI additionally hides actions the viewer cannot perform.

## 8. Edge cases and decisions

**D1 - Deleted PRs do not count on the leaderboard.** The brief defines the leaderboard as work on "active and merged PRs", so a deleted PR's credit stops counting. Deletion is meant for mistakes and duplicates. The rows are soft-deleted so a bad deletion is recoverable by hand.

**D2 - Re-review earns credit again.** If the poster clears a completed review and the same person reviews the new version, they earn a second credit, because they did the work twice. Counting distinct `(PR, member, role)` instead is a one-line change if the team decides it is being gamed.

**D3 - Re-adding a removed name reactivates that member.** Display names are unique, so a removed "Sam" blocks a new "Sam". Typing that exact name clears the removal and restores their history rather than erroring out - the least surprising behaviour and a self-service fix for accidental removals.

**D4 - Duplicate PR URLs are rejected while active.** Posting a URL that already has an open or merged post returns a clear "already posted" error. The same URL may be posted again after the earlier post is deleted.

**D5 - Concurrent volunteers are harmless.** Extra volunteers are allowed, so two people claiming the last slot at once both succeed. The same person clicking twice is idempotent: the second click is treated as already-assigned rather than an error.

**D6 - Requirements can be lowered below what is done.** Setting "reviewers needed" to 1 when 3 people already reviewed is allowed; the track simply reads `3/1` and is satisfied. No credit is removed.

**D7 - The poster may not be the PR author on GitHub.** The app tracks who posted it here, which is who owns the requirements. This is intentional and the "poster cannot self-assign" rule follows the poster, not GitHub.

**D8 - No GitHub truth.** Since there are no API calls, a PR merged on GitHub stays open here until someone marks it. Accepted for v1; see future work.

## 9. Non-functional requirements

- **Scale:** one team, tens of PRs open, thousands of rows lifetime. A single SQLite file is comfortably sufficient.
- **Freshness:** teammates' actions become visible within ~2 seconds without a manual refresh.
- **Resilience:** if the network connection is severed, the header's freshness indicator flips to an explicit "Offline" state (with the age of the last successful update) instead of silently pretending the page is live. A request timeout turns hangs into failures so disconnection is detected even when the browser still thinks it is online.
- **Responsiveness:** every mutation reflects in the UI in under ~200ms locally.
- **Layout:** usable from 375px wide up to a wide desktop; the three sections stack on mobile.
- **Accessibility:** keyboard reachable actions, visible focus, destructive dialogs focus the safe option by default, colour is never the only signal of status.
- **Dark mode:** follows the OS preference by default; a header toggle can force light or dark, remembered across visits.
- **Durability:** the database is a single file that can be copied for backup; no data is destroyed by any normal user action except PR deletion.

## 10. Out of scope for v1

Real authentication, GitHub API enrichment or webhooks, notifications (Slack/email), automatic round-robin assignment, per-repo configuration, multi-team support, time-windowed leaderboards, comments or discussion threads, and an audit log UI.

## 11. Future enhancements, roughly in order of value

1. A "My assignments" strip at the top so each person sees their own queue first.
2. GitHub API enrichment: real PR title, author, and auto-detected merge state.
3. Slack notification when a PR has waited too long for a volunteer.
4. Aging indicators, e.g. highlight PRs unclaimed for more than 24 hours.
5. Time-windowed leaderboards (last 7/30 days) alongside all-time.
6. An audit log of who did what, which the append-only credit ledger already makes easy.
