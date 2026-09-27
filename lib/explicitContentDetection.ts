/**
 * Explicit Content Detection Integration (#434).
 *
 * Part of the AI Song Quality Filter (Mastra AI + NVIDIA) initiative for AudioBlock.
 * Screens song titles, lyrics, and metadata for explicit content including profanity,
 * sexual content, graphic violence, and hate speech. Provides normalized advisories
 * for catalog labeling ([E] badge) and user preference filtering.
 */

export type ExplicitAdvisory = 'clean' | 'explicit' | 'unrated';

export interface ExplicitContentCategories {
  profanity: boolean;
  sexualContent: boolean;
  violence: boolean;
  hateSpeech: boolean;
}

export interface ExplicitDetectionInput {
  trackId?: string;
  title?: string;
  lyrics?: string;
  artist?: string;
  genre?: string;
}

export interface ExplicitDetectionResult {
  isExplicit: boolean;
  confidence: number;
  advisory: ExplicitAdvisory;
  categories: ExplicitContentCategories;
  flaggedTerms: string[];
  reasons: string[];
  analyzedFieldCount: number;
}

// ── Word Boundary Patterns for Detection ────────────────────────────────────

const PROFANITY_PATTERNS: RegExp[] = [
  /\b(fuck|fucking|fucker|motherfucker|fucked)\b/i,
  /\b(shit|bullshit|shitty|shitting)\b/i,
  /\b(bitch|bitches|bitching)\b/i,
  /\b(cunt|cunts)\b/i,
  /\b(asshole|dickhead|bastard)\b/i,
  /\b(cock|cocksucker)\b/i,
];

const SEXUAL_CONTENT_PATTERNS: RegExp[] = [
  /\b(pussy|blowjob|handjob|cumshot|dildo)\b/i,
  /\b(gangbang|threesome|masturbat\w+)\b/i,
  /\b(strip club|porn|hardcore sex)\b/i,
];

const VIOLENCE_PATTERNS: RegExp[] = [
  /\b(massacre|murderer|slaughtering|blood bath)\b/i,
  /\b(shoot to kill|execution style|decapitat\w+)\b/i,
  /\b(snuff|mutilat\w+)\b/i,
];

const HATE_SPEECH_PATTERNS: RegExp[] = [
  /\b(nigger|nigga|faggot|fag|kike|chink|spic)\b/i,
  /\b(white power|ethnic cleansing|kill all)\b/i,
];

/**
 * Analyzes track metadata and lyrics to detect explicit content across multiple categories.
 */
export function detectExplicitContent(input: ExplicitDetectionInput): ExplicitDetectionResult {
  const fields: string[] = [];
  if (input.title) fields.push(input.title);
  if (input.lyrics) fields.push(input.lyrics);
  if (input.artist) fields.push(input.artist);

  if (fields.length === 0) {
    return {
      isExplicit: false,
      confidence: 0.5,
      advisory: 'unrated',
      categories: {
        profanity: false,
        sexualContent: false,
        violence: false,
        hateSpeech: false,
      },
      flaggedTerms: [],
      reasons: ['No textual metadata or lyrics supplied for explicit content analysis.'],
      analyzedFieldCount: 0,
    };
  }

  const combinedText = fields.join(' ');
  const flaggedTerms: string[] = [];
  const reasons: string[] = [];

  const checkCategory = (patterns: RegExp[], categoryName: string): boolean => {
    let matched = false;
    for (const pattern of patterns) {
      const match = combinedText.match(pattern);
      if (match) {
        matched = true;
        const matchedWord = match[0].toLowerCase();
        if (!flaggedTerms.includes(matchedWord)) {
          flaggedTerms.push(matchedWord);
        }
      }
    }
    if (matched) {
      reasons.push(`Detected explicit ${categoryName} language.`);
    }
    return matched;
  };

  const hasProfanity = checkCategory(PROFANITY_PATTERNS, 'profanity');
  const hasSexual = checkCategory(SEXUAL_CONTENT_PATTERNS, 'sexual content');
  const hasViolence = checkCategory(VIOLENCE_PATTERNS, 'graphic violence');
  const hasHate = checkCategory(HATE_SPEECH_PATTERNS, 'hate speech');

  const isExplicit = hasProfanity || hasSexual || hasViolence || hasHate;
  const confidence = isExplicit ? Math.min(1.0, 0.75 + flaggedTerms.length * 0.05) : 0.95;

  return {
    isExplicit,
    confidence: Number(confidence.toFixed(2)),
    advisory: isExplicit ? 'explicit' : 'clean',
    categories: {
      profanity: hasProfanity,
      sexualContent: hasSexual,
      violence: hasViolence,
      hateSpeech: hasHate,
    },
    flaggedTerms,
    reasons: isExplicit ? reasons : ['No explicit content or profanity detected.'],
    analyzedFieldCount: fields.length,
  };
}

/**
 * Convenience helper returning a boolean flag indicating if a track contains explicit content.
 */
export function isExplicitTrack(input: ExplicitDetectionInput): boolean {
  return detectExplicitContent(input).isExplicit;
}

/**
 * Filters a list of tracks based on the user's explicit content preference.
 */
export function filterExplicitTracks<T extends { title?: string; lyrics?: string }>(
  tracks: T[],
  allowExplicit: boolean
): T[] {
  if (allowExplicit) return tracks;
  return tracks.filter((track) => !isExplicitTrack(track));
}
