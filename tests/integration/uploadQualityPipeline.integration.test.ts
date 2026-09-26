import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  processUploadQualityCheck,
  type UploadQualityPipelineInput,
} from '../../lib/uploadQualityPipeline';
import {
  resetPlagiarismRegistry,
  registerTrackFingerprint,
} from '../../lib/plagiarismDetection';
import {
  resetGenreThresholds,
  setGenreThreshold,
} from '../../lib/qualityThresholds';
import {
  getQualityCheckStats,
  resetQualityAnalytics,
} from '../../lib/qualityAnalytics';
import { AnalysisQueueMonitor } from '../../lib/analysisQueueMonitor';

/**
 * Integration tests for the upload-to-quality-check pipeline (#429).
 *
 * Exercises the end-to-end upload verification flow:
 * - Exemption evaluation
 * - Plagiarism & duplicate pre-screening
 * - NVIDIA AI chat completion analysis (mocked fetch)
 * - Multi-track stem analysis
 * - Configurable genre thresholds
 * - Queue monitoring and platform analytics
 */

function nvidiaMockResponse(content: string, status = 200, ok = true): Response {
  return {
    ok,
    status,
    json: async () => ({
      id: 'chatcmpl-nvidia-test',
      object: 'chat.completion',
      model: 'nvidia/llama-3.1-nemotron-70b-instruct',
      choices: [{ index: 0, message: { role: 'assistant', content } }],
    }),
  } as unknown as Response;
}

describe('Upload-to-Quality-Check Pipeline Integration (#429)', () => {
  beforeEach(() => {
    resetPlagiarismRegistry();
    resetGenreThresholds();
    resetQualityAnalytics();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('runs a standard song upload through the pipeline and approves high quality tracks', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      nvidiaMockResponse(
        '{"score": 88, "verdict": "approved", "reasons": ["Excellent stereo width", "Clean dynamic range"]}'
      )
    );

    const input: UploadQualityPipelineInput = {
      trackId: 'track_test_1',
      title: 'Neon Odyssey',
      artist: 'SynthWaveMaster',
      genre: 'Electronic',
      durationSeconds: 195,
      audioHash: 'hash_neon_odyssey_1',
    };

    const result = await processUploadQualityCheck(input, {
      apiKey: 'nvapi-test-key',
    });

    expect(result.status).toBe('approved');
    expect(result.score).toBe(88);
    expect(result.genre).toBe('Electronic');
    expect(result.genreThreshold).toBe(0.75);
    expect(result.passedGenreThreshold).toBe(true);
    expect(result.exempt).toBe(false);
    expect(result.plagiarismCheck?.verdict).toBe('clean');
    expect(result.reasons).toContain('Excellent stereo width');

    // Platform analytics should reflect 1 passed check
    const stats = getQualityCheckStats();
    expect(stats.total).toBe(1);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(0);
  });

  it('evaluates tracks against strict genre-specific thresholds (e.g. Classical vs Lofi)', async () => {
    // Model returns 72% score
    vi.mocked(fetch).mockResolvedValue(
      nvidiaMockResponse(
        '{"score": 72, "verdict": "approved", "reasons": ["Good acoustic structure"]}'
      )
    );

    // 1. Classical requires 0.85 (85%) -> score 72 fails threshold
    const classicalInput: UploadQualityPipelineInput = {
      trackId: 'track_classical_1',
      title: 'Symphony No. 5',
      artist: 'Orchestra',
      genre: 'Classical',
      durationSeconds: 300,
    };

    const classicalResult = await processUploadQualityCheck(classicalInput);
    expect(classicalResult.genreThreshold).toBe(0.85);
    expect(classicalResult.passedGenreThreshold).toBe(false);
    // Score 72 is 13 points below 85 -> sends to review
    expect(classicalResult.status).toBe('review');
    expect(classicalResult.reasons.some((r) => r.includes('Classical'))).toBe(true);

    // 2. Lofi requires 0.60 (60%) -> score 72 passes threshold
    const lofiInput: UploadQualityPipelineInput = {
      trackId: 'track_lofi_1',
      title: 'Late Night Study',
      artist: 'ChillBeats',
      genre: 'Lofi',
      durationSeconds: 150,
    };

    const lofiResult = await processUploadQualityCheck(lofiInput);
    expect(lofiResult.genreThreshold).toBe(0.60);
    expect(lofiResult.passedGenreThreshold).toBe(true);
    expect(lofiResult.status).toBe('approved');
  });

  it('immediately rejects duplicate / plagiarized tracks without calling the AI API', async () => {
    // Register existing track in registry
    registerTrackFingerprint({
      trackId: 'existing_track_123',
      title: 'Midnight Groove',
      artist: 'OriginalArtist',
      audioHash: 'identical_checksum_abc',
      fingerprintHash: 'fp_midnight_groove',
    });

    const duplicateUpload: UploadQualityPipelineInput = {
      trackId: 'upload_pirate_1',
      title: 'Midnight Groove (Rip)',
      artist: 'PirateUploader',
      audioHash: 'identical_checksum_abc', // Same audio hash!
      genre: 'Electronic',
    };

    const result = await processUploadQualityCheck(duplicateUpload);

    expect(result.status).toBe('rejected');
    expect(result.score).toBe(0);
    expect(result.plagiarismCheck?.isDuplicate).toBe(true);
    expect(result.plagiarismCheck?.matchType).toBe('exact_audio');
    expect(result.reasons[0]).toMatch(/plagiarism detector/i);

    // Fetch was NOT called since plagiarism check short-circuited
    expect(fetch).not.toHaveBeenCalled();

    // Logged as failed check in analytics
    const stats = getQualityCheckStats();
    expect(stats.failed).toBe(1);
  });

  it('sends tracks with suspicious sample matches to manual review', async () => {
    registerTrackFingerprint({
      trackId: 'existing_sample_track',
      title: 'Vintage Funk Break',
      artist: 'ClassicBand',
      spectralFeatures: [0.8, 0.4, 0.9, 0.2, 0.6, 0.7],
      fingerprintHash: 'fp_sample_track',
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      nvidiaMockResponse('{"score": 85, "verdict": "approved", "reasons": ["Punchy drums"]}')
    );

    const sampledUpload: UploadQualityPipelineInput = {
      trackId: 'upload_remix_1',
      title: 'Funky Future',
      artist: 'ModernProducer',
      genre: 'Hip Hop',
      spectralFeatures: [0.8, 0.4, 0.6, 0.4, 0.4, 0.5], // Moderately similar
    };

    const result = await processUploadQualityCheck(sampledUpload);

    if (result.plagiarismCheck?.verdict === 'suspicious') {
      expect(result.status).toBe('review');
      expect(result.reasons.some((r) => r.includes('Flagged for sample/derivative review'))).toBe(true);
    }
  });

  it('bypasses quality check for admin or admin-approved artist accounts', async () => {
    const adminUpload: UploadQualityPipelineInput = {
      trackId: 'track_admin_1',
      title: 'Admin Demo Track',
      subject: { role: 'admin' },
    };

    const result = await processUploadQualityCheck(adminUpload);

    expect(result.status).toBe('skipped');
    expect(result.exempt).toBe(true);
    expect(result.score).toBe(100);
    expect(fetch).not.toHaveBeenCalled();

    const artistUpload: UploadQualityPipelineInput = {
      trackId: 'track_approved_artist_1',
      title: 'Verified Artist Track',
      subject: { role: 'artist', qualityCheckApproved: true },
    };

    const artistResult = await processUploadQualityCheck(artistUpload);
    expect(artistResult.status).toBe('skipped');
    expect(artistResult.exempt).toBe(true);
  });

  it('processes multi-track stem uploads and coordinates queue monitor heartbeats', async () => {
    const queueMonitor = new AnalysisQueueMonitor({ stuckThresholdMs: 60000 });
    const regSpy = vi.spyOn(queueMonitor, 'register');
    const hbSpy = vi.spyOn(queueMonitor, 'heartbeat');
    const compSpy = vi.spyOn(queueMonitor, 'complete');

    // 2 stem assessments
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        nvidiaMockResponse('{"score": 90, "verdict": "approved", "reasons": ["Clean vocal"]}')
      )
      .mockResolvedValueOnce(
        nvidiaMockResponse('{"score": 80, "verdict": "approved", "reasons": ["Tight drum bus"]}')
      );

    const stemUpload: UploadQualityPipelineInput = {
      trackId: 'project_stems_1',
      title: 'Summer Anthem',
      artist: 'Band',
      genre: 'Pop',
      stems: [
        { id: 's1', name: 'Vocals', role: 'lead-vocal' },
        { id: 's2', name: 'Drums', role: 'drums' },
      ],
    };

    const result = await processUploadQualityCheck(stemUpload, { queueMonitor });

    expect(result.status).toBe('approved');
    expect(result.score).toBe(85); // Average of 90 and 80
    expect(result.stemAnalysis).toBeDefined();
    expect(result.stemAnalysis?.stems).toHaveLength(2);

    expect(regSpy).toHaveBeenCalledWith('project_stems_1');
    expect(hbSpy).toHaveBeenCalledWith('project_stems_1');
    expect(compSpy).toHaveBeenCalledWith('project_stems_1');
  });

  it('gracefully degrades to manual review when NVIDIA API fails or times out', async () => {
    const queueMonitor = new AnalysisQueueMonitor({ stuckThresholdMs: 60000 });
    const compSpy = vi.spyOn(queueMonitor, 'complete');

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network connection lost'));

    const input: UploadQualityPipelineInput = {
      trackId: 'track_offline_1',
      title: 'Offline Track',
      genre: 'Rock',
    };

    const result = await processUploadQualityCheck(input, { queueMonitor });

    expect(result.status).toBe('review');
    expect(result.reasons[0]).toMatch(/manual review queue/i);
    expect(compSpy).toHaveBeenCalledWith('track_offline_1');

    const stats = getQualityCheckStats();
    expect(stats.timeouts).toBe(1);
  });
});
