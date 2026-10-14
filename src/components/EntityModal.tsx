import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  EntitySelection,
  PersonFullDetails,
  CompanyFullDetails,
  GenreFullDetails,
  TMDBMediaItem,
  DiscoverFilter,
} from '@/types/media';
import { TMDBService } from '@/services/tmdb';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';
import { formatDateDisplay } from '@/utils/date';

interface EntityModalProps {
  visible: boolean;
  entity: EntitySelection | null;
  onClose: () => void;
  onSelectMedia?: (media: TMDBMediaItem) => void;
  onFilterInDiscover?: (filter: DiscoverFilter) => void;
}

interface EntityModalContentProps {
  entity: EntitySelection;
  onClose: () => void;
  onSelectMedia?: (media: TMDBMediaItem) => void;
  onFilterInDiscover?: (filter: DiscoverFilter) => void;
}

function EntityModalContent({
  entity,
  onClose,
  onSelectMedia,
  onFilterInDiscover,
}: EntityModalContentProps) {
  const { apiKey, showActorImages, sizingConfig, dateFormat, triggerHaptic } = useMedia();
  const { colors } = useAppTheme();

  const [translateY] = useState(() => new Animated.Value(0));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 70 || gestureState.vy > 0.6) {
            triggerHaptic('selection');
            Animated.timing(translateY, {
              toValue: 600,
              duration: 160,
              useNativeDriver: true,
            }).start(() => {
              onClose();
              translateY.setValue(0);
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
      }),
    [onClose, triggerHaptic, translateY]
  );

  const [isLoading, setIsLoading] = useState(Boolean(apiKey));
  const [personData, setPersonData] = useState<PersonFullDetails | null>(null);
  const [companyData, setCompanyData] = useState<CompanyFullDetails | null>(null);
  const [genreData, setGenreData] = useState<GenreFullDetails | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (apiKey) {
      if (entity.type === 'person') {
        TMDBService.getPersonDetails(entity.id, apiKey)
          .then((data) => {
            if (isMounted) setPersonData(data);
          })
          .finally(() => {
            if (isMounted) setIsLoading(false);
          });
      } else if (entity.type === 'company' || entity.type === 'network') {
        TMDBService.getCompanyDetails(entity.id, apiKey)
          .then((data) => {
            if (isMounted) setCompanyData(data);
          })
          .finally(() => {
            if (isMounted) setIsLoading(false);
          });
      } else if (entity.type === 'genre') {
        TMDBService.getGenreDetails(entity.id, entity.name, apiKey)
          .then((data) => {
            if (isMounted) setGenreData(data);
          })
          .finally(() => {
            if (isMounted) setIsLoading(false);
          });
      }
    }
    return () => {
      isMounted = false;
    };
  }, [entity, apiKey]);

  // Sizing styles derived from sizingConfig
  const bioFontSize =
    sizingConfig.textSize === 'small'
      ? 11
      : sizingConfig.textSize === 'large'
      ? 14
      : sizingConfig.textSize === 'xlarge'
      ? 15
      : 12.5;

  const handleApplyFilter = () => {
    if (onFilterInDiscover) {
      onFilterInDiscover({
        type: entity.type,
        id: entity.id,
        name: entity.name,
      });
      onClose();
    }
  };

  const knownWorks =
    personData?.knownWorks || companyData?.knownWorks || genreData?.knownWorks || [];

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            transform: [{ translateY }],
          },
        ]}>
        {/* Top Handle */}
        <View style={styles.sheetHeader} {...panResponder.panHandlers}>
          <View style={[styles.handle, { backgroundColor: colors.divider }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Header with Close */}
          <View style={styles.headerRow}>
            <View style={[styles.entityTypeBadge, { backgroundColor: colors.primaryBg }]}>
              <Ionicons
                name={
                  entity.type === 'person'
                    ? 'person'
                    : entity.type === 'genre'
                    ? 'pricetag'
                    : 'business'
                }
                size={12}
                color={colors.primary}
              />
              <Text style={[styles.entityTypeBadgeText, { color: colors.primary }]}>
                {entity.type === 'person'
                  ? 'PEOPLE / CAST'
                  : entity.type === 'genre'
                  ? 'GENRE'
                  : 'PRODUCTION / STUDIO'}
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Fetching details from TMDB...</Text>
            </View>
          ) : (
            <>
              {/* Person Profile Banner */}
              {entity.type === 'person' && (
                <View style={styles.profileBanner}>
                  {showActorImages && (personData?.profilePath || entity.profilePath) ? (
                    <Image
                      source={{
                        uri:
                          TMDBService.getImageUrl(
                            personData?.profilePath || entity.profilePath,
                            'w342'
                          ) || '',
                      }}
                      style={styles.personPortrait}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.personPortrait, styles.portraitFallback, { backgroundColor: colors.cardBorder }]}>
                      <Ionicons name="person" size={32} color={colors.textSecondary} />
                    </View>
                  )}

                  <View style={styles.profileDetails}>
                    <Text style={[styles.entityName, { color: colors.text }]} selectable={true}>
                      {personData?.name || entity.name}
                    </Text>
                    {entity.role ? (
                      <Text style={[styles.roleSub, { color: colors.textSecondary }]} selectable={true}>{entity.role}</Text>
                    ) : personData?.knownForDepartment ? (
                      <Text style={[styles.roleSub, { color: colors.textSecondary }]} selectable={true}>Known for: {personData.knownForDepartment}</Text>
                    ) : null}

                    {personData?.birthday ? (
                      <Text style={[styles.metaInfoText, { color: colors.textMuted }]} selectable={true}>
                        Born: {formatDateDisplay(personData.birthday, dateFormat)}
                        {personData.placeOfBirth ? ` in ${personData.placeOfBirth}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Company / Studio Banner */}
              {(entity.type === 'company' || entity.type === 'network') && (
                <View style={styles.profileBanner}>
                  {companyData?.logoPath ? (
                    <View style={[styles.companyLogoWrapper, { backgroundColor: colors.inputBg }]}>
                      <Image
                        source={{
                          uri: TMDBService.getImageUrl(companyData.logoPath, 'w185') || '',
                        }}
                        style={styles.companyLogo}
                        contentFit="contain"
                      />
                    </View>
                  ) : (
                    <View style={[styles.personPortrait, styles.portraitFallback, { backgroundColor: colors.cardBorder }]}>
                      <Ionicons name="business-outline" size={32} color={colors.textSecondary} />
                    </View>
                  )}

                  <View style={styles.profileDetails}>
                    <Text style={[styles.entityName, { color: colors.text }]} selectable={true}>
                      {companyData?.name || entity.name}
                    </Text>
                    {companyData?.headquarters ? (
                      <Text style={[styles.metaInfoText, { color: colors.textMuted }]} selectable={true}>
                        Headquarters: {companyData.headquarters}
                      </Text>
                    ) : null}
                    {companyData?.originCountry ? (
                      <Text style={[styles.metaInfoText, { color: colors.textMuted }]} selectable={true}>
                        Country: {companyData.originCountry}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Genre Banner */}
              {entity.type === 'genre' && (
                <View style={styles.genreBanner}>
                  <View style={[styles.genreIconCircle, { backgroundColor: colors.primaryBg }]}>
                    <Ionicons name="film" size={24} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.entityName, { color: colors.text }]} selectable={true}>{entity.name}</Text>
                    <Text style={[styles.roleSub, { color: colors.textSecondary }]}>Browse popular movies & TV shows</Text>
                  </View>
                </View>
              )}

              {/* Biography / Description */}
              {(personData?.biography || companyData?.description) ? (
                <View style={[styles.bioCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.bioTitle, { color: colors.textSecondary }]}>
                    {entity.type === 'person' ? 'Biography' : 'About'}
                  </Text>
                  <Text
                    style={[styles.bioText, { fontSize: bioFontSize, color: colors.text }]}
                    numberOfLines={bioExpanded ? undefined : 4}
                    selectable={true}>
                    {personData?.biography || companyData?.description}
                  </Text>
                  <Pressable
                    style={styles.expandBioBtn}
                    onPress={() => setBioExpanded(!bioExpanded)}>
                    <Text style={[styles.expandBioText, { color: colors.primary }]}>
                      {bioExpanded ? 'Show less' : 'Read full biography...'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Filter in Discover Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.filterActionBtn,
                  { backgroundColor: colors.primary },
                  pressed && styles.btnPressed,
                ]}
                onPress={handleApplyFilter}>
                <Ionicons name="search" size={16} color="#ffffff" />
                <Text style={styles.filterActionBtnText}>
                  Search & Filter in Discover ({entity.name})
                </Text>
              </Pressable>

              {/* Known Works / Top Titles Carousel */}
              {knownWorks.length > 0 && (
                <View style={styles.knownWorksSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {entity.type === 'person'
                        ? 'Known Works / Filmography'
                        : entity.type === 'genre'
                        ? `Top ${entity.name} Titles`
                        : 'Top Productions'}
                    </Text>
                    <Text style={[styles.countText, { color: colors.textSecondary }]}>{knownWorks.length} titles</Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.worksCarousel}>
                    {knownWorks.map((work) => {
                      const posterUrl = TMDBService.getImageUrl(work.poster_path, 'w185');
                      const workTitle = work.title || work.name || 'Untitled';
                      const workYear = (work.release_date || work.first_air_date || '').substring(0, 4);

                      return (
                        <Pressable
                          key={`entity-work-${work.id}-${work.media_type || 'm'}`}
                          style={[styles.workCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
                          onPress={() => {
                            if (onSelectMedia) {
                              onSelectMedia(work);
                              onClose();
                            }
                          }}>
                          <View style={styles.workPosterWrapper}>
                            {posterUrl ? (
                              <Image
                                source={{ uri: posterUrl }}
                                style={styles.workPoster}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={[styles.workPoster, styles.posterFallback]}>
                                <Ionicons name="film-outline" size={20} color={colors.textSecondary} />
                              </View>
                            )}
                            {work.vote_average ? (
                              <View style={styles.ratingBadge}>
                                <Ionicons name="star" size={9} color="#f59e0b" />
                                <Text style={styles.ratingBadgeText} selectable={true}>
                                  {work.vote_average.toFixed(1)}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <Text style={[styles.workTitle, { color: colors.text }]} numberOfLines={2} selectable={true}>
                            {workTitle}
                          </Text>
                          <Text style={[styles.workYear, { color: colors.textSecondary }]} selectable={true}>
                            {workYear ? workYear : (work.media_type || '').toUpperCase()}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export function EntityModal({
  visible,
  entity,
  onClose,
  onSelectMedia,
  onFilterInDiscover,
}: EntityModalProps) {
  if (!visible || !entity) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <EntityModalContent
        key={`${entity.type}-${entity.id}`}
        entity={entity}
        onClose={onClose}
        onSelectMedia={onSelectMedia}
        onFilterInDiscover={onFilterInDiscover}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#12151c',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#232838',
    maxHeight: '90%',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  entityTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  entityTypeBadgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  profileBanner: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  genreBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  genreIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  personPortrait: {
    width: 72,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#1e2433',
  },
  companyLogoWrapper: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  companyLogo: {
    width: '100%',
    height: '100%',
  },
  portraitFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileDetails: {
    flex: 1,
    gap: 3,
  },
  entityName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  roleSub: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  metaInfoText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  bioCard: {
    backgroundColor: '#161922',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#232838',
    marginBottom: 16,
  },
  bioTitle: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  bioText: {
    color: '#cbd5e1',
    lineHeight: 18,
  },
  expandBioBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  expandBioText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  filterActionBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  filterActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  knownWorksSection: {
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countText: {
    color: '#64748b',
    fontSize: 11,
  },
  worksCarousel: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
  },
  workCard: {
    width: 90,
  },
  workPosterWrapper: {
    width: 90,
    height: 130,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1e2433',
    position: 'relative',
    marginBottom: 6,
  },
  workPoster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  workTitle: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  workYear: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  btnPressed: {
    opacity: 0.8,
  },
});
