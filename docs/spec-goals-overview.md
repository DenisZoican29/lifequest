# LifeQuest spec addendum A3: Goals overview

**Status:** implemented in the web POC (22 Nov 2026). Later the same day it became Roadmap's **Active** view instead of a separate screen (see A4 §7).
**Extends:** addendum A1 (`docs/spec-goals-roadmap.md`), Roadmap §4.1.
**Code:** `src/domain/goal-share.ts` (rules), `src/domain/territory-map.ts` (map layout), `src/ui/goals-overview.tsx` (rendered by Roadmap → Active), `TerritoryMap` in `src/ui/goal-charts.tsx`, `GoalMark` and the icon presets in `src/ui/goal-mark.tsx`, initials in `src/domain/goal-mark.ts`, the icon picker in `src/app/goal-form.tsx`, entry points in `src/app/(tabs)/roadmap.tsx`. Tests: `tests/goal-share.test.ts`, `tests/territory-map.test.ts`, `tests/goal-mark.test.ts`.

## 1. Why

The goal page explains one goal in depth. Nothing showed how your effort splits **between** goals: which goal gets most of your time, and which one gets almost none.

## 2. Requirements

| ID | Requirement |
|---|---|
| FR-05a | A **Goals overview** screen shows every goal that isn't archived (active and reached) and its share of the quests done, as a percentage of all goals. |
| FR-05b | Range: **Last 7 days**, **Last 4 weeks** (default, the same 28-day window as status), or **Calendar** (custom dates or **All time**). See §7. |
| FR-05c | Tapping a goal, either its territory on the map or its row, opens that goal's page (§4.3 of A1). |
| FR-05d | Main quests done without a linked goal are not part of the split. A note gives their count and offers **Go to quests**. Side quests are left out. |

## 3. Rules

- **Effort** = completions of main quests linked to the goal, with `completedOn` inside the range.
- **Share** = goal's completions ÷ all linked completions in the range. Shown percentages use largest-remainder rounding, so they always add up to 100%. A goal with nothing done shows 0%.
- Order: largest share first. Ties keep creation order.
- **Colour follows the goal, not its rank.** Each goal takes a categorical slot by creation date (7 slots: blue, orange, aqua, yellow, magenta, green, violet). Switching the range or reordering never repaints a goal. Goals past the seventh share a neutral grey and are still listed by name. The palette passes the dataviz CVD and normal-vision checks on both surfaces. Status colours (mint, peach, rose) are not used for series.

## 4. Screens

### 4.1 Roadmap entry points

- A **pie chart** icon button beside **+** in the header (shown once there is a goal).
- On *Active*, with two or more goals: a card *Where your effort went* with the top three shares in words and a thin 8 px split bar (the map's colours). Tapping it opens the overview.

### 4.2 Goals overview

1. **Last 4 weeks · All time** segmented control.
2. **Hero card**: *Where your effort went*, *N quests done*, *Since 26 Oct, across 3 goals. Tap a territory to open its goal.*, then the **territory map** with its legend (§4.3) and the coins earned from these quests.
3. **One row per goal**, largest share first (the rows are the map's legend): colour swatch, title, share %, a thin bar of its share in the goal's colour, *12 quests done · 120 coins*, and the goal's status chip. Each row opens the goal.
4. **Unlinked note** (when relevant).
5. **Empty state** with no goals: *No goals yet* and **Create a goal**.

### 4.3 Territory map

- A hexagon **island** (a radius-5 hex disc with its six corners and some coast cells dropped in a fixed pattern: 81 pointy-top cells) is split into **one connected territory per goal** with effort in the range.
- **Size:** cells per goal are its share of the island (largest remainder, so they add up exactly). Every goal with at least one quest done keeps at least one cell.
- **Layout (treemap on hexes):** the goals, largest first, are split into two groups of near-equal size. The land is cut in a straight line across its longest side in that ratio, and each side is split again. A cut is only used if both sides stay in one piece; otherwise the next angle is tried. The same shares always draw the same map.
- **Drawing:** cells in the goal's colour with a thin surface-coloured gap between them; a thicker gap (5 px) along every border between two territories. **Labels**, largest territory first, never covering one another: territories of 6+ cells get a white **name pill** (*Read more  16%*, names over 20 characters shortened with …) at their middle; smaller ones of 3+ cells get the bare share (*4%*) in white (near-black on yellow); the rest rely on the legend.
- **Legend** right under the map: swatch, name and share for every goal on the map, largest first. Tapping an entry opens the goal.
- **Tap** any cell of a territory to open that goal. The map has an accessibility label listing every goal and its share; the rows below are the accessible way in.
- With nothing done in the range, the whole island is unclaimed (track colour).

## 5. Open points

- Effort counts completions, so a 2-minute quest weighs the same as a 2-hour one. A *coins* or *time* measure could be offered later.
- A share of the **plan** (planned sessions per week, by goal) could sit next to the share of what was actually done.

## 6. Proposed redesign: a readable, tappable territory map

**Status:** implemented in the web POC (22 Nov 2026). This section supersedes the presentation and interaction in §4.2–4.3 (name pills, the wraparound legend and tap-to-navigate on the map are gone). The share rules in §3 and the island layout in §4.3 still apply.

### What to improve

The island gives the overview a recognizable LifeQuest look. Today, the grid lines are almost as prominent as the territories, labels get smaller or disappear as territories shrink, and the same goal can appear on the island, in the legend, and again as a detailed row. A tap immediately opens a different screen, which makes it hard to explore several territories in a row.

### Proposed layout and behavior

1. **Explain the metric above the map.** Keep the range control and completion count. Add “Larger territories represent more completed quests.” Show the period, contributing goal count and coins once, close to the count.
2. **Keep the island and soften the grid.** Preserve the existing layout and stable goal colors. Let fills meet directly at territory boundaries, with subtle dark hex seams. Put the goal’s chosen icon above its percentage in a compact map label. Place a label only where its 44 × 44 pt target fits without overlapping another label or the map edge. A small region can still respond to a direct tap, and its full size goal row provides the equivalent action.
3. **Preview a territory in place.** Start with the goal with the most completions selected. A tap or keyboard activation selects a territory and updates one panel under the map with the full goal name, share, completion count, and **Open goal**. Use an outline and a selected state for the marker, so the selection does not depend on color. Changing the range keeps the selected goal if it still has effort and a territory. Otherwise, select the leading mapped goal. If there are no completions, leave the selection empty. Returning from a goal should restore the range, selection, and scroll position.
4. **Use the goal list as the only legend.** Remove the separate wraparound legend. Keep one sorted row per goal with its icon or initials, color (when mapped), full name, share, completion count, coins, and status. The row opens its goal directly. A goal with no completions remains in the list at 0% when other goals have completions and has no territory. If the range has no completions, replace the map and preview with a short empty message and show a dash for each undefined share. Keep the separate note and action for unlinked quests.

### Icon picker in New goal and Edit goal

- Place an optional **Goal icon** field below the goal name. Open a compact picker of labeled presets, such as Strength (dumbbell), Language (speech bubble), Reading (book), and Running (shoe). Show the current choice and offer **Use initials** to clear it.
- Save the optional icon with the goal. Linked quests contribute completions to that goal and use the goal's identity on the map.
- Existing goals, cleared choices and unknown icon values use up to two initials from the goal name. If the name has no usable initials, use a generic goal icon. Reuse the same mark on the map and in the list. Keep accessible labels based on the full goal name and share, so similar or repeated icons still work.

### Acceptance criteria

- At 320, 390 and 430 pt widths, in both themes, the island and goal rows fit without horizontal scrolling. At large text sizes, names and figures wrap or stack, and all goal rows and actions stay usable.
- Territory selection keeps the user on Goals overview. Only **Open goal** and the goal rows navigate. Screen readers announce the selected goal, share, and completed quest count once. Rows expose the full goal name and share, and keyboard users can reach every goal through those rows.
- Map markers never overlap. When goals share an icon or color, tapping their territories shows their full names, and the list provides a direct path to each goal. Small regions, long names, ties, one contributing goal, zero completions, and more goals than the map can represent all have a usable list fallback.
- Creating or editing a goal icon updates its mark on the map and in the goal list. Cancelling leaves the stored icon as it was. Saving with **Use initials** or opening an existing goal without an icon produces the initials fallback.
- Switching ranges updates the island, percentages and list together. Verify that percentages use the same completion denominator and rounding as the existing list, even when the minimum cell allocation exaggerates a very small share.

### Implementation notes

- **Map:** a blue water gradient and small ripples frame the island. Two shadow layers below the coastline give the land depth, with subtle shade variation across the hexes. Adjacent territory colors meet directly, and thin dark lines show the hex grid. The selected territory uses a stronger fill and a dark outline. Territory sizes still follow the same quest shares.
- **Markers:** the goal icon or initials sit above the percentage in a compact label. Labels are centered in 44 × 44 pt targets by `placeMarkers`. Each target’s accessible name includes the goal and share.
- **Preview:** below the map, the selected goal’s color accents the edge of its panel. The name and quest count are on the left and the share is on the right. **Open goal** navigates to the goal. The selection is announced once per change through a polite live region.
- **State on return:** the overview stays mounted under the goal page, so range, selection and scroll are kept.
- **Icon presets (16):** Strength, Running, Health, Reading, Language, Learning, Career, Money, Cooking, Music, Creative, Coding, Travel, Home, Family, Sleep. Stored as a short key on `Goal.icon` (no migration: rows are stored whole). Keys that aren't lowercase tokens are dropped when saving.
- **Initials:** the first letter of the first and last words, skipping small words (*a, an, the, in, of, to, and, at, for, my, on, with, by*) unless nothing else is left: *Get in better shape* → GS, *Read more* → RM, *Cooking* → C. No letters or digits → a flag icon.

## 7. Calendar ranges

**Status:** implemented in the web POC (22 Nov 2026).

**Implementation notes:** ranges come from `rangeBounds` in `src/domain/goal-share.ts` (`'7d' | '4w' | 'all' | { from, to }`; reversed dates are ordered and an end past today is clamped). The dialog is `src/ui/date-range-dialog.tsx`; its rules (Monday-first month grid, two-tap picking, roles for circles and the band) are pure helpers in `src/domain/date-range.ts`. The grid always draws six rows so the month arrows don't move. The applied dates show above the map as *28 Oct 2026 – 3 Nov 2026* (one day shows once; *All time · through 22 Nov 2026*). Tests: `tests/date-range.test.ts` and the range cases in `tests/goal-share.test.ts`.

### Layout

- Keep **Last 7 days**, **Last 4 weeks**, and **Calendar** together above the map. **Last 4 weeks** is the default. Give the calendar a calendar icon and highlight it whenever custom dates or **All time** are active. Allow the controls to wrap on narrow screens or at larger text sizes.
- Open a **Choose dates** dialog with the **Start date** and **End date** above the month grid. Place previous and next month buttons beside the month title. Give the two selected days solid circles and connect the intervening days with a light band. Outline today when it is outside the selection. Use the theme colors in both light and dark modes.
- Place **All time** and **Apply dates** below the grid. Provide a close button beside the title. Keep all controls reachable at 320 pt and with larger text.

### Interaction

1. Open the current month by default. When editing a custom period, restore its two dates and open the month of the end date.
2. Pick two days. The calendar can span months and orders the dates if the earlier day is picked second. Picking the same day twice selects a single day. A new tap after both dates are set starts a new draft.
3. Disable future dates, navigation past the current month, and **Apply dates** until both dates are set. Closing the dialog or using Back or Escape discards draft changes. **All time** applies immediately and closes the dialog.
4. On **Apply dates**, refresh the map, preview, goal rows, and completion and coin totals together. Show the exact applied dates above the map, even for an empty period. Preserve the selected territory if it still has completions in the new period.

### Counting and acceptance

- **Last 7 days** and **Last 4 weeks** are rolling windows of 7 and 28 local calendar days, including today. Custom dates include both endpoints, using each quest's completion day. **All time** includes the full history through today.
- Verify a range across a month or year boundary, a one-day range, and a range with zero completions. Verify that closing without applying keeps the previous period, and that reopening a custom period restores its dates.
- Give every day a full-date accessible label. Expose selected dates and unavailable days to assistive technology and allow the dialog to be operated by keyboard.

## 8. Map pin markers

**Selected design:** **Map pin** (implemented 22 Nov 2026).

**Implementation notes:** each pin is a 30 × 38 teardrop drawn in `TerritoryMap` (`src/ui/goal-charts.tsx`): dark body (`mapEdge`), edge in the territory colour (3.5 pt and a light halo when selected, 2.5 pt otherwise), the goal icon or initials in the head, and the share in a small pill under the tip. The tap target is 44 × 56 (pin plus label); `placeMarkers` takes the separate height so pins never overlap or leave the map. Tests at 320 and 390 wide in `tests/territory-map.test.ts`.

- Place a compact, dark pin on each territory with the goal’s chosen icon centered inside. Keep the goal’s initials fallback when it has no icon. Tint the pin’s edge with the territory color and put the share, such as **29%**, in a small label directly below the tip.
- Give the selected pin a stronger outline and keep the existing outline around its territory. Tapping a pin or a territory updates the preview below the map with the goal name, quest count, and share.
- Fit the entire pin and percentage label inside the map with a touch target of at least 44 × 44 pt. Check for overlaps at 320 pt in both themes. If a small territory has no room for a pin, its cells remain tappable and its goal remains reachable from the list. Each pin’s accessible label includes the goal name and percentage.

