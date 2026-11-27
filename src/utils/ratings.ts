import { MediaType, SeasonInfo } from '@/types/media';

export interface CompleteShowRatingResult {
  average: number;
  formatted: string; // e.g. "AVG 7.23 / 10"
  totalCount: number;
  seasonCount: number;
  episodeCount: number;
}

/**
 * Computes the combined flat mean of a TV show's own score, all regular season
 * ratings, and all individual episode ratings across those regular seasons.
 * Season 0 (Specials) is intentionally excluded. Returns null unless every
 * regular season and episode is rated from 1 to 10.
 */
export function computeCompleteShowRating(input: {
  mediaType: MediaType;
  userScore: number;
  seasons?: SeasonInfo[];
  seasonRatings?: Record<number, number>;
  episodeRatings?: Record<string, number>;
}): CompleteShowRatingResult | null {
  if (input.mediaType !== 'tv') return null;
  if (typeof input.userScore !== 'number' || input.userScore < 1 || input.userScore > 10) {
    return null;
  }

  const regularSeasons = (input.seasons || []).filter(
    (s) => s.seasonNumber > 0 && s.episodeCount > 0
  );
  if (regularSeasons.length === 0) return null;
  if (!input.seasonRatings || !input.episodeRatings) return null;

  let sum = input.userScore;
  let totalCount = 1;
  let episodeCount = 0;

  for (const season of regularSeasons) {
    const sRating = input.seasonRatings[season.seasonNumber];
    if (typeof sRating !== 'number' || sRating < 1 || sRating > 10) {
      return null;
    }
    sum += sRating;
    totalCount += 1;

    for (let ep = 1; ep <= season.episodeCount; ep++) {
      const eRating = input.episodeRatings[`s${season.seasonNumber}_e${ep}`];
      if (typeof eRating !== 'number' || eRating < 1 || eRating > 10) {
        return null;
      }
      sum += eRating;
      totalCount += 1;
      episodeCount += 1;
    }
  }

  const average = sum / totalCount;
  return {
    average,
    formatted: `AVG ${average.toFixed(2)} / 10`,
    totalCount,
    seasonCount: regularSeasons.length,
    episodeCount,
  };
}
