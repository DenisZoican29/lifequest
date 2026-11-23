# LifeQuest spec addendum A4: App redesign

- **Status:** web POC implementation is recorded in §7, including the Today tabs (option 2, Underline).
- **Scope:** LifeQuest's web app, with layouts that can also work on mobile.
- **Related:** [Goals and roadmap](spec-goals-roadmap.md), [Goals overview](spec-goals-overview.md), and [date-range quests](spec-date-range-quests.md).

## 1. Design direction

Put the action each screen is for near the top. On Today, that means doing a quest. On Roadmap, it means finding or creating a goal. On Time Bank, it means checking the balance or buying time. Use the redesigned goal detail as the visual reference: a clear title, neutral surfaces, compact status chips, and room between groups.

Keep the four existing tabs. Use one prominent action per screen or form step. Reserve strong color for states, selection, and actions, with text to carry the same meaning. Use the mascot and larger illustrations on welcome and empty screens where they help set the tone.

## 2. Today and Quests

### Today

- Use the current weekday as the main heading, with the day and month beneath it in smaller text, for example **Monday** above **23 November**. Append “simulated” to the date when a demo offset is active.
- Put **Today's quests** and the first actionable quest immediately after the date and heading. Show the first three due quests, followed by **Show N more quests** when there are more. Expand the remaining quests in place.
- Combine available screen time and coins in one compact **Time Bank** summary beneath the task list. Keep the visible demo label when usage is simulated.
- When there is nothing due, show one clear next action. Offer **Add a quest** for a new or empty board and **Plan ahead** when upcoming quests exist.

### Today quest progress

**Selected design:** **Plain text** (implemented 22 Nov 2026, see §7).

- On the right of a quota quest row, set the completion count in bold with the period on a smaller, muted line below. Use right alignment and the neutral row background. The two lines replace the progress ring in the current Today preview.
- For a weekly quota, show **1 of 3** above **This week**. For a custom date range, show **2 of 5** above **By 1 Dec**. Show each count and period once per row.
- Use the same completion count and due date as the quest detail. Announce both together, for example “1 of 3 completed this week.” Check that the label remains readable alongside long quest names at 320 pt and in both themes.

### Today progress ring

**Status:** implemented 23 Nov 2026 (see §7).

- Place one progress ring above the selected **Main quests** or **Side quests** list. Put **0/3**, **1/3**, or the current count in its center, with the number of quests left to log beside it. Use a rose tint at zero, amber while progress builds, and green at completion. Read out the count, for example “1 of 3 quests logged today.”
- Count distinct quests in the selected tab. Use the union of quests available to log today and quests logged on the current local date. The first log for a quest advances the ring by one. Further logs update the quest’s own quota, which stays visible on its row.
- Preserve the **Completed today** disclosure. On a day with zero eligible quests, use the existing empty state. Check the zero, partial, and full rings in both themes, and verify that switching tabs updates the ring and list together.

### Today tabs

**Selected design:** option 2, **Underline**.

- Put two equal-width tabs below the Today heading: **Main quests** and **Side quests**. Use a thin blue underline for the selected tab, muted text for the inactive tab, and a neutral background. **Main quests** is the initial view.
- Show one quest list at a time and switch in place. Preserve the three-quest preview and **Show N more quests** on the Main quests tab. The Side quests tab previews up to two due or overdue quests, oldest due first. If none are due, preview the next upcoming item. **See all** opens the full side quest list, and **Add** is the entry point when there are no open side quests.
- Keep **Completed today** and **Time Bank** available below either tab. **Completed today** lists only the selected tab's quest type: main quests under **Main quests**, side quests under **Side quests**. Keep row surfaces neutral.
- **Selected icon frames for the quest library design:** use a circle for main quests and a rounded rectangle for side quests. Apply the same shapes on Today and in the library. Custom icons and colors use the frame for their quest type.

**Side quests warning**

| Open side quests | Tab indicator |
|---|---|
| At least one deadline has passed | Red warning triangle |
| At least one deadline is inside that quest's warning period (default: today or tomorrow) | Amber warning triangle |
| All deadlines are later | No warning icon |

Evaluate dates in the app's local calendar. Use the due date for one-time and standard recurring occurrences, the end date for a fixed date range, and the end of the active period for an unfinished repeating quota. Ignore completed and archived quests. If both warning states apply, show red. Keep the warning visible when **Main quests** is selected, and provide its meaning in the **Side quests** tab’s accessible label. Identifying urgent items in the list also requires visible text such as **Overdue** or the due date.

**Acceptance checks:** switching tabs shows only the selected list and keeps shared sections visible. An open quest due tomorrow shows amber. An overdue quest takes priority and shows red. Completing the last overdue quest falls back to amber if another deadline is close, or clears the icon otherwise. A custom date-range quest only triggers the warning when its end date meets the threshold. The tabs and warning fit at 320 px in both themes and are usable by keyboard.

### Quests

- Use **Today**, **This week**, and **Side quests** as the range controls. Put **Add quest** beside the screen heading, with **Add side quest** when the side-quest view is selected.
- Define **This week** as Monday through Sunday in the app's local calendar. Groups for **To do** and **Completed** show open quests by scheduled date and completed quests by completion date. Include today's quests in the week. Keep older overdue items under **Overdue** and later items under **Upcoming**.
- Show separate counts for open and completed activity instead of a fraction that combines scheduled items and logged completions. Keep each repeating quest's existing quota indicator, such as **2 of 3 this week**.
- Use the same compact rows as Today for main quests, side quests, and history. The row starts with the quest icon and shows the completion count or schedule on the right. Tap to open the quest for actions, or swipe right to log a quest that is due. Keep history and archived quests in secondary sections.

**Observed issue:** The web review showed Daily at **0 of 3 completed** and Weekly at **9 of 9 completed** on the same day. The current Weekly calculation excludes today and combines the previous six days of completions with future due dates.

### Quests library

**Status:** implemented 23 Nov 2026 and replaces the Quests date views above (see §7).

- Open **Quests** to **All** by default. Use **Main quests** and **Side quests** to filter by type, and **Find a quest** to search by title or linked goal. Keep **Add quest** beside the heading.
- Show one row per quest definition, including active quests scheduled for a future date. Put active quests first, with separate collapsed sections for **Completed one-time quests** and **Archived**. A recurring quest stays in the library after each log. Open a row to edit its quest.
- Reuse the compact Today rows. Main quests have circular icon frames and side quests have rounded rectangular frames. Show the linked goal or quest type under the name and a schedule or due date on the right.
- Verify that a future quest appears under **All**, search matches each quest once, type filters and search work together, and a completed one-time quest appears in its own section. Use **Today** for the daily list and that day’s activity.

## 3. Roadmap and goal pages

- Lead Roadmap with the goal list and a visible **New goal** action. Keep each row focused on the goal icon, full title, status, and one useful progress signal. Keep date and chart detail on the goal page.
- Offer a labeled **Goals overview** action. Keep the island, chosen goal icons, tap previews, and the goal list as the map's legend. Continue calculating territory size from linked main quest completions in the selected range.
- Keep the current goal detail hierarchy: goal identity first, then plan progress and deadline, then the per-quest breakdown. Give **Add quest** a clear entry point that carries the current goal into the form.
- Address the React warnings from the map SVG in the web build. Check that territory selection works from the hexes and markers and that every goal is reachable through the list.

## 4. Onboarding and forms

- Offer **Create your first quest** early. Let people defer app selection and screen-time setup until they are ready to use Time Bank. Explain simulation when they first encounter it.
- In **New quest**, put the title, linked goal for main quests, and schedule before optional details. When opened from a goal, show that goal as already selected. Use **Just once** and common repeating options as the quick choices. Reveal custom recurrence, rewards, reminders, and description when relevant.
- Keep **New goal** short: name, optional icon, and an optional deadline. Keep the optional description available and use the chosen icon consistently across Roadmap, goal detail, and the goals map.

### Repeat design and quests without due dates

**Implemented editor layout (updated 23 Nov 2026, at the user's request):** **Once | Repeating** under **Schedule** in the new and edit forms; *Daily* and *Custom* were merged into **Repeating**. Repeating offers **Regularly** (the default) or **Between dates**. Regularly is *Repeats every [1] [day ▾]* plus the times-per-period target, so daily is *every 1 day*, the starting value. Existing daily quests open as every 1 day. Onboarding uses the same repeat controls for available schedule types.

**Implemented custom repeat layout.** **Repeats every [number] [unit ▾]** pairs the scroll wheel with a dropdown of *days / weeks / months / years*, which reads in the singular for 1. A second row shows the target with a label such as **Times per day**, **Times per week**, or **Times every 2 weeks**.

**Compact number wheel.** **Repeats every** (1–99), **Times per …** (1–100), and **Warn me** (0–90 days, 1–52 weeks) use the same 44-point wheel in `src/ui/number-wheel.tsx`. It aligns with the unit dropdown. The selected number rests in a tinted band with a peek at its neighbors. Users can scroll, swipe, or tap a visible number. The wheel snaps on native and web. On web, it supports one step per mouse-wheel notch, arrow keys, Page Up/Down, and Home/End. Screen readers get increment/decrement actions.

**Shared form controls.** Text and search fields, dropdowns, calendar buttons, and wheels share rounded surfaces, a cool green tint, and a stronger focus border in both themes. `src/ui/form-controls.tsx` provides the shared styling and picker button. Validation uses the existing error color and explanatory text.

**Scheduling behavior for quests without due dates** (implemented 23 Nov 2026, see §7)

- **Daily** makes a quest available each local calendar day without a due date. Show **No due date** in the editor. Example: *Eat breakfast*. After completion it moves to **Completed today** and becomes available again the next day. A missed day never becomes overdue or creates a backlog. The same rule applies to a custom target such as *3 times per day* once the daily target is reached.
- **Once** has an optional due date chosen from the calendar. With **No due date**, the quest stays available until completed. Example: *Send an email*.
- Show daily quests on Today under their own quest type. Open one-time quests without deadlines stay available on Today and Quests until completed. Neither triggers a due-date reminder or deadline warning. Completion history and linked goal progress use the recorded completion dates.
- Verify that main and side quests can be saved with **Daily** and no date. Check the editor, Today, and the side-quest warning across midnight after a completed day and after a missed day. Check that an undated one-time quest leaves the open list once completed.

## 5. Time Bank and Settings

- Show remaining minutes and coin balance together, followed by **Buy extra time**. Preserve the confirmation step, price, and same-day expiry information.
- Group per-app simulation buttons and test-clock controls under **Demo tools**, collapsed by default. Keep the simulated-usage explanation visible outside the expanded controls.
- Group Settings by **Appearance**, **Screen time**, and **Data**. Put allowance, apps, and time pack prices under **Screen time**. Keep **Erase all data** in its own confirmed action.

## 6. Delivery and acceptance

| Order | Deliverable | Acceptance checks |
|---|---|---|
| 1 | Today and Quests | A quest due today appears in both Today and This week. Completing it updates both views. Sunday and Monday fixtures confirm the local week boundary. Overdue tasks and quota progress stay distinguishable. The first quest or the empty-state action is visible before rewards. |
| 2 | Roadmap, map, and goal pages | Open a goal from Roadmap and from the map list. Pick an icon and verify it appears on all three goal surfaces. Switch the map range and verify the share and preview together. Map warnings no longer cover navigation in the web dev build. |
| 3 | Onboarding and forms | A new user can reach Today with a quest while deferring screen-time setup. A quest created from a goal is linked to it. The one-off, recurring, date-range, and side-quest flows still expose the fields they require. |
| 4 | Time Bank and Settings | Balance and purchase controls are visible before simulator controls. Expanding or collapsing Demo tools leaves the balance intact. Confirm purchase, allowance changes, and data erase continue through their existing actions. |

Check each changed screen at 320 and 390 px and within the desktop shell, in both themes. Check keyboard focus, visible button labels, long names, empty states, and touch targets of at least 44 pt. Keep terminology consistent across screens so **quest**, **goal**, **coins**, and **screen time** mean the same thing wherever they appear.

## 7. Implementation notes

- **Action feedback.** Creating a goal shows a flag and a small burst of color. Logging a partial quest target shows a check, the updated count, and a progress bar that advances by one entry. Finishing a quest or hitting its target shows a trophy and a brief burst. The card shows coins when the action earns them, stays visible through navigation, and dismisses itself. Reduce Motion keeps the same text, icon, and final progress without animation.

- **Shared layout:** Today, Quests, and Roadmap use underline tabs for switching lists. Side quest cards use the same neutral surface on Today and Quests. New and edit forms share the calendar field, details cards, and pinned bottom action. Expandable rows inside a form card (**Goal**, **Deadline warning**) use `DisclosureCard`: the row and its expanded content share one bordered card, with the content below a divider on a lightly tinted background (added 23 Nov 2026, at the user's request). Goal deadlines use the same calendar picker.
- **Quest board:** `questBoard` in `src/domain/selectors.ts` feeds both Today and the Quests tab, so a quest due today shows in Today and This week and one completion updates both. Weeks run Monday–Sunday (`weekBounds`). Overdue = open and scheduled before the range (one-offs and repeats; quota quests carry on in their current period instead). A quota quest that has met its target leaves **To do**; its latest log appears under **Completed**. Counts are *N to do* and *N completions* (every quota log counts). Tests: `tests/quest-board.test.ts`, including Sunday and Monday fixtures.
- **Quest marks:** **Icon & color** in Edit quest previews both choices together. A quest can use its own icon preset and color. The default icon follows the linked goal, or uses a sparkle for an unlinked main quest and a house for a side quest. The default outline follows the goal’s color when linked. A custom quest color tints its icon and outline. Goal cards and map markers use the goal’s own icon and color.
- **Quest rows:** Today and the Quests lists share grouped quest rows with the quest icon, title, and progress or schedule. Tap a row to open it or swipe a due quest to record a completion. The same compact row appears for linked quests on the goal page.
- **Today:** a compact *Today’s quests* heading and to-do count sit on the same row, above up to three quests. **Show N more quests** reveals the rest in place, and **Show fewer quests** collapses the list. The separate **Side quests** preview uses due dates for one-time errands and links to the full side quest list. Tap a row to open the quest and record a completion. **Completed today** starts collapsed and shows completions of the selected tab's quest type (updated 23 Nov 2026, at the user's request). The Time Bank card shows screen time and coins, with a setup cue when no apps are selected.
- **Today quest progress:** quota rows on Today show the count in bold (**1 of 3**) above the muted period (**This week**, **By 1 Dec**, or **Ended 1 Dec** in rose when a date range was missed), right-aligned on the neutral row; the progress ring is gone from Today. The row announces both together, e.g. *Open Apply to 3 jobs, 0 of 3 completed this week*.
- **Today tabs:** **Main quests** and **Side quests** sit under the heading as equal-width tabs with a thin blue underline (`questColors.blue`). Main keeps the three-quest preview; Side previews up to two due or overdue quests (oldest first), else the next upcoming one, with **See all**, or an empty card with **Add a side quest**. Completed today (filtered to the selected tab's quest type) and Time Bank stay below either tab. The warning triangle comes from `sideQuestWarning` in `src/domain/selectors.ts` (`questDeadline`: due date, a date range's end, or the end of an unfinished quota's period; red beats amber) and is announced in the tab label, e.g. *Side quests, 1 due by tomorrow*. Side rows on Today now use the neutral surface. Tests: `tests/side-warning.test.ts`.
- **Roadmap (updated 22 Nov 2026, at the user's request):** the filter is **Active | Reached** only. **Active** is the goals overview in place: the territory map of active goals with *Last 7 days / Last 4 weeks / Calendar* ranges, the in-place preview, then every active goal as a share row, and the unlinked-quests note. Reached goals are left out of the split; colour slots still come from every non-archived goal, so colours don't change. **Reached** lists reached goals, with archived goals in a collapsed *Archived goals (N)* section. The separate `/goals-overview` route was removed; the overview lives in `src/ui/goals-overview.tsx`. **New goal** stays beside the heading.
  - **Date filters (implemented):** **Last 7 days** and **Last 4 weeks** shortcuts beside a **Calendar** button. The calendar offers custom start and end dates and **All time**. [Goals overview design §7](spec-goals-overview.md#7-calendar-ranges)
  - **Map marker (implemented):** **Map pin**, with the goal’s icon inside and its share below. [Goals overview design §8](spec-goals-overview.md#8-map-pin-markers)
- **Map warnings:** SVG shapes no longer carry press handlers or native-only accessibility props. Taps go to invisible, non-focusable tap zones laid over the cells; the drawing sits in an `aria-hidden` view. The web console is clean on the overview.
- **Goal page:** **Add quest** sits at the bottom of the quest breakdown and beside *Linked quests*; it opens New quest with the goal preselected (*Linked to Read more…*). **Checkpoints removed (23 Nov 2026, at the user's request):** the goal page no longer has a *Checkpoints (optional)* section, and Today no longer shows the *Coming up* milestone card. Milestones already stored stay in the data but aren't shown.
- **New quest:** uses the Edit quest layout, with a **Quest / Side quest** choice at the top and an **Add quest** or **Add side quest** action at the bottom. Repeat frequency and the target are set under **Schedule**. New once-per-period quests are due again after completion, and existing quests keep their setting.
- **Edit quest:** **Quest details** puts the description directly under the title, followed by the goal selector for main quests and **Icon & color**. The goal selector is a dropdown with a search box (updated 23 Nov 2026, at the user's request). It lists *No linked goal* and every active goal with its icon and deadline. Search matches every word in any order, ignoring case and accents (`searchGoals` in `src/domain/goal-search.ts`). Enter picks the first match and Escape closes the dropdown. **Schedule** has calendar fields and, for side quests, a reminder control. **Reward** holds the coin amount, picked with the same number wheel in steps of 5: 0, 5, 10 … 50 (`NumberWheel step`). An older quest's other amount snaps to the nearest step when edited. The cap is `MAX_REWARD_COINS` = 50, enforced in `validateTask`, and an older quest above the cap is brought down to 50 when edited (updated 23 Nov 2026, at the user's request; replaces the typed field and 0/5/10/20/50 chips). Tests: `tests/reward-cap.test.ts`. **Quest activity** shows the status and actions for completion, skip, archive, and restore. **Move this occurrence** opens a calendar for moving the current occurrence. **Save changes** stays visible while the form scrolls and saves all edits together.
- **New goal:** name, optional icon, **Deadline (optional)**, then *Why it matters (optional)*. The deadline became optional on 23 Nov 2026, at the user's request: the field reads *No deadline* with a clear button once set. A new deadline still can't be in the past, and the goal page shows *No deadline* without nudging you to set one. Goals without a deadline never become *past deadline*. **Goal color (optional)** (added 23 Nov 2026, at the user's request): **Automatic** or one of the seven palette colours (Blue, Orange, Teal, Amber, Pink, Green, Violet), stored as `Goal.color`. A chosen colour is used on the goals map, Roadmap, goal page and linked quests. Automatic goals take the colours no goal chose, in creation order (`goalSlots`), and two goals may choose the same colour. Tests: `tests/goal-color.test.ts`.
- **Onboarding:** Welcome → **Create your first quest** (or skip) → **Screen time (optional)** with the demo explanation, **Start my journey** or **Set up screen time later** (no apps, 30 free minutes). Time Bank then shows *Screen time isn’t set up yet* with **Set up screen time**.
- **Time Bank:** one card with minutes left and coins, then **Buy extra time** with the same-day expiry note and the existing confirmation. **Demo tools** (per-app simulation and test clock) are collapsed; the demo explanation stays visible above them.
- **Settings:** Appearance · Screen time (allowance, apps, time pack prices) · Data (storage note, the side-quest reminder note, and **Erase all data** as its own confirmed button).
- **Repeating quests without a due date (23 Nov 2026, at the user's request):** **Repeating** has the same optional due date as **Once**, and new quests start with *No due date*. Such a quest runs for as long as you keep it: any time in each period (the form shows no extra note for it, at the user's request). It's stored with `noDueDate`, and a 1-time rule becomes a times-per-period quota (`timesPerPeriod: 1`, calendar periods), so after it's done it waits for the next period. A missed period leaves no backlog, and it never goes overdue. A side quest can still have a **Deadline warning**, counted back from the end of each period (*2 weeks before the end of each 6-month period*, e.g. an oil change; added at the user's request). The warning goes quiet once the quest is done for the period, and it never turns red (`canWarn` in `src/domain/recurrence.ts`; `questDeadline` uses the period end). Picking a date gives the classic due-date repeat (overdue, **Deadline warning**), e.g. an oil change every 6 months. Every 1 day stays *No due date*, and date ranges always have dates. A first quest from onboarding has no due date. Tests: `tests/no-due-date.test.ts`.
- **Quests without due dates (23 Nov 2026):** `isUndated` in `src/domain/recurrence.ts` covers **Daily** (and *N times per day*) plus one-offs saved with `noDueDate`. They are never overdue or listed under **Overdue**, a missed day leaves one open occurrence (no backlog), and they trigger no reminder, deadline warning, or *due soon* count. A daily quest done today waits until tomorrow. In the editor, a quest repeating every 1 day shows *Due date · No due date* with *Available every day. A missed day never becomes overdue.* **Once** has an optional calendar date: new quests start with *No due date* (no extra note below it, at the user's request), and a chosen date has a clear button. The Reminder control is hidden for undated side quests. Rows show *Daily* or *No due date* in place of a date. Goal consistency never counts an undated one-off as missed. **Move this occurrence** is hidden for undated quests. An onboarding first quest set to **Once** has no due date. Tests: `tests/no-due-date.test.ts`.
- **Deadline warning period (23 Nov 2026, at the user's request):** each side quest's **Deadline warning** (replacing the old Reminder chips) sets when amber starts. It's one line, **Warn me [number] [days/weeks before ▾]** (simplified at the user's request, like *Repeats every*). The default is 1 day (today or tomorrow), e.g. 2 weeks before an oil change, and 0 means on the due day. The value is stored in days as `reminderDaysBefore`. `deadlineLevel` in `src/domain/selectors.ts` turns an open side quest red once its deadline (`questDeadline`) has passed and amber from `warningDays` before it. The level is stored on the item (`QuestItem.warning`) and also feeds `sideQuestWarning`. Rows inside the period show an amber pill with a warning icon (*In 12 days* from a week out), and the row is announced as *due soon*. Today's Side quests preview lists due quests first, then quests due soon (*1 due · 1 due soon*). Tabs read *Side quests, N due soon*. The row appears whenever there's something to count back from: a due date, a date range, or the end of each period for a repeating quest without a due date. It stays hidden for one-offs without a due date and for quests repeating every 1 day. Notifications stay in-app in the web POC; push notifications come with the phone app. Tests: `tests/side-warning.test.ts`.
- **Quests library (23 Nov 2026):** the Quests tab opens on **All**, with **Main quests** and **Side quests** as underline tabs (the side-quest warning triangle shows here as on Today). **Find a quest** searches quest titles and linked goal titles; every word must match, ignoring case and accents. `questLibrary` in `src/domain/selectors.ts` returns one row per quest definition. **Active** lists quests with an open occurrence, soonest first, including future ones; a repeating quest stays after each log. **Completed one-time quests** holds finished one-offs and date ranges, and **Archived** holds archived quests. Both sections start collapsed and open automatically when a search only matches there. Rows reuse the Today rows. Under **All**, an unlinked quest shows *Main quest* or *Side quest* under its name. **Add quest** (or **Add side quest**) sits beside the heading. The Today and This week date views were removed from the tab, and old `?view=today/week` links open **All**. Tests: `tests/quest-library.test.ts`.
- **Active quests card (23 Nov 2026, at the user's request):** below the tabs, the list sits in one card headed **Active quests** (or **Active side quests**). The ring sits beside the title, with *3 of 15 logged today · 12 left* under it; side quests also show *1 due · 1 due soon* and **See all** in the header. The rows and **Show N more quests** follow below a divider. With nothing left to do, the full-size ring and empty card show instead.
- **Today progress ring (23 Nov 2026):** `todayProgress` in `src/domain/selectors.ts` counts distinct quests of the selected tab's type that are available to log today (due or overdue, quota not yet met) or were logged on the current local date. The first log of a quest counts, and later logs don't. The 64 px ring sits between the tabs and the list. Its centre shows *logged/total*, and beside it is *N quests left to log* (or *All quests logged today*) with *X of Y quests logged today*. It is rose at zero, amber while progress builds, and green when full, and it reads out as *1 of 3 quests logged today, 2 left*. With nothing eligible, the ring is hidden and the existing empty state shows. It replaces the *N to do today* line. Tests: `tests/today-progress.test.ts`.
- **Layout check (23 Nov 2026):** Today (both tabs), Quests, Roadmap, Time Bank, Settings, New quest and New goal were checked at 320 and 390 px, in light and dark, and at 320 px with every font scaled to 135% to stand in for large text. There was no horizontal overflow and no clipped text. Two fixes came from it: the Quests tabs now size to their labels (`UnderlineTabs fit`), so *Main quests* no longer wraps at 320 px, and quest names may use 3 lines before an ellipsis. The ring's count is capped at 1.2× font scaling so it stays inside the ring. Native iOS and Android Dynamic Type has not been checked on a device.

