import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { TMDBService } from '@/services/tmdb';
import {
  MultiDiscoverFilter,
  DEFAULT_MULTI_DISCOVER_FILTER,
  DiscoverReleaseWindow,
  DiscoverSortOption,
  TMDB_GENRES,
  WatchProvider,
  POPULAR_STREAMING_PROVIDERS,
  PopularProviderOption,
  POPULAR_REGIONS,
} from '@/types/media';
import { getTextScale, getHeaderScale, getButtonScale } from '@/utils/sizing';
import { ALL_COUNTRIES, getCountryName } from '@/utils/country';
import { CountryPickerModal } from '@/components/CountryPickerModal';

interface DiscoverFilterModalProps {
  visible: boolean;
  filter: MultiDiscoverFilter;
  onClose: () => void;
  onApply: (newFilter: MultiDiscoverFilter) => void;
  onReset: () => void;
}

export function DiscoverFilterModal(props: DiscoverFilterModalProps) {
  if (!props.visible) return null;

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent={true}
      onRequestClose={props.onClose}>
      <DiscoverFilterModalContent {...props} />
    </Modal>
  );
}

function DiscoverFilterModalContent({
  filter,
  onClose,
  onApply,
  onReset,
}: DiscoverFilterModalProps) {
  const { colors } = useAppTheme();
  const {
    apiKey,
    selectedRegion,
    mySubscribedProviders,
    triggerHaptic,
    sizingConfig,
  } = useMedia();
  const { height } = useWindowDimensions();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);
  const buttonScale = getButtonScale(sizingConfig?.buttonSize);

  // Draft local filter state for the modal - initialized fresh when opened
  const [draft, setDraft] = useState<MultiDiscoverFilter>(filter);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');

  const countrySuggestions = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return [];
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [countryQuery]);

  // Providers catalog state
  const [regionProviders, setRegionProviders] = useState<WatchProvider[]>([]);
  const [worldwideProviders, setWorldwideProviders] = useState<WatchProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');

  // People & Studios live search states
  const [personQuery, setPersonQuery] = useState('');
  const [personResults, setPersonResults] = useState<{ id: number; name: string; profilePath: string | null; department?: string }[]>([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);

  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState<{ id: number; name: string; logoPath: string | null }[]>([]);
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false);

  // Load streaming providers when providerScope is selected
  useEffect(() => {
    let isMounted = true;
    if (!apiKey) return;

    if (draft.providerScope === 'region' && regionProviders.length === 0) {
      const timer = setTimeout(() => {
        if (!isMounted) return;
        setIsLoadingProviders(true);
        TMDBService.getWatchProvidersList(apiKey, selectedRegion)
          .then((list) => {
            if (isMounted) setRegionProviders(list);
          })
          .catch(() => {})
          .finally(() => {
            if (isMounted) setIsLoadingProviders(false);
          });
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else if (draft.providerScope === 'worldwide' && worldwideProviders.length === 0) {
      const timer = setTimeout(() => {
        if (!isMounted) return;
        setIsLoadingProviders(true);
        TMDBService.getWatchProvidersList(apiKey, undefined)
          .then((list) => {
            if (isMounted) setWorldwideProviders(list);
          })
          .catch(() => {})
          .finally(() => {
            if (isMounted) setIsLoadingProviders(false);
          });
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [draft.providerScope, apiKey, selectedRegion, regionProviders.length, worldwideProviders.length]);

  // Live search for people (actors / directors) with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!personQuery.trim() || !apiKey) {
        setPersonResults([]);
        setIsSearchingPeople(false);
        return;
      }

      setIsSearchingPeople(true);
      TMDBService.searchPeople(personQuery, apiKey)
        .then((res) => setPersonResults(res))
        .catch(() => setPersonResults([]))
        .finally(() => setIsSearchingPeople(false));
    }, personQuery.trim() ? 350 : 0);

    return () => clearTimeout(timer);
  }, [personQuery, apiKey]);

  // Live search for production companies / studios with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!companyQuery.trim() || !apiKey) {
        setCompanyResults([]);
        setIsSearchingCompanies(false);
        return;
      }

      setIsSearchingCompanies(true);
      TMDBService.searchCompanies(companyQuery, apiKey)
        .then((res) => setCompanyResults(res))
        .catch(() => setCompanyResults([]))
        .finally(() => setIsSearchingCompanies(false));
    }, companyQuery.trim() ? 350 : 0);

    return () => clearTimeout(timer);
  }, [companyQuery, apiKey]);

  // Active providers based on current scope
  const availableProviders: WatchProvider[] = useMemo(() => {
    if (draft.providerScope === 'subscribed') {
      return POPULAR_STREAMING_PROVIDERS.filter((p: PopularProviderOption) =>
        mySubscribedProviders.includes(p.id)
      ).map((p: PopularProviderOption) => ({
        id: p.id,
        name: p.name,
        logoPath: p.logoPath,
      }));
    }
    const list: WatchProvider[] = draft.providerScope === 'worldwide' ? worldwideProviders : regionProviders;
    if (!providerSearch.trim()) return list;
    const q = providerSearch.toLowerCase();
    return list.filter((p: WatchProvider) => p.name.toLowerCase().includes(q));
  }, [draft.providerScope, mySubscribedProviders, regionProviders, worldwideProviders, providerSearch]);

  // Calculate active filter count
  const activeCount = useMemo(() => {
    let count = 0;
    if (draft.mediaType !== 'all') count++;
    if (draft.releaseWindow !== 'all') count++;
    if (draft.providerScope !== 'none') {
      if (draft.providerScope === 'subscribed') count++;
      else if (draft.selectedProviders.length > 0) count++;
    }
    if (draft.selectedGenres.length > 0) count++;
    if (draft.selectedCountries && draft.selectedCountries.length > 0) count += draft.selectedCountries.length;
    if (draft.minRating > 0) count++;
    if (draft.selectedPeople.length > 0) count += draft.selectedPeople.length;
    if (draft.selectedCompanies.length > 0) count += draft.selectedCompanies.length;
    if (draft.sortBy !== 'primary_release_date.asc') count++;
    return count;
  }, [draft]);

  const toggleCountry = (countryCode: string) => {
    triggerHaptic('selection');
    setDraft((prev) => {
      const current = prev.selectedCountries || [];
      const exists = current.includes(countryCode);
      return {
        ...prev,
        selectedCountries: exists
          ? current.filter((c) => c !== countryCode)
          : [...current, countryCode],
      };
    });
  };

  const toggleGenre = (genreId: number) => {
    triggerHaptic('selection');
    setDraft((prev) => {
      const exists = prev.selectedGenres.includes(genreId);
      return {
        ...prev,
        selectedGenres: exists
          ? prev.selectedGenres.filter((id) => id !== genreId)
          : [...prev.selectedGenres, genreId],
      };
    });
  };

  const toggleProvider = (providerId: number) => {
    triggerHaptic('selection');
    setDraft((prev) => {
      const exists = prev.selectedProviders.includes(providerId);
      const nextIds = exists
        ? prev.selectedProviders.filter((id) => id !== providerId)
        : [...prev.selectedProviders, providerId];

      const prevDetails = prev.selectedProviderDetails || [];
      let nextDetails: WatchProvider[];
      if (exists) {
        nextDetails = prevDetails.filter((p) => p.id !== providerId);
      } else {
        const found =
          availableProviders.find((p) => p.id === providerId) ||
          regionProviders.find((p) => p.id === providerId) ||
          worldwideProviders.find((p) => p.id === providerId) ||
          POPULAR_STREAMING_PROVIDERS.find((p) => p.id === providerId);
        nextDetails = found
          ? [...prevDetails.filter((p) => p.id !== providerId), { id: found.id, name: found.name, logoPath: found.logoPath }]
          : prevDetails;
      }

      return {
        ...prev,
        selectedProviders: nextIds,
        selectedProviderDetails: nextDetails,
      };
    });
  };

  const selectAllProviders = () => {
    triggerHaptic('selection');
    const allIds = availableProviders.map((p: WatchProvider) => p.id);
    setDraft((prev) => {
      const prevDetails = prev.selectedProviderDetails || [];
      const detailMap = new Map<number, WatchProvider>();
      for (const d of prevDetails) detailMap.set(d.id, d);
      for (const p of availableProviders) detailMap.set(p.id, { id: p.id, name: p.name, logoPath: p.logoPath });
      return {
        ...prev,
        selectedProviders: Array.from(new Set([...prev.selectedProviders, ...allIds])),
        selectedProviderDetails: Array.from(detailMap.values()),
      };
    });
  };

  const clearSelectedProviders = () => {
    triggerHaptic('selection');
    setDraft((prev) => ({ ...prev, selectedProviders: [], selectedProviderDetails: [] }));
  };

  const addPerson = (person: { id: number; name: string; profilePath: string | null }) => {
    triggerHaptic('selection');
    setDraft((prev) => {
      if (prev.selectedPeople.some((p) => p.id === person.id)) return prev;
      return {
        ...prev,
        selectedPeople: [...prev.selectedPeople, person],
      };
    });
    setPersonQuery('');
    setPersonResults([]);
    Keyboard.dismiss();
  };

  const removePerson = (id: number) => {
    triggerHaptic('selection');
    setDraft((prev) => ({
      ...prev,
      selectedPeople: prev.selectedPeople.filter((p) => p.id !== id),
    }));
  };

  const addCompany = (company: { id: number; name: string; logoPath: string | null }) => {
    triggerHaptic('selection');
    setDraft((prev) => {
      if (prev.selectedCompanies.some((c) => c.id === company.id)) return prev;
      return {
        ...prev,
        selectedCompanies: [...prev.selectedCompanies, company],
      };
    });
    setCompanyQuery('');
    setCompanyResults([]);
    Keyboard.dismiss();
  };

  const removeCompany = (id: number) => {
    triggerHaptic('selection');
    setDraft((prev) => ({
      ...prev,
      selectedCompanies: prev.selectedCompanies.filter((c) => c.id !== id),
    }));
  };

  const handleApply = () => {
    triggerHaptic('selection');
    const detailMap = new Map<number, WatchProvider>();
    for (const d of draft.selectedProviderDetails || []) {
      detailMap.set(d.id, d);
    }
    for (const id of draft.selectedProviders) {
      if (!detailMap.has(id)) {
        const found =
          availableProviders.find((p) => p.id === id) ||
          regionProviders.find((p) => p.id === id) ||
          worldwideProviders.find((p) => p.id === id) ||
          POPULAR_STREAMING_PROVIDERS.find((p) => p.id === id);
        if (found) {
          detailMap.set(id, { id: found.id, name: found.name, logoPath: found.logoPath });
        }
      }
    }
    onApply({
      ...draft,
      selectedProviderDetails: Array.from(detailMap.values()),
    });
    onClose();
  };

  const handleReset = () => {
    triggerHaptic('selection');
    setDraft(DEFAULT_MULTI_DISCOVER_FILTER);
    setProviderSearch('');
    setPersonQuery('');
    setPersonResults([]);
    setCompanyQuery('');
    setCompanyResults([]);
    onReset();
    onClose();
  };

  const RELEASE_WINDOWS: { id: DiscoverReleaseWindow; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'all', label: 'All Releases', icon: 'infinite-outline' },
    { id: 'upcoming_30', label: 'Next 30 Days', icon: 'calendar-outline' },
    { id: 'upcoming_60', label: 'Next 60 Days', icon: 'calendar-outline' },
    { id: 'upcoming_90', label: 'Next 90 Days', icon: 'calendar-outline' },
    { id: 'digital_premieres', label: 'Streaming Premieres', icon: 'tv-outline' },
    { id: 'in_theaters', label: 'In Theaters', icon: 'film-outline' },
  ];

  const SORT_OPTIONS: { id: DiscoverSortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'primary_release_date.asc', label: 'Release Date (Earliest)', icon: 'arrow-up-outline' },
    { id: 'popularity.desc', label: 'Most Popular', icon: 'trending-up-outline' },
    { id: 'primary_release_date.desc', label: 'Release Date (Newest)', icon: 'arrow-down-outline' },
    { id: 'vote_average.desc', label: 'Highest Rated', icon: 'star-outline' },
  ];

  const RATING_PRESETS = [0, 6, 7, 7.5, 8, 8.5];

  // Explicit modal sheet height (85% of screen height) so ScrollView never collapses
  const modalSheetHeight = Math.round(height * 0.85);

  return (
    <Pressable style={styles.modalBackdrop} onPress={onClose}>
      <Pressable
        style={[
          styles.modalContainer,
          {
            backgroundColor: colors.background,
            height: modalSheetHeight,
            borderColor: colors.cardBorder,
          },
        ]}
        onPress={(e) => e.stopPropagation()}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.cardBorder }]}>
          <View style={styles.modalHeaderLeft}>
            <Ionicons name="filter" size={20 * headerScale} color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.text, fontSize: 17 * headerScale }]}>
              Discover Filters
            </Text>
            {activeCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>{activeCount}</Text>
              </View>
            )}
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Scrollable Form Body */}
        <ScrollView
          style={styles.modalBody}
          contentContainerStyle={styles.modalBodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* 1. Media Type Selector */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 13 * headerScale }]}>
              MEDIA FORMAT
            </Text>
            <View style={styles.segmentRow}>
              {(
                [
                  { id: 'all', label: 'All Titles', icon: 'apps-outline' },
                  { id: 'movie', label: 'Movies', icon: 'film-outline' },
                  { id: 'tv', label: 'TV Shows', icon: 'tv-outline' },
                ] as const
              ).map((opt) => {
                const isSelected = draft.mediaType === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.segmentBtn,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setDraft((p) => ({ ...p, mediaType: opt.id }));
                    }}>
                    <Ionicons
                      name={opt.icon}
                      size={15 * textScale}
                      color={isSelected ? '#ffffff' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.segmentBtnText,
                        { color: isSelected ? '#ffffff' : colors.text, fontSize: 12.5 * textScale },
                        isSelected && styles.segmentBtnTextSelected,
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 2. Release Window & Drops */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 13 * headerScale }]}>
              RELEASE TIMING & DROPS
            </Text>
            <View style={styles.chipsWrap}>
              {RELEASE_WINDOWS.map((win) => {
                const isSelected = draft.releaseWindow === win.id;
                return (
                  <Pressable
                    key={win.id}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setDraft((p) => ({ ...p, releaseWindow: win.id }));
                    }}>
                    <Ionicons
                      name={win.icon}
                      size={13 * textScale}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.primary : colors.text, fontSize: 12 * textScale },
                        isSelected && styles.chipTextSelected,
                      ]}>
                      {win.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 3. Streaming Providers */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 13 * headerScale }]}>
              STREAMING PROVIDERS
            </Text>

            {/* Provider Scope Pills */}
            <View style={styles.chipsWrap}>
              {(
                [
                  { id: 'none', label: 'Any / Worldwide' },
                  { id: 'subscribed', label: 'My Subscriptions' },
                  { id: 'region', label: `By Region (${selectedRegion})` },
                  { id: 'worldwide', label: 'Worldwide Catalog' },
                ] as const
              ).map((scope) => {
                const isSelected = draft.providerScope === scope.id;
                return (
                  <Pressable
                    key={scope.id}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setDraft((p) => ({ ...p, providerScope: scope.id, selectedProviders: [] }));
                    }}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.primary : colors.text, fontSize: 12 * textScale },
                        isSelected && styles.chipTextSelected,
                      ]}>
                      {scope.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Provider Subscribed Notice */}
            {draft.providerScope === 'subscribed' && (
              <View style={[styles.infoBanner, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.infoBannerText, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                  Filtering by {mySubscribedProviders.length} active service
                  {mySubscribedProviders.length === 1 ? '' : 's'} configured in your Settings.
                </Text>
              </View>
            )}

            {/* Provider Search & Multi-select when region or worldwide */}
            {(draft.providerScope === 'region' || draft.providerScope === 'worldwide') && (
              <View style={styles.providerPickerContainer}>
                <View style={[styles.providerSearchRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Ionicons name="search" size={16} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.providerSearchInput, { color: colors.text, fontSize: 12.5 * textScale }]}
                    placeholder="Search providers..."
                    placeholderTextColor={colors.textMuted}
                    value={providerSearch}
                    onChangeText={setProviderSearch}
                    autoCorrect={false}
                  />
                  {providerSearch.length > 0 && (
                    <Pressable onPress={() => setProviderSearch('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </View>

                {/* Actions row: Select All / Clear */}
                <View style={styles.providerActionRow}>
                  <Text style={[styles.selectedCountText, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                    {draft.selectedProviders.length} selected
                  </Text>
                  <View style={styles.providerActionButtons}>
                    <Pressable onPress={selectAllProviders} style={styles.providerMiniBtn}>
                      <Text style={[styles.providerMiniBtnText, { color: colors.primary, fontSize: 11 * textScale }]}>
                        Select All
                      </Text>
                    </Pressable>
                    <Pressable onPress={clearSelectedProviders} style={styles.providerMiniBtn}>
                      <Text style={[styles.providerMiniBtnText, { color: colors.textMuted, fontSize: 11 * textScale }]}>
                        Clear
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Provider List / Loading */}
                {isLoadingProviders ? (
                  <View style={styles.providerLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.providerLoadingText, { color: colors.textMuted, fontSize: 11 * textScale }]}>
                      Loading provider catalog...
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.providerHorizontalList}>
                    {availableProviders.slice(0, providerSearch.trim() ? 60 : 45).map((p: WatchProvider) => {
                      const isSelected = draft.selectedProviders.includes(p.id);
                      const logoUrl = TMDBService.getImageUrl(p.logoPath, 'w92');
                      return (
                        <Pressable
                          key={p.id}
                          style={[
                            styles.providerPill,
                            { backgroundColor: colors.card, borderColor: colors.cardBorder },
                            isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                          ]}
                          onPress={() => toggleProvider(p.id)}>
                          {logoUrl ? (
                            <Image source={{ uri: logoUrl }} style={styles.providerLogo} contentFit="cover" />
                          ) : (
                            <View style={[styles.providerLogo, { backgroundColor: colors.inputBg }]}>
                              <Ionicons name="tv" size={12} color={colors.textMuted} />
                            </View>
                          )}
                          <Text
                            style={[
                              styles.providerPillText,
                              { color: isSelected ? colors.primary : colors.text, fontSize: 11.5 * textScale },
                              isSelected && { fontWeight: '700' },
                            ]}
                            numberOfLines={1}>
                            {p.name}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* 4. Genres */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 13 * headerScale }]}>
                GENRES
              </Text>
              {draft.selectedGenres.length > 0 && (
                <Pressable onPress={() => setDraft((p) => ({ ...p, selectedGenres: [] }))}>
                  <Text style={[styles.sectionClearText, { color: colors.primary, fontSize: 11 * textScale }]}>
                    Clear
                  </Text>
                </Pressable>
              )}
            </View>
            <View style={styles.chipsWrap}>
              {TMDB_GENRES.map((g) => {
                const isSelected = draft.selectedGenres.includes(g.id);
                return (
                  <Pressable
                    key={g.id}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                    ]}
                    onPress={() => toggleGenre(g.id)}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.primary : colors.text, fontSize: 12 * textScale },
                        isSelected && styles.chipTextSelected,
                      ]}>
                      {g.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 5. Country of Origin */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 13 * headerScale }]}>
                COUNTRY OF ORIGIN
              </Text>
              {draft.selectedCountries && draft.selectedCountries.length > 0 && (
                <Pressable onPress={() => setDraft((p) => ({ ...p, selectedCountries: [] }))}>
                  <Text style={[styles.sectionClearText, { color: colors.primary, fontSize: 11 * textScale }]}>
                    Clear ({draft.selectedCountries.length})
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Active Selected Country Tags */}
            {draft.selectedCountries && draft.selectedCountries.length > 0 && (
              <View style={styles.activeTagsWrap}>
                {draft.selectedCountries.map((code) => {
                  const name = getCountryName(code);
                  return (
                    <View
                      key={code}
                      style={[styles.activeTag, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                      <Image
                        source={{ uri: `https://flagcdn.com/w40/${code.toLowerCase()}.png` }}
                        style={styles.activeTagFlag}
                        contentFit="cover"
                      />
                      <Text style={[styles.activeTagText, { color: colors.primary, fontSize: 11.5 * textScale }]}>
                        {name} ({code})
                      </Text>
                      <Pressable onPress={() => toggleCountry(code)} hitSlop={6}>
                        <Ionicons name="close-circle" size={15} color={colors.primary} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Search Country Input */}
            <View style={[styles.searchBoxFixed, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInputFixed, { color: colors.text, fontSize: 12.5 * textScale }]}
                placeholder="Search countries (e.g. Turkey, JP)..."
                placeholderTextColor={colors.textMuted}
                value={countryQuery}
                onChangeText={setCountryQuery}
                autoCorrect={false}
                multiline={false}
                numberOfLines={1}
              />
              {countryQuery.length > 0 && (
                <Pressable onPress={() => setCountryQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>

            {/* Country Suggestions Dropdown (Inline, Zero Nested Scroll) */}
            {countrySuggestions.length > 0 ? (
              <View style={[styles.suggestionBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {countrySuggestions.map((c) => {
                  const isSelected = draft.selectedCountries?.includes(c.code);
                  return (
                    <Pressable
                      key={c.code}
                      style={[styles.suggestionItem, { borderBottomColor: colors.cardBorder }, isSelected && { backgroundColor: colors.primaryBg }]}
                      onPress={() => {
                        toggleCountry(c.code);
                        setCountryQuery('');
                      }}>
                      <Image
                        source={{ uri: `https://flagcdn.com/w40/${c.code.toLowerCase()}.png` }}
                        style={styles.countryRowFlag}
                        contentFit="cover"
                      />
                      <Text
                        style={[
                          styles.suggestionText,
                          { color: isSelected ? colors.primary : colors.text, fontSize: 12 * textScale },
                          isSelected && { fontWeight: '700' },
                        ]}>
                        {c.name} ({c.code})
                      </Text>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                        size={18}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : countryQuery.trim().length > 0 ? (
              <View style={[styles.suggestionBox, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 12, alignItems: 'center' }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 * textScale }}>
                  No countries found matching &ldquo;{countryQuery}&rdquo;.
                </Text>
              </View>
            ) : (
              <>
                {/* Browse All 252 Countries Button */}
                <Pressable
                  style={[styles.browseAllBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setShowCountryPicker(true);
                  }}>
                  <View style={styles.browseAllLeft}>
                    <Ionicons name="globe-outline" size={16} color={colors.primary} />
                    <Text style={[styles.browseAllText, { color: colors.text, fontSize: 12 * textScale }]}>
                      Browse All 252 Countries & Territories...
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                </Pressable>

                {/* Quick Popular Country Chips */}
                <View style={styles.chipsWrap}>
                  {POPULAR_REGIONS.map((r) => {
                    const isSelected = draft.selectedCountries?.includes(r.code);
                    return (
                      <Pressable
                        key={r.code}
                        style={[
                          styles.chip,
                          { backgroundColor: colors.card, borderColor: colors.cardBorder },
                          isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                        ]}
                        onPress={() => toggleCountry(r.code)}>
                        <Image
                          source={{ uri: `https://flagcdn.com/w40/${r.code.toLowerCase()}.png` }}
                          style={{ width: 14, height: 14, borderRadius: 2 }}
                          contentFit="cover"
                        />
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? colors.primary : colors.text, fontSize: 12 * textScale },
                            isSelected && styles.chipTextSelected,
                          ]}>
                          {r.name} ({r.code})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* 6. Rating Threshold */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 13 * headerScale }]}>
              MINIMUM USER SCORE
            </Text>
            <View style={styles.chipsWrap}>
              {RATING_PRESETS.map((rate) => {
                const isSelected = draft.minRating === rate;
                return (
                  <Pressable
                    key={rate}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setDraft((p) => ({ ...p, minRating: rate }));
                    }}>
                    {rate > 0 && (
                      <Ionicons
                        name="star"
                        size={12 * textScale}
                        color={isSelected ? colors.primary : '#fbbf24'}
                      />
                    )}
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.primary : colors.text, fontSize: 12 * textScale },
                        isSelected && styles.chipTextSelected,
                      ]}>
                      {rate === 0 ? 'Any Rating' : `${rate.toFixed(1)}+`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 6. Production Studios / Companies */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 13 * headerScale }]}>
              STUDIOS & PRODUCTION COMPANIES
            </Text>

            {/* Active Studio Tags */}
            {draft.selectedCompanies.length > 0 && (
              <View style={styles.activeTagsWrap}>
                {draft.selectedCompanies.map((c) => (
                  <View
                    key={c.id}
                    style={[styles.activeTag, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                    <Text style={[styles.activeTagText, { color: colors.primary, fontSize: 11.5 * textScale }]}>
                      {c.name}
                    </Text>
                    <Pressable onPress={() => removeCompany(c.id)} hitSlop={6}>
                      <Ionicons name="close-circle" size={15} color={colors.primary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Studio Search Bar */}
            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text, fontSize: 12.5 * textScale }]}
                placeholder="Search studio (e.g. A24, Marvel, Ghibli)..."
                placeholderTextColor={colors.textMuted}
                value={companyQuery}
                onChangeText={setCompanyQuery}
                autoCorrect={false}
              />
              {isSearchingCompanies && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {/* Company Suggestions Dropdown */}
            {companyResults.length > 0 && (
              <View style={[styles.suggestionBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {companyResults.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[styles.suggestionItem, { borderBottomColor: colors.cardBorder }]}
                    onPress={() => addCompany(c)}>
                    <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                    <Text style={[styles.suggestionText, { color: colors.text, fontSize: 12 * textScale }]}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* 7. Actors & Directors */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 13 * headerScale }]}>
              CAST & DIRECTORS
            </Text>

            {/* Active People Tags */}
            {draft.selectedPeople.length > 0 && (
              <View style={styles.activeTagsWrap}>
                {draft.selectedPeople.map((p) => (
                  <View
                    key={p.id}
                    style={[styles.activeTag, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                    <Text style={[styles.activeTagText, { color: colors.primary, fontSize: 11.5 * textScale }]}>
                      {p.name}
                    </Text>
                    <Pressable onPress={() => removePerson(p.id)} hitSlop={6}>
                      <Ionicons name="close-circle" size={15} color={colors.primary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Person Search Bar */}
            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text, fontSize: 12.5 * textScale }]}
                placeholder="Search actor or director..."
                placeholderTextColor={colors.textMuted}
                value={personQuery}
                onChangeText={setPersonQuery}
                autoCorrect={false}
              />
              {isSearchingPeople && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {/* Person Suggestions Dropdown */}
            {personResults.length > 0 && (
              <View style={[styles.suggestionBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {personResults.map((p) => {
                  const profileUrl = TMDBService.getImageUrl(p.profilePath, 'w92');
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.suggestionItem, { borderBottomColor: colors.cardBorder }]}
                      onPress={() => addPerson(p)}>
                      {profileUrl ? (
                        <Image source={{ uri: profileUrl }} style={styles.personThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.personThumb, { backgroundColor: colors.inputBg }]}>
                          <Ionicons name="person" size={12} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.personDetails}>
                        <Text style={[styles.suggestionText, { color: colors.text, fontSize: 12 * textScale }]}>
                          {p.name}
                        </Text>
                        {p.department && (
                          <Text style={[styles.personDept, { color: colors.textMuted, fontSize: 10 * textScale }]}>
                            {p.department}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* 8. Sort By */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 13 * headerScale }]}>
              SORT BY
            </Text>
            <View style={styles.chipsWrap}>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = draft.sortBy === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setDraft((p) => ({ ...p, sortBy: opt.id }));
                    }}>
                    <Ionicons
                      name={opt.icon}
                      size={13 * textScale}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.primary : colors.text, fontSize: 12 * textScale },
                        isSelected && styles.chipTextSelected,
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={[styles.modalFooter, { borderTopColor: colors.cardBorder }]}>
          <Pressable
            style={[
              styles.resetBtn,
              { borderColor: colors.cardBorder, minHeight: Math.round(44 * buttonScale) },
            ]}
            onPress={handleReset}>
            <Ionicons name="refresh-outline" size={16 * textScale} color={colors.textSecondary} />
            <Text style={[styles.resetBtnText, { color: colors.textSecondary, fontSize: 13 * textScale }]}>
              Reset
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.applyBtn,
              { backgroundColor: colors.primary, minHeight: Math.round(44 * buttonScale) },
            ]}
            onPress={handleApply}>
            <Ionicons name="checkmark" size={17 * textScale} color="#ffffff" />
            <Text style={[styles.applyBtnText, { fontSize: 13.5 * textScale }]}>
              Apply Filters {activeCount > 0 ? `(${activeCount})` : ''}
            </Text>
          </Pressable>
        </View>

        <CountryPickerModal
          visible={showCountryPicker}
          selectedCountries={draft.selectedCountries || []}
          onToggleCountry={toggleCountry}
          onClose={() => setShowCountryPicker(false)}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionClearText: {
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentBtnText: {
    fontWeight: '600',
  },
  segmentBtnTextSelected: {
    fontWeight: '700',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '600',
  },
  chipTextSelected: {
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoBannerText: {
    flex: 1,
    lineHeight: 16,
  },
  providerPickerContainer: {
    gap: 10,
    marginTop: 4,
  },
  providerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
  },
  providerSearchInput: {
    flex: 1,
    height: '100%',
  },
  providerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedCountText: {
    fontWeight: '600',
  },
  providerActionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  providerMiniBtn: {
    paddingVertical: 2,
  },
  providerMiniBtnText: {
    fontWeight: '700',
  },
  providerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  providerLoadingText: {
    fontWeight: '500',
  },
  providerHorizontalList: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  providerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  providerLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  providerPillText: {
    fontWeight: '600',
    maxWidth: 120,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    height: '100%',
  },
  suggestionBox: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  suggestionText: {
    fontWeight: '600',
    flex: 1,
  },
  personThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  personDetails: {
    flex: 1,
  },
  personDept: {
    fontWeight: '500',
  },
  activeTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeTagText: {
    fontWeight: '700',
  },
  activeTagFlag: {
    width: 14,
    height: 14,
    borderRadius: 2,
    marginRight: 4,
  },
  searchBoxFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInputFixed: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  browseAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 2,
    marginBottom: 4,
  },
  browseAllLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  browseAllText: {
    fontWeight: '600',
  },
  countryRowFlag: {
    width: 18,
    height: 18,
    borderRadius: 2,
    marginRight: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  resetBtnText: {
    fontWeight: '700',
  },
  applyBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  applyBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
