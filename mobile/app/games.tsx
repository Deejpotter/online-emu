/**
 * Game Selection Screen
 * 
 * Displays the library of games from the connected server.
 * Users can filter by system and select a game to play.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSocket } from './index';

/**
 * Game data structure matching the server's Game type.
 */
interface Game {
  id: string;
  title: string;
  system: string;
  romPath: string;
  coverArt?: string;
  lastPlayed?: string;
  playCount?: number;
}

/**
 * Human-readable system names for display.
 */
const SYSTEM_NAMES: Record<string, string> = {
  nes: 'NES',
  snes: 'SNES',
  gb: 'Game Boy',
  gba: 'GBA',
  n64: 'N64',
  nds: 'DS',
  segaMD: 'Genesis',
  segaMS: 'Master System',
  segaGG: 'Game Gear',
  segaCD: 'Sega CD',
  psx: 'PlayStation',
  psp: 'PSP',
  atari2600: 'Atari',
  arcade: 'Arcade',
};

export default function GamesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ host: string; port: string }>();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [systems, setSystems] = useState<string[]>([]);
  const [launching, setLaunching] = useState(false);

  const serverUrl = `http://${params.host}:${params.port}`;

  /**
   * Fetch games from the server.
   */
  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/games`);
      const data = await response.json();

      if (data.success) {
        setGames(data.data.games);
        
        // Extract unique systems
        const uniqueSystems = [...new Set(data.data.games.map((g: Game) => g.system))];
        setSystems(uniqueSystems as string[]);
      } else {
        Alert.alert('Error', 'Failed to load games');
      }
    } catch (error) {
      console.error('Failed to fetch games:', error);
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  /**
   * Launch a game - create streaming session and navigate to play screen.
   */
  const launchGame = async (game: Game) => {
    setLaunching(true);
    
    try {
      // Create streaming session on server
      const response = await fetch(`${serverUrl}/api/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create stream');
      }
      
      // Navigate to play screen with session info
      router.push({
        pathname: '/play',
        params: {
          host: params.host,
          port: params.port,
          sessionId: data.data.sessionId,
          gameTitle: game.title,
          gameSystem: game.system,
        },
      });
      
    } catch (error) {
      console.error('Failed to launch game:', error);
      Alert.alert('Error', 'Failed to start game. Make sure the server is running.');
    } finally {
      setLaunching(false);
    }
  };

  /**
   * Filter games by selected system.
   */
  const filteredGames = selectedSystem
    ? games.filter((g) => g.system === selectedSystem)
    : games;

  /**
   * Render a game card.
   */
  const renderGame = ({ item }: { item: Game }) => (
    <TouchableOpacity
      style={styles.gameCard}
      onPress={() => launchGame(item)}
      disabled={launching}
    >
      {/* Placeholder for cover art */}
      <View style={styles.coverArt}>
        <Text style={styles.coverEmoji}>🎮</Text>
      </View>
      <View style={styles.gameInfo}>
        <Text style={styles.gameTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.gameSystem}>
          {SYSTEM_NAMES[item.system] || item.system}
        </Text>
        {item.playCount && item.playCount > 0 && (
          <Text style={styles.playCount}>
            Played {item.playCount} time{item.playCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  /**
   * Render a system filter chip.
   */
  const renderSystemChip = (system: string) => {
    const isSelected = selectedSystem === system;
    return (
      <TouchableOpacity
        key={system}
        style={[styles.systemChip, isSelected && styles.systemChipSelected]}
        onPress={() => setSelectedSystem(isSelected ? null : system)}
      >
        <Text style={[styles.systemChipText, isSelected && styles.systemChipTextSelected]}>
          {SYSTEM_NAMES[system] || system}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading games...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* System filter chips */}
      {systems.length > 1 && (
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            data={systems}
            renderItem={({ item }) => renderSystemChip(item)}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
          />
        </View>
      )}

      {/* Game list */}
      {filteredGames.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📂</Text>
          <Text style={styles.emptyTitle}>No Games Found</Text>
          <Text style={styles.emptyText}>
            Add ROM files to the server's public/roms/ folder
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredGames}
          renderItem={renderGame}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gameRow}
          contentContainerStyle={styles.gameList}
        />
      )}

      {/* Loading overlay when launching */}
      {launching && (
        <View style={styles.launchingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.launchingText}>Starting game...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  systemChip: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  systemChipSelected: {
    backgroundColor: '#6366f1',
  },
  systemChipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  systemChipTextSelected: {
    color: '#fff',
  },
  gameList: {
    padding: 16,
  },
  gameRow: {
    justifyContent: 'space-between',
  },
  gameCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    width: '48%',
    marginBottom: 16,
    overflow: 'hidden',
  },
  coverArt: {
    aspectRatio: 1,
    backgroundColor: '#252540',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverEmoji: {
    fontSize: 48,
  },
  gameInfo: {
    padding: 12,
  },
  gameTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  gameSystem: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '500',
  },
  playCount: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  launchingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  launchingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
});
