import { RhythmScreen } from './RhythmScreen';

/**
 * Purpose: legacy `/habits` stack entry — opens Rhythm hub on Consistency segment.
 * Inputs: none.
 * Outputs: RhythmScreen with streaks selected.
 * Side effects: none (route may also Redirect; this keeps in-place render for stack pushes).
 * Design decisions: preserves old links while Tab 3 owns the unified hub.
 */
export function HabitStreaksScreen() {
  return <RhythmScreen initialSegment="streaks" />;
}
