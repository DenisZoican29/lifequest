import { format } from 'date-fns';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addPeriod, formatFriendly, fromLocalDate, isLocalDate } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';

import { Chip, Field, IconButton, Ionicons, Row, T } from './components';
import { DatePickerDialog } from './date-range-dialog';
import { InputButton } from './form-controls';
import { radius, space, TOUCH, usePalette } from './theme';

/** Text date input (no native picker on web) with quick-pick chips. */
export function DateField({
  label,
  value,
  onChange,
  today,
  optional,
  horizon = 'near',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  today: string;
  optional?: boolean;
  /** `far` offers months-ahead shortcuts, for goal deadlines. */
  horizon?: 'near' | 'far';
}) {
  const quick =
    horizon === 'far'
      ? [
          { label: 'In 1 month', v: addPeriod(today, 'month', 1) },
          { label: 'In 3 months', v: addPeriod(today, 'month', 3) },
          { label: 'In 6 months', v: addPeriod(today, 'month', 6) },
          { label: 'In 1 year', v: addPeriod(today, 'year', 1) },
        ]
      : [
          { label: 'Today', v: today },
          { label: 'Tomorrow', v: addPeriod(today, 'day', 1) },
          { label: '+1 week', v: addPeriod(today, 'week', 1) },
          { label: '+1 month', v: addPeriod(today, 'month', 1) },
        ];
  const invalid = value !== '' && !isLocalDate(value);
  return (
    <View>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={optional ? 'YYYY-MM-DD (optional)' : 'YYYY-MM-DD'}
        error={invalid ? 'Use the format 2026-12-31' : undefined}
        hint={value && !invalid ? formatFriendly(value, today) : undefined}
      />
      <Row style={{ flexWrap: 'wrap', marginTop: -space.xs, marginBottom: space.md }}>
        {quick.map((q) => (
          <Chip key={q.label} label={q.label} selected={value === q.v} onPress={() => onChange(q.v)} />
        ))}
        {optional && value !== '' && <Chip label="Clear" icon="close" onPress={() => onChange('')} />}
      </Row>
    </View>
  );
}

/**
 * A date chosen from the calendar. With `onClear`, the date is optional: an empty value reads
 * "No due date" and a clear button sits beside a chosen date (addendum A4 §4).
 */
export function CalendarDateField({ label, value, today, minDate, onChange, onClear, emptyLabel = 'No due date' }: {
  label: string;
  value: LocalDate;
  today: LocalDate;
  minDate?: LocalDate;
  onChange: (date: LocalDate) => void;
  onClear?: () => void;
  /** Shown when an optional date is empty ("No deadline"). */
  emptyLabel?: string;
}) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const selected = isLocalDate(value) ? value : undefined;
  const caption = selected ? format(fromLocalDate(selected), 'd MMM yyyy') : onClear ? emptyLabel : 'Choose a date';
  const tooEarly = selected && minDate && selected < minDate;

  return (
    <>
      <Row>
        <InputButton
          accessibilityLabel={`${label}. ${caption}`}
          aria-expanded={open}
          active={open}
          invalid={Boolean(tooEarly)}
          onPress={() => setOpen(true)}
          style={styles.dateButton}>
          <View style={[styles.dateIcon, { backgroundColor: p.input.selection }]} aria-hidden>
            <Ionicons name="calendar-outline" size={18} color={p.input.accent} />
          </View>
          <View style={styles.dateText}>
            <T kind="meta">{label}</T>
            <T kind="bodyStrong" color={selected ? p.ink : p.muted}>{caption}</T>
          </View>
          <Ionicons name="chevron-forward" size={15} color={p.muted} aria-hidden />
        </InputButton>
        {onClear && selected && <IconButton icon="close" label={`Remove ${label.toLowerCase()}`} onPress={onClear} />}
      </Row>
      {tooEarly && <T kind="meta" color={p.roseInk}>Choose an end date on or after the start date.</T>}
      {open && (
        <DatePickerDialog
          title={label}
          today={today}
          selected={selected}
          minDate={minDate}
          onClose={() => setOpen(false)}
          onSelect={(day) => {
            onChange(day);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/** Daily quests: shown where the date field would be, so the schedule reads "No due date". */
export function NoDueDateField({ label, note }: { label: string; note: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: space.xs }}>
      <View style={[styles.trigger, { borderColor: p.input.border, backgroundColor: p.input.fill }]}>
        <View style={[styles.dateIcon, { backgroundColor: p.track }]} aria-hidden>
          <Ionicons name="infinite-outline" size={19} color={p.muted} />
        </View>
        <View style={styles.dateText}>
          <T kind="meta">{label}</T>
          <T kind="bodyStrong">No due date</T>
        </View>
      </View>
      <T kind="small">{note}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  dateButton: { flex: 1, minHeight: 58 },
  dateIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  trigger: {
    flexDirection: 'row', alignItems: 'center', minHeight: TOUCH,
    paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.md,
    borderWidth: 1, borderRadius: radius.md,
  },
  dateText: { flex: 1 },
});
