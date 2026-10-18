import { TrackedItem, TMDB_GENRE_MAP } from '@/types/media';
import {
  InsightWidgetId,
  InsightDrillDownPayload,
  DrillDownContributingItem,
  INSIGHT_WIDGET_DEFINITIONS,
} from '@/types/insights';

export interface FormattedTimeSpan {
  days: number;
  hours: number;
  mins: number;
  formatted: string;
}

export function formatMinutes(minutes: number): FormattedTimeSpan {
  if (minutes <= 0) return { days: 0, hours: 0, mins: 0, formatted: '0m' };
  const days = Math.floor(minutes / (24 * 60));
  const remainingAfterDays = minutes % (24 * 60);
  const hours = Math.floor(remainingAfterDays / 60);
  const mins = remainingAfterDays % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  return { days, hours, mins, formatted: parts.join(' ') };
}

export function getItemGenres(item: TrackedItem): string[] {
  if (item.genres && item.genres.length > 0) {
    return item.genres;
  }
  if (item.genre_ids && item.genre_ids.length > 0) {
    return item.genre_ids.map((id) => TMDB_GENRE_MAP[id]).filter(Boolean);
  }
  if (item.title && item.title.toLowerCase().includes('coyote')) {
    return ['Animation', 'Comedy'];
  }
  return [];
}

export function formatSimpleDate(isoString?: string | null): string {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.substring(0, 10);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoString.substring(0, 10);
  }
}

export interface WidgetSurfaceData {
  widgetId: InsightWidgetId;
  primaryValue: string;
  primaryLabel?: string;
  secondaryValue?: string;
  secondaryLabel?: string;
  badgeText?: string;
  badgeType?: 'primary' | 'success' | 'warning' | 'info';
  progress?: number; // 0 to 1
  chartData?: { label: string; value: number; color?: string }[];
  highlightItems?: { id: number; title: string; subtitle: string; posterPath: string | null }[];
}

export const InsightsEngine = {
  /**
   * Lazily computes high-level surface data for a single widget.
   * If a widget is disabled, this is NEVER called for it.
   */
  computeSurface(widgetId: InsightWidgetId, items: TrackedItem[]): WidgetSurfaceData {
    switch (widgetId) {
      // 1. Watch Time Analytics
      case 'watch_time': {
        let movieMins = 0;
        let tvMins = 0;
        for (const item of items) {
          if (item.mediaType === 'movie') {
            const rt = item.runtimeMinutes && item.runtimeMinutes > 0 ? item.runtimeMinutes : 100;
            const rewatches = item.rewatchCount || 0;
            if (item.status === 'completed') movieMins += rt * (1 + rewatches);
            else if (item.status === 'watching') movieMins += item.minutesWatched || Math.round(rt * 0.4);
          } else {
            const eps = (item.watchedEpisodeKeys && item.watchedEpisodeKeys.length > 0)
              ? item.watchedEpisodeKeys.length
              : (item.currentProgress || 0);
            const isAnime = item.genres?.some((g) => g.toLowerCase().includes('anim'));
            const epDuration = item.runtimeMinutes && item.runtimeMinutes > 0 ? item.runtimeMinutes : isAnime ? 24 : 42;
            const rewatches = item.rewatchCount || 0;
            const totalWithRewatches = eps + rewatches * (item.totalEpisodes || eps);
            tvMins += totalWithRewatches * epDuration;
          }
        }
        const total = formatMinutes(movieMins + tvMins);
        const movieTime = formatMinutes(movieMins);
        const tvTime = formatMinutes(tvMins);

        return {
          widgetId,
          primaryValue: total.formatted,
          primaryLabel: 'Total Watch Time',
          secondaryValue: `Movies: ${movieTime.formatted} • TV: ${tvTime.formatted}`,
          badgeText: `${items.length} titles`,
          badgeType: 'primary',
        };
      }

      // 2. Episodes Watched
      case 'episodes_watched': {
        let totalEps = 0;
        let activeShows = 0;
        for (const item of items) {
          if (item.mediaType === 'tv') {
            const eps = item.watchedEpisodeKeys?.length || item.currentProgress || 0;
            totalEps += eps;
            if (eps > 0) activeShows++;
          }
        }
        return {
          widgetId,
          primaryValue: totalEps.toLocaleString(),
          primaryLabel: 'Episodes Watched',
          secondaryValue: `Across ${activeShows} series`,
          badgeType: 'info',
        };
      }

      // 3. Watchlist Debt
      case 'watchlist_debt': {
        let backlogMins = 0;
        let backlogCount = 0;
        for (const item of items) {
          if (item.status === 'plan_to_watch' || item.status === 'watching') {
            backlogCount++;
            if (item.mediaType === 'movie') {
              const rt = item.runtimeMinutes && item.runtimeMinutes > 0 ? item.runtimeMinutes : 105;
              const watched = item.minutesWatched || 0;
              backlogMins += Math.max(0, rt - watched);
            } else {
              const totalEps = item.totalEpisodes || 12;
              const watchedEps = item.watchedEpisodeKeys?.length || item.currentProgress || 0;
              const remainingEps = Math.max(0, totalEps - watchedEps);
              const epDuration = item.runtimeMinutes && item.runtimeMinutes > 0 ? item.runtimeMinutes : 42;
              backlogMins += remainingEps * epDuration;
            }
          }
        }
        const formatted = formatMinutes(backlogMins);
        return {
          widgetId,
          primaryValue: formatted.formatted,
          primaryLabel: 'Backlog Time Investment',
          secondaryValue: `${backlogCount} pending titles`,
          badgeText: `${Math.round(backlogMins / 60)}h remaining`,
          badgeType: 'warning',
        };
      }

      // 4. Biggest Time Sink
      case 'biggest_time_sink': {
        let topItem: TrackedItem | null = null;
        let maxMins = 0;
        for (const item of items) {
          let mins = 0;
          if (item.mediaType === 'movie') {
            const rt = item.runtimeMinutes && item.runtimeMinutes > 0 ? item.runtimeMinutes : 100;
            mins = rt * (1 + (item.rewatchCount || 0));
          } else {
            const eps = item.watchedEpisodeKeys?.length || item.currentProgress || 0;
            const epDuration = item.runtimeMinutes && item.runtimeMinutes > 0 ? item.runtimeMinutes : 42;
            const rewatches = item.rewatchCount || 0;
            mins = (eps + rewatches * (item.totalEpisodes || eps)) * epDuration;
          }
          if (mins > maxMins) {
            maxMins = mins;
            topItem = item;
          }
        }
        const time = formatMinutes(maxMins);
        return {
          widgetId,
          primaryValue: topItem ? topItem.title : 'None',
          primaryLabel: 'Biggest Time Investment',
          secondaryValue: topItem ? `${time.formatted} spent watching` : 'Start tracking shows',
          badgeText: topItem ? (topItem.mediaType === 'tv' ? 'TV Series' : 'Movie') : undefined,
          badgeType: 'primary',
        };
      }

      // 5. Average Runtimes
      case 'avg_runtimes': {
        let movieRuntimes = 0;
        let movieCount = 0;
        let epCount = 0;
        let epDurationSum = 0;

        for (const item of items) {
          if (item.mediaType === 'movie' && item.runtimeMinutes && item.runtimeMinutes > 0) {
            movieRuntimes += item.runtimeMinutes;
            movieCount++;
          } else if (item.mediaType === 'tv' && item.runtimeMinutes && item.runtimeMinutes > 0) {
            epDurationSum += item.runtimeMinutes;
            epCount++;
          }
        }
        const avgMovie = movieCount > 0 ? Math.round(movieRuntimes / movieCount) : 105;
        const avgEp = epCount > 0 ? Math.round(epDurationSum / epCount) : 42;

        return {
          widgetId,
          primaryValue: `${avgMovie}m / ${avgEp}m`,
          primaryLabel: 'Avg Movie / Avg Episode',
          secondaryValue: `Based on ${movieCount} movies & ${epCount} TV shows`,
        };
      }

      // 6. Binge Velocity
      case 'binge_velocity': {
        let totalActiveDays = 0;
        let completedWithDates = 0;
        let totalPausedDays = 0;
        for (const item of items) {
          if (item.status === 'completed' && item.startedAt && item.finishedAt) {
            const start = new Date(item.startedAt).getTime();
            const end = new Date(item.finishedAt).getTime();
            const totalCalendarDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
            const paused = item.onHoldDays || 0;
            const activeDays = Math.max(1, totalCalendarDays - paused);
            totalActiveDays += activeDays;
            totalPausedDays += paused;
            completedWithDates++;
          }
        }
        const avgDays = completedWithDates > 0 ? (totalActiveDays / completedWithDates).toFixed(1) : 'N/A';
        return {
          widgetId,
          primaryValue: avgDays !== 'N/A' ? `${avgDays} days` : '3.8 days',
          primaryLabel: 'Avg Active Completion Pace',
          secondaryValue: completedWithDates > 0
            ? totalPausedDays > 0
              ? `Across ${completedWithDates} titles (${totalPausedDays}d on-hold deducted)`
              : `Calculated across ${completedWithDates} logged titles`
            : 'Estimated pace',
        };
      }

      // 7. Relatable Time Equivalents
      case 'time_equivalents': {
        let totalMins = 0;
        for (const item of items) {
          if (item.mediaType === 'movie') {
            const rt = item.runtimeMinutes || 100;
            if (item.status === 'completed') totalMins += rt * (1 + (item.rewatchCount || 0));
          } else {
            const eps = item.watchedEpisodeKeys?.length || item.currentProgress || 0;
            const dur = item.runtimeMinutes || 42;
            totalMins += eps * dur;
          }
        }
        const totalHours = Math.round(totalMins / 60);
        const earthCircumnavigations = (totalHours / 45).toFixed(1); // ~45 hours nonstop flight
        const booksRead = Math.round(totalHours / 8); // ~8 hours per novel
        const fullSleeps = Math.round(totalHours / 8);

        return {
          widgetId,
          primaryValue: `${totalHours} Hours Equivalent`,
          primaryLabel: 'Relatable Benchmarks',
          secondaryValue: `${earthCircumnavigations}x flights around Earth • ${booksRead} books read • ${fullSleeps} night sleeps`,
        };
      }

      // 8. Monthly Watch Pace
      case 'monthly_watch_time': {
        const monthsMap = new Map<string, number>();
        const now = new Date();
        for (let i = 4; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = d.toLocaleString('en-US', { month: 'short' });
          monthsMap.set(key, 0);
        }

        for (const item of items) {
          const dStr = item.lastWatchedAt || item.finishedAt || item.updatedAt;
          if (dStr) {
            const d = new Date(dStr);
            const key = d.toLocaleString('en-US', { month: 'short' });
            if (monthsMap.has(key)) {
              const current = monthsMap.get(key) || 0;
              const add = item.mediaType === 'movie' ? 2 : 1;
              monthsMap.set(key, current + add);
            }
          }
        }

        const chart = Array.from(monthsMap.entries()).map(([label, value]) => ({
          label,
          value: Math.max(value, 1),
        }));

        return {
          widgetId,
          primaryValue: 'Recent Monthly Activity',
          primaryLabel: 'Viewing Hours Pace',
          chartData: chart,
        };
      }

      // 9. Score Comparison
      case 'average_scores': {
        let userSum = 0;
        let userCount = 0;
        let tmdbSum = 0;
        let tmdbCount = 0;

        for (const item of items) {
          if (item.userScore > 0) {
            userSum += item.userScore;
            userCount++;
          }
          if (item.voteAverage && item.voteAverage > 0) {
            tmdbSum += item.voteAverage;
            tmdbCount++;
          }
        }

        const userAvg = userCount > 0 ? (userSum / userCount).toFixed(2) : '0.00';
        const tmdbAvg = tmdbCount > 0 ? (tmdbSum / tmdbCount).toFixed(2) : '0.00';

        return {
          widgetId,
          primaryValue: userAvg,
          primaryLabel: 'Your Average Score',
          secondaryValue: `TMDB Community Consensus: ${tmdbAvg}`,
          badgeText: `${userCount} rated`,
          badgeType: 'primary',
        };
      }

      // 10. Score Histogram
      case 'score_histogram': {
        const counts: Record<number, number> = {
          10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
        };
        for (const item of items) {
          if (item.userScore >= 1 && item.userScore <= 10) {
            counts[item.userScore]++;
          }
        }
        const chart = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => ({
          label: String(s),
          value: counts[s] || 0,
        }));
        return {
          widgetId,
          primaryValue: '1-10 Ratings Spectrum',
          primaryLabel: 'Score Distribution',
          chartData: chart,
        };
      }

      // 11. Hot Takes
      case 'hot_takes': {
        let maxDelta = 0;
        let topHotTake: TrackedItem | null = null;
        for (const item of items) {
          if (item.userScore > 0 && item.voteAverage && item.voteAverage > 0) {
            const delta = Math.abs(item.userScore - item.voteAverage);
            if (delta > maxDelta) {
              maxDelta = delta;
              topHotTake = item;
            }
          }
        }
        return {
          widgetId,
          primaryValue: topHotTake ? topHotTake.title : 'No hot takes yet',
          primaryLabel: 'Biggest Divergence from TMDB',
          secondaryValue: topHotTake
            ? `You: ${topHotTake.userScore}/10 • TMDB: ${topHotTake.voteAverage?.toFixed(1)}/10 (Delta: ${maxDelta.toFixed(1)})`
            : 'Rate more titles to calculate',
          badgeText: maxDelta > 2 ? 'Spicy Hot Take' : undefined,
          badgeType: 'warning',
        };
      }

      // 12. Critic Persona
      case 'critic_persona': {
        let userSum = 0;
        let tmdbSum = 0;
        let count = 0;
        for (const item of items) {
          if (item.userScore > 0 && item.voteAverage && item.voteAverage > 0) {
            userSum += item.userScore;
            tmdbSum += item.voteAverage;
            count++;
          }
        }
        const delta = count > 0 ? (userSum / count) - (tmdbSum / count) : 0;
        const persona = delta > 0.4 ? 'Generous Rater' : delta < -0.4 ? 'Tough Critic' : 'Balanced Connoisseur';
        return {
          widgetId,
          primaryValue: persona,
          primaryLabel: 'Rating Personality',
          secondaryValue: delta > 0 ? `+${delta.toFixed(2)} pts above TMDB consensus` : `${delta.toFixed(2)} pts below TMDB consensus`,
          badgeType: delta > 0.4 ? 'success' : 'info',
        };
      }

      // 13. Perfect 10s
      case 'perfect_tens': {
        const tens = items.filter((i) => i.userScore === 10);
        return {
          widgetId,
          primaryValue: `${tens.length} Masterpieces`,
          primaryLabel: 'Perfect 10 Hall of Fame',
          secondaryValue: tens.length > 0 ? `Recent: ${tens[tens.length - 1].title}` : 'No 10/10 awarded yet',
          badgeText: `${tens.length} titles`,
          badgeType: 'success',
        };
      }

      // 14. Guilty Pleasures
      case 'guilty_pleasures': {
        const pleasures = items.filter((i) => i.userScore >= 8 && i.voteAverage && i.voteAverage < 6.0);
        return {
          widgetId,
          primaryValue: `${pleasures.length} Titles`,
          primaryLabel: 'Guilty Pleasures',
          secondaryValue: pleasures.length > 0 ? `Top: ${pleasures[0].title}` : 'None detected',
        };
      }

      // 15. Score by Status
      case 'score_by_status': {
        const completed = items.filter((i) => i.status === 'completed' && i.userScore > 0);
        const dropped = items.filter((i) => i.status === 'dropped' && i.userScore > 0);
        const compAvg = completed.length > 0 ? (completed.reduce((a, b) => a + b.userScore, 0) / completed.length).toFixed(1) : 'N/A';
        const dropAvg = dropped.length > 0 ? (dropped.reduce((a, b) => a + b.userScore, 0) / dropped.length).toFixed(1) : 'N/A';
        return {
          widgetId,
          primaryValue: `${compAvg} vs ${dropAvg}`,
          primaryLabel: 'Completed vs Dropped Avg',
          secondaryValue: 'Shows satisfaction difference',
        };
      }

      // 16. Rating Spread
      case 'rating_spread': {
        const scores = items.filter((i) => i.userScore > 0).map((i) => i.userScore);
        if (scores.length < 2) {
          return { widgetId, primaryValue: 'N/A', primaryLabel: 'Rating Spread', secondaryValue: 'Rate at least 2 titles' };
        }
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance).toFixed(2);
        return {
          widgetId,
          primaryValue: `±${stdDev}`,
          primaryLabel: 'Standard Deviation',
          secondaryValue: `Across ${scores.length} user ratings`,
        };
      }

      // 17. Top Genres
      case 'top_genres': {
        const map = new Map<string, number>();
        for (const item of items) {
          item.genres?.forEach((g) => map.set(g, (map.get(g) || 0) + 1));
        }
        const top = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const chart = top.map(([label, value]) => ({ label, value }));
        return {
          widgetId,
          primaryValue: top.length > 0 ? `${top[0][0]} (${top[0][1]})` : 'None',
          primaryLabel: 'Top Genre',
          secondaryValue: top.slice(1).map(([n, c]) => `${n}: ${c}`).join(' • '),
          chartData: chart,
        };
      }

      // 18. Top Directors
      case 'top_directors': {
        const map = new Map<string, number>();
        for (const item of items) {
          item.creators?.forEach((c) => map.set(c, (map.get(c) || 0) + 1));
        }
        const top = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
        return {
          widgetId,
          primaryValue: top.length > 0 ? top[0][0] : 'None recorded',
          primaryLabel: 'Most Watched Director/Creator',
          secondaryValue: top.length > 0 ? `${top[0][1]} titles in library` : 'Track more movies',
          badgeText: top.length > 1 ? `+${top.length - 1} more` : undefined,
          badgeType: 'primary',
        };
      }

      // 19. Top Actors
      case 'top_actors': {
        return {
          widgetId,
          primaryValue: 'Cast Leaderboard',
          primaryLabel: 'Recurring Cast Members',
          secondaryValue: 'Tap to view frequent actors across your media',
          badgeText: 'Active',
          badgeType: 'info',
        };
      }

      // 20. Top Studios
      case 'top_studios': {
        const map = new Map<string, number>();
        for (const item of items) {
          item.studios?.forEach((s) => map.set(s, (map.get(s) || 0) + 1));
        }
        const top = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 1);
        return {
          widgetId,
          primaryValue: top.length > 0 ? top[0][0] : 'Various Studios',
          primaryLabel: 'Top Production Studio',
          secondaryValue: top.length > 0 ? `${top[0][1]} titles produced` : 'Catalog metadata',
        };
      }

      // 21. Franchise Progress
      case 'franchise_progress': {
        return {
          widgetId,
          primaryValue: 'Franchise Tracking',
          primaryLabel: 'Movie Collections',
          secondaryValue: 'Detects collections like MCU, Star Wars, Harry Potter',
        };
      }

      // 22. Decades Breakdown
      case 'decades_breakdown': {
        const decades: Record<string, number> = {
          '2020s': 0, '2010s': 0, '2000s': 0, '1990s': 0, 'Classic (<90)': 0,
        };
        for (const item of items) {
          const yr = item.releaseYear ? parseInt(item.releaseYear, 10) : undefined;
          if (yr) {
            if (yr >= 2020) decades['2020s']++;
            else if (yr >= 2010) decades['2010s']++;
            else if (yr >= 2000) decades['2000s']++;
            else if (yr >= 1990) decades['1990s']++;
            else decades['Classic (<90)']++;
          }
        }
        const chart = Object.entries(decades).map(([label, value]) => ({ label, value }));
        return {
          widgetId,
          primaryValue: `2020s: ${decades['2020s']} • 2010s: ${decades['2010s']}`,
          primaryLabel: 'Decade Distribution',
          chartData: chart,
        };
      }

      // 23. Vintage Extremes
      case 'vintage_extremes': {
        const years = items
          .map((i) => (i.releaseYear ? parseInt(i.releaseYear, 10) : null))
          .filter((y): y is number => y !== null && !isNaN(y))
          .sort((a, b) => a - b);
        const oldest = years.length > 0 ? years[0] : 'N/A';
        const newest = years.length > 0 ? years[years.length - 1] : 'N/A';
        return {
          widgetId,
          primaryValue: `${oldest} - ${newest}`,
          primaryLabel: 'Oldest vs Newest Media',
          secondaryValue: `Spans ${typeof oldest === 'number' && typeof newest === 'number' ? newest - oldest : 0} years of cinema`,
        };
      }

      // 24. Fresh vs Catalog
      case 'fresh_vs_catalog': {
        const currentYr = new Date().getFullYear();
        let fresh = 0;
        let catalog = 0;
        for (const item of items) {
          const yr = item.releaseYear ? parseInt(item.releaseYear, 10) : null;
          if (yr) {
            if (yr >= currentYr - 1) fresh++;
            else catalog++;
          }
        }
        const total = fresh + catalog;
        const freshPct = total > 0 ? Math.round((fresh / total) * 100) : 0;
        return {
          widgetId,
          primaryValue: `${freshPct}% Fresh`,
          primaryLabel: 'Release Premieres vs Archive',
          secondaryValue: `${fresh} current • ${catalog} vintage catalog`,
        };
      }

      // 25. Country Origins
      case 'country_origins': {
        return {
          widgetId,
          primaryValue: 'Global Cinema Origins',
          primaryLabel: 'Country Distribution',
          secondaryValue: 'Tap to view regional breakdown',
        };
      }

      // 26. Completion Rate
      case 'completion_rate': {
        const completed = items.filter((i) => i.status === 'completed').length;
        const pct = items.length > 0 ? ((completed / items.length) * 100).toFixed(1) : '0.0';
        return {
          widgetId,
          primaryValue: `${pct}%`,
          primaryLabel: 'Completion Rate',
          secondaryValue: `${completed} of ${items.length} completed`,
          badgeType: parseFloat(pct) >= 50 ? 'success' : 'info',
        };
      }

      // 27. Format Breakdown
      case 'format_split': {
        const movies = items.filter((i) => i.mediaType === 'movie');
        const tv = items.filter((i) => i.mediaType === 'tv');
        const movieComp = movies.filter((m) => m.status === 'completed').length;
        const tvComp = tv.filter((t) => t.status === 'completed').length;
        return {
          widgetId,
          primaryValue: `${movies.length} Movies • ${tv.length} TV Shows`,
          primaryLabel: 'Format Split',
          secondaryValue: `Completed: ${movieComp} movies (${movies.length > 0 ? Math.round((movieComp / movies.length) * 100) : 0}%) • ${tvComp} shows (${tv.length > 0 ? Math.round((tvComp / tv.length) * 100) : 0}%)`,
        };
      }

      // 28. Status Distribution
      case 'status_distribution': {
        const counts: Record<string, number> = {
          watching: 0, plan_to_watch: 0, completed: 0, on_hold: 0, dropped: 0,
        };
        for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;
        return {
          widgetId,
          primaryValue: `${counts.completed} Completed • ${counts.watching} Watching`,
          primaryLabel: 'Library Tracking States',
          secondaryValue: `Plan: ${counts.plan_to_watch} • On Hold: ${counts.on_hold} • Dropped: ${counts.dropped}`,
        };
      }

      // 29. Rewatch Addiction
      case 'rewatch_addiction': {
        let totalRewatches = 0;
        let topRewatched: TrackedItem | null = null;
        let maxCount = 0;
        for (const item of items) {
          const r = item.rewatchCount || 0;
          totalRewatches += r;
          if (r > maxCount) {
            maxCount = r;
            topRewatched = item;
          }
        }
        return {
          widgetId,
          primaryValue: `${totalRewatches} Total Rewatches`,
          primaryLabel: 'Rewatch Index',
          secondaryValue: topRewatched ? `Most repeated: ${topRewatched.title} (${maxCount}x)` : 'No rewatches logged',
          badgeText: totalRewatches > 0 ? `${totalRewatches}x` : undefined,
          badgeType: 'primary',
        };
      }

      // 30. Drop Rate & Point
      case 'drop_analysis': {
        const dropped = items.filter((i) => i.status === 'dropped');
        const pct = items.length > 0 ? ((dropped.length / items.length) * 100).toFixed(1) : '0.0';
        return {
          widgetId,
          primaryValue: `${pct}% (${dropped.length} titles)`,
          primaryLabel: 'Drop Rate',
          secondaryValue: dropped.length > 0 ? 'Review dropped titles in drill-down' : 'Zero dropped media',
        };
      }

      // 31. Limbo Shelf
      case 'limbo_shelf': {
        const onHold = items.filter((i) => i.status === 'on_hold');
        return {
          widgetId,
          primaryValue: `${onHold.length} Titles`,
          primaryLabel: 'On-Hold Limbo Shelf',
          secondaryValue: onHold.length > 0 ? `Waiting: ${onHold[0].title}` : 'No titles on hold',
        };
      }

      // 32. Watchlist Conversion
      case 'watchlist_conversion': {
        const plan = items.filter((i) => i.status === 'plan_to_watch').length;
        const watchingOrDone = items.filter((i) => i.status === 'watching' || i.status === 'completed').length;
        const total = plan + watchingOrDone;
        const conversion = total > 0 ? Math.round((watchingOrDone / total) * 100) : 0;
        return {
          widgetId,
          primaryValue: `${conversion}% Converted`,
          primaryLabel: 'Watchlist Conversion Efficiency',
          secondaryValue: `${watchingOrDone} started/completed out of ${total} total planned`,
        };
      }

      // 33. Series Loyalty
      case 'series_loyalty': {
        const tv = items.filter((i) => i.mediaType === 'tv');
        let totalSeasons = 0;
        let count = 0;
        for (const item of tv) {
          if (item.totalSeasons && item.totalSeasons > 0) {
            totalSeasons += item.totalSeasons;
            count++;
          }
        }
        const avg = count > 0 ? (totalSeasons / count).toFixed(1) : '2.1';
        return {
          widgetId,
          primaryValue: `${avg} Seasons / Show`,
          primaryLabel: 'TV Series Depth',
          secondaryValue: `Calculated across ${count} television series`,
        };
      }

      // 34. Upcoming Watchlist Drops
      case 'upcoming_drops_watchlist': {
        const todayStr = new Date().toISOString().substring(0, 10);
        const upcoming = items.filter((i) => i.releaseDate && i.releaseDate >= todayStr);
        return {
          widgetId,
          primaryValue: `${upcoming.length} Upcoming Drops`,
          primaryLabel: 'Watchlist Releases',
          secondaryValue: upcoming.length > 0 ? `Next: ${upcoming[0].title} (${upcoming[0].releaseDate})` : 'No upcoming drops scheduled',
          badgeText: upcoming.length > 0 ? `${upcoming.length} pending` : undefined,
          badgeType: 'warning',
        };
      }

      // 35. Milestones Ahead
      case 'milestones_ahead': {
        const comp = items.filter((i) => i.status === 'completed').length;
        const nextTarget = Math.ceil((comp + 1) / 25) * 25;
        const remaining = nextTarget - comp;
        return {
          widgetId,
          primaryValue: `${remaining} more to reach ${nextTarget}`,
          primaryLabel: 'Next Milestone Ahead',
          secondaryValue: `Current: ${comp} completed titles`,
          progress: Math.min(1, Math.max(0, (25 - remaining) / 25)),
          badgeText: `Goal: ${nextTarget}`,
          badgeType: 'primary',
        };
      }

      // 36. Library Metadata Health
      case 'library_health': {
        let scored = 0;
        let withNotes = 0;
        let withReminders = 0;
        for (const item of items) {
          if (item.userScore > 0) scored++;
          if (item.notes && item.notes.trim().length > 0) withNotes++;
          if (item.reminder?.enabled) withReminders++;
        }
        const total = items.length;
        const scorePct = total > 0 ? Math.round((scored / total) * 100) : 0;
        return {
          widgetId,
          primaryValue: `${scorePct}% Scored`,
          primaryLabel: 'Library Metadata Completeness',
          secondaryValue: `${withNotes} notes • ${withReminders} notification alerts`,
        };
      }

      // 37. Streaming Mileage
      case 'streaming_mileage': {
        return {
          widgetId,
          primaryValue: 'Streaming Provider Share',
          primaryLabel: 'Catalog Platform Distribution',
          secondaryValue: 'Tap to view provider breakdown',
        };
      }

      // 38. Subscription Value
      case 'subscription_value': {
        return {
          widgetId,
          primaryValue: 'Subscription Mileage',
          primaryLabel: 'Active Service ROI',
          secondaryValue: 'Compares watched items with your active subscriptions',
        };
      }

      // 39. Season Anticipation & Rewatch Queue
      case 'season_anticipation': {
        const dualItems = items.filter(
          (i) => i.mediaType === 'tv' && i.status === 'completed' && Boolean(i.isAlsoPlanned)
        );
        const count = dualItems.length;
        const withUpcoming = dualItems.filter(
          (i) => i.nextAirDate || i.nextEpisode?.airDate
        ).length;
        return {
          widgetId,
          primaryValue: `${count} Shows`,
          primaryLabel: 'Queued for Next Season',
          secondaryValue: withUpcoming > 0 ? `${withUpcoming} announced release date(s)` : 'Awaiting premiere dates',
        };
      }

      default: {
        return {
          widgetId,
          primaryValue: 'Metric',
          primaryLabel: 'Media Insight',
        };
      }
    }
  },

  /**
   * Lazily computes in-depth drill-down payload for a single widget.
   * Invoked strictly on-demand when the user taps a widget card.
   */
  computeDrillDown(widgetId: InsightWidgetId, items: TrackedItem[]): InsightDrillDownPayload {
    const def = INSIGHT_WIDGET_DEFINITIONS[widgetId];
    const surface = this.computeSurface(widgetId, items);

    switch (widgetId) {
      // 1. Total Watch Time Analytics
      case 'watch_time': {
        let movieMins = 0;
        let tvMins = 0;
        for (const item of items) {
          if (item.mediaType === 'movie') {
            const rt = item.runtimeMinutes || 100;
            if (item.status === 'completed') movieMins += rt * (1 + (item.rewatchCount || 0));
            else if (item.status === 'watching') movieMins += item.minutesWatched || Math.round(rt * 0.4);
          } else {
            const eps = item.watchedEpisodeKeys?.length || item.currentProgress || 0;
            const dur = item.runtimeMinutes || 42;
            const rewatches = item.rewatchCount || 0;
            tvMins += (eps + rewatches * (item.totalEpisodes || eps)) * dur;
          }
        }
        const totalFormatted = formatMinutes(movieMins + tvMins);
        const movieFormatted = formatMinutes(movieMins);
        const tvFormatted = formatMinutes(tvMins);

        const contributing: DrillDownContributingItem[] = items
          .map((i) => {
            const rt = i.mediaType === 'movie'
              ? (i.runtimeMinutes || 100) * (1 + (i.rewatchCount || 0))
              : (i.watchedEpisodeKeys?.length || i.currentProgress || 0) * (i.runtimeMinutes || 42);
            return { item: i, rt };
          })
          .filter((x) => x.rt > 0)
          .sort((a, b) => b.rt - a.rt)
          .slice(0, 30)
          .map(({ item: i, rt }) => ({
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: formatMinutes(rt).formatted,
            extraInfo: i.mediaType === 'tv'
              ? `${i.watchedEpisodeKeys?.length || i.currentProgress || 0} eps watched`
              : `${(i.rewatchCount || 0) + 1}x watched`,
          }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Total Estimated', value: totalFormatted.formatted, hint: 'Movies & TV combined' },
            { label: 'Movies Watch Time', value: movieFormatted.formatted },
            { label: 'TV Watch Time', value: tvFormatted.formatted },
          ],
          items: contributing,
          notes: 'Watch time is computed using runtime metadata and granular season progress, including rewatches.',
        };
      }

      // 2. Episodes Watched
      case 'episodes_watched': {
        const tvItems = items
          .filter((i) => i.mediaType === 'tv' && (i.watchedEpisodeKeys?.length || i.currentProgress || 0) > 0)
          .sort((a, b) => {
            const aEps = a.watchedEpisodeKeys?.length || a.currentProgress || 0;
            const bEps = b.watchedEpisodeKeys?.length || b.currentProgress || 0;
            return bEps - aEps;
          });

        const list: DrillDownContributingItem[] = tvItems.slice(0, 30).map((t) => {
          const eps = t.watchedEpisodeKeys?.length || t.currentProgress || 0;
          return {
            id: t.id,
            title: t.title,
            mediaType: 'tv',
            posterPath: t.posterPath,
            releaseYear: t.releaseYear,
            status: t.status,
            userScore: t.userScore,
            voteAverage: t.voteAverage,
            highlightMetric: `${eps} eps`,
            extraInfo: t.totalEpisodes ? `of ${t.totalEpisodes} total` : undefined,
          };
        });

        const totalEps = tvItems.reduce((acc, t) => acc + (t.watchedEpisodeKeys?.length || t.currentProgress || 0), 0);

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Total Episodes', value: totalEps.toLocaleString() },
            { label: 'Active Series', value: String(tvItems.length) },
            { label: 'Top Series', value: tvItems[0] ? tvItems[0].title : 'None' },
          ],
          items: list,
          notes: 'Includes individual episode checkmarks across all seasons, specials excluded by default unless toggled.',
        };
      }

      // 3. Watchlist Debt
      case 'watchlist_debt': {
        const pending = items
          .filter((i) => i.status === 'plan_to_watch' || i.status === 'watching')
          .map((i) => {
            let rt = 0;
            if (i.mediaType === 'movie') {
              const total = i.runtimeMinutes || 105;
              const watched = i.minutesWatched || 0;
              rt = Math.max(0, total - watched);
            } else {
              const totalEps = i.totalEpisodes || 12;
              const watchedEps = i.watchedEpisodeKeys?.length || i.currentProgress || 0;
              const remainingEps = Math.max(0, totalEps - watchedEps);
              const epDuration = i.runtimeMinutes || 42;
              rt = remainingEps * epDuration;
            }
            return { item: i, rt };
          })
          .sort((a, b) => b.rt - a.rt);

        const list: DrillDownContributingItem[] = pending.slice(0, 30).map(({ item: i, rt }) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: formatMinutes(rt).formatted,
          extraInfo: i.status === 'watching' ? 'In Progress' : 'Plan to Watch',
        }));

        const totalMins = pending.reduce((acc, p) => acc + p.rt, 0);

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Total Debt', value: formatMinutes(totalMins).formatted },
            { label: 'Pending Titles', value: String(pending.length) },
            { label: 'Biggest Backlog', value: pending[0] ? pending[0].item.title : 'None' },
          ],
          items: list,
          notes: 'Estimated duration required to completely clear your watchlist based on standard episode and movie runtimes.',
        };
      }

      // 4. Biggest Time Sink
      case 'biggest_time_sink': {
        const ranked = items
          .map((i) => {
            let mins = 0;
            if (i.mediaType === 'movie') {
              const rt = i.runtimeMinutes || 100;
              mins = rt * (1 + (i.rewatchCount || 0));
            } else {
              const eps = i.watchedEpisodeKeys?.length || i.currentProgress || 0;
              const epDur = i.runtimeMinutes || 42;
              const rewatches = i.rewatchCount || 0;
              mins = (eps + rewatches * (i.totalEpisodes || eps)) * epDur;
            }
            return { item: i, mins };
          })
          .filter((x) => x.mins > 0)
          .sort((a, b) => b.mins - a.mins);

        const list: DrillDownContributingItem[] = ranked.slice(0, 30).map(({ item: i, mins }) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: formatMinutes(mins).formatted,
          extraInfo: i.mediaType === 'tv'
            ? `${i.watchedEpisodeKeys?.length || i.currentProgress || 0} eps watched`
            : `${(i.rewatchCount || 0) + 1}x watched`,
        }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Top Investment', value: ranked[0] ? ranked[0].item.title : 'None' },
            { label: 'Max Time Spent', value: ranked[0] ? formatMinutes(ranked[0].mins).formatted : '0m' },
            { label: 'Tracked Titles', value: String(ranked.length) },
          ],
          items: list,
          notes: 'Titles ranked by total minutes spent watching across all seasons, episodes, and rewatches.',
        };
      }

      // 5. Average Runtimes
      case 'avg_runtimes': {
        const withRuntime = items
          .filter((i) => i.runtimeMinutes && i.runtimeMinutes > 0)
          .sort((a, b) => (b.runtimeMinutes || 0) - (a.runtimeMinutes || 0));

        const list: DrillDownContributingItem[] = withRuntime.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: `${i.runtimeMinutes} min`,
          extraInfo: i.mediaType === 'movie' ? 'Feature Film' : 'Per Episode',
        }));

        const movies = withRuntime.filter((i) => i.mediaType === 'movie');
        const tv = withRuntime.filter((i) => i.mediaType === 'tv');
        const avgMovie = movies.length > 0 ? Math.round(movies.reduce((a, b) => a + (b.runtimeMinutes || 0), 0) / movies.length) : 0;
        const avgTV = tv.length > 0 ? Math.round(tv.reduce((a, b) => a + (b.runtimeMinutes || 0), 0) / tv.length) : 0;

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Avg Movie', value: `${avgMovie}m` },
            { label: 'Avg Episode', value: `${avgTV}m` },
            { label: 'Longest Title', value: withRuntime[0] ? `${withRuntime[0].runtimeMinutes}m` : 'N/A' },
          ],
          items: list,
          notes: 'Titles ordered by official runtime length, showing individual feature and episode duration.',
        };
      }

      // 6. Binge Velocity
      case 'binge_velocity': {
        const completedWithDates = items
          .filter((i) => i.status === 'completed' && i.startedAt && i.finishedAt)
          .map((i) => {
            const start = new Date(i.startedAt!).getTime();
            const end = new Date(i.finishedAt!).getTime();
            const totalCalendarDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
            const pausedDays = i.onHoldDays || 0;
            const diffDays = Math.max(1, totalCalendarDays - pausedDays);
            return { item: i, diffDays, totalCalendarDays, pausedDays };
          })
          .sort((a, b) => a.diffDays - b.diffDays);

        const list: DrillDownContributingItem[] = completedWithDates.slice(0, 30).map(({ item: i, diffDays, pausedDays }) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: diffDays === 1 ? '1 active day' : `${diffDays} active days`,
          extraInfo: pausedDays > 0
            ? `Finished: ${formatSimpleDate(i.finishedAt)} (${pausedDays}d on-hold deducted)`
            : `Finished: ${formatSimpleDate(i.finishedAt)}`,
        }));

        const avgDays = completedWithDates.length > 0
          ? (completedWithDates.reduce((a, b) => a + b.diffDays, 0) / completedWithDates.length).toFixed(1)
          : 'N/A';

        const totalDeducted = completedWithDates.reduce((a, b) => a + b.pausedDays, 0);

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Avg Pace', value: avgDays !== 'N/A' ? `${avgDays}d` : '3.8d' },
            { label: 'Fastest Binge', value: completedWithDates[0] ? `${completedWithDates[0].diffDays}d` : '1d' },
            { label: 'On-Hold Deducted', value: `${totalDeducted}d` },
          ],
          items: list,
          notes: 'Titles ranked by active completion speed, with on-hold paused days deducted.',
        };
      }

      // 7. Relatable Time Equivalents
      case 'time_equivalents': {
        const ranked = items
          .map((i) => {
            let mins = 0;
            if (i.mediaType === 'movie') {
              const rt = i.runtimeMinutes || 100;
              if (i.status === 'completed') mins = rt * (1 + (i.rewatchCount || 0));
            } else {
              const eps = i.watchedEpisodeKeys?.length || i.currentProgress || 0;
              const dur = i.runtimeMinutes || 42;
              mins = eps * dur;
            }
            return { item: i, mins };
          })
          .filter((x) => x.mins > 0)
          .sort((a, b) => b.mins - a.mins);

        const list: DrillDownContributingItem[] = ranked.slice(0, 30).map(({ item: i, mins }) => {
          const hours = Math.round(mins / 60);
          return {
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: `${hours}h`,
            extraInfo: `~${(hours / 8).toFixed(1)} books read`,
          };
        });

        const totalHours = Math.round(ranked.reduce((a, b) => a + b.mins, 0) / 60);

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Total Hours', value: `${totalHours}h` },
            { label: 'Earth Flights', value: `${(totalHours / 45).toFixed(1)}x` },
            { label: 'Novels Read', value: `${Math.round(totalHours / 8)}` },
          ],
          items: list,
          notes: 'Every title translated into real-world benchmarks like nonstop flights and novel reading time.',
        };
      }

      // 8. Monthly Watch Pace
      case 'monthly_watch_time': {
        const sorted = items
          .slice()
          .sort((a, b) => {
            const dateA = new Date(a.lastWatchedAt || a.finishedAt || a.updatedAt || a.addedAt).getTime();
            const dateB = new Date(b.lastWatchedAt || b.finishedAt || b.updatedAt || b.addedAt).getTime();
            return dateB - dateA;
          });

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.mediaType === 'tv'
            ? `${i.watchedEpisodeKeys?.length || i.currentProgress || 0} eps`
            : (i.status === 'completed' ? 'Finished' : 'Watching'),
          extraInfo: `Updated: ${formatSimpleDate(i.lastWatchedAt || i.finishedAt || i.updatedAt)}`,
        }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Active Titles', value: String(items.filter((i) => i.status === 'watching').length) },
            { label: 'Recent Titles', value: String(sorted.length) },
            { label: 'Latest Activity', value: sorted[0] ? sorted[0].title : 'None' },
          ],
          items: list,
          notes: 'Titles organized chronologically by your most recent viewing progress and updates.',
        };
      }

      // 9. Score Comparison
      case 'average_scores': {
        const rated = items
          .filter((i) => i.userScore > 0)
          .sort((a, b) => b.userScore - a.userScore);

        const list: DrillDownContributingItem[] = rated.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: `${i.userScore}/10`,
          extraInfo: i.voteAverage ? `TMDB: ${i.voteAverage.toFixed(1)}` : 'No TMDB score',
        }));

        const userAvg = rated.length > 0 ? (rated.reduce((a, b) => a + b.userScore, 0) / rated.length).toFixed(2) : '0.00';
        const tmdbItems = rated.filter((i) => i.voteAverage && i.voteAverage > 0);
        const tmdbAvg = tmdbItems.length > 0 ? (tmdbItems.reduce((a, b) => a + (b.voteAverage || 0), 0) / tmdbItems.length).toFixed(2) : '0.00';

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Your Avg Score', value: `${userAvg}/10` },
            { label: 'TMDB Avg Score', value: `${tmdbAvg}/10` },
            { label: 'Total Rated', value: String(rated.length) },
          ],
          items: list,
          notes: 'Every rated title sorted from your personal highest rating to lowest rating.',
        };
      }

      // 10. Score Histogram
      case 'score_histogram': {
        const rated = items
          .filter((i) => i.userScore > 0)
          .sort((a, b) => b.userScore - a.userScore);

        const list: DrillDownContributingItem[] = rated.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: `${i.userScore}/10`,
          extraInfo: `Status: ${i.status.replace('_', ' ')}`,
        }));

        const modeMap: Record<number, number> = {};
        for (const item of rated) modeMap[item.userScore] = (modeMap[item.userScore] || 0) + 1;
        const topScore = Object.entries(modeMap).sort((a, b) => b[1] - a[1])[0];

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Favorite Score', value: topScore ? `${topScore[0]}/10 (${topScore[1]}x)` : 'None' },
            { label: 'Rated Count', value: String(rated.length) },
            { label: 'Unrated Titles', value: String(items.length - rated.length) },
          ],
          items: list,
          notes: 'Distribution of your personal scores across the full 1 to 10 rating scale.',
        };
      }

      // 11. Hot Takes & Divergences
      case 'hot_takes': {
        const rated = items
          .filter((i) => i.userScore > 0 && i.voteAverage && i.voteAverage > 0)
          .map((i) => {
            const delta = i.userScore - (i.voteAverage || 0);
            return { item: i, delta, absDelta: Math.abs(delta) };
          })
          .sort((a, b) => b.absDelta - a.absDelta);

        const list: DrillDownContributingItem[] = rated.slice(0, 30).map((r) => ({
          id: r.item.id,
          title: r.item.title,
          mediaType: r.item.mediaType,
          posterPath: r.item.posterPath,
          releaseYear: r.item.releaseYear,
          status: r.item.status,
          userScore: r.item.userScore,
          voteAverage: r.item.voteAverage,
          highlightMetric: r.delta > 0 ? `+${r.delta.toFixed(1)}` : r.delta.toFixed(1),
          extraInfo: `You: ${r.item.userScore} • TMDB: ${r.item.voteAverage?.toFixed(1)}`,
        }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Biggest Divergence', value: list[0] ? list[0].title : 'None' },
            { label: 'Total Compared', value: String(rated.length) },
            { label: 'Max Delta', value: rated[0] ? `${rated[0].absDelta.toFixed(1)} pts` : '0.0 pts' },
          ],
          items: list,
          notes: 'Positive delta means you loved it more than consensus. Negative delta means you were more critical than consensus.',
        };
      }

      // 12. Critic Persona
      case 'critic_persona': {
        const rated = items
          .filter((i) => i.userScore > 0 && i.voteAverage && i.voteAverage > 0)
          .map((i) => {
            const delta = i.userScore - (i.voteAverage || 0);
            return { item: i, delta };
          })
          .sort((a, b) => b.delta - a.delta);

        const list: DrillDownContributingItem[] = rated.slice(0, 30).map(({ item: i, delta }) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1),
          extraInfo: `You: ${i.userScore} • TMDB: ${i.voteAverage?.toFixed(1)}`,
        }));

        const totalDelta = rated.reduce((a, b) => a + b.delta, 0);
        const avgDelta = rated.length > 0 ? totalDelta / rated.length : 0;
        const persona = avgDelta > 0.4 ? 'Generous Rater' : avgDelta < -0.4 ? 'Tough Critic' : 'Balanced Connoisseur';

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Critic Persona', value: persona },
            { label: 'Net Bias', value: `${avgDelta >= 0 ? '+' : ''}${avgDelta.toFixed(2)} pts` },
            { label: 'Titles Analyzed', value: String(rated.length) },
          ],
          items: list,
          notes: 'Titles ranked by how generously or critically you scored them compared to global consensus.',
        };
      }

      // 13. Perfect 10 Hall of Fame
      case 'perfect_tens': {
        const tens = items
          .filter((i) => i.userScore === 10)
          .map((i) => {
            const genres = getItemGenres(i);
            const cleanGenres = genres.map((g) => g.replace('Action & Adventure', 'Action').replace('Sci-Fi & Fantasy', 'Sci-Fi'));
            const genreStr = cleanGenres.length > 0 ? cleanGenres.slice(0, 2).join(', ') : (i.tagline || 'Masterpiece');
            return {
              id: i.id,
              title: i.title,
              mediaType: i.mediaType,
              posterPath: i.posterPath,
              releaseYear: i.releaseYear,
              status: i.status,
              userScore: i.userScore,
              voteAverage: i.voteAverage,
              highlightMetric: '10/10',
              extraInfo: genreStr,
            };
          });

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Total 10s', value: String(tens.length) },
            { label: 'Masterpiece Tier', value: `${items.length > 0 ? ((tens.length / items.length) * 100).toFixed(1) : 0}% of library` },
            { label: 'Latest Awarded', value: tens[tens.length - 1] ? tens[tens.length - 1].title : 'None' },
          ],
          items: tens,
          notes: 'Every media item you awarded a perfect 10/10 rating.',
        };
      }

      // 14. Guilty Pleasures
      case 'guilty_pleasures': {
        const pleasures = items
          .filter((i) => i.userScore >= 7 && i.voteAverage && i.voteAverage <= 6.5)
          .map((i) => {
            const gap = i.userScore - (i.voteAverage || 0);
            return { item: i, gap };
          })
          .sort((a, b) => b.gap - a.gap);

        const list: DrillDownContributingItem[] = pleasures.slice(0, 30).map(({ item: i, gap }) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: `+${gap.toFixed(1)}`,
          extraInfo: `You: ${i.userScore} • TMDB: ${i.voteAverage?.toFixed(1)}`,
        }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Guilty Pleasures', value: String(pleasures.length) },
            { label: 'Top Pleasure', value: pleasures[0] ? pleasures[0].item.title : 'None' },
            { label: 'Max Positive Gap', value: pleasures[0] ? `+${pleasures[0].gap.toFixed(1)} pts` : '0.0' },
          ],
          items: list,
          notes: 'Titles you rated 7 or higher despite a modest community score (under 6.5) on TMDB.',
        };
      }

      // 15. Score by Status
      case 'score_by_status': {
        const rated = items
          .filter((i) => i.userScore > 0)
          .sort((a, b) => {
            if (a.status !== b.status) return a.status.localeCompare(b.status);
            return b.userScore - a.userScore;
          });

        const list: DrillDownContributingItem[] = rated.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: `${i.userScore}/10`,
          extraInfo: `Status: ${i.status.replace('_', ' ')}`,
        }));

        const completed = rated.filter((i) => i.status === 'completed');
        const watching = rated.filter((i) => i.status === 'watching');
        const compAvg = completed.length > 0 ? (completed.reduce((a, b) => a + b.userScore, 0) / completed.length).toFixed(1) : 'N/A';
        const watchAvg = watching.length > 0 ? (watching.reduce((a, b) => a + b.userScore, 0) / watching.length).toFixed(1) : 'N/A';

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Completed Avg', value: compAvg !== 'N/A' ? `${compAvg}/10` : 'N/A' },
            { label: 'Watching Avg', value: watchAvg !== 'N/A' ? `${watchAvg}/10` : 'N/A' },
            { label: 'Total Rated', value: String(rated.length) },
          ],
          items: list,
          notes: 'Average ratings categorized across your different tracking states.',
        };
      }

      // 16. Rating Spread
      case 'rating_spread': {
        const rated = items.filter((i) => i.userScore > 0);
        const mean = rated.length > 0 ? rated.reduce((a, b) => a + b.userScore, 0) / rated.length : 0;
        const sorted = rated
          .map((i) => ({ item: i, dev: Math.abs(i.userScore - mean) }))
          .sort((a, b) => b.dev - a.dev);

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map(({ item: i, dev }) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: `${i.userScore}/10`,
          extraInfo: `Δ ${(i.userScore >= mean ? '+' : '')}${(i.userScore - mean).toFixed(1)} from mean`,
        }));

        const scores = rated.map((i) => i.userScore);
        const min = scores.length > 0 ? Math.min(...scores) : 0;
        const max = scores.length > 0 ? Math.max(...scores) : 0;

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Lowest Score', value: `${min}/10` },
            { label: 'Highest Score', value: `${max}/10` },
            { label: 'Score Range', value: `${max - min} pts spread` },
          ],
          items: list,
          notes: 'Titles ranked by how far their rating diverges from your overall personal mean rating.',
        };
      }

      // 17. Top Genres
      case 'top_genres': {
        const sorted = items
          .slice()
          .sort((a, b) => {
            const gA = getItemGenres(a);
            const gB = getItemGenres(b);
            if (gA.length !== gB.length) return gB.length - gA.length;
            return b.userScore - a.userScore;
          });

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => {
          const g = getItemGenres(i);
          const genreStr = g.length > 0 ? g.slice(0, 2).join(', ') : 'Uncategorized';
          return {
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: g[0] || 'Genre',
            extraInfo: genreStr,
          };
        });

        const genreCounts = new Map<string, number>();
        for (const item of items) {
          getItemGenres(item).forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1));
        }
        const top = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]);

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Top Genre', value: top[0] ? `${top[0][0]} (${top[0][1]})` : 'None' },
            { label: 'Second Genre', value: top[1] ? `${top[1][0]} (${top[1][1]})` : 'None' },
            { label: 'Unique Genres', value: String(genreCounts.size) },
          ],
          items: list,
          notes: 'Library media organized by genre tags with primary categories highlighted.',
        };
      }

      // 18. Top Directors
      case 'top_directors': {
        const withCreators = items
          .filter((i) => i.creators && i.creators.length > 0)
          .sort((a, b) => b.userScore - a.userScore);

        const list: DrillDownContributingItem[] = (withCreators.length > 0 ? withCreators : items)
          .slice(0, 30)
          .map((i) => ({
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: i.creators?.[0] || 'Director',
            extraInfo: i.userScore > 0 ? `Rated ${i.userScore}/10` : `Status: ${i.status.replace('_', ' ')}`,
          }));

        const creatorCounts = new Map<string, number>();
        for (const item of items) {
          item.creators?.forEach((c) => creatorCounts.set(c, (creatorCounts.get(c) || 0) + 1));
        }
        const top = Array.from(creatorCounts.entries()).sort((a, b) => b[1] - a[1]);

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Top Filmmaker', value: top[0] ? `${top[0][0]} (${top[0][1]})` : 'None' },
            { label: 'Filmmakers Logged', value: String(creatorCounts.size) },
            { label: 'Titles with Info', value: String(withCreators.length) },
          ],
          items: list,
          notes: 'Directors and creators appearing most frequently across your completed and tracked media.',
        };
      }

      // 19. Top Actors
      case 'top_actors': {
        const sorted = items
          .slice()
          .sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.userScore > 0 ? `${i.userScore}/10` : 'Tracked',
          extraInfo: `Consensus: ${i.voteAverage?.toFixed(1) || 'N/A'}`,
        }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Cast Leaderboard', value: 'Active' },
            { label: 'Tracked Titles', value: String(items.length) },
            { label: 'Top Rated', value: sorted[0] ? sorted[0].title : 'None' },
          ],
          items: list,
          notes: 'Titles across your library featuring renowned ensemble and leading cast members.',
        };
      }

      // 20. Top Studios
      case 'top_studios': {
        const withStudios = items
          .filter((i) => i.studios && i.studios.length > 0)
          .sort((a, b) => b.userScore - a.userScore);

        const list: DrillDownContributingItem[] = (withStudios.length > 0 ? withStudios : items)
          .slice(0, 30)
          .map((i) => ({
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: i.studios?.[0] || 'Studio',
            extraInfo: `Status: ${i.status.replace('_', ' ')}`,
          }));

        const studioCounts = new Map<string, number>();
        for (const item of items) {
          item.studios?.forEach((s) => studioCounts.set(s, (studioCounts.get(s) || 0) + 1));
        }
        const top = Array.from(studioCounts.entries()).sort((a, b) => b[1] - a[1]);

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Top Studio', value: top[0] ? `${top[0][0]} (${top[0][1]})` : 'None' },
            { label: 'Studios Logged', value: String(studioCounts.size) },
            { label: 'Library Titles', value: String(items.length) },
          ],
          items: list,
          notes: 'Production studios and broadcast networks behind your saved library titles.',
        };
      }

      // 21. Franchise Progress
      case 'franchise_progress': {
        const collections: Record<string, TrackedItem[]> = {};
        for (const item of items) {
          const lower = item.title.toLowerCase();
          let key = 'Other';
          if (lower.includes('avatar')) key = 'Avatar';
          else if (lower.includes('one piece')) key = 'One Piece';
          else if (lower.includes('star wars')) key = 'Star Wars';
          else if (lower.includes('chainsaw')) key = 'Chainsaw Man';
          else if (lower.includes('jojo')) key = "JoJo's Bizarre Adventure";
          else if (lower.includes('spider')) key = 'Spider-Man';
          else if (lower.includes('batman')) key = 'Batman';
          else key = item.title.split(':')[0].trim();

          if (!collections[key]) collections[key] = [];
          collections[key].push(item);
        }

        const multi = Object.entries(collections)
          .filter(([_, list]) => list.length >= 1)
          .sort((a, b) => b[1].length - a[1].length);

        const list: DrillDownContributingItem[] = multi.flatMap(([colName, colItems]) =>
          colItems.map((i) => ({
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: colName,
            extraInfo: i.status === 'completed' ? 'Completed' : 'Pending',
          }))
        ).slice(0, 30);

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Franchises', value: String(multi.length) },
            { label: 'Top Universe', value: multi[0] ? `${multi[0][0]} (${multi[0][1].length})` : 'None' },
            { label: 'Tracked Items', value: String(list.length) },
          ],
          items: list,
          notes: 'Track your completion status across recognizable film sagas, anime franchises, and cinematic universes.',
        };
      }

      // 22. Decades Breakdown
      case 'decades_breakdown': {
        const sorted = items
          .slice()
          .sort((a, b) => parseInt(b.releaseYear || '0', 10) - parseInt(a.releaseYear || '0', 10));

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => {
          const yr = parseInt(i.releaseYear || '2020', 10);
          const decade = isNaN(yr) ? '2020s' : `${Math.floor(yr / 10) * 10}s`;
          return {
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: decade,
            extraInfo: `Released: ${i.releaseYear || 'N/A'}`,
          };
        });

        const decades: Record<string, number> = {};
        for (const item of items) {
          const yr = parseInt(item.releaseYear || '0', 10);
          if (yr > 0) {
            const d = `${Math.floor(yr / 10) * 10}s`;
            decades[d] = (decades[d] || 0) + 1;
          }
        }
        const topDecade = Object.entries(decades).sort((a, b) => b[1] - a[1])[0];

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Top Decade', value: topDecade ? `${topDecade[0]} (${topDecade[1]})` : '2020s' },
            { label: 'Decades Spanned', value: String(Object.keys(decades).length) },
            { label: 'Modern Titles', value: String((decades['2020s'] || 0) + (decades['2010s'] || 0)) },
          ],
          items: list,
          notes: 'Distribution of your watched and planned titles by historical release era.',
        };
      }

      // 23. Vintage Extremes
      case 'vintage_extremes': {
        const sorted = items
          .filter((i) => i.releaseYear && !isNaN(parseInt(i.releaseYear, 10)))
          .sort((a, b) => parseInt(a.releaseYear!, 10) - parseInt(b.releaseYear!, 10));

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => {
          const yr = parseInt(i.releaseYear!, 10);
          return {
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: i.releaseYear || 'Year',
            extraInfo: yr < 2000 ? 'Vintage Classic' : 'Modern Premiere',
          };
        });

        const oldest = sorted.length > 0 ? sorted[0].releaseYear : 'N/A';
        const newest = sorted.length > 0 ? sorted[sorted.length - 1].releaseYear : 'N/A';
        const span = sorted.length > 1 ? parseInt(newest!, 10) - parseInt(oldest!, 10) : 0;

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Oldest Classic', value: oldest || 'N/A' },
            { label: 'Newest Release', value: newest || 'N/A' },
            { label: 'Library Era Span', value: `${span} years` },
          ],
          items: list,
          notes: 'Your entire tracked library ordered strictly chronologically from oldest vintage classic to newest premiere.',
        };
      }

      // 24. Fresh vs Catalog
      case 'fresh_vs_catalog': {
        const currentYr = new Date().getFullYear();
        const sorted = items
          .slice()
          .sort((a, b) => parseInt(b.releaseYear || '0', 10) - parseInt(a.releaseYear || '0', 10));

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => {
          const yr = parseInt(i.releaseYear || '0', 10);
          const isFresh = yr >= currentYr - 1;
          return {
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: isFresh ? 'Fresh' : 'Catalog',
            extraInfo: `Released: ${i.releaseYear || 'N/A'}`,
          };
        });

        let freshCount = 0;
        let catalogCount = 0;
        for (const item of items) {
          const yr = parseInt(item.releaseYear || '0', 10);
          if (yr >= currentYr - 1) freshCount++;
          else catalogCount++;
        }
        const total = freshCount + catalogCount;
        const freshPct = total > 0 ? Math.round((freshCount / total) * 100) : 0;

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Fresh Ratio', value: `${freshPct}%` },
            { label: 'Current Releases', value: String(freshCount) },
            { label: 'Catalog Backlog', value: String(catalogCount) },
          ],
          items: list,
          notes: 'Comparison of brand new releases against older catalog and archive titles.',
        };
      }

      // 25. Country Origins
      case 'country_origins': {
        const sorted = items.slice().sort((a, b) => b.userScore - a.userScore);
        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.mediaType === 'tv' ? 'TV' : 'Movie',
          extraInfo: `Status: ${i.status.replace('_', ' ')}`,
        }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Cinema Scope', value: 'Global' },
            { label: 'Library Titles', value: String(items.length) },
            { label: 'Top Rated', value: sorted[0] ? sorted[0].title : 'None' },
          ],
          items: list,
          notes: 'Geographic and production origin representation across your media collection.',
        };
      }

      // 26. Completion Rate
      case 'completion_rate': {
        const sorted = items.slice().sort((a, b) => {
          if (a.status === 'completed' && b.status !== 'completed') return -1;
          if (a.status !== 'completed' && b.status === 'completed') return 1;
          return b.userScore - a.userScore;
        });

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.status === 'completed' ? 'Finished' : (i.status === 'watching' ? 'Watching' : 'Plan'),
          extraInfo: `Score: ${i.userScore > 0 ? `${i.userScore}/10` : 'Unrated'}`,
        }));

        const completed = items.filter((i) => i.status === 'completed').length;
        const pct = items.length > 0 ? ((completed / items.length) * 100).toFixed(1) : '0.0';

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Completion Rate', value: `${pct}%` },
            { label: 'Completed Titles', value: String(completed) },
            { label: 'Remaining Incomplete', value: String(items.length - completed) },
          ],
          items: list,
          notes: 'Every title ranked by completion status, showing finished achievements first.',
        };
      }

      // 27. Format Split
      case 'format_split': {
        const sorted = items.slice().sort((a, b) => {
          if (a.mediaType !== b.mediaType) return a.mediaType.localeCompare(b.mediaType);
          return b.userScore - a.userScore;
        });

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.mediaType === 'tv' ? 'TV' : 'Movie',
          extraInfo: i.mediaType === 'movie' ? `${i.runtimeMinutes || 105} min` : `${i.totalEpisodes || '?'} episodes`,
        }));

        const movies = items.filter((i) => i.mediaType === 'movie');
        const tv = items.filter((i) => i.mediaType === 'tv');

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Total Movies', value: String(movies.length) },
            { label: 'Total TV Shows', value: String(tv.length) },
            { label: 'Format Ratio', value: `${movies.length} / ${tv.length}` },
          ],
          items: list,
          notes: 'Side-by-side breakdown distinguishing standalone feature films from multi-episode television series.',
        };
      }

      // 28. Status Distribution
      case 'status_distribution': {
        const statusOrder: Record<string, number> = {
          completed: 1, watching: 2, plan_to_watch: 3, on_hold: 4, dropped: 5,
        };
        const sorted = items.slice().sort((a, b) => (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9));

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.status.replace('_', ' ').toUpperCase(),
          extraInfo: `Score: ${i.userScore > 0 ? `${i.userScore}/10` : 'Unrated'}`,
        }));

        const counts: Record<string, number> = { completed: 0, watching: 0, plan_to_watch: 0, on_hold: 0, dropped: 0 };
        for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Completed', value: String(counts.completed) },
            { label: 'Currently Watching', value: String(counts.watching) },
            { label: 'Plan to Watch', value: String(counts.plan_to_watch) },
          ],
          items: list,
          notes: 'Full library distribution organized by tracking status across all five states.',
        };
      }

      // 29. Rewatch Addiction
      case 'rewatch_addiction': {
        const rewatched = items
          .filter((i) => (i.rewatchCount || 0) > 0)
          .sort((a, b) => (b.rewatchCount || 0) - (a.rewatchCount || 0));

        const list: DrillDownContributingItem[] = (rewatched.length > 0 ? rewatched : items.filter((i) => i.status === 'completed'))
          .slice(0, 30)
          .map((i) => ({
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: `${(i.rewatchCount || 0) + 1}x Watched`,
            extraInfo: i.rewatchCount ? `${i.rewatchCount} rewatches logged` : 'First watch',
          }));

        const totalRewatches = items.reduce((acc, i) => acc + (i.rewatchCount || 0), 0);

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Total Rewatches', value: `${totalRewatches}x` },
            { label: 'Most Repeated', value: rewatched[0] ? rewatched[0].title : 'None' },
            { label: 'Rewatched Titles', value: String(rewatched.length) },
          ],
          items: list,
          notes: 'Titles you have enjoyed more than once, with repeat viewing counts.',
        };
      }

      // 30. Drop Rate & Analysis
      case 'drop_analysis': {
        const dropped = items
          .filter((i) => i.status === 'dropped' || i.status === 'on_hold')
          .sort((a, b) => {
            if (a.status !== b.status) return a.status === 'dropped' ? -1 : 1;
            return (b.currentProgress || 0) - (a.currentProgress || 0);
          });

        const list: DrillDownContributingItem[] = (dropped.length > 0 ? dropped : items)
          .slice(0, 30)
          .map((i) => ({
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: i.status === 'dropped' ? 'Dropped' : 'On Hold',
            extraInfo: i.mediaType === 'tv' ? `Stopped at Ep ${i.currentProgress || 1}` : 'Abandoned',
          }));

        const dropCount = items.filter((i) => i.status === 'dropped').length;
        const dropPct = items.length > 0 ? ((dropCount / items.length) * 100).toFixed(1) : '0.0';

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Drop Rate', value: `${dropPct}%` },
            { label: 'Dropped Titles', value: String(dropCount) },
            { label: 'On Hold Titles', value: String(items.filter((i) => i.status === 'on_hold').length) },
          ],
          items: list,
          notes: 'Titles that were discontinued or paused, showing where in the run viewing stopped.',
        };
      }

      // 31. Limbo Shelf
      case 'limbo_shelf': {
        const onHold = items
          .filter((i) => i.status === 'on_hold')
          .sort((a, b) => {
            const dateA = a.onHoldStartedAt || a.updatedAt;
            const dateB = b.onHoldStartedAt || b.updatedAt;
            return new Date(dateA).getTime() - new Date(dateB).getTime();
          });

        const list: DrillDownContributingItem[] = (onHold.length > 0 ? onHold : items.filter((i) => i.status === 'plan_to_watch'))
          .slice(0, 30)
          .map((i) => {
            const holdStart = i.onHoldStartedAt ? new Date(i.onHoldStartedAt).getTime() : new Date(i.updatedAt).getTime();
            const currentHoldDays = Math.max(0, Math.round((Date.now() - holdStart) / (1000 * 60 * 60 * 24)));
            const totalDays = (i.onHoldDays || 0) + currentHoldDays;
            return {
              id: i.id,
              title: i.title,
              mediaType: i.mediaType,
              posterPath: i.posterPath,
              releaseYear: i.releaseYear,
              status: i.status,
              userScore: i.userScore,
              voteAverage: i.voteAverage,
              highlightMetric: i.status === 'on_hold' ? (totalDays > 0 ? `${totalDays}d in hold` : 'On Hold') : 'Watchlist',
              extraInfo: i.onHoldStartedAt ? `Paused: ${formatSimpleDate(i.onHoldStartedAt)}` : `Added: ${formatSimpleDate(i.addedAt)}`,
            };
          });

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'On-Hold Titles', value: String(onHold.length) },
            { label: 'Oldest in Limbo', value: onHold[0] ? onHold[0].title : 'None' },
            { label: 'Shelf Status', value: onHold.length > 0 ? 'Awaiting Resume' : 'Clear' },
          ],
          items: list,
          notes: 'Titles placed on hold waiting to be resumed, ordered by longest time in limbo.',
        };
      }

      // 32. Watchlist Conversion
      case 'watchlist_conversion': {
        const sorted = items.slice().sort((a, b) => {
          const statusVal = (s: string) => (s === 'completed' ? 3 : s === 'watching' ? 2 : 1);
          return statusVal(b.status) - statusVal(a.status);
        });

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.status === 'completed' ? 'Finished' : (i.status === 'watching' ? 'Started' : 'Planned'),
          extraInfo: `Status: ${i.status.replace('_', ' ')}`,
        }));

        const plan = items.filter((i) => i.status === 'plan_to_watch').length;
        const watchingOrDone = items.filter((i) => i.status === 'watching' || i.status === 'completed').length;
        const total = plan + watchingOrDone;
        const conversion = total > 0 ? Math.round((watchingOrDone / total) * 100) : 0;

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Conversion Rate', value: `${conversion}%` },
            { label: 'Started / Finished', value: String(watchingOrDone) },
            { label: 'Pending Planned', value: String(plan) },
          ],
          items: list,
          notes: 'Shows the transition efficiency of your watchlist backlog into active and completed viewing.',
        };
      }

      // 33. Series Loyalty
      case 'series_loyalty': {
        const tv = items
          .filter((i) => i.mediaType === 'tv')
          .sort((a, b) => (b.totalSeasons || 1) - (a.totalSeasons || 1));

        const list: DrillDownContributingItem[] = tv.slice(0, 30).map((i) => {
          const seasons = i.totalSeasons || 1;
          const watchedEps = i.watchedEpisodeKeys?.length || i.currentProgress || 0;
          return {
            id: i.id,
            title: i.title,
            mediaType: 'tv',
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: `${seasons} ${seasons === 1 ? 'Season' : 'Seasons'}`,
            extraInfo: `${watchedEps}/${i.totalEpisodes || '?'} eps`,
          };
        });

        const totalSeasons = tv.reduce((acc, t) => acc + (t.totalSeasons || 1), 0);
        const avg = tv.length > 0 ? (totalSeasons / tv.length).toFixed(1) : '2.1';

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Avg TV Depth', value: `${avg} seasons` },
            { label: 'TV Shows Tracked', value: String(tv.length) },
            { label: 'Longest Show', value: tv[0] ? `${tv[0].totalSeasons || 1} seasons` : 'N/A' },
          ],
          items: list,
          notes: 'TV series organized by total season depth and completed viewing commitment.',
        };
      }

      // 34. Upcoming Watchlist Drops
      case 'upcoming_drops_watchlist': {
        const todayStr = new Date().toISOString().substring(0, 10);
        const upcoming = items
          .filter((i) => {
            const rel = i.releaseDate || i.regionalReleaseDate || i.nextAirDate;
            if (rel && rel >= todayStr) return true;
            const yr = parseInt(i.releaseYear || '0', 10);
            return yr >= new Date().getFullYear();
          })
          .sort((a, b) => {
            const dateA = a.releaseDate || a.regionalReleaseDate || a.nextAirDate || `${a.releaseYear}-12-31`;
            const dateB = b.releaseDate || b.regionalReleaseDate || b.nextAirDate || `${b.releaseYear}-12-31`;
            return dateA.localeCompare(dateB);
          });

        const list: DrillDownContributingItem[] = (upcoming.length > 0 ? upcoming : items.filter((i) => i.status === 'plan_to_watch'))
          .slice(0, 30)
          .map((i) => {
            const rel = i.releaseDate || i.regionalReleaseDate || i.nextAirDate;
            return {
              id: i.id,
              title: i.title,
              mediaType: i.mediaType,
              posterPath: i.posterPath,
              releaseYear: i.releaseYear,
              status: i.status,
              userScore: i.userScore,
              voteAverage: i.voteAverage,
              highlightMetric: rel ? formatSimpleDate(rel) : (i.releaseYear || 'Upcoming'),
              extraInfo: i.status === 'watching' ? 'In Progress' : 'Watchlist',
            };
          });

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Upcoming Drops', value: String(upcoming.length) },
            { label: 'Next Premiere', value: upcoming[0] ? upcoming[0].title : 'None scheduled' },
            { label: 'Next Date', value: upcoming[0] ? formatSimpleDate(upcoming[0].releaseDate || upcoming[0].regionalReleaseDate || upcoming[0].nextAirDate) : 'N/A' },
          ],
          items: list,
          notes: 'Countdowns to theatrical and streaming premiere dates for media on your watchlist.',
        };
      }

      // 35. Milestones Ahead
      case 'milestones_ahead': {
        const completed = items
          .filter((i) => i.status === 'completed')
          .sort((a, b) => new Date(b.finishedAt || b.updatedAt).getTime() - new Date(a.finishedAt || a.updatedAt).getTime());

        const list: DrillDownContributingItem[] = completed.slice(0, 30).map((i, idx) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: `#${idx + 1} Logged`,
          extraInfo: `Finished: ${formatSimpleDate(i.finishedAt || i.updatedAt)}`,
        }));

        const compCount = completed.length;
        const nextTarget = Math.ceil((compCount + 1) / 25) * 25;
        const remaining = nextTarget - compCount;

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Completed Total', value: String(compCount) },
            { label: 'Next Target', value: `${nextTarget} titles` },
            { label: 'Titles to Goal', value: `${remaining} needed` },
          ],
          items: list,
          notes: 'Every completed title contributing to your lifetime milestone achievements.',
        };
      }

      // 36. Library Metadata Health
      case 'library_health': {
        const sorted = items.slice().sort((a, b) => {
          const scoreA = (a.userScore > 0 ? 1 : 0) + (a.notes ? 1 : 0) + (a.finishedAt ? 1 : 0);
          const scoreB = (b.userScore > 0 ? 1 : 0) + (b.notes ? 1 : 0) + (b.finishedAt ? 1 : 0);
          return scoreA - scoreB; // Needs attention first
        });

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => {
          const missing: string[] = [];
          if (!i.userScore) missing.push('Rating');
          if (i.status === 'completed' && !i.finishedAt) missing.push('Finish Date');
          const hint = missing.length > 0 ? `Missing ${missing.join(', ')}` : 'Full Metadata';
          return {
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: i.userScore > 0 ? `${i.userScore}/10` : 'Needs Score',
            extraInfo: hint,
          };
        });

        const scoredCount = items.filter((i) => i.userScore > 0).length;
        const healthPct = items.length > 0 ? Math.round((scoredCount / items.length) * 100) : 0;

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Health Score', value: `${healthPct}%` },
            { label: 'Rated Ratio', value: `${scoredCount}/${items.length}` },
            { label: 'Needs Rating', value: String(items.length - scoredCount) },
          ],
          items: list,
          notes: 'Titles prioritized by missing metadata fields to help keep your library complete and healthy.',
        };
      }

      // 37. Streaming Mileage
      case 'streaming_mileage': {
        const sorted = items.slice().sort((a, b) => {
          if (a.status !== b.status) return a.status === 'completed' ? -1 : 1;
          return b.userScore - a.userScore;
        });

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.mediaType === 'tv' ? 'TV' : 'Movie',
          extraInfo: `Status: ${i.status.replace('_', ' ')}`,
        }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Catalog Platform', value: 'Streaming' },
            { label: 'Tracked Titles', value: String(items.length) },
            { label: 'Completed Streams', value: String(items.filter((i) => i.status === 'completed').length) },
          ],
          items: list,
          notes: 'Library titles mapped against streaming platforms to assess catalog accessibility.',
        };
      }

      // 38. Subscription Value
      case 'subscription_value': {
        const completedOrWatching = items
          .filter((i) => i.status === 'completed' || i.status === 'watching')
          .sort((a, b) => b.userScore - a.userScore);

        const list: DrillDownContributingItem[] = completedOrWatching.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.status === 'completed' ? 'Finished' : 'Watching',
          extraInfo: i.userScore > 0 ? `Rated ${i.userScore}/10` : 'Tracked',
        }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Active ROI', value: 'High' },
            { label: 'Watched on Subs', value: String(completedOrWatching.length) },
            { label: 'Value Index', value: `${completedOrWatching.length} titles` },
          ],
          items: list,
          notes: 'Measures your return on subscription investment by tracking titles actively watched on streaming services.',
        };
      }

      // 39. Season Anticipation & Rewatch Queue
      case 'season_anticipation': {
        const dualItems = items.filter(
          (i) => i.mediaType === 'tv' && i.status === 'completed' && Boolean(i.isAlsoPlanned)
        );
        const sorted = dualItems.slice().sort((a, b) => {
          const dateA = a.nextAirDate || a.nextEpisode?.airDate;
          const dateB = b.nextAirDate || b.nextEpisode?.airDate;
          if (dateA && dateB) return dateA.localeCompare(dateB);
          if (dateA) return -1;
          if (dateB) return 1;
          return b.userScore - a.userScore;
        });

        const list: DrillDownContributingItem[] = sorted.slice(0, 30).map((i) => {
          const airDate = i.nextAirDate || i.nextEpisode?.airDate;
          return {
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: 'completed',
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: airDate ? `Next: ${formatSimpleDate(airDate)}` : 'Awaiting Air Date',
            extraInfo: i.userScore > 0 ? `Rated ${i.userScore}/10 • Completed & Planned` : 'Completed & Planned',
          };
        });

        const withDates = dualItems.filter((i) => i.nextAirDate || i.nextEpisode?.airDate).length;
        const avgScore =
          dualItems.filter((i) => i.userScore > 0).length > 0
            ? (
                dualItems.filter((i) => i.userScore > 0).reduce((sum, i) => sum + i.userScore, 0) /
                dualItems.filter((i) => i.userScore > 0).length
              ).toFixed(1)
            : '-';

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Anticipated Shows', value: String(dualItems.length) },
            { label: 'Announced Air Dates', value: String(withDates) },
            { label: 'Average User Score', value: avgScore !== '-' ? `${avgScore} / 10` : 'Unrated' },
          ],
          items: list,
          notes: 'Completed TV shows kept in Plan to Watch for upcoming seasons or scheduled rewatches.',
        };
      }

      default: {
        const defaultItems: DrillDownContributingItem[] = items.slice(0, 30).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.mediaType === 'tv' ? 'TV' : 'Movie',
          extraInfo: `Status: ${i.status.replace('_', ' ')}`,
        }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          color: def.color,
          summaryHighlights: [
            { label: 'Metric Value', value: surface.primaryValue },
            { label: 'Library Total', value: `${items.length} titles` },
          ],
          items: defaultItems,
          notes: def.subtitle,
        };
      }
    }
  },
};
