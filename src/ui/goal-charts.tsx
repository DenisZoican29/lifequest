import { format } from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { fromLocalDate } from '@/domain/dates';
import { ON_TRACK, type DayActivity, type WeekStanding } from '@/domain/goal-insights';

import { Card, Ionicons, Row, T, type IconName } from './components';
import { font, space, useIsDark, usePalette } from './theme';

const pct = (r: number) => `${Math.round(r * 100)}%`;
const day = (d: string, f: string) => format(fromLocalDate(d), f);

/** Share of the plan kept (last four weeks) as a ring. Shows a dash before anything was due. */
export function ConsistencyRing({ ratio, size = 96, stroke = 10, track }: { ratio: number | null; size?: number; stroke?: number; track?: string }) {
  const p = usePalette();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = ratio === null ? 0 : Math.max(0, Math.min(1, ratio));
  const small = size < 72;
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityLabel={ratio === null ? 'Consistency not measured yet' : `Kept ${pct(v)} of the plan`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? p.track} strokeWidth={stroke} fill="none" />
        {v > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={p.forestBright}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <T kind={small ? 'meta' : 'h2'} style={{ fontFamily: font.bold }}>
        {ratio === null ? '–' : pct(v)}
      </T>
    </View>
  );
}

/** Tiny bar strip of recent weeks for goal cards. Decorative; the card states the status in words. */
export function WeekSpark({ weeks, height = 28 }: { weeks: WeekStanding[]; height?: number }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height }} importantForAccessibility="no-hide-descendants">
      {weeks.map((w) => (
        <View
          key={w.start}
          style={{
            width: 6,
            height: w.ratio === null ? 2 : Math.max(3, w.ratio * height),
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            backgroundColor: w.ratio === null ? p.track : p.forestBright,
          }}
        />
      ))}
    </View>
  );
}

function weekLabel(w: WeekStanding): string {
  return w.current ? 'This week so far' : `Week of ${day(w.start, 'd MMM')}`;
}

/**
 * Week by week: share of the plan kept, one bar per week, with the 80% "on track" line.
 * Tap a bar to read it (no hover on touch screens).
 */
export function WeekBars({ weeks }: { weeks: WeekStanding[] }) {
  const p = usePalette();
  const H = 120;
  const lastWithData = weeks.map((w) => w.ratio !== null).lastIndexOf(true);
  const [sel, setSel] = useState(lastWithData >= 0 ? lastWithData : weeks.length - 1);
  const w = weeks[Math.min(sel, weeks.length - 1)];
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ minHeight: 40 }}>
        <T kind="meta">{weekLabel(w)}</T>
        <T kind="bodyStrong">{w.ratio === null ? 'Nothing was due' : `Kept ${pct(w.ratio)} of the plan`}</T>
      </View>
      <View style={{ height: H, justifyContent: 'flex-end' }}>
        <View style={[styles.refLine, { top: H * (1 - ON_TRACK), borderColor: p.faint }]} />
        <View style={[styles.baseline, { backgroundColor: p.border }]} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, gap: 6 }}>
          {weeks.map((x, i) => {
            const on = i === sel;
            const h = x.ratio === null ? 2 : Math.max(4, x.ratio * H);
            return (
              <Pressable
                key={x.start}
                onPress={() => setSel(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${weekLabel(x)}: ${x.ratio === null ? 'nothing was due' : `kept ${pct(x.ratio)} of the plan`}`}
                style={{ flex: 1, height: H, justifyContent: 'flex-end' }}>
                <View
                  style={{
                    height: h,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: x.ratio === null ? p.track : p.forestBright,
                    opacity: on || x.ratio === null ? 1 : 0.55,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T kind="meta">{day(weeks[0].start, 'd MMM')}</T>
        <Row gap={4}>
          <View style={{ width: 14, borderTopWidth: 1, borderStyle: 'dashed', borderColor: p.faint }} />
          <T kind="meta">On track ({pct(ON_TRACK)})</T>
        </Row>
        <T kind="meta">This week</T>
      </Row>
    </View>
  );
}

/** One hue, light to dark: no quests done → 4 or more done that day. */
function useRamp(): string[] {
  const p = usePalette();
  return useIsDark() ? [p.track, '#24503A', '#2F7350', '#479A6C', '#6FC497'] : [p.track, '#C4E8C2', '#8ECB95', '#4E9A6C', '#2C6249'];
}

const level = (n: number) => Math.min(4, n);
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

/** Days you showed up: one column per week, Monday at the top. Tap a day to read it. */
export function ActivityGrid({ days }: { days: DayActivity[] }) {
  const p = usePalette();
  const ramp = useRamp();
  const last = days.filter((d) => !d.future).pop();
  const [sel, setSel] = useState<DayActivity | undefined>(last);
  const weeks: DayActivity[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ minHeight: 40 }}>
        {sel && (
          <>
            <T kind="meta">{day(sel.date, 'EEEE d MMM')}</T>
            <T kind="bodyStrong">{sel.count === 0 ? 'No quests done' : `${sel.count} quest${sel.count === 1 ? '' : 's'} done`}</T>
          </>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <View style={{ gap: 3, marginRight: 2 }}>
          {WEEKDAYS.map((d, i) => (
            <View key={i} style={{ flex: 1, justifyContent: 'center' }}>
              <T kind="meta" style={{ fontSize: 10, lineHeight: 12 }}>
                {d}
              </T>
            </View>
          ))}
        </View>
        {weeks.map((col) => (
          <View key={col[0].date} style={{ flex: 1, gap: 3 }}>
            {col.map((d) => (
              <Pressable
                key={d.date}
                disabled={d.future || d.beforeStart}
                onPress={() => setSel(d)}
                accessibilityRole="button"
                accessibilityLabel={`${day(d.date, 'EEEE d MMM')}: ${d.count} done`}
                style={{
                  aspectRatio: 1,
                  borderRadius: 4,
                  backgroundColor: d.future || d.beforeStart ? 'transparent' : ramp[level(d.count)],
                  borderWidth: sel?.date === d.date ? 2 : d.beforeStart ? 1 : 0,
                  borderColor: sel?.date === d.date ? p.ink : p.border,
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <Row gap={4} style={{ justifyContent: 'flex-end' }}>
        <T kind="meta">Less</T>
        {ramp.map((c) => (
          <View key={c} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c }} />
        ))}
        <T kind="meta">More</T>
      </Row>
    </View>
  );
}

export function StatTile({ icon, value, label, sub }: { icon: IconName; value: string; label: string; sub?: string }) {
  const p = usePalette();
  return (
    <Card style={{ flex: 1, minWidth: 140, gap: 2 }}>
      <Ionicons name={icon} size={18} color={p.forest} />
      <T kind="h2" style={{ fontVariant: ['tabular-nums'], marginTop: 4 }}>
        {value}
      </T>
      <T kind="meta" color={p.ink} style={{ fontFamily: font.bold }}>
        {label}
      </T>
      {sub ? <T kind="meta">{sub}</T> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  refLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  baseline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
});
