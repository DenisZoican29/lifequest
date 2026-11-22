import { View } from 'react-native';

import { addPeriod, formatFriendly, isLocalDate } from '@/domain/dates';

import { Chip, Field, Row } from './components';
import { space } from './theme';

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
