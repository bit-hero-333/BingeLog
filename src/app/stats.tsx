import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';
import { STATUS_CONFIG, MediaStatus } from '@/types/media';

function formatMinutesToDH(minutes: number): { days: number; hours: number; mins: number; formatted: string } {
  if (minutes <= 0) {
    return { days: 0, hours: 0, mins: 0, formatted: '0m' };
  }
  const days = Math.floor(minutes / (24 * 60));
  const remainingMinutesAfterDays = minutes % (24 * 60);
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const mins = remainingMinutesAfterDays % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

  return { days, hours, mins, formatted: parts.join(' ') };
}

export default function StatsScreen() {
  const router = useRouter();
  const { trackedItems, triggerHaptic } = useMedia();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 720;

  // Compute In-Depth Statistics
  const insights = useMemo(() => {
    let movieMinutes = 0;
    let tvMinutes = 0;
    let totalEpisodesWatched = 0;
    let totalRewatches = 0;
    let scoredItemsCount = 0;
    let userScoreSum = 0;
    let tmdbScoreSum = 0;
    let tmdbScoreCount = 0;

    const statusCounts: Record<MediaStatus, number> = {
      watching: 0,
      plan_to_watch: 0,
      completed: 0,
      on_hold: 0,
      dropped: 0,
    };

    const scoreDistribution: Record<number, number> = {
      10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0,
    };

    const genreMap = new Map<string, number>();

    let movieCompletedCount = 0;
    let tvCompletedCount = 0;
    let movieTotalCount = 0;
    let tvTotalCount = 0;

    for (const item of trackedItems) {
      if (item.mediaType === 'movie') {
        movieTotalCount++;
        if (item.status === 'completed') movieCompletedCount++;

        const runtime = item.runtimeMinutes && item.runtimeMinutes > 0 ? item.runtimeMinutes : 100;
        const rewatches = item.rewatchCount || 0;
        totalRewatches += rewatches;

        if (item.status === 'completed') {
          movieMinutes += runtime * (1 + rewatches);
        } else if (item.status === 'watching') {
          movieMinutes += (item.minutesWatched && item.minutesWatched > 0) ? item.minutesWatched : Math.round(runtime * 0.4);
        }
      } else {
        // TV Show
        tvTotalCount++;
        if (item.status === 'completed') tvCompletedCount++;

        const eps = (item.watchedEpisodeKeys && item.watchedEpisodeKeys.length > 0)
          ? item.watchedEpisodeKeys.length
          : (item.currentProgress || 0);

        totalEpisodesWatched += eps;
        const rewatches = item.rewatchCount || 0;
        totalRewatches += rewatches;

        // Default episodic duration: 42 min for drama/series, 24 if anime/animation
        const isAnimation = item.genres?.some((g) => g.toLowerCase().includes('anim'));
        const epDuration = item.runtimeMinutes && item.runtimeMinutes > 0
          ? item.runtimeMinutes
          : isAnimation ? 24 : 42;

        const totalEpsCountWithRewatches = eps + (rewatches * (item.totalEpisodes || eps));
        tvMinutes += totalEpsCountWithRewatches * epDuration;
      }

      // Status
      if (statusCounts[item.status] !== undefined) {
        statusCounts[item.status]++;
      }

      // User score
      if (item.userScore > 0) {
        userScoreSum += item.userScore;
        scoredItemsCount++;
        scoreDistribution[item.userScore] = (scoreDistribution[item.userScore] || 0) + 1;
      } else {
        scoreDistribution[0] = (scoreDistribution[0] || 0) + 1;
      }

      // TMDB score
      if (item.voteAverage && item.voteAverage > 0) {
        tmdbScoreSum += item.voteAverage;
        tmdbScoreCount++;
      }

      // Genres
      item.genres?.forEach((g) => {
        genreMap.set(g, (genreMap.get(g) || 0) + 1);
      });
    }

    const totalMinutes = movieMinutes + tvMinutes;
    const totalWatchTime = formatMinutesToDH(totalMinutes);
    const movieWatchTime = formatMinutesToDH(movieMinutes);
    const tvWatchTime = formatMinutesToDH(tvMinutes);

    const completionRate = trackedItems.length > 0
      ? Number(((statusCounts.completed / trackedItems.length) * 100).toFixed(1))
      : 0;

    const movieCompletionRate = movieTotalCount > 0
      ? Number(((movieCompletedCount / movieTotalCount) * 100).toFixed(1))
      : 0;

    const tvCompletionRate = tvTotalCount > 0
      ? Number(((tvCompletedCount / tvTotalCount) * 100).toFixed(1))
      : 0;

    const averageUserScore = scoredItemsCount > 0
      ? Number((userScoreSum / scoredItemsCount).toFixed(2))
      : 0;

    const averageTmdbScore = tmdbScoreCount > 0
      ? Number((tmdbScoreSum / tmdbScoreCount).toFixed(2))
      : 0;

    // Top genres ranked
    const topGenres = Array.from(genreMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const maxGenreCount = topGenres.length > 0 ? topGenres[0].count : 1;

    // Max score count for histogram scale
    let maxScoreCount = 1;
    for (let s = 1; s <= 10; s++) {
      if (scoreDistribution[s] > maxScoreCount) maxScoreCount = scoreDistribution[s];
    }

    return {
      totalItems: trackedItems.length,
      movieTotalCount,
      tvTotalCount,
      totalMinutes,
      totalWatchTime,
      movieMinutes,
      movieWatchTime,
      tvMinutes,
      tvWatchTime,
      totalEpisodesWatched,
      totalRewatches,
      statusCounts,
      completionRate,
      movieCompletionRate,
      tvCompletionRate,
      averageUserScore,
      averageTmdbScore,
      scoredItemsCount,
      unratedCount: scoreDistribution[0],
      scoreDistribution,
      maxScoreCount,
      topGenres,
      maxGenreCount,
    };
  }, [trackedItems]);

  const hasItems = trackedItems.length > 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        isTablet && styles.tabletScrollContent,
      ]}
      showsVerticalScrollIndicator={false}>
      {/* Header Overview Card */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleGroup}>
            <Text style={[styles.heroEyebrow, { color: colors.primary }]}>WATCH TIME ANALYTICS</Text>
            <Text style={[styles.heroMainMetric, { color: colors.text }]} selectable={true}>
              {insights.totalWatchTime.days > 0 ? (
                <>
                  {insights.totalWatchTime.days}
                  <Text style={[styles.heroMetricUnit, { color: colors.textSecondary }]}>d </Text>
                  {insights.totalWatchTime.hours}
                  <Text style={[styles.heroMetricUnit, { color: colors.textSecondary }]}>h </Text>
                  {insights.totalWatchTime.mins}
                  <Text style={[styles.heroMetricUnit, { color: colors.textSecondary }]}>m</Text>
                </>
              ) : insights.totalWatchTime.hours > 0 ? (
                <>
                  {insights.totalWatchTime.hours}
                  <Text style={[styles.heroMetricUnit, { color: colors.textSecondary }]}>h </Text>
                  {insights.totalWatchTime.mins}
                  <Text style={[styles.heroMetricUnit, { color: colors.textSecondary }]}>m</Text>
                </>
              ) : (
                <>
                  {insights.totalWatchTime.mins}
                  <Text style={[styles.heroMetricUnit, { color: colors.textSecondary }]}>m</Text>
                </>
              )}
            </Text>
            <Text style={[styles.heroSubLabel, { color: colors.textSecondary }]} selectable={true}>
              Total Estimated Time Spent Watching
            </Text>
          </View>

          <View style={[styles.heroIconBadge, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="time" size={28} color={colors.primary} />
          </View>
        </View>

        {/* Watch Time Split (Movies vs TV) */}
        {hasItems && (
          <View style={styles.watchSplitSection}>
            <View style={styles.splitBarContainer}>
              <View
                style={[
                  styles.splitBarMovie,
                  {
                    flex: insights.totalMinutes > 0 ? insights.movieMinutes / insights.totalMinutes : 0.5,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
              <View
                style={[
                  styles.splitBarTv,
                  {
                    flex: insights.totalMinutes > 0 ? insights.tvMinutes / insights.totalMinutes : 0.5,
                    backgroundColor: '#10b981',
                  },
                ]}
              />
            </View>

            <View style={styles.splitLegendRow}>
              <View style={styles.splitLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                  Movies: <Text style={[styles.legendValue, { color: colors.text }]} selectable={true}>{insights.movieWatchTime.formatted}</Text>
                </Text>
              </View>

              <View style={styles.splitLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                  TV Shows: <Text style={[styles.legendValue, { color: colors.text }]} selectable={true}>{insights.tvWatchTime.formatted}</Text>
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Grid Summary Cards */}
      <View style={styles.gridContainer}>
        {/* Total Titles */}
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.metricCardHeader}>
            <Text style={[styles.metricCardTitle, { color: colors.textSecondary }]}>Total Titles</Text>
            <Ionicons name="library-outline" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.metricCardValue, { color: colors.text }]} selectable={true}>
            {insights.totalItems}
          </Text>
          <Text style={[styles.metricCardSub, { color: colors.textMuted }]}>
            {insights.movieTotalCount} Movies • {insights.tvTotalCount} Shows
          </Text>
        </View>

        {/* Completion Rate */}
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.metricCardHeader}>
            <Text style={[styles.metricCardTitle, { color: colors.textSecondary }]}>Completion Rate</Text>
            <Ionicons name="checkmark-done-circle-outline" size={17} color="#22c55e" />
          </View>
          <Text style={[styles.metricCardValue, { color: colors.text }]} selectable={true}>
            {insights.completionRate}%
          </Text>
          <Text style={[styles.metricCardSub, { color: colors.textMuted }]}>
            {insights.statusCounts.completed} Completed
          </Text>
        </View>

        {/* Average User Score */}
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.metricCardHeader}>
            <Text style={[styles.metricCardTitle, { color: colors.textSecondary }]}>Mean Score</Text>
            <Ionicons name="star" size={16} color="#fbbf24" />
          </View>
          <Text style={[styles.metricCardValue, { color: colors.text }]} selectable={true}>
            {insights.averageUserScore > 0 ? `${insights.averageUserScore}/10` : '—'}
          </Text>
          <Text style={[styles.metricCardSub, { color: colors.textMuted }]}>
            {insights.scoredItemsCount} Rated ({insights.unratedCount} Unrated)
          </Text>
        </View>

        {/* TV Episodes & Rewatches */}
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.metricCardHeader}>
            <Text style={[styles.metricCardTitle, { color: colors.textSecondary }]}>Episodes Watched</Text>
            <Ionicons name="tv-outline" size={16} color="#38bdf8" />
          </View>
          <Text style={[styles.metricCardValue, { color: colors.text }]} selectable={true}>
            {insights.totalEpisodesWatched}
          </Text>
          <Text style={[styles.metricCardSub, { color: colors.textMuted }]}>
            +{insights.totalRewatches} Total Rewatches
          </Text>
        </View>
      </View>

      {/* Library Status Breakdown */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <Ionicons name="pie-chart-outline" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]} selectable={true}>
              Library Status Distribution
            </Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {insights.totalItems} titles
          </Text>
        </View>

        {/* Multi-segment status progress bar */}
        {insights.totalItems > 0 ? (
          <View style={styles.statusBarMulti}>
            {(Object.keys(STATUS_CONFIG) as MediaStatus[]).map((st) => {
              const count = insights.statusCounts[st];
              if (count <= 0) return null;
              const flex = count / insights.totalItems;
              return (
                <View
                  key={`bar-${st}`}
                  style={{
                    flex,
                    backgroundColor: STATUS_CONFIG[st].color,
                    height: 10,
                  }}
                />
              );
            })}
          </View>
        ) : null}

        {/* Status items breakdown list */}
        <View style={styles.statusListGrid}>
          {(Object.keys(STATUS_CONFIG) as MediaStatus[]).map((st) => {
            const count = insights.statusCounts[st];
            const pct = insights.totalItems > 0
              ? ((count / insights.totalItems) * 100).toFixed(0)
              : '0';
            const config = STATUS_CONFIG[st];

            return (
              <View
                key={st}
                style={[
                  styles.statusListItem,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                ]}>
                <View style={styles.statusListLeft}>
                  <View style={[styles.statusPip, { backgroundColor: config.color }]} />
                  <Text style={[styles.statusItemLabel, { color: colors.text }]} selectable={true}>
                    {config.label}
                  </Text>
                </View>
                <View style={styles.statusListRight}>
                  <Text style={[styles.statusItemCount, { color: colors.text }]} selectable={true}>
                    {count}
                  </Text>
                  <Text style={[styles.statusItemPct, { color: colors.textMuted }]}>
                    ({pct}%)
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* User Score Histogram / Rating Distribution (10 down to 1) */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <Ionicons name="bar-chart-outline" size={18} color="#fbbf24" />
            <Text style={[styles.sectionTitle, { color: colors.text }]} selectable={true}>
              Rating Distribution (10 → 1)
            </Text>
          </View>
          {insights.averageUserScore > 0 && (
            <View style={[styles.scoreBadgeHeader, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
              <Ionicons name="star" size={11} color="#fbbf24" />
              <Text style={styles.scoreBadgeHeaderText}>{insights.averageUserScore} Avg</Text>
            </View>
          )}
        </View>

        <View style={styles.histogramContainer}>
          {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => {
            const count = insights.scoreDistribution[s] || 0;
            const pct = insights.scoredItemsCount > 0
              ? ((count / insights.scoredItemsCount) * 100).toFixed(0)
              : '0';
            const barWidthPct = insights.maxScoreCount > 0
              ? Math.max(count > 0 ? 6 : 0, (count / insights.maxScoreCount) * 100)
              : 0;

            return (
              <View key={`hist-${s}`} style={styles.histogramRow}>
                <View style={styles.histogramLabelCol}>
                  <Text style={[styles.histogramScoreNum, { color: colors.text }]} selectable={true}>{s}</Text>
                  <Ionicons name="star" size={10} color="#fbbf24" />
                </View>

                <View style={[styles.histogramBarTrack, { backgroundColor: colors.inputBg }]}>
                  {count > 0 && (
                    <View
                      style={[
                        styles.histogramBarFill,
                        {
                          width: `${barWidthPct}%`,
                          backgroundColor: s >= 8 ? colors.primary : s >= 6 ? '#38bdf8' : '#f59e0b',
                        },
                      ]}
                    />
                  )}
                </View>

                <View style={styles.histogramCountCol}>
                  <Text style={[styles.histogramCountText, { color: count > 0 ? colors.text : colors.textMuted }]} selectable={true}>
                    {count}
                  </Text>
                  <Text style={[styles.histogramPctText, { color: colors.textMuted }]}>
                    {pct}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Top Genres Breakdown */}
      {insights.topGenres.length > 0 && (
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithIcon}>
              <Ionicons name="film-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]} selectable={true}>
                Top Favorite Genres
              </Text>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {insights.topGenres.length} genres
            </Text>
          </View>

          <View style={styles.genresList}>
            {insights.topGenres.map((genre, idx) => {
              const barWidth = (genre.count / insights.maxGenreCount) * 100;
              const pct = insights.totalItems > 0
                ? ((genre.count / insights.totalItems) * 100).toFixed(0)
                : '0';

              return (
                <View key={genre.name} style={styles.genreItemCard}>
                  <View style={styles.genreMetaRow}>
                    <View style={styles.genreLeft}>
                      <Text style={[styles.genreRank, { color: colors.textMuted }]}>#{idx + 1}</Text>
                      <Text style={[styles.genreName, { color: colors.text }]} selectable={true}>
                        {genre.name}
                      </Text>
                    </View>

                    <View style={styles.genreRight}>
                      <Text style={[styles.genreCount, { color: colors.text }]} selectable={true}>
                        {genre.count}
                      </Text>
                      <Text style={[styles.genrePct, { color: colors.textMuted }]}>
                        ({pct}%)
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.genreTrack, { backgroundColor: colors.inputBg }]}>
                    <View
                      style={[
                        styles.genreFill,
                        {
                          width: `${barWidth}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Empty State Banner if no titles tracked */}
      {!hasItems && (
        <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]} selectable={true}>
            No Tracking Data Yet
          </Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]} selectable={true}>
            Start adding movies and shows to your watchlist to unlock in-depth stats, watch time breakdowns, and rating distribution histograms.
          </Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              triggerHaptic('selection');
              router.push('/');
            }}>
            <Ionicons name="compass-outline" size={16} color="#ffffff" />
            <Text style={styles.emptyBtnText}>Explore Titles</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  tabletScrollContent: {
    paddingHorizontal: 24,
    maxWidth: 1080,
    alignSelf: 'center',
    width: '100%',
  },
  heroCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTitleGroup: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroMainMetric: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroMetricUnit: {
    fontSize: 20,
    fontWeight: '600',
  },
  heroSubLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  heroIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  watchSplitSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  splitBarContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  splitBarMovie: {
    height: '100%',
  },
  splitBarTv: {
    height: '100%',
  },
  splitLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
  },
  legendValue: {
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  metricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricCardTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricCardValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricCardSub: {
    fontSize: 11,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  statusBarMulti: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  statusListGrid: {
    gap: 8,
  },
  statusListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusItemLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusListRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusItemCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusItemPct: {
    fontSize: 11,
  },
  scoreBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scoreBadgeHeaderText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
  },
  histogramContainer: {
    gap: 8,
  },
  histogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  histogramLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 32,
    gap: 2,
    justifyContent: 'flex-end',
  },
  histogramScoreNum: {
    fontSize: 12,
    fontWeight: '700',
  },
  histogramBarTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  histogramBarFill: {
    height: '100%',
    borderRadius: 7,
  },
  histogramCountCol: {
    width: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-start',
  },
  histogramCountText: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 18,
  },
  histogramPctText: {
    fontSize: 11,
  },
  genresList: {
    gap: 12,
  },
  genreItemCard: {
    gap: 6,
  },
  genreMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  genreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    marginRight: 8,
  },
  genreRank: {
    fontSize: 12,
    fontWeight: '700',
    width: 24,
  },
  genreName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  genreTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  genreFill: {
    height: '100%',
    borderRadius: 3,
  },
  genreRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  genreCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  genrePct: {
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
