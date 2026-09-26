/**
 * Duplicate and Plagiarism Detection Check (#433).
 *
 * Part of the AI Song Quality Filter (Mastra AI + NVIDIA) initiative for AudioBlock.
 * Screens uploaded audio tracks for exact duplicates, acoustic fingerprint matches,
 * and high-similarity plagiarism/infringement against registered platform tracks before
 * publication.
 */

export type PlagiarismVerdict = 'clean' | 'suspicious' | 'duplicate';

export type PlagiarismMatchType =
  | 'none'
  | 'exact_audio'
  | 'acoustic_fingerprint'
  | 'high_similarity'
  | 'metadata_match';

export interface AudioFingerprint {
  trackId: string;
  title: string;
  artist?: string;
  genre?: string;
  durationSeconds?: number;
  /** Exact audio content hash / checksum (SHA-256 or MD5 hex). */
  audioHash?: string;
  /** Perceptual / acoustic fingerprint hash string. */
  fingerprintHash: string;
  /** Normalized spectral / acoustic feature vector (e.g. MFCC or energy bins). */
  spectralFeatures?: number[];
  registeredAt?: number;
}

export interface PlagiarismCheckResult {
  /** True when the track is considered an unauthorized duplicate or rip. */
  isDuplicate: boolean;
  /** Similarity score on a [0.0, 1.0] scale. */
  similarityScore: number;
  verdict: PlagiarismVerdict;
  matchType: PlagiarismMatchType;
  matchedTrackId?: string;
  matchedTrackTitle?: string;
  matchedArtist?: string;
  confidence: number;
  reasons: string[];
}

export interface PlagiarismCheckOptions {
  /** Custom similarity threshold for duplicate verdict (default: 0.85). */
  duplicateThreshold?: number;
  /** Custom similarity threshold for suspicious review verdict (default: 0.65). */
  suspiciousThreshold?: number;
  /** Optional specific reference library to search against instead of global registry. */
  referenceLibrary?: AudioFingerprint[];
}

/** Threshold above which a track is flagged as an exact or near-exact duplicate. */
export const DEFAULT_DUPLICATE_THRESHOLD = 0.85;

/** Threshold above which a track is flagged for manual copyright/sample review. */
export const DEFAULT_SUSPICIOUS_THRESHOLD = 0.65;

/** Exact content hash match similarity. */
export const EXACT_MATCH_SIMILARITY = 1.0;

const MAX_REGISTRY_ENTRIES = 5000;
const registry: AudioFingerprint[] = [];

/**
 * Computes a simple deterministic hash code from a string.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generates an audio fingerprint from track metadata and optional audio content.
 */
export function generateAudioFingerprint(input: {
  trackId?: string;
  id?: string;
  title: string;
  artist?: string;
  artistAddress?: string;
  genre?: string;
  durationSeconds?: number;
  audioHash?: string;
  audioChecksum?: string;
  audioBuffer?: ArrayBuffer | Uint8Array | string;
  waveformSamples?: number[];
  spectralCentroids?: number[];
  spectralFeatures?: number[];
}): AudioFingerprint {
  const resolvedTrackId = input.trackId || input.id || `track_${Date.now()}`;
  const resolvedArtist = input.artist || input.artistAddress;
  let computedAudioHash = input.audioHash || input.audioChecksum;
  if (!computedAudioHash && input.audioBuffer) {
    if (typeof input.audioBuffer === 'string') {
      computedAudioHash = simpleHash(input.audioBuffer);
    } else {
      const bytes = new Uint8Array(input.audioBuffer);
      let sum = 0;
      for (let i = 0; i < Math.min(bytes.length, 1024); i++) {
        sum = (sum * 31 + bytes[i]) | 0;
      }
      computedAudioHash = Math.abs(sum).toString(16).padStart(8, '0');
    }
  }

  // Combine spectral features or waveform samples if provided
  let features = input.spectralFeatures;
  if (!features && input.spectralCentroids) {
    features = input.spectralCentroids.map((c) => c / 10000);
  } else if (!features && input.waveformSamples) {
    features = input.waveformSamples;
  }

  // Derive acoustic fingerprint hash from spectral features or metadata
  let fingerprintHash = '';
  if (features && features.length > 0) {
    fingerprintHash = features
      .map((v) => Math.round(v * 100).toString(16))
      .join('-');
  } else {
    const seed = `${input.title.toLowerCase().trim()}:${resolvedArtist?.toLowerCase().trim() || ''}:${input.durationSeconds || 0}`;
    fingerprintHash = `fp_${simpleHash(seed)}`;
  }

  return {
    trackId: resolvedTrackId,
    title: input.title,
    artist: resolvedArtist,
    genre: input.genre,
    durationSeconds: input.durationSeconds,
    audioHash: computedAudioHash,
    fingerprintHash,
    spectralFeatures: features,
    registeredAt: Date.now(),
  };
}

/**
 * Calculates cosine similarity between two numeric feature vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculates acoustic similarity score in [0.0, 1.0] between two fingerprints.
 */
export function calculateFingerprintSimilarity(
  fp1: AudioFingerprint,
  fp2: AudioFingerprint
): { score: number; matchType: PlagiarismMatchType } {
  // 1. Exact audio content hash match
  if (fp1.audioHash && fp2.audioHash && fp1.audioHash.toLowerCase() === fp2.audioHash.toLowerCase()) {
    return { score: EXACT_MATCH_SIMILARITY, matchType: 'exact_audio' };
  }

  // 2. Exact acoustic fingerprint hash match
  if (
    fp1.fingerprintHash &&
    fp2.fingerprintHash &&
    fp1.fingerprintHash.toLowerCase() === fp2.fingerprintHash.toLowerCase()
  ) {
    return { score: 0.99, matchType: 'acoustic_fingerprint' };
  }

  // 3. Spectral feature vector similarity
  if (
    fp1.spectralFeatures &&
    fp2.spectralFeatures &&
    fp1.spectralFeatures.length === fp2.spectralFeatures.length &&
    fp1.spectralFeatures.length > 0
  ) {
    const similarity = cosineSimilarity(fp1.spectralFeatures, fp2.spectralFeatures);
    const clamped = Math.max(0, Math.min(1, Math.round(similarity * 100) / 100));
    return {
      score: clamped,
      matchType: clamped >= DEFAULT_DUPLICATE_THRESHOLD ? 'acoustic_fingerprint' : 'high_similarity',
    };
  }

  // 4. Metadata similarity fallback (same artist + exact same title + matching duration)
  const normTitle1 = fp1.title.toLowerCase().trim();
  const normTitle2 = fp2.title.toLowerCase().trim();
  const normArtist1 = fp1.artist?.toLowerCase().trim();
  const normArtist2 = fp2.artist?.toLowerCase().trim();

  if (normTitle1 === normTitle2 && normArtist1 && normArtist2 && normArtist1 === normArtist2) {
    const durDelta = Math.abs((fp1.durationSeconds || 0) - (fp2.durationSeconds || 0));
    if (durDelta <= 2) {
      return { score: 0.95, matchType: 'metadata_match' };
    }
    return { score: 0.8, matchType: 'metadata_match' };
  }

  if (normTitle1 === normTitle2) {
    return { score: 0.5, matchType: 'none' };
  }

  return { score: 0.0, matchType: 'none' };
}

/**
 * Registers an existing track's fingerprint into the plagiarism registry.
 */
export function registerTrackFingerprint(fingerprint: AudioFingerprint): void {
  if (registry.length >= MAX_REGISTRY_ENTRIES) {
    registry.shift();
  }
  // Replace if trackId already exists
  const existingIdx = registry.findIndex((f) => f.trackId === fingerprint.trackId);
  if (existingIdx !== -1) {
    registry[existingIdx] = fingerprint;
  } else {
    registry.push(fingerprint);
  }
}

/**
 * Registers multiple track fingerprints into the registry.
 */
export function registerTrackFingerprints(fingerprints: AudioFingerprint[]): void {
  for (const fp of fingerprints) {
    registerTrackFingerprint(fp);
  }
}

/**
 * Returns all currently registered fingerprints.
 */
export function getRegisteredFingerprints(): AudioFingerprint[] {
  return [...registry];
}

/**
 * Resets the plagiarism registry (for test use).
 */
export function resetPlagiarismRegistry(): void {
  registry.length = 0;
}

/**
 * Checks a candidate track against registered audio fingerprints for duplicates and plagiarism.
 */
export function checkPlagiarism(
  candidate: AudioFingerprint | {
    trackId?: string;
    id?: string;
    title: string;
    artist?: string;
    artistAddress?: string;
    genre?: string;
    durationSeconds?: number;
    audioHash?: string;
    audioChecksum?: string;
    fingerprintHash?: string;
    waveformSamples?: number[];
    spectralCentroids?: number[];
    spectralFeatures?: number[];
  },
  options?: PlagiarismCheckOptions
): PlagiarismCheckResult {
  const duplicateThreshold = options?.duplicateThreshold ?? DEFAULT_DUPLICATE_THRESHOLD;
  const suspiciousThreshold = options?.suspiciousThreshold ?? DEFAULT_SUSPICIOUS_THRESHOLD;
  const library = options?.referenceLibrary ?? registry;

  const candidateFp: AudioFingerprint =
    'fingerprintHash' in candidate && candidate.fingerprintHash
      ? (candidate as AudioFingerprint)
      : generateAudioFingerprint(candidate);

  let highestScore = 0;
  let bestMatch: AudioFingerprint | undefined;
  let bestMatchType: PlagiarismMatchType = 'none';

  for (const ref of library) {
    // Skip self-comparison if the same trackId is in registry
    if (candidateFp.trackId && ref.trackId === candidateFp.trackId) {
      continue;
    }

    const { score, matchType } = calculateFingerprintSimilarity(candidateFp, ref);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = ref;
      bestMatchType = matchType;
    }
  }

  if (highestScore >= duplicateThreshold && bestMatch) {
    const matchLabel =
      bestMatchType === 'exact_audio'
        ? 'Identical audio file checksum matched'
        : bestMatchType === 'acoustic_fingerprint'
          ? 'Near-identical acoustic waveform signature matched'
          : 'High acoustic similarity matched';

    return {
      isDuplicate: true,
      similarityScore: highestScore,
      verdict: 'duplicate',
      matchType: bestMatchType,
      matchedTrackId: bestMatch.trackId,
      matchedTrackTitle: bestMatch.title,
      matchedArtist: bestMatch.artist,
      confidence: Math.round(highestScore * 100) / 100,
      reasons: [
        `${matchLabel} existing track "${bestMatch.title}"${bestMatch.artist ? ` by ${bestMatch.artist}` : ''} (ID: ${bestMatch.trackId}) with ${(highestScore * 100).toFixed(1)}% match.`,
      ],
    };
  }

  if (highestScore >= suspiciousThreshold && bestMatch) {
    return {
      isDuplicate: false,
      similarityScore: highestScore,
      verdict: 'suspicious',
      matchType: bestMatchType,
      matchedTrackId: bestMatch.trackId,
      matchedTrackTitle: bestMatch.title,
      matchedArtist: bestMatch.artist,
      confidence: Math.round(highestScore * 100) / 100,
      reasons: [
        `Moderate similarity (${(highestScore * 100).toFixed(1)}%) detected with "${bestMatch.title}"${bestMatch.artist ? ` by ${bestMatch.artist}` : ''}. Flagged for sample/derivative review.`,
      ],
    };
  }

  return {
    isDuplicate: false,
    similarityScore: highestScore,
    verdict: 'clean',
    matchType: 'none',
    confidence: 1.0 - highestScore,
    reasons: ['No duplicate or plagiarized acoustic matches found in platform registry.'],
  };
}
