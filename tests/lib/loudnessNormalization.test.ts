import { describe, it, expect } from 'vitest';
import {
  analyzeLoudnessAndSuggest,
  TARGET_STREAMING_LUFS,
  MAX_TRUE_PEAK_DBTP,
} from '@/lib/loudnessNormalization';

describe('Loudness Normalization Suggestion Service (#432)', () => {
  it('correctly identifies optimal loudness at streaming standard target (-14 LUFS)', () => {
    const result = analyzeLoudnessAndSuggest({
      integratedLufs: -14.0,
      truePeakDbtp: -1.2,
    });

    expect(result.status).toBe('optimal');
    expect(result.isCompliant).toBe(true);
    expect(result.suggestedGainDb).toBe(0);
    expect(result.clippingRisk).toBe(false);
    expect(result.targetLufs).toBe(TARGET_STREAMING_LUFS);
    expect(result.recommendations[0]).toMatch(/optimal/i);
  });

  it('suggests attenuation and dynamic range preservation for overly loud tracks', () => {
    // A master pushed to -8.0 LUFS
    const result = analyzeLoudnessAndSuggest({
      integratedLufs: -8.0,
      truePeakDbtp: -0.2,
    });

    expect(result.status).toBe('too_loud');
    expect(result.isCompliant).toBe(false);
    expect(result.suggestedGainDb).toBe(-6.0); // -14 - (-8) = -6
    expect(result.clippingRisk).toBe(false);
    expect(result.recommendations[0]).toMatch(/lowering limiter gain by 6 dB/i);
  });

  it('detects clipping risk when boosting quiet audio would exceed peak ceiling', () => {
    // Quiet audio at -22.0 LUFS but peak is already -2.0 dBTP
    // Boosting +8.0 dB would produce +6.0 dBTP peak (clipping)
    const result = analyzeLoudnessAndSuggest({
      integratedLufs: -22.0,
      truePeakDbtp: -2.0,
    });

    expect(result.status).toBe('clipping_risk');
    expect(result.clippingRisk).toBe(true);
    expect(result.suggestedGainDb).toBe(8.0);
    expect(result.estimatedPostGainPeakDbtp).toBe(6.0);
    expect(result.recommendations[0]).toMatch(/exceeding the -1 dBTP ceiling/i);
  });

  it('suggests clean gain boost for quiet tracks with ample headroom', () => {
    const result = analyzeLoudnessAndSuggest({
      integratedLufs: -18.0,
      truePeakDbtp: -10.0,
    });

    expect(result.status).toBe('too_quiet');
    expect(result.suggestedGainDb).toBe(4.0); // -14 - (-18) = +4
    expect(result.clippingRisk).toBe(false);
    expect(result.estimatedPostGainPeakDbtp).toBe(-6.0);
    expect(result.recommendations[0]).toMatch(/suggest applying \+4 dB gain/i);
  });

  it('derives estimates from spectral features when raw LUFS is absent', () => {
    const result = analyzeLoudnessAndSuggest({
      spectralFeatures: [0.5, 0.6, 0.55, 0.45],
    });

    expect(result.measuredLufs).toBeDefined();
    expect(Number.isFinite(result.suggestedGainDb)).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
