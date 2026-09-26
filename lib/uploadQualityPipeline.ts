/**
 * Upload-to-Quality-Check Pipeline (#429).
 *
 * Part of the AI Song Quality Filter (Mastra AI + NVIDIA) initiative for AudioBlock.
 * Orchestrates the end-to-end verification of uploaded tracks:
 * 1. Admin/Trusted Artist exemption pre-checks (`lib/qualityChecks.ts`).
 * 2. Plagiarism & duplicate detection (`lib/plagiarismDetection.ts`).
 * 3. Queue monitoring & heartbeat registration (`lib/analysisQueueMonitor.ts`).
 * 4. NVIDIA AI quality assessment for single track or stems (`lib/songQualityFilter.ts`, `lib/stemAnalysis.ts`).
 * 5. Configurable genre quality threshold evaluation (`lib/qualityThresholds.ts`).
 * 6. Platform analytics logging (`lib/qualityAnalytics.ts`).
 */

import { canSkipQualityCheck, type QualityCheckSubject } from './qualityChecks';
import {
  checkPlagiarism,
  registerTrackFingerprint,
  generateAudioFingerprint,
  type PlagiarismCheckResult,
} from './plagiarismDetection';
import {
  analyzeSongQuality,
  type SongQualityAssessment,
  type SongQualityOptions,
} from './songQualityFilter';
import { analyzeStemUpload, type StemUploadAnalysis, type AudioStem } from './stemAnalysis';
import { getGenreThreshold, evaluateQualityScoreAgainstGenre } from './qualityThresholds';
import { recordQualityCheckResult } from './qualityAnalytics';
import { AnalysisQueueMonitor } from './analysisQueueMonitor';
import { detectExplicitContent, type ExplicitDetectionResult } from './explicitContentDetection';
import {
  analyzeLoudnessAndSuggest,
  type LoudnessNormalizationSuggestion,
} from './loudnessNormalization';

export type PipelineVerdict = 'approved' | 'review' | 'rejected' | 'skipped';

export interface UploadQualityPipelineInput {
  trackId: string;
  title: string;
  artist?: string;
  genre?: string;
  durationSeconds?: number;
  lyrics?: string;
  audioBuffer?: ArrayBuffer | Uint8Array | string;
  audioHash?: string;
  spectralFeatures?: number[];
  stems?: AudioStem[];
  subject?: QualityCheckSubject | null;
  integratedLufs?: number;
  truePeakDbtp?: number;
}

export interface UploadQualityPipelineOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  queueMonitor?: AnalysisQueueMonitor;
  skipPlagiarismCheck?: boolean;
}

export interface UploadQualityPipelineResult {
  trackId: string;
  status: PipelineVerdict;
  score: number;
  genre: string;
  genreThreshold: number;
  passedGenreThreshold: boolean;
  exempt: boolean;
  plagiarismCheck?: PlagiarismCheckResult;
  assessment?: SongQualityAssessment;
  stemAnalysis?: StemUploadAnalysis;
  explicitCheck?: ExplicitDetectionResult;
  loudnessSuggestion?: LoudnessNormalizationSuggestion;
  reasons: string[];
  processedAt: number;
}

/**
 * Runs an uploaded song through the complete quality check and verification pipeline.
 */
export async function processUploadQualityCheck(
  input: UploadQualityPipelineInput,
  options: UploadQualityPipelineOptions = {}
): Promise<UploadQualityPipelineResult> {
  const processedAt = Date.now();
  const genre = input.genre ? input.genre.trim() : 'Default';
  const genreThreshold = getGenreThreshold(genre);
  const queueMonitor = options.queueMonitor;

  // Compute explicit content detection and loudness normalization suggestions
  const explicitCheck = detectExplicitContent({
    trackId: input.trackId,
    title: input.title,
    lyrics: input.lyrics,
    artist: input.artist,
    genre: input.genre,
  });

  const loudnessSuggestion = analyzeLoudnessAndSuggest({
    trackId: input.trackId,
    integratedLufs: input.integratedLufs,
    truePeakDbtp: input.truePeakDbtp,
    spectralFeatures: input.spectralFeatures,
    audioBuffer: input.audioBuffer,
    durationSeconds: input.durationSeconds,
  });

  // 1. Check for role-based / admin-approved exemption
  if (canSkipQualityCheck(input.subject)) {
    recordQualityCheckResult({
      trackId: input.trackId,
      outcome: 'passed',
      score: 1.0,
      recordedAt: processedAt,
    });

    return {
      trackId: input.trackId,
      status: 'skipped',
      score: 100,
      genre,
      genreThreshold,
      passedGenreThreshold: true,
      exempt: true,
      explicitCheck,
      loudnessSuggestion,
      reasons: ['Quality check bypassed for exempt/admin-approved artist.'],
      processedAt,
    };
  }

  // 2. Plagiarism & duplicate pre-screening
  let plagiarismResult: PlagiarismCheckResult | undefined;
  if (!options.skipPlagiarismCheck) {
    plagiarismResult = checkPlagiarism({
      trackId: input.trackId,
      title: input.title,
      artist: input.artist,
      genre: input.genre,
      durationSeconds: input.durationSeconds,
      audioHash: input.audioHash,
      spectralFeatures: input.spectralFeatures,
    });

    // If confirmed duplicate, reject immediately without calling AI API
    if (plagiarismResult.isDuplicate) {
      recordQualityCheckResult({
        trackId: input.trackId,
        outcome: 'failed',
        score: 0.0,
        recordedAt: processedAt,
      });

      return {
        trackId: input.trackId,
        status: 'rejected',
        score: 0,
        genre,
        genreThreshold,
        passedGenreThreshold: false,
        exempt: false,
        plagiarismCheck: plagiarismResult,
        explicitCheck,
        loudnessSuggestion,
        reasons: [`Rejected by plagiarism detector: ${plagiarismResult.reasons.join(' ')}`],
        processedAt,
      };
    }
  }

  // 3. Register with queue monitor
  if (queueMonitor) {
    queueMonitor.register(input.trackId);
    queueMonitor.heartbeat(input.trackId);
  }

  // 4. AI Quality Analysis (Stem-based or Single Track)
  const apiKey = options.apiKey || process.env.NVIDIA_API_KEY || 'test-key';
  const songQualityOptions: SongQualityOptions = {
    apiKey,
    baseUrl: options.baseUrl,
    model: options.model,
    fetchImpl: options.fetchImpl,
  };

  let assessment: SongQualityAssessment | undefined;
  let stemAnalysis: StemUploadAnalysis | undefined;
  let rawScore = 0;
  let reasons: string[] = [];

  try {
    if (input.stems && input.stems.length > 0) {
      stemAnalysis = await analyzeStemUpload(input.stems, (stem) =>
        analyzeSongQuality(
          {
            title: `${input.title} — ${stem.role}`,
            artist: input.artist,
            genre: input.genre,
          },
          songQualityOptions
        )
      );

      rawScore = stemAnalysis.score;
      if (stemAnalysis.verdict === 'rejected') {
        reasons.push('One or more stems failed acoustic quality inspection.');
      } else if (stemAnalysis.verdict === 'review') {
        reasons.push('Multi-track stem assessment flagged for manual review.');
      }
    } else {
      assessment = await analyzeSongQuality(
        {
          title: input.title,
          artist: input.artist,
          genre: input.genre,
          durationSeconds: input.durationSeconds,
          lyrics: input.lyrics,
        },
        songQualityOptions
      );

      rawScore = assessment.score;
      reasons.push(...assessment.reasons);
    }

    if (queueMonitor) {
      queueMonitor.heartbeat(input.trackId);
    }
  } catch (err) {
    if (queueMonitor) {
      queueMonitor.complete(input.trackId);
    }

    recordQualityCheckResult({
      trackId: input.trackId,
      outcome: 'timeout',
      recordedAt: processedAt,
    });

    const errorMsg = err instanceof Error ? err.message : 'Quality check service unavailable';
    return {
      trackId: input.trackId,
      status: 'review',
      score: 0,
      genre,
      genreThreshold,
      passedGenreThreshold: false,
      exempt: false,
      plagiarismCheck: plagiarismResult,
      explicitCheck,
      loudnessSuggestion,
      reasons: [`Analysis error (${errorMsg}); sent to manual review queue.`],
      processedAt,
    };
  }

  // 5. Evaluate against configurable genre thresholds
  const genreEvaluation = evaluateQualityScoreAgainstGenre(rawScore, genre);
  const passedGenreThreshold = genreEvaluation.passed;

  let finalStatus: PipelineVerdict = 'approved';

  if (!passedGenreThreshold) {
    // If score is significantly below genre threshold, reject; otherwise send to review
    if (genreEvaluation.scoreNormalized < genreThreshold - 0.15) {
      finalStatus = 'rejected';
      reasons.push(
        `Quality score (${rawScore}/100) failed ${genre} minimum threshold (${Math.round(genreThreshold * 100)}/100).`
      );
    } else {
      finalStatus = 'review';
      reasons.push(
        `Quality score (${rawScore}/100) is borderline for ${genre} threshold (${Math.round(genreThreshold * 100)}/100).`
      );
    }
  } else if (assessment?.verdict === 'rejected' || stemAnalysis?.verdict === 'rejected') {
    finalStatus = 'rejected';
  } else if (
    assessment?.verdict === 'review' ||
    stemAnalysis?.verdict === 'review' ||
    plagiarismResult?.verdict === 'suspicious'
  ) {
    finalStatus = 'review';
    if (plagiarismResult?.verdict === 'suspicious') {
      reasons.push(plagiarismResult.reasons[0]);
    }
  }

  // 6. Record analytics & complete queue job
  recordQualityCheckResult({
    trackId: input.trackId,
    outcome:
      finalStatus === 'approved' ? 'passed' : finalStatus === 'rejected' ? 'failed' : 'failed',
    score: rawScore / 100,
    recordedAt: processedAt,
  });

  if (queueMonitor) {
    queueMonitor.complete(input.trackId);
  }

  // 7. If approved, register fingerprint for future duplicate screening
  if (finalStatus === 'approved') {
    const fp = generateAudioFingerprint({
      trackId: input.trackId,
      title: input.title,
      artist: input.artist,
      genre: input.genre,
      durationSeconds: input.durationSeconds,
      audioHash: input.audioHash,
      spectralFeatures: input.spectralFeatures,
    });
    registerTrackFingerprint(fp);
  }

  return {
    trackId: input.trackId,
    status: finalStatus,
    score: rawScore,
    genre,
    genreThreshold,
    passedGenreThreshold,
    exempt: false,
    plagiarismCheck: plagiarismResult,
    assessment,
    stemAnalysis,
    explicitCheck,
    loudnessSuggestion,
    reasons,
    processedAt,
  };
}
