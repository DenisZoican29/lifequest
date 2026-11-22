import { View } from 'react-native';

import { isDates, plural, repeatSummary, type RepeatValue } from '@/domain/repeat';
import type { RecurrenceFrequency } from '@/domain/types';

import { Card, Chip, Field, Row, Segmented, T } from './components';
import { DateField } from './date-field';
import { font, space, usePalette } from './theme';

export { repeatFromRule, ruleFromRepeat, windowFromRepeat, isDates, type RepeatValue } from '@/domain/repeat';

const UNITS: RecurrenceFrequency[] = ['day', 'week', 'month', 'year'];

export function RepeatPicker({
  value,
  onChange,
  showAnchor = true,
  start,
  today,
}: {
  value: RepeatValue;
  onChange: (v: RepeatValue) => void;
  /** Offer "after I complete it / fixed schedule" for once-per-period repeats. */
  showAnchor?: boolean;
  /** Start date (the form's date field). Passing it with `today` offers "Between dates". */
  start?: string;
  today?: string;
}) {
  const p = usePalette();
  const set = (patch: Partial<RepeatValue>) => onChange({ ...value, ...patch });
  const v = value;
  const single = v.times === '1';
  const unitWord = plural(v.every, v.unit);

  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="Every day" selected={v.mode === 'daily'} onPress={() => set({ mode: 'daily' })} />
        <Chip label="Just once" selected={v.mode === 'once'} onPress={() => set({ mode: 'once' })} />
        <Chip label="Custom" icon="options-outline" selected={v.mode === 'custom'} onPress={() => set({ mode: 'custom' })} />
      </Row>

      {v.mode === 'custom' && start !== undefined && today !== undefined && (
        <Segmented
          value={v.span ?? 'repeat'}
          onChange={(span) => set({ span })}
          options={[
            { value: 'repeat', label: 'Repeating' },
            { value: 'dates', label: 'Between dates' },
          ]}
        />
      )}

      {isDates(v) && start !== undefined && today !== undefined && (
        <Card>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 72 }}>
              <Field label="Times" value={v.times} onChangeText={(times) => set({ times })} numeric />
            </View>
            <T kind="body" style={{ marginTop: 34, flex: 1 }}>
              {plural(v.times, 'time')} from the start date until
            </T>
          </Row>
          <DateField label="End date" value={v.end ?? ''} onChange={(end) => set({ end })} today={today} />
          <T kind="bodyStrong" color={p.forest}>
            {repeatSummary(v, start)}
          </T>
          <T kind="small">
            Log it on whatever days suit you, even several in one day. If the end date passes before you reach {v.times || 'N'}, it shows as not done, and you can give it more time or delete it.
          </T>
        </Card>
      )}

      {v.mode === 'custom' && !isDates(v) && (
        <Card>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 72 }}>
              <Field label="Times" value={v.times} onChangeText={(times) => set({ times })} numeric />
            </View>
            <T kind="body" style={{ marginTop: 34 }}>
              {plural(v.times, 'time')} every
            </T>
            <View style={{ width: 72 }}>
              <Field label="Period" value={v.every} onChangeText={(every) => set({ every })} numeric />
            </View>
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            {UNITS.map((u) => (
              <Chip key={u} label={plural(v.every, u[0].toUpperCase() + u.slice(1))} selected={v.unit === u} onPress={() => set({ unit: u })} />
            ))}
          </Row>
          <T kind="bodyStrong" color={p.forest}>
            {repeatSummary(v)}
          </T>

          {single ? (
            showAnchor && (
              <>
                <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>
                  Next one is scheduled
                </T>
                <Row style={{ flexWrap: 'wrap' }}>
                  <Chip label="After I complete it" selected={v.anchor === 'completion'} onPress={() => set({ anchor: 'completion' })} />
                  <Chip label="On a fixed schedule" selected={v.anchor === 'calendar'} onPress={() => set({ anchor: 'calendar' })} />
                </Row>
                <T kind="small">
                  {v.anchor === 'completion'
                    ? `Done late? The next one is due ${v.every || 'N'} ${unitWord} after you finish.`
                    : 'Stays on the original dates. Missed ones are skipped, not stacked.'}
                </T>
              </>
            )
          ) : (
            <T kind="small">
              {v.unit === 'day' && v.every === '1'
                ? `Tick it up to ${v.times || 'N'} times a day. It comes back tomorrow.`
                : `Do it ${v.times || 'N'} times ${v.every === '1' ? `each ${v.unit}` : `in each ${v.every}-${v.unit} stretch`}, on whatever days suit you, even several in one day. Once you reach ${v.times || 'N'}, it waits for the next ${v.every === '1' ? v.unit : `${v.every}-${v.unit} stretch`}.${v.unit === 'week' ? ' Weeks run Monday to Sunday.' : ''}`}
            </T>
          )}
        </Card>
      )}
    </View>
  );
}
