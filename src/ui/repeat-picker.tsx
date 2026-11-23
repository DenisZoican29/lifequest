import { StyleSheet, View } from 'react-native';

import { isDates, type RepeatValue } from '@/domain/repeat';
import type { RecurrenceFrequency } from '@/domain/types';

import { Chip, Row, Segmented, T } from './components';
import { Dropdown } from './dropdown';
import { inputStyles } from './form-controls';
import { NumberWheel, WHEEL_HEIGHT } from './number-wheel';
import { font, space, usePalette } from './theme';

export { repeatFromRule, ruleFromRepeat, windowFromRepeat, isDates, type RepeatValue } from '@/domain/repeat';

const UNITS: RecurrenceFrequency[] = ['day', 'week', 'month', 'year'];

/**
 * How often a quest repeats: **Once** or **Repeating**. Repeating is one line, "Repeats every
 * [1] [day ▾]" (daily is every 1 day), plus how many times per period, or N times between two dates.
 */
export function RepeatPicker({ value, onChange, allowDateRange = false }: {
  value: RepeatValue;
  onChange: (value: RepeatValue) => void;
  allowDateRange?: boolean;
}) {
  const p = usePalette();
  const { every, unit, times, mode, span } = value;
  const set = (patch: Partial<RepeatValue>) => onChange({ ...value, ...patch });
  const hasRange = isDates(value);
  const one = every === '1';
  const period = one ? unit : `${every || '…'} ${unit}s`;
  const timesLabel = hasRange ? 'Times in date range' : one ? `Times per ${unit}` : `Times every ${period}`;

  return (
    <View style={{ gap: space.sm }}>
      <Segmented
        value={mode}
        onChange={(next) => set({ mode: next })}
        options={[
          { value: 'once', label: 'Once' },
          { value: 'repeating', label: 'Repeating' },
        ]}
      />
      {mode === 'repeating' && (
        <>
          {allowDateRange && (
            <Row style={{ flexWrap: 'wrap' }}>
              <Chip label="Regularly" selected={span !== 'dates'} onPress={() => set({ span: 'repeat' })} />
              <Chip label="Between dates" selected={span === 'dates'} onPress={() => set({ span: 'dates' })} />
            </Row>
          )}
          {!hasRange && (
            <View style={styles.every}>
              <View style={styles.cadenceLabel}>
                <T kind="small" color={p.ink} style={[inputStyles.label, styles.label]}>Repeats every</T>
              </View>
              <NumberWheel
                label={`Repeat every how many ${unit}s`}
                value={Number(every) || 1}
                min={1}
                max={99}
                onChange={(n) => set({ every: String(n) })}
              />
              <View style={styles.unit}>
                <Dropdown
                  label="Repeat unit"
                  value={unit}
                  onChange={(next) => set({ unit: next })}
                  options={UNITS.map((u) => ({ value: u, label: one ? u : `${u}s` }))}
                />
              </View>
            </View>
          )}
          <View style={[styles.timesRow, !hasRange && { borderTopWidth: 1, borderColor: p.border }]}>
            <T kind="small" color={p.ink} style={[inputStyles.label, styles.label, styles.timesLabel]}>{timesLabel}</T>
            <NumberWheel
              label={timesLabel}
              value={Number(times) || 1}
              min={1}
              max={100}
              onChange={(n) => set({ times: String(n) })}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  every: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  cadenceLabel: { flex: 1, minHeight: WHEEL_HEIGHT, justifyContent: 'center' },
  unit: { width: 100 },
  timesRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  label: { fontFamily: font.bold },
  timesLabel: { flex: 1 },
});
