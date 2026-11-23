import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { fromLocalDate } from '@/domain/dates';
import { ON_TRACK, type DayActivity, type WeekStanding } from '@/domain/goal-insights';
import type { GoalShare } from '@/domain/goal-share';
import { buildTerritories, HEX_DIRS, hexCenter, islandCells, placeMarkers, type Hex } from '@/domain/territory-map';

import { Card, Ionicons, Row, T, type IconName } from './components';
import { GoalMark } from './goal-mark';
import { ProgressRing } from './progress-ring';
import { font, radius, space, useIsDark, usePalette, type Palette } from './theme';

const pct = (r: number) => `${Math.round(r * 100)}%`;
const day = (d: string, f: string) => format(fromLocalDate(d), f);

/** Share of the plan kept (last four weeks) as a ring. Shows a dash before anything was due. */
export function ConsistencyRing({ ratio, size = 96, stroke = 10, track }: { ratio: number | null; size?: number; stroke?: number; track?: string }) {
  const v = ratio === null ? 0 : Math.max(0, Math.min(1, ratio));
  const small = size < 72;
  return (
    <ProgressRing
      ratio={v}
      size={size}
      stroke={stroke}
      track={track}
      accessibilityLabel={ratio === null ? 'Consistency not measured yet' : `Kept ${pct(v)} of the plan`}>
      <T kind={small ? 'meta' : 'h2'} style={{ fontFamily: font.bold }}>
        {ratio === null ? '–' : pct(v)}
      </T>
    </ProgressRing>
  );
}

/** Tiny bar strip of recent weeks for goal cards. Decorative; the card states the status in words. */
export function WeekSpark({ weeks, height = 28 }: { weeks: WeekStanding[]; height?: number }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height }} aria-hidden>
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

/** A goal's colour: its fixed categorical slot (by creation date). Goals past the seventh share a neutral. */
export function goalColor(p: Palette, slot: number): string {
  return p.series[slot] ?? p.faint;
}

const ISLAND = islandCells();
const SQRT3 = Math.sqrt(3);
const MAP_INSET = 12;
const RIPPLE_POINTS = [[0.09, 0.15], [0.73, 0.08], [0.91, 0.27], [0.11, 0.72], [0.28, 0.91], [0.88, 0.87]];
/** Pointy-top corners; corner i → i+1 is the edge facing HEX_DIRS[i]. */
const corner = (x: number, y: number, size: number, i: number) => {
  const a = ((60 * i - 30) * Math.PI) / 180;
  return { x: x + size * Math.cos(a), y: y + size * Math.sin(a) };
};

const MARKER_BOX = 44;
/** A map pin (30 × 38) plus its share label below the tip (A3 §8). */
const PIN_BOX_H = 56;
const PIN_W = 30;
const PIN_H = 38;
/** Teardrop: a round head with the icon, narrowing to a tip at the bottom centre. */
const PIN_PATH = 'M15 36.5C15 36.5 2.5 24 2.5 14.5A12.5 12.5 0 1 1 27.5 14.5C27.5 24 15 36.5 15 36.5Z';

/**
 * Goals overview map (addendum A3 §6): a hexagon island where each goal holds one connected
 * territory sized by its share of quests done. Taps select a territory in place.
 */
export function TerritoryMap({
  parts,
  selectedId,
  onSelect,
}: {
  parts: GoalShare[];
  selectedId?: string;
  onSelect: (part: GoalShare) => void;
}) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const map = useMemo(() => buildTerritories(parts.map((x) => x.done), ISLAND), [parts]);

  const unit = useMemo(() => {
    const pts = ISLAND.map((c) => hexCenter(c, 1));
    const minX = Math.min(...pts.map((q) => q.x)) - SQRT3 / 2;
    const maxX = Math.max(...pts.map((q) => q.x)) + SQRT3 / 2;
    const minY = Math.min(...pts.map((q) => q.y)) - 1;
    const maxY = Math.max(...pts.map((q) => q.y)) + 1;
    return { minX, minY, w: maxX - minX, h: maxY - minY };
  }, []);

  const size = Math.max(0, width - 2 * MAP_INSET) / unit.w;
  const height = size ? size * unit.h + 2 * MAP_INSET : 0;
  const at = (h: Hex) => {
    const c = hexCenter(h, size);
    return { x: c.x - unit.minX * size + MAP_INSET, y: c.y - unit.minY * size + MAP_INSET };
  };
  const ownerOf = new Map(map.cells.map((c) => [`${c.q},${c.r}`, c.owner]));
  const selected = parts.findIndex((x) => x.goal.id === selectedId);

  const hexPath = (h: Hex) => {
    const { x, y } = at(h);
    return (
      Array.from({ length: 6 }, (_, i) => corner(x, y, size, i))
        .map((v, i) => `${i ? 'L' : 'M'}${v.x.toFixed(2)},${v.y.toFixed(2)}`)
        .join('') + 'Z'
    );
  };

  // Coastline and the selected territory's outline. Adjacent territory fills meet directly.
  const coast: string[] = [];
  const outline: string[] = [];
  if (size) {
    for (const c of map.cells) {
      const { x, y } = at(c);
      HEX_DIRS.forEach((d, i) => {
        const n = ownerOf.get(`${c.q + d.q},${c.r + d.r}`);
        const a = corner(x, y, size, i);
        const b = corner(x, y, size, (i + 1) % 6);
        const e = `M${a.x} ${a.y}L${b.x} ${b.y}`;
        if (n === undefined) coast.push(e);
        if (selected >= 0 && c.owner === selected && n !== selected) outline.push(e);
      });
    }
  }

  const tiles = size ? map.cells.map((cell) => ({ ...cell, path: hexPath(cell) })) : [];
  const land = tiles.map((tile) => tile.path).join('');
  const ripples = RIPPLE_POINTS.map(([x, y]) => `M${x * width - 8} ${y * height}q3 -2 6 0t6 0t6 0m-13 5q3 -2 6 0t6 0`).join('');

  const markers = size
    ? placeMarkers(
        map.cells.map((c) => ({ owner: c.owner, ...at(c) })),
        map.counts,
        MARKER_BOX,
        width,
        height,
        PIN_BOX_H,
      )
    : [];

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.mapStage, { backgroundColor: p.mapWater, height: height || undefined, aspectRatio: height ? undefined : unit.w / unit.h }]}>
      {size > 0 && (
        <>
          {/* Drawing only: hidden from screen readers, and taps go to the zones below (no SVG handlers on web). */}
          <View aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="lifequest-map-water" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={p.mapWater} />
                  <Stop offset="100%" stopColor={p.mapWaterDeep} />
                </LinearGradient>
              </Defs>
              <Rect width={width} height={height} fill="url(#lifequest-map-water)" />
              <Path d={ripples} fill="none" stroke={p.mapRipple} strokeOpacity={0.29} strokeWidth={1} strokeLinecap="round" />
              <Path d={coast.join('')} fill="none" stroke={p.mapRipple} strokeOpacity={0.12} strokeWidth={11} strokeLinecap="round" />
              <Path d={land} fill={p.ink} fillOpacity={0.13} transform="translate(0,6)" />
              <Path d={land} fill={p.ink} fillOpacity={0.28} transform="translate(0,3)" />
              <Path d={land} fill={p.surface} />
              {tiles.map((tile) => {
                const part = tile.owner >= 0 ? parts[tile.owner] : undefined;
                // Use the coordinates so the tile texture stays fixed when the selected goal changes.
                const shade = Math.abs((tile.q * 7 + tile.r * 13) % 4);
                const opacity = 0.57 + shade * 0.035 + (tile.owner === selected ? 0.2 : 0);
                return (
                  <Path
                    key={`${tile.q},${tile.r}`}
                    d={tile.path}
                    fill={part ? goalColor(p, part.slot) : p.track}
                    fillOpacity={opacity}
                    stroke={p.mapEdge}
                    strokeOpacity={0.23}
                    strokeWidth={0.65}
                  />
                );
              })}
              <Path d={coast.join('')} fill="none" stroke={p.mapRipple} strokeOpacity={0.76} strokeWidth={1.1} strokeLinecap="round" />
              {outline.length > 0 && <Path d={outline.join('')} fill="none" stroke={p.mapEdge} strokeOpacity={0.84} strokeWidth={1.6} strokeLinecap="round" />}
            </Svg>
          </View>
          {/* Tap zones: one per claimed cell, brick-laid so they tile the hexes. Not focusable: keyboard and screen-reader users use the markers and the goal list. */}
          {map.cells.map((c) => {
            if (c.owner < 0) return null;
            const part = parts[c.owner];
            const { x, y } = at(c);
            const w = SQRT3 * size;
            const h = 1.5 * size;
            return (
              <Pressable
                key={`hit-${c.q},${c.r}`}
                onPress={() => onSelect(part)}
                focusable={false}
                accessible={false}
                style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h }}
              />
            );
          })}
          {markers.map((m) => {
            const part = parts[m.owner];
            const on = m.owner === selected;
            return (
              <Pressable
                key={part.goal.id}
                onPress={() => onSelect(part)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${part.goal.title}, ${part.percent}%. ${on ? 'Selected on map.' : 'Show on map.'}`}
                style={{
                  position: 'absolute',
                  left: m.x - MARKER_BOX / 2,
                  top: m.y - PIN_BOX_H / 2,
                  width: MARKER_BOX,
                  height: PIN_BOX_H,
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                }}>
                {/* Map pin: dark body, edge in the territory colour (thicker when selected), goal icon or initials inside. */}
                <View aria-hidden style={{ width: PIN_W, height: PIN_H }}>
                  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <Svg width={PIN_W} height={PIN_H}>
                      {on && <Path d={PIN_PATH} fill="none" stroke={p.mapLabel} strokeWidth={6} strokeLinejoin="round" />}
                      <Path d={PIN_PATH} fill={p.mapEdge} stroke={goalColor(p, part.slot)} strokeWidth={on ? 3.5 : 2.5} strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <View style={styles.pinIcon}>
                    <GoalMark goal={part.goal} size={16} color={p.mapLabel} bare />
                  </View>
                </View>
                <View aria-hidden style={[styles.pinLabel, { backgroundColor: p.surface, borderColor: on ? p.mapEdge : p.border }]}>
                  <T kind="meta" color={p.ink} style={styles.mapMarkerText}>{part.percent}%</T>
                </View>
              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  refLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  baseline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
  mapStage: { width: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  pinIcon: { position: 'absolute', left: 0, right: 0, top: 6, height: 17, alignItems: 'center', justifyContent: 'center' },
  pinLabel: { marginTop: 1, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 5 },
  mapMarkerText: { fontFamily: font.bold, fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'] },
});
