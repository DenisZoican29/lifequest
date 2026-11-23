import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DEFAULT_WARNING_DAYS } from '@/domain/selectors';

import { T } from './components';
import { Dropdown } from './dropdown';
import { NumberWheel } from './number-wheel';
import { font, space, usePalette } from './theme';

type Unit = 'days' | 'weeks';

/** "1 day before", "2 weeks before", "On the due day". Unset means the default (1 day). */
export function warningLabel(days: number | undefined): string {
  const d = days ?? DEFAULT_WARNING_DAYS;
  if (d === 0) return 'On the due day';
  if (d % 7 === 0) return `${d / 7} week${d === 7 ? '' : 's'} before`;
  return `${d} day${d === 1 ? '' : 's'} before`;
}

/**
 * When a side quest's warning icon appears: one line, "Warn me [2] [weeks ▾] before", like the
 * repeat setting. `onChange` gets whole days, or NaN while the number is not valid yet.
 */
export function WarningPicker({ value, onChange, deadline = 'the deadline' }: {
  value: number | undefined;
  onChange: (days: number | undefined) => void;
  /** What the warning counts back from: "the deadline", or "the end of each week". */
  deadline?: string;
}) {
  const p = usePalette();
  const start = value === undefined || Number.isNaN(value) ? DEFAULT_WARNING_DAYS : value;
  const [unit, setUnit] = useState<Unit>(start > 0 && start % 7 === 0 ? 'weeks' : 'days');
  const [amount, setAmount] = useState(String(unit === 'weeks' ? start / 7 : start));
  const one = amount === '1';

  const emit = (text: string, u: Unit) => {
    const n = Number(text);
    onChange(text === '' || !Number.isInteger(n) ? NaN : u === 'weeks' ? n * 7 : n);
  };

  return (
    <View style={{ gap: 6 }}>
      <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>Warn me</T>
      <View style={styles.line}>
        <NumberWheel
          label={`Warn this many ${unit} before`}
          value={Number(amount)}
          min={unit === 'weeks' ? 1 : 0}
          max={unit === 'weeks' ? 52 : 90}
          onChange={(n) => {
            setAmount(String(n));
            emit(String(n), unit);
          }}
        />
        <View style={styles.grow}>
          <Dropdown
            label="Warning unit"
            value={unit}
            onChange={(u) => {
              // Keep the number inside the new unit's range (weeks start at 1).
              const n = u === 'weeks' ? Math.min(52, Math.max(1, Number(amount))) : Math.min(90, Number(amount));
              setUnit(u);
              setAmount(String(n));
              emit(String(n), u);
            }}
            options={[
              { value: 'days', label: one ? 'day before' : 'days before' },
              { value: 'weeks', label: one ? 'week before' : 'weeks before' },
            ]}
          />
        </View>
      </View>
      <T kind="small">{hint(value, deadline)}</T>
    </View>
  );
}

function hint(days: number | undefined, deadline: string): string {
  if (days !== undefined && Number.isNaN(days)) return 'Enter a whole number.';
  const d = days ?? DEFAULT_WARNING_DAYS;
  const dated = deadline === 'the deadline';
  const when = d > 0 ? `${warningLabel(d)} ${deadline}` : dated ? 'on the due day' : `on the last day of ${deadline.replace(/^the end of /, '')}`;
  const after = dated ? 'Overdue quests turn red.' : 'If the period ends, a new one starts; nothing turns red.';
  return `The warning icon appears ${when}. ${after}`;
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  grow: { flex: 1 },
});
