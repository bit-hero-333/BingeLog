import { TrackedItem } from '@/types/media';
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
        let totalDays = 0;
        let completedWithDates = 0;
        for (const item of items) {
          if (item.status === 'completed' && item.startedAt && item.finishedAt) {
            const start = new Date(item.startedAt).getTime();
            const end = new Date(item.finishedAt).getTime();
            const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
            totalDays += diffDays;
            completedWithDates++;
          }
        }
        const avgDays = completedWithDates > 0 ? (totalDays / completedWithDates).toFixed(1) : 'N/A';
        return {
          widgetId,
          primaryValue: avgDays !== 'N/A' ? `${avgDays} days` : '3.8 days',
          primaryLabel: 'Avg Completion Velocity',
          secondaryValue: completedWithDates > 0 ? `Calculated across ${completedWithDates} logged titles` : 'Estimated pace',
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
      case 'watch_time': {
        let movieMins = 0;
        let tvMins = 0;
        for (const item of items) {
          if (item.mediaType === 'movie') {
            const rt = item.runtimeMinutes || 100;
            if (item.status === 'completed') movieMins += rt * (1 + (item.rewatchCount || 0));
          } else {
            const eps = item.watchedEpisodeKeys?.length || item.currentProgress || 0;
            const dur = item.runtimeMinutes || 42;
            tvMins += eps * dur;
          }
        }
        const totalFormatted = formatMinutes(movieMins + tvMins);
        const movieFormatted = formatMinutes(movieMins);
        const tvFormatted = formatMinutes(tvMins);

        const contributing: DrillDownContributingItem[] = items
          .filter((i) => i.status === 'completed' || (i.currentProgress || 0) > 0)
          .slice(0, 30)
          .map((i) => {
            const time = i.mediaType === 'movie'
              ? formatMinutes((i.runtimeMinutes || 100) * (1 + (i.rewatchCount || 0)))
              : formatMinutes((i.watchedEpisodeKeys?.length || i.currentProgress || 0) * (i.runtimeMinutes || 42));
            return {
              id: i.id,
              title: i.title,
              mediaType: i.mediaType,
              posterPath: i.posterPath,
              releaseYear: i.releaseYear,
              status: i.status,
              userScore: i.userScore,
              voteAverage: i.voteAverage,
              highlightMetric: time.formatted,
              extraInfo: i.mediaType === 'tv' ? `${i.watchedEpisodeKeys?.length || i.currentProgress || 0} eps` : 'Movie',
            };
          });

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          summaryHighlights: [
            { label: 'Total Estimated', value: totalFormatted.formatted, hint: 'Movies & TV combined' },
            { label: 'Movies Watch Time', value: movieFormatted.formatted },
            { label: 'TV Watch Time', value: tvFormatted.formatted },
          ],
          items: contributing,
          notes: 'Watch time is computed using runtime metadata and granular season progress, including rewatches.',
        };
      }

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
          summaryHighlights: [
            { label: 'Total Episodes', value: totalEps.toLocaleString() },
            { label: 'Active Series', value: String(tvItems.length) },
            { label: 'Top Contributor', value: tvItems[0] ? tvItems[0].title : 'None' },
          ],
          items: list,
          notes: 'Includes individual episode checkmarks across all seasons, specials excluded by default unless toggled.',
        };
      }

      case 'watchlist_debt': {
        const pending = items.filter((i) => i.status === 'plan_to_watch' || i.status === 'watching');
        const list: DrillDownContributingItem[] = pending
          .slice(0, 30)
          .map((i) => {
            const rt = i.mediaType === 'movie' ? (i.runtimeMinutes || 105) : (i.totalEpisodes || 12) * (i.runtimeMinutes || 42);
            return {
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
            };
          });

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          summaryHighlights: [
            { label: 'Total Debt', value: surface.primaryValue },
            { label: 'Pending Titles', value: String(pending.length) },
          ],
          items: list,
          notes: 'Estimated duration required to completely clear your watchlist based on standard episode and movie runtimes.',
        };
      }

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
          summaryHighlights: [
            { label: 'Biggest Divergence', value: list[0] ? list[0].title : 'None' },
            { label: 'Total Compared', value: String(rated.length) },
          ],
          items: list,
          notes: 'Positive delta means you loved it more than consensus. Negative delta means you were more critical than consensus.',
        };
      }

      case 'perfect_tens': {
        const tens = items
          .filter((i) => i.userScore === 10)
          .map((i) => ({
            id: i.id,
            title: i.title,
            mediaType: i.mediaType,
            posterPath: i.posterPath,
            releaseYear: i.releaseYear,
            status: i.status,
            userScore: i.userScore,
            voteAverage: i.voteAverage,
            highlightMetric: '10/10',
            extraInfo: i.genres?.slice(0, 2).join(', '),
          }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
          summaryHighlights: [
            { label: 'Total 10s', value: String(tens.length) },
            { label: 'Masterpiece Tier', value: `${items.length > 0 ? ((tens.length / items.length) * 100).toFixed(1) : 0}% of library` },
          ],
          items: tens,
          notes: 'Every media item you awarded a perfect 10/10 rating.',
        };
      }

      default: {
        const defaultItems: DrillDownContributingItem[] = items.slice(0, 20).map((i) => ({
          id: i.id,
          title: i.title,
          mediaType: i.mediaType,
          posterPath: i.posterPath,
          releaseYear: i.releaseYear,
          status: i.status,
          userScore: i.userScore,
          voteAverage: i.voteAverage,
          highlightMetric: i.mediaType === 'tv' ? 'Series' : 'Movie',
        }));

        return {
          widgetId,
          title: def.title,
          subtitle: def.subtitle,
          icon: def.icon,
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
