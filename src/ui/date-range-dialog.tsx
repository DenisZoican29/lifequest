import { format } from 'date-fns';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { dayRole, monthGrid, monthOf, pickDay, type DraftRange } from '@/domain/date-range';
import { addPeriod, fromLocalDate } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';

import { Button, IconButton, Ionicons, T, textStyles } from './components';
import { font, radius, softShadow, space, usePalette } from './theme';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const fullDate = (d: LocalDate) => format(fromLocalDate(d), 'EEEE, d MMMM yyyy');
const shortDate = (d: LocalDate) => format(fromLocalDate(d), 'd MMM yyyy');

/**
 * Choose dates (addendum A3 §7). Two taps pick a range (in order, across months, the same day
 * twice = one day). Future days and months are unavailable. Closing, Back or Escape discards the
 * draft; **All time** applies at once; **Apply dates** needs both dates. Mount it only while open,
 * so each opening starts from `initial`.
 */
export function DateRangeDialog({
  today,
  initial,
  onApply,
  onAllTime,
  onClose,
}: {
  today: LocalDate;
  initial?: { from: LocalDate; to: LocalDate };
  onApply: (range: { from: LocalDate; to: LocalDate }) => void;
  onAllTime: () => void;
  onClose: () => void;
}) {
  const p = usePalette();
  const [draft, setDraft] = useState<DraftRange>(initial ? { start: initial.from, end: initial.to } : {});
  const { start, end } = draft;

  return (
    <CalendarDialog title="Choose dates" onClose={onClose}>
    <View style={styles.fields}>
      {(['start', 'end'] as const).map((k) => {
        const value = draft[k];
        const active = k === 'start' ? !draft.start || !!draft.end : !!draft.start && !draft.end;
        return (
          <View
            key={k}
            accessible
            accessibilityLabel={`${k === 'start' ? 'Start date' : 'End date'}: ${value ? fullDate(value) : 'not set'}`}
            style={[styles.field, { borderColor: active ? p.forest : p.border, backgroundColor: p.canvas }]}>
            <T kind="meta">{k === 'start' ? 'Start date' : 'End date'}</T>
            <T kind="bodyStrong" color={value ? p.ink : p.faint} numberOfLines={1}>
              {value ? shortDate(value) : 'Pick a day'}
            </T>
          </View>
        );
      })}
    </View>

    <CalendarMonth today={today} initialDay={initial?.to ?? today} maxDate={today} draft={draft} onSelect={(day) => setDraft((d) => pickDay(d, day))} />

    <View style={styles.actions}>
      <Button compact kind="secondary" title="All time" onPress={onAllTime} style={{ flex: 1 }} />
      <Button
        compact
        title="Apply dates"
        disabled={!start || !end}
        onPress={() => { if (start && end) onApply({ from: start, to: end }); }}
        style={{ flex: 1 }}
      />
    </View>
    {!(start && end) && (
      <T kind="meta" style={{ textAlign: 'center' }}>
        {start ? 'Now pick the end date.' : 'Pick the first and last day.'}
      </T>
    )}
    </CalendarDialog>
  );
}

/** Single selection applies the date to its caller. Closing the dialog leaves the value as is. */
export function DatePickerDialog({ title, today, selected, minDate, maxDate, onSelect, onClose }: {
  title: string;
  today: LocalDate;
  selected?: LocalDate;
  minDate?: LocalDate;
  maxDate?: LocalDate;
  onSelect: (day: LocalDate) => void;
  onClose: () => void;
}) {
  const date = selected ?? today;
  const initialDay = minDate && date < minDate ? minDate : maxDate && date > maxDate ? maxDate : date;
  return (
    <CalendarDialog title={title} onClose={onClose}>
      <CalendarMonth today={today} initialDay={initialDay} minDate={minDate} maxDate={maxDate} draft={{ start: selected }} onSelect={onSelect} />
    </CalendarDialog>
  );
}

function CalendarDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const p = usePalette();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} tabIndex={-1} />
        <View role="dialog" aria-modal accessibilityViewIsModal aria-label={title} style={[styles.dialog, { backgroundColor: p.surface }, softShadow(p)]}>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.titleRow}>
              <T kind="h2" accessibilityRole="header" style={{ flex: 1 }}>{title}</T>
              <IconButton icon="close" label="Close without applying" onPress={onClose} />
            </View>
            {children}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function CalendarMonth({ today, initialDay, minDate, maxDate, draft, onSelect }: {
  today: LocalDate;
  initialDay: LocalDate;
  minDate?: LocalDate;
  maxDate?: LocalDate;
  draft: DraftRange;
  onSelect: (day: LocalDate) => void;
}) {
  const p = usePalette();
  const [month, setMonth] = useState(() => monthOf(initialDay));
  const canGoBack = !minDate || month > monthOf(minDate);
  const canGoNext = !maxDate || month < monthOf(maxDate);
  const monthTitle = format(fromLocalDate(month), 'MMMM yyyy');
  // Keep the height steady while moving between months.
  const weeks = monthGrid(month);
  while (weeks.length < 6) weeks.push(Array.from({ length: 7 }, () => null));

  return (
    <View style={{ gap: space.sm }}>
    <View style={styles.monthRow}>
      <MonthArrow direction="back" enabled={canGoBack} onPress={() => setMonth(addPeriod(month, 'month', -1))} />
      <View style={{ flex: 1 }} accessibilityLiveRegion="polite" aria-live="polite">
        <T kind="h3" style={styles.monthTitle}>
          {monthTitle}
        </T>
      </View>
      <MonthArrow direction="forward" enabled={canGoNext} onPress={() => setMonth(addPeriod(month, 'month', 1))} />
    </View>

    <View accessibilityRole="grid" aria-label={monthTitle}>
      <View style={styles.week} aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <Text key={d} style={[textStyles.meta, styles.weekday, { color: p.muted }]} accessibilityLabel={WEEKDAY_NAMES[i]}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.cell} />;
            const role = dayRole(draft, day);
            const disabled = !!((minDate && day < minDate) || (maxDate && day > maxDate));
            const solid = !disabled && (role === 'start' || role === 'end' || role === 'single');
            const banded = !disabled && (role === 'between' || role === 'start' || role === 'end');
            const isToday = day === today;
            return (
              <View key={di} style={styles.cell}>
                {/* The light band joins the two chosen days; half-width at each end. */}
                {banded && (
                  <View
                    aria-hidden
                    style={[
                      styles.band,
                      { backgroundColor: p.mint },
                      role === 'start' && { left: '50%' },
                      role === 'end' && { right: '50%' },
                    ]}
                  />
                )}
                <Pressable
                  onPress={() => onSelect(day)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`${fullDate(day)}${isToday ? ', today' : ''}${disabled ? ', unavailable' : ''}`}
                  accessibilityState={{ selected: !disabled && !!role, disabled }}
                  aria-pressed={!disabled && !!role}
                  style={({ pressed }) => [
                    styles.day,
                    solid && { backgroundColor: p.forest },
                    isToday && !role && { borderWidth: 1.5, borderColor: p.ink },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text
                    style={[
                      textStyles.chip,
                      { color: solid ? p.onForest : disabled ? p.faint : p.ink, fontFamily: solid || isToday ? font.bold : undefined },
                    ]}>
                    {Number(day.slice(8))}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>

    </View>
  );
}

function MonthArrow({ direction, enabled, onPress }: { direction: 'back' | 'forward'; enabled: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={direction === 'back' ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [styles.navButton, { borderColor: p.border, backgroundColor: p.surface, opacity: !enabled ? 0.35 : pressed ? 0.7 : 1 }]}>
      <Ionicons name={direction === 'back' ? 'chevron-back' : 'chevron-forward'} size={20} color={p.ink} aria-hidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(39,61,53,0.45)', justifyContent: 'center', alignItems: 'center', padding: space.sm },
  dialog: { width: '100%', maxWidth: 400, maxHeight: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  content: { padding: space.md, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  field: { flexGrow: 1, flexBasis: 120, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm, gap: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  monthTitle: { textAlign: 'center' },
  navButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: space.xs },
  cell: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', left: 0, right: 0, top: 4, bottom: 4 },
  day: { width: '100%', maxWidth: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
