import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMedia } from '@/context/MediaContext';
import { TrackedItem, MediaType } from '@/types/media';
import { MediaCard } from '@/components/MediaCard';
import { StatsHeader } from '@/components/StatsHeader';
import { StatusFilterChips, FilterStatus } from '@/components/StatusFilterChips';
import { TrackModal } from '@/components/TrackModal';

type SortOption = 'updated' | 'score' | 'title';

export default function MyListScreen() {
  const router = useRouter();
  const { trackedItems, saveItem, removeItem, stats } = useMedia();

  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');

  // Modal state
  const [activeItem, setActiveItem] = useState<TrackedItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Status counts for chips
  const statusCounts = useMemo<Record<FilterStatus, number>>(() => {
    const counts: Record<FilterStatus, number> = {
      all: trackedItems.length,
      watching: stats.watching,
      plan_to_watch: stats.planToWatch,
      completed: stats.completed,
      on_hold: stats.onHold,
      dropped: stats.dropped,
    };
    return counts;
  }, [trackedItems.length, stats]);

  // Filtered & sorted items
  const displayedItems = useMemo(() => {
    let result = [...trackedItems];

    // Filter by status
    if (selectedStatus !== 'all') {
      result = result.filter((i) => i.status === selectedStatus);
    }

    // Filter by query
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'score') {
        return (b.userScore || 0) - (a.userScore || 0);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      // 'updated'
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [trackedItems, selectedStatus, filterQuery, sortBy]);

  const handleCardPress = (item: TrackedItem) => {
    setActiveItem(item);
    setModalVisible(true);
  };

  const cycleSort = () => {
    if (sortBy === 'updated') setSortBy('score');
    else if (sortBy === 'score') setSortBy('title');
    else setSortBy('updated');
  };

  const getSortLabel = () => {
    switch (sortBy) {
      case 'score':
        return 'Score';
      case 'title':
        return 'A-Z';
      case 'updated':
      default:
        return 'Recent';
    }
  };

  return (
    <View style={styles.container}>
      {/* Subheader / Search & Sort bar */}
      <View style={styles.topControlSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter your list..."
            placeholderTextColor="#64748b"
            value={filterQuery}
            onChangeText={setFilterQuery}
          />
          {filterQuery.length > 0 && (
            <Pressable onPress={() => setFilterQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </Pressable>
          )}
        </View>

        <Pressable style={styles.sortButton} onPress={cycleSort}>
          <Ionicons name="swap-vertical" size={14} color="#38bdf8" />
          <Text style={styles.sortButtonText}>{getSortLabel()}</Text>
        </Pressable>
      </View>

      {/* Status Filter Chips */}
      <View style={styles.chipsSection}>
        <StatusFilterChips
          selectedStatus={selectedStatus}
          onSelect={setSelectedStatus}
          counts={statusCounts}
        />
      </View>

      {/* Main List */}
      <FlatList
        data={displayedItems}
        keyExtractor={(item) => `${item.mediaType}-${item.id}`}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            trackedRecord={item}
            onPress={() => handleCardPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          trackedItems.length > 0 ? (
            <StatsHeader
              total={stats.total}
              watching={stats.watching}
              planToWatch={stats.planToWatch}
              completed={stats.completed}
              onHold={stats.onHold}
              dropped={stats.dropped}
              meanScore={stats.meanScore}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={52} color="#334155" />
            <Text style={styles.emptyTitle}>
              {trackedItems.length === 0
                ? 'Your list is empty'
                : 'No matching titles found'}
            </Text>
            <Text style={styles.emptySub}>
              {trackedItems.length === 0
                ? 'Explore trending movies & TV shows and add them to your tracker.'
                : 'Try changing your status filter or search keyword.'}
            </Text>

            {trackedItems.length === 0 && (
              <Pressable
                style={styles.discoverBtn}
                onPress={() => router.push('/')}>
                <Ionicons name="compass-outline" size={16} color="#ffffff" />
                <Text style={styles.discoverBtnText}>Explore Titles</Text>
              </Pressable>
            )}
          </View>
        }
      />

      {/* Track / Edit Modal */}
      <TrackModal
        visible={modalVisible}
        item={activeItem}
        existingRecord={activeItem || undefined}
        onClose={() => {
          setModalVisible(false);
          setActiveItem(null);
        }}
        onSave={(record) => {
          saveItem(record);
        }}
        onRemove={(id, mediaType: MediaType) => {
          removeItem(id, mediaType);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0f15',
  },
  topControlSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#0d0f15',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161922',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: '#232838',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    marginLeft: 6,
    height: '100%',
  },
  clearBtn: {
    padding: 2,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161922',
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#232838',
  },
  sortButtonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  chipsSection: {
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#161922',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  discoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  discoverBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
