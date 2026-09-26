import { beforeEach, describe, it, expect } from 'vitest';
import {
  BASE_MIN_CONFIDENCE_SCORE,
  DEFAULT_GENRE_THRESHOLDS,
  THRESHOLD_STEP,
  getThresholdFeedback,
  getGenreThreshold,
  getGenreThresholds,
  setGenreThreshold,
  setGenreThresholds,
  resetGenreThresholds,
  evaluateQualityScoreAgainstGenre,
  recordAdminOverride,
  resetThresholdFeedback,
} from '@/lib/qualityThresholds';

/**
 * Feedback loop to improve quality check thresholds from admin overrides and
 * configurable quality thresholds per genre (#431, #448).
 */

const override = (
  trackId: string,
  filterDecision: 'approved' | 'rejected' | 'timeout',
  adminAction: 'approved' | 'rejected' | 'skipped',
  genre?: string
) => ({ trackId, filterDecision, adminAction, genre });

describe('qualityThresholds - Genre Thresholds (#431)', () => {
  beforeEach(() => {
    resetThresholdFeedback();
  });

  it('provides default genre thresholds for distinct musical genres', () => {
    expect(getGenreThreshold('Classical')).toBe(0.85);
    expect(getGenreThreshold('Jazz')).toBe(0.8);
    expect(getGenreThreshold('Acoustic')).toBe(0.78);
    expect(getGenreThreshold('Electronic')).toBe(0.75);
    expect(getGenreThreshold('Pop')).toBe(0.7);
    expect(getGenreThreshold('Rock')).toBe(0.7);
    expect(getGenreThreshold('Hip Hop')).toBe(0.7);
    expect(getGenreThreshold('Ambient')).toBe(0.65);
    expect(getGenreThreshold('Lofi')).toBe(0.6);
  });

  it('handles case-insensitivity and whitespace when querying genre thresholds', () => {
    expect(getGenreThreshold('  classical  ')).toBe(0.85);
    expect(getGenreThreshold('ELECTRONIC')).toBe(0.75);
    expect(getGenreThreshold('hip hop')).toBe(0.7);
  });

  it('falls back to baseline score when genre is unknown or undefined', () => {
    expect(getGenreThreshold(undefined)).toBe(BASE_MIN_CONFIDENCE_SCORE);
    expect(getGenreThreshold('')).toBe(BASE_MIN_CONFIDENCE_SCORE);
    expect(getGenreThreshold('UnheardOfAvantGardeSubgenre')).toBe(BASE_MIN_CONFIDENCE_SCORE);
  });

  it('allows setting and overriding individual genre thresholds with clamping and rounding', () => {
    setGenreThreshold('Lofi', 0.63);
    // 0.63 rounds to 0.65 with THRESHOLD_STEP = 0.05
    expect(getGenreThreshold('Lofi')).toBe(0.65);

    setGenreThreshold('Synthwave', 0.8);
    expect(getGenreThreshold('Synthwave')).toBe(0.8);

    // Clamps values above 1 and below 0
    setGenreThreshold('Extreme', 1.5);
    expect(getGenreThreshold('Extreme')).toBe(1.0);

    setGenreThreshold('ExtremeNegative', -0.5);
    expect(getGenreThreshold('ExtremeNegative')).toBe(0.0);
  });

  it('supports batch threshold updates via setGenreThresholds', () => {
    setGenreThresholds({
      pop: 0.75,
      rock: 0.8,
      classical: 0.9,
    });

    expect(getGenreThreshold('pop')).toBe(0.75);
    expect(getGenreThreshold('rock')).toBe(0.8);
    expect(getGenreThreshold('classical')).toBe(0.9);
  });

  it('resets genre thresholds back to defaults with resetGenreThresholds', () => {
    setGenreThreshold('Classical', 0.5);
    expect(getGenreThreshold('Classical')).toBe(0.5);

    resetGenreThresholds();
    expect(getGenreThreshold('Classical')).toBe(DEFAULT_GENRE_THRESHOLDS.classical);
  });

  it('evaluates quality scores accurately against genre thresholds', () => {
    // 72% score passes Lofi (0.60 threshold) but fails Classical (0.85 threshold)
    const lofiEval = evaluateQualityScoreAgainstGenre(72, 'Lofi');
    expect(lofiEval.passed).toBe(true);
    expect(lofiEval.requiredThreshold).toBe(0.6);
    expect(lofiEval.scoreNormalized).toBeCloseTo(0.72);

    const classicalEval = evaluateQualityScoreAgainstGenre(72, 'Classical');
    expect(classicalEval.passed).toBe(false);
    expect(classicalEval.requiredThreshold).toBe(0.85);

    // Supports 0-1 scale scores as well
    const popEval = evaluateQualityScoreAgainstGenre(0.75, 'Pop');
    expect(popEval.passed).toBe(true);
    expect(popEval.requiredThreshold).toBe(0.7);
  });

  it('calculates feedback recommendations scoped to specific genres', () => {
    // 6 classical tracks rejected by filter but approved by admin
    for (let i = 0; i < 6; i++) {
      recordAdminOverride(override(`c${i}`, 'rejected', 'approved', 'Classical'));
    }
    // 4 lofi tracks approved by filter and approved by admin
    for (let i = 0; i < 4; i++) {
      recordAdminOverride(override(`l${i}`, 'approved', 'approved', 'Lofi'));
    }

    const classicalFeedback = getThresholdFeedback('Classical');
    expect(classicalFeedback.overridesRecorded).toBe(6);
    expect(classicalFeedback.approvalReversals).toBe(6);
    // Classical baseline is 0.85 -> recommended adjustment: 0.80
    expect(classicalFeedback.suggestedMinConfidenceScore).toBeCloseTo(0.85 - THRESHOLD_STEP, 10);
    expect(classicalFeedback.recommendation).toMatch(/lower minconfidencescore/i);

    const lofiFeedback = getThresholdFeedback('Lofi');
    expect(lofiFeedback.overridesRecorded).toBe(4);
    expect(lofiFeedback.approvalReversals).toBe(0);
    expect(lofiFeedback.suggestedMinConfidenceScore).toBe(0.6);
  });
});

describe('recordAdminOverride / getThresholdFeedback (Global)', () => {
  beforeEach(() => {
    resetThresholdFeedback();
  });

  it('starts with a clean slate and the baseline threshold', () => {
    const feedback = getThresholdFeedback();

    expect(feedback.overridesRecorded).toBe(0);
    expect(feedback.suggestedMinConfidenceScore).toBe(BASE_MIN_CONFIDENCE_SCORE);
    expect(feedback.recommendation).toMatch(/keep the current threshold/i);
  });

  it('categorizes approval reversals, rejection reversals, and timeout skips', () => {
    recordAdminOverride(override('t1', 'rejected', 'approved'));
    recordAdminOverride(override('t2', 'approved', 'rejected'));
    recordAdminOverride(override('t3', 'timeout', 'skipped'));
    // Aligned decisions are not reversals.
    recordAdminOverride(override('t4', 'rejected', 'rejected'));

    const feedback = getThresholdFeedback();

    expect(feedback.overridesRecorded).toBe(4);
    expect(feedback.approvalReversals).toBe(1);
    expect(feedback.rejectionReversals).toBe(1);
    expect(feedback.timeoutSkips).toBe(1);
    expect(feedback.suggestedMinConfidenceScore).toBe(BASE_MIN_CONFIDENCE_SCORE);
  });

  it('recommends a lower threshold when admins frequently approve rejections', () => {
    // 60% of overrides reverse a rejection into an approval.
    for (let i = 0; i < 6; i++) recordAdminOverride(override(`t${i}`, 'rejected', 'approved'));
    for (let i = 0; i < 4; i++) recordAdminOverride(override(`a${i}`, 'rejected', 'rejected'));

    const feedback = getThresholdFeedback();

    expect(feedback.approvalReversals).toBe(6);
    expect(feedback.suggestedMinConfidenceScore).toBeCloseTo(
      BASE_MIN_CONFIDENCE_SCORE - THRESHOLD_STEP,
      10
    );
    expect(feedback.recommendation).toMatch(/lower minconfidencescore/i);
  });

  it('recommends a higher threshold when admins frequently reject approvals', () => {
    for (let i = 0; i < 6; i++) recordAdminOverride(override(`t${i}`, 'approved', 'rejected'));
    for (let i = 0; i < 4; i++) recordAdminOverride(override(`a${i}`, 'rejected', 'approved'));

    const feedback = getThresholdFeedback();

    expect(feedback.rejectionReversals).toBe(6);
    expect(feedback.suggestedMinConfidenceScore).toBeCloseTo(
      BASE_MIN_CONFIDENCE_SCORE + THRESHOLD_STEP,
      10
    );
    expect(feedback.recommendation).toMatch(/raise minconfidencescore/i);
  });

  it('keeps the threshold when disagreements stay below the reversal share', () => {
    for (let i = 0; i < 2; i++) recordAdminOverride(override(`t${i}`, 'rejected', 'approved'));
    for (let i = 0; i < 8; i++) recordAdminOverride(override(`a${i}`, 'rejected', 'rejected'));

    expect(getThresholdFeedback().suggestedMinConfidenceScore).toBe(BASE_MIN_CONFIDENCE_SCORE);
  });

  it('stays bounded at 1000 recorded overrides', () => {
    for (let i = 0; i < 1050; i++) {
      recordAdminOverride(override(`t${i}`, 'rejected', 'approved'));
    }

    expect(getThresholdFeedback().overridesRecorded).toBe(1000);
  });
});
