# LifeQuest spec addendum A1: End goals, linked quests and goal status

**Status:** implemented in the web POC (22 Nov 2026)
**Extends:** `LifeQuest_Product_Technical_Specification_v1.pdf` §2.1 (FR-01 to FR-04) and the open decision "Goal progress calculation" in §10, plus `LifeQuest_Design_Specification_v1.pdf` §06 (Roadmap).
**Code:** `src/domain/goal-insights.ts` (rules), `src/app/(tabs)/roadmap.tsx`, `src/app/goal/[id].tsx`, `src/app/goal-form.tsx`, `src/ui/goal-charts.tsx`. Tests: `tests/goal-insights.test.ts`.

## 1. Why

In v1, goals had a *cadence* (daily, weekly, monthly, yearly). Quests also repeat daily or weekly, so the two were easy to confuse. Goal progress came only from milestones and one-off quests. Repeating quests, where most of the effort goes, never moved a goal.

A1 makes the roadmap a list of **end goals**: things you want to reach by a date, like *Get a new job*, *Get in better shape* or *Be better at cooking*. Quests are linked to a goal, and **how well you keep those quests sets the goal's status**. The goal page also shows how persistent you have been.

## 2. Requirements (replace FR-01 to FR-04)

| ID | Requirement |
|---|---|
| FR-01a | Create, edit, archive and view end goals. A goal has a title, an optional *why it matters* text, and a **required deadline** (today or later when set or changed). |
| FR-02a | Goals no longer have a cadence. Main quests (one-off or repeating, including *N times per period*) link to a goal through the quest's **Goal** field. Side quests still cannot link (FR-09, FR-12 unchanged). |
| FR-03a | Each active goal shows a **status** computed from its linked quests (§3), a **deadline countdown** and **time used** (start to deadline). |
| FR-03b | The goal page shows **perseverance**: a week streak, best streak, quests done, days you showed up, coins earned, a week-by-week chart and a day-by-day activity grid (§5). |
| FR-04a | The roadmap lists every goal as a card, sorted by deadline, filtered by *Active / Reached / Archived*. It also says how many active main quests aren't linked to any goal. |
| FR-04b | Milestones remain as optional **checkpoints** inside a goal. They no longer drive status. |

## 3. Goal status

### 3.1 Each linked quest is a plan

Every linked main quest is read as a target per period:

| Quest repeat | Period | Target per period |
|---|---|---|
| Every day | 1 day | 1 |
| N times a day | 1 day | N |
| Every K days / weeks / months / years (fixed or after completion) | K days / weeks / months / years | 1 |
| N times every K weeks / months / years | K weeks / months / years | N |
| One-off | from creation to its due date | 1 |
| N times between two dates (A2) | the chosen start to end date | N |

Periods follow the calendar, using the same rules as quota quests in the README: weeks run Monday to Sunday, months start on the 1st, years on 1 January, and multi-unit periods are counted from the quest's first due date.

### 3.2 Scoring a period

`score = min(done, target) / target`, where `done` is the number of completions inside the period. Doing more than the target never makes up for another period or another quest.

A period **counts** when:

1. it is over and the quest was active for all of it, **or**
2. it is already kept (`done ≥ target`), even if it hasn't ended (doing your 3 gym sessions by Wednesday counts right away), **or**
3. it is the current period, it lasts more than one day, and it **can no longer be kept**: more sessions are left than days remain (for example 0 of 3 on Sunday).

A period the quest was only active for part of (created mid-week, archived mid-week, or the goal was closed) counts **only if it was kept**. So starting on a Saturday never makes you look behind.

One-off quests count once done (score 1), or once their due date has passed without being done (score 0). Archived one-offs that were never done don't count.

### 3.3 Consistency (plan kept, last 4 weeks)

- For each linked quest, look at the periods that counted in the **last 28 days** (by the day each period is filed under: its last day, or today if it counted early). Score = Σ kept / Σ target. A quest with periods longer than 28 days (for example monthly) uses its most recent counted period when none fall in the window.
- **Consistency = the average of the quest scores.** Each quest weighs the same, so *8 glasses of water a day* can't drown out *Gym 3× a week*.
- When nothing has counted yet, consistency is *not measured* (shown as "–").

### 3.4 Status

Checked in this order:

| Status | When | Chip | Message |
|---|---|---|---|
| Reached | goal marked reached | mint, trophy | Goal reached. What a journey! |
| Archived | goal archived | grey | This goal is archived. |
| Deadline passed | today is after the deadline | rose, clock | The deadline has passed. Mark the goal reached, or give it a new date. Offers **Mark reached** and **New deadline**. |
| No quests yet | no active linked quest and no completions | grey | Link a quest to this goal so we can show how you are doing. |
| Getting started | nothing counted yet, **or** below 80% while the quests have run for less than 7 days | sky, sparkles | Your status shows up once your quests have run for about a week. |
| On track | consistency ≥ 80% | mint, trending up | You are keeping your plan. Keep the rhythm going. |
| Needs a push | 50% ≤ consistency < 80% | peach, walking | A little behind your plan. One extra session this week gets you back. |
| Falling behind | consistency < 50% | rose, leaf | This goal needs some love. Try a smaller, easier quest to get moving again. |

The copy stays calm, following the design spec's "a cozy quest journal, not a punishment app". Status colour always comes with an icon and a word.

## 4. Screens

### 4.1 Roadmap tab

- Header: *Your direction / My roadmap / Big goals, small steps.* with **+** (new goal).
- Segmented control: **Active · Reached · Archived**.
- One card per goal, sorted by soonest deadline:
  - title
  - status chip and deadline chip (*98 days left*, *Due today*, *3 days past the deadline*)
  - consistency ring (56 px) with *Kept 67% of your plan in the last 4 weeks.* (or the status message before anything is measured), the number of linked quests and the week streak
  - a strip of the last 8 weeks' scores (decorative)
  - a thin *Time used* bar (active goals only)
- When active main quests aren't linked to any goal: a cream card *N quests are not linked to a goal* with **Go to quests**.
- Empty state: *Where would you like to go?* with examples and **Create a goal**.

### 4.2 New / edit goal

- Fields: **Goal** (e.g. *Get a new job*), **Why it matters (optional)**, **Deadline** (text date plus *In 1 month / 3 months / 6 months / 1 year* shortcuts).
- **Create goal** is disabled until there is a title and a deadline.
- After creating, the app opens the new goal's page, so the next step (adding a quest) is right there.

### 4.3 Goal page

From top to bottom:

1. **Hero card**, tinted by status: *End goal* eyebrow, status chip, title, why-it-matters text, a 96 px consistency ring with the status message, the deadline date, the countdown, a time-used bar and the start date.
2. If there's no deadline (goals from v0.1): **Set a deadline**. If the deadline has passed: **Mark reached / New deadline**.
3. **Perseverance** (only once there's history): four tiles: *Week streak* (best streak below), *Quests done*, *Days you showed up*, *Coins earned*. A note explains the streak rule.
4. **Week by week**: one bar per week (from the goal's first week, at least 6 and at most 12) showing the share of the plan kept, a dashed *On track (80%)* line and a recessive baseline. Tap a bar to read it (*Week of 9 Nov · Kept 83% of the plan*, or *Nothing was due*). The selected bar is full strength and the others are lighter.
5. **Days you showed up**: a 12-week × 7-day grid (Monday at the top) with one green ramp, light to dark for 0, 1, 2, 3 and 4+ quests done. Days before the goal began are outlined and empty, not grey. It has a *Less → More* legend. Tap a day to read it.
6. **Linked quests** (with **+ Quest**): each active linked quest's row, ticked or swiped exactly as on the Quests tab, plus *Last 4 weeks · 11 of 12 kept* and a thin bar. With no quests, a card *What will move this goal forward?* gives examples and **Add a quest**.
7. **Checkpoints (optional)**: the existing milestone path, with *2 of 4 done*.
8. **Goal status** buttons: *Mark goal reached*, *Reopen goal*, *Archive goal*.

### 4.4 Streak rule

A week counts toward the streak when its score is at least 80%. A week's score is the average, over linked quests, of each quest's periods filed in that week. Weeks with nothing due neither count nor break the streak. The current week adds to the streak once it reaches 80%, but never breaks it while it's still in progress. *Best streak* is the longest run since the goal began.

## 5. Charts (design notes)

- There is one series per chart, so no legend box: the title names it. The activity grid has a *Less → More* scale.
- Bars use the forest colour with 4 px rounded tops, sit on the baseline and have gaps between them. The grid lines are recessive.
- Status colours (mint, peach, rose) are only used for status, never as chart series colours.
- Touch screens have no hover, so tapping a bar or a day shows its value in the caption above the chart. Every bar and cell has an accessibility label.
- Dark mode uses its own ramp steps rather than an automatic inversion.

## 6. Data model changes

- `Goal.cadence` becomes optional and is no longer set. v0.1 records keep it, and it is ignored. No storage migration is needed: Dexie and SQLite store whole rows.
- `Goal.deadline` stays optional in the type, so old goals still load, but `createGoal` and `updateGoal` require it. A new or changed deadline must be today or later; keeping an existing deadline that has already passed is allowed.
- No new tables. Status and perseverance are computed from tasks, occurrences and the wallet whenever they're displayed.

## 7. Acceptance checks (automated in `tests/goal-insights.test.ts`)

1. A goal without quests shows *No quests yet* and its days left.
2. A new *3 times a week* quest shows *Getting started* until something counts, with no penalty mid-week.
3. Logging 3 sessions in the first week makes the goal *On track* immediately: consistency 100%, a 1-week streak, 3 done, 30 coins.
4. Weeks of 3/3, 1/3 and 0/3 give 4/9 ≈ 44%, *Falling behind*, a streak of 0 and a best streak of 1.
5. On Sunday with 0 of 3 done, the week already counts as missed.
6. A quest started on a Saturday is not judged on that partial week.
7. A daily quest kept 5 of 7 days for two weeks gives ≈ 71%, *Needs a push*. Adding a fully kept 8×/day quest averages per quest: (71% + 100%) / 2.
8. A one-off counts as 0 once overdue and as 1 once done.
9. Archiving a quest stops it counting from that day.
10. A passed deadline shows *Deadline passed* (time used 100%). Marking the goal reached shows *Reached*.
11. Time used is 50% halfway between start and deadline.
12. The activity grid has 84 Monday-aligned days, counts completions per day, and marks future days and days before the start.
13. `createGoal` rejects a missing deadline or one in the past.

## 8. Open points

- **Thresholds** (80% / 50%, 7 days to settle, 28-day window) are constants in `goal-insights.ts`. They could become settings.
- **Quest weighting:** every quest weighs the same. A per-quest importance setting could come later.
- **Checkpoints and status:** milestones are tracked but don't affect status. They could later combine with consistency into a forecast ("at this pace you'll reach it by …").
- **Doing more than the target** is capped at the period. Extra logs beyond the weekly target are not possible today, because each log pays coins.
