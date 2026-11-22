# LifeQuest spec addendum A2: "N times between two dates" quests

**Status:** implemented in the web POC (22 Nov 2026)
**Extends:** `LifeQuest_Product_Technical_Specification_v1.pdf` §2.2 (FR-05, FR-06) and the open decision "Missed / overdue recurring occurrences" in §10. Works with addendum A1 (`docs/spec-goals-roadmap.md`).
**Code:** `src/domain/commands.ts` (`TargetWindow` rules, `rescheduleWindow`, `deleteTask`), `src/domain/selectors.ts` (`quotaProgress`), `src/domain/repeat.ts`, `src/ui/repeat-picker.tsx`, `src/ui/not-done-sheet.tsx`, `src/ui/quest-row.tsx`, `src/app/task-form.tsx`. Tests: `tests/date-window.test.ts`.

## 1. Why

Repeating quests follow calendar periods (a Monday–Sunday week, a month starting on the 1st). Some plans have their own dates instead: *cook a new recipe 4 times between 20 Nov and 1 Dec*, or *apply to 10 jobs before the end of the month*. A2 adds that, plus a clear way to handle the case where the dates run out first.

## 2. Requirements

| ID | Requirement |
|---|---|
| FR-05b | A quest can be **N times between a start and an end date** (N = 1–100, end ≥ start, end ≥ today when created). It replaces the repeat rule; it is not a repeat. |
| FR-06b | From the start date it can be logged like an *N times a week* quest: a counter badge (*1/4*) and swipe to log +1, any number of times per day (including several on the same day), up to N. Each log pays the coin reward. Before the start date it is listed as *Starts \<day\>* and can't be logged. |
| FR-06c | When it reaches N, it is finished and moves to history. |
| FR-06d | When the end date passes below N, it shows as **Not done · 1 of 4** and stays in the Daily list. It can no longer be logged. |
| FR-06e | Tapping a not-done quest opens a sheet with: **Give it more time** (pick a new end date, today or later; progress inside the window still counts), **Delete quest** (with a confirm step), **Edit details**, **Close**. |
| FR-06f | **Delete** removes the quest and its open occurrence for good. Completed occurrences and the coins they paid stay (the ledger is never rewritten). |

## 3. Setting it up

Repeat → **Custom** → **Repeating | Between dates**:

- *Repeating* is the existing "N times every K days / weeks / months / years".
- *Between dates* asks for **Times** and an **End date**. The form's date field becomes **Start date**. A summary line reads *4 times between 20 Nov and 1 Dec*, with a hint explaining what happens if the end date passes.
- Onboarding keeps the simpler picker (no *Between dates*).

## 4. How it shows

| State | Row | Tap |
|---|---|---|
| Before start | counter *0/4*, chip *0 of 4 by 1 Dec*, chip *Starts Friday* | opens the quest form |
| Running | counter *2/4*, chip *2 of 4 by 1 Dec* (red *2 to go · 1 day left* when more are left than days), *Swipe to log* | opens the quest form |
| Finished | in history, like other completions | opens the quest form |
| Not done | grey counter *1/4*, red chip *Not done · 1 of 4*, chip *Tap to reschedule or delete* | opens the Not done sheet |

The row's context line reads *Quest · 4× by 1 Dec · \<goal\>*. In the quest form, the Status card shows the same chip. A not-done quest gets **Give it more time or delete** instead of *Mark done*. The snooze chips (*Tomorrow / In 3 days / In 7 days*) are hidden for date-range quests, because the window already defines the timing.

## 5. Rules

- **Progress** = completions dated inside [start, end].
- **After each log** the next open occurrence is due the same day (or on the start date) until N is reached; after that there's none.
- **Logging is refused** before the start date (*This quest has not started yet.*) and after the end date (*This quest ended. Give it more time or delete it.*).
- **Give it more time** changes only the end date. If the quest has no open occurrence, it gets one again, due today (or on the start date if that's later).
- **Editing** the window (start, end or times) keeps the completions that fall inside the new window. If they already reach N, the quest is finished.
- **Linked goals (A1):** the whole window is one plan with a target of N. It counts toward the goal's status once it's over, once it's kept, or once it can no longer be kept (more left than days remain). Archived and unfinished, it doesn't count.

## 6. Data model

`TaskDefinition.window?: { start, end, times }` (type `TargetWindow`). When it's set, `recurrence` is unset and `dueAt = window.start`. No new tables and no migration.

## 7. Acceptance checks (automated in `tests/date-window.test.ts`)

1. It waits for its start date. From then on it can be logged several times a day, and it finishes at N (coins paid each time).
2. After the end date it is *Not done* (not "overdue"), and logging is refused.
3. Rescheduling refuses a past date, moves the end date, keeps progress and can be logged again.
4. Rescheduling after the end leaves exactly one open occurrence.
5. Delete removes the quest and its open occurrence, and keeps earned coins and completion history.
6. Editing the window (raising N after it finished) re-opens it with progress kept.
7. Validation: end before start, end in the past, and times outside 1–100 are rejected.
8. A linked goal counts it as one plan (1 of 4 once the window is over = 25%).
9. The picker maps *Between dates* to a window (not a rule), summarises it, and round-trips an existing window.

## 8. Open points

- *Delete* currently exists only for not-done date-range quests. Other quests are archived (history kept), as before.
- A finished window could offer **Do it again** (the same length, starting the next day). Not built.
