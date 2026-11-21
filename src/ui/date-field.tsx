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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  today: string;
  optional?: boolean;
}) {
  const quick = [
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
