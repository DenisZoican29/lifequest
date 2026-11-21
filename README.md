# LifeQuest v0.1 — browser proof of concept

Personal goals, recurring quests and earned screen time. Implements the Windows browser POC from
`../LifeQuest_Product_Technical_Specification_v1.pdf` (delivery phases 0–3, plus the start of phase 4 hardening),
styled after `../LifeQuest_Design_Specification_v1.pdf`.

App usage and blocking are **simulated**. Nothing outside the browser tab is tracked or blocked, and the UI says so.

## Run

```bash
npm install
npm run web          # http://localhost:8081
```

In Chrome or Edge, press F12 then Ctrl+Shift+M and pick an iPhone-sized viewport.

## Live site (GitHub Pages)

https://deniszoican29.github.io/lifequest/

Every push to `master` runs `.github/workflows/deploy.yml`: tests, `expo export -p web`, then publish `dist/`.
`app.json` sets `experiments.baseUrl` to `/lifequest`. This setting only affects the export; `npm run web` still serves from `/`.
Data lives in each browser's IndexedDB, so the live site, localhost and your phone each keep separate quests.

## Managing quests

- **Add:** use **+ Add quest** or **+ Add side quest** on the Quests tab, or **+ Quest** on a goal.
- **Change status:** tap a quest to open it. The **Status** card offers *Mark done*, move to *Tomorrow / In 3 days / In 7 days*, *Skip this time* (repeating quests) and *Archive*.
- **Several times per period:** choose **Repeat → X times per…**, e.g. *3 times per 1 week*. Weeks run Monday to Sunday, months start on the 1st. Every tick pays the reward. The quest comes back the next day until the target is met, then waits for the next period. For one-day periods, such as *8× a day*, it comes back the same day. Missed sessions are not carried over and the quest never shows as overdue. The row shows *1 of 3 this week*, or *2 to go · 1 day left* when you're behind. The behind warning is skipped in a partial first week. *Skip rest of this week* jumps to the next period.
- **Archived:** archived quests are listed under **Archived (N)** at the bottom of the Quests tab. Open one and press **Restore quest** to make it due again today.

```bash
npm test             # domain + storage unit tests (vitest, fake-indexeddb)
npm run typecheck
npm run lint
```

## Try the acceptance flow (spec §7)

1. Onboarding: choose apps and a daily allowance.
2. Roadmap → **New goal** → open it → add milestones → **+ Quest** linked to the goal.
3. Tick the quest. Coins are credited once, however often you click.
4. Bank → Demo screen time → use **+15 min** on the sample apps until they show *Paused*.
5. Bank → Buy extra time → confirm. Coins are debited and the apps reopen.
6. Reload the page. Everything is still there (IndexedDB).
7. Bank → test helpers → **Next day**. The free allowance resets, bought minutes expire, and coins stay.

## Architecture

```
src/app/           Expo Router screens (tabs: Today | Roadmap | Quests | Bank; plus forms, goal detail, settings, onboarding)
src/ui/            Design-spec component kit, theme tokens (light/dark), Sprig artwork, quest rows, milestone path
src/state/store.ts Zustand store: runs commands, serializes writes, syncs the AppBlocker
src/domain/        Pure TypeScript — no React, no storage
  commands.ts      (snapshot, clock, input) -> ChangeSet   ← all business rules live here
  economy.ts       coin balance, shared daily allowance
  recurrence.ts    next due date (after-completion or fixed calendar)
  selectors.ts     today/upcoming/side/history lists, goal progress
  dates.ts         Clock abstraction (simulated day offset)
src/data/          Repository interface; Dexie/IndexedDB adapter (web), expo-sqlite adapter (iPhone/Android)
src/platform/      AppBlocker interface + WebMockAppBlocker (iOS/Android adapters plug in here)
tests/             Spec tests T-01…T-09; one storage contract run against IndexedDB and SQLite
```

Every write is a **ChangeSet** that the repository applies in a single IndexedDB transaction.
Before writing, the transaction re-checks the change's guards:

- `occurrenceOpen`: the quest occurrence is still open.
- `uniqueIdempotencyKey`: the reward or purchase hasn't already been applied.
- `minBalance`: there are enough coins.

A unique index on `idempotencyKey` is a second safety net. Together these stop double rewards and
double purchases even when the UI is working from stale data (spec FR-16).

## Design (LifeQuest_Design_Specification_v1)

- **Tokens** live in `src/ui/theme.ts`: Forest #316E54, Mint, Sky, Peach, Gold, Lavender, Ink and a Paper canvas. Lato is used throughout, on an 8 pt grid with 16–32 pt radii.
- **Component kit** is in `src/ui/components.tsx`: flat primary, secondary and tertiary buttons, status chips, tinted hero cards, and the eyebrow + title header.
- **Sprig**, the original leaf companion, is in `src/ui/art.tsx`. It is static and appears only in onboarding, empty states and milestones.
- **Desktop** shows a centred 430 px phone shell. Settings → Appearance switches between System, Light and Dark.
- **Reduced motion** turns off the completion check pulse.

## Defaults chosen for open decisions (spec §11)

| Decision | v0.1 behaviour |
|---|---|
| Base allowance / prices | 30 min; packs 15 min = 25, 30 = 45, 60 = 80 coins. All editable in Settings |
| Purchased minutes | Count for the current local day only (no rollover) |
| Reset | Local midnight (re-checked every 30 s) |
| Recurrence | Per quest: *after completion* (default), *fixed schedule*, or *N times per period* (calendar-aligned). Missed slots are skipped, not stacked |
| Overdue | Stays visible ("A little behind schedule"). Paid once when completed. Side quests can be snoozed 3 days or rescheduled |
| Unchecking a completed quest | Not supported. Completions are final, which keeps the ledger simple |
| Deselecting an app | Minutes it already used today still count. Time is never refunded |
| Goal progress | Equal weight: milestones + linked one-off quests. Repeating quests are excluded |
| Sub-goals | Not built. Milestones only (the spec's `parentGoalId` is omitted) |
| Reminders | In-app badge N days before a side quest is due. No OS push in the browser |

## Run on an iPhone (Expo Go)

1. Install **Expo Go** from the App Store. The phone and the PC must be on the same Wi-Fi.
2. On the PC: `npx expo start --host lan` (a QR code appears in the terminal).
3. Scan the QR code with the iPhone camera, or in Expo Go choose *Enter URL manually* and type `exp://<PC-IP>:8081`.

Data is saved in a SQLite file on the phone (`lifequest.db`), so it survives closing the app. App usage and blocking are still simulated; real Screen Time blocking needs a signed build with Apple's Family Controls entitlement (phase 5).

## Not yet built

Data export/import, offline PWA caching (T-10), and native iOS/Android blockers (phases 5–6).
