import { describe, it, expect } from 'vitest';
import {
  detectExplicitContent,
  isExplicitTrack,
  filterExplicitTracks,
} from '@/lib/explicitContentDetection';

describe('Explicit Content Detection Service (#434)', () => {
  it('returns clean advisory for safe and radio-friendly lyrics and title', () => {
    const result = detectExplicitContent({
      title: 'Sunny Morning Breeze',
      artist: 'Acoustic Joy',
      lyrics: 'Walking down the road, watching the bright sunshine and blue sky.',
      genre: 'Acoustic',
    });

    expect(result.isExplicit).toBe(false);
    expect(result.advisory).toBe('clean');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.flaggedTerms).toHaveLength(0);
    expect(result.categories.profanity).toBe(false);
    expect(result.categories.sexualContent).toBe(false);
    expect(result.categories.violence).toBe(false);
    expect(result.categories.hateSpeech).toBe(false);
  });

  it('detects profanity in lyrics and flags explicit advisory', () => {
    const result = detectExplicitContent({
      title: 'Night Hustle',
      lyrics: 'They keep talking that bullshit but I don’t give a fuck about the noise.',
      genre: 'Hip Hop',
    });

    expect(result.isExplicit).toBe(true);
    expect(result.advisory).toBe('explicit');
    expect(result.categories.profanity).toBe(true);
    expect(result.flaggedTerms).toContain('bullshit');
    expect(result.flaggedTerms).toContain('fuck');
    expect(result.reasons[0]).toMatch(/profanity/i);
  });

  it('does not produce false positives on benign words containing substrings', () => {
    // words like "bass", "class", "classic", "compassion" should not trigger profanity
    const result = detectExplicitContent({
      title: 'Classic Bass Groove',
      lyrics: 'Feel the bass vibrating through the room, high class production.',
      genre: 'Electronic',
    });

    expect(result.isExplicit).toBe(false);
    expect(result.advisory).toBe('clean');
    expect(result.flaggedTerms).toHaveLength(0);
  });

  it('detects sexual content and graphic violence', () => {
    const sexualResult = detectExplicitContent({
      title: 'After Midnight',
      lyrics: 'Heading to the strip club, watching explicit porn on the screen.',
    });
    expect(sexualResult.isExplicit).toBe(true);
    expect(sexualResult.categories.sexualContent).toBe(true);

    const violenceResult = detectExplicitContent({
      title: 'Dark Alley',
      lyrics: 'A ruthless murderer on a shooting spree execution style.',
    });
    expect(violenceResult.isExplicit).toBe(true);
    expect(violenceResult.categories.violence).toBe(true);
  });

  it('returns unrated advisory when no text is provided', () => {
    const result = detectExplicitContent({});
    expect(result.isExplicit).toBe(false);
    expect(result.advisory).toBe('unrated');
    expect(result.analyzedFieldCount).toBe(0);
  });

  it('isExplicitTrack convenience helper works accurately', () => {
    expect(isExplicitTrack({ title: 'Just a Clean Track' })).toBe(false);
    expect(isExplicitTrack({ title: 'What the fuck' })).toBe(true);
  });

  it('filterExplicitTracks filters out explicit songs when allowExplicit is false', () => {
    const playlist = [
      { id: 1, title: 'Clean Acoustic Tune', lyrics: 'Gentle waves' },
      { id: 2, title: 'Explicit Rap Anthem', lyrics: 'Got my bitches and my money' },
      { id: 3, title: 'Serene Piano', lyrics: 'Peaceful keys' },
    ];

    const filtered = filterExplicitTracks(playlist, false);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id)).toEqual([1, 3]);

    const all = filterExplicitTracks(playlist, true);
    expect(all).toHaveLength(3);
  });
});
