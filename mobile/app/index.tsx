/**
 * Home Screen - Server Discovery
 * 
 * The entry point of the app. Shows:
 * - List of discovered servers on the local network (via mDNS)
 * - Manual IP entry option
 * - Connection status
 * 
 * Once connected, user can navigate to game selection.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { io, Socket } from 'socket.io-client';

/**
 * Represents a discovered server on the network.
 */
interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
}

// Store socket globally so it persists across navigation
let globalSocket: Socket | null = null;

export default function HomeScreen() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [scanning, setScanning] = useState(false);
  const [manualIP, setManualIP] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectedServer, setConnectedServer] = useState<Server | null>(null);

  /**
   * Scan for servers using mDNS.
   * Note: In a full implementation, we'd use react-native-zeroconf.
   * For now, we use a simpler approach with direct connection testing.
   */
  const scanForServers = useCallback(async () => {
    setScanning(true);
    
    // In a real app, we'd use mDNS discovery here
    // For now, we'll try common local IPs
    const commonPorts = [3000];
    const localIPs = [
      '192.168.1.1', '192.168.1.100', '192.168.0.1', '192.168.0.100',
      '10.0.0.1', '10.0.0.13', '10.0.0.100',
    ];
    
    const foundServers: Server[] = [];
    
    // Quick scan of common IPs
    for (const ip of localIPs) {
      for (const port of commonPorts) {
        try {
          const response = await Promise.race([
            fetch(`http://${ip}:${port}/api/status`),
            new Promise((_, reject) => setTimeout(() => reject('timeout'), 1000)),
          ]) as Response;
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              foundServers.push({
                id: `${ip}:${port}`,
                name: 'OnlineEmu Server',
                host: ip,
                port,
              });
            }
          }
        } catch {
          // Server not found at this IP
        }
      }
    }
    
    setServers(foundServers);
    setScanning(false);
  }, []);

  // Scan on mount
  useEffect(() => {
    scanForServers();
  }, [scanForServers]);

  /**
   * Connect to a server.
   */
  const connectToServer = async (server: Server) => {
    setConnecting(true);
    
    try {
      // Verify server is available
      const response = await fetch(`http://${server.host}:${server.port}/api/status`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Server not responding correctly');
      }
      
      // Create socket connection
      const socket = io(`http://${server.host}:${server.port}`, {
        transports: ['websocket'],
        timeout: 5000,
      });
      
      socket.on('connect', () => {
        console.log('Connected to server');
        globalSocket = socket;
        setConnectedServer(server);
        setConnecting(false);
      });
      
      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        Alert.alert('Connection Failed', 'Could not connect to server');
        setConnecting(false);
      });
      
    } catch (error) {
      console.error('Failed to connect:', error);
      Alert.alert('Connection Failed', 'Could not reach the server');
      setConnecting(false);
    }
  };

  /**
   * Connect using manual IP entry.
   */
  const connectManual = () => {
    if (!manualIP.trim()) {
      Alert.alert('Error', 'Please enter an IP address');
      return;
    }
    
    // Parse IP:port or just IP
    let host = manualIP.trim();
    let port = 3000;
    
    if (host.includes(':')) {
      const parts = host.split(':');
      host = parts[0];
      port = parseInt(parts[1], 10) || 3000;
    }
    
    connectToServer({
      id: `${host}:${port}`,
      name: 'Manual Server',
      host,
      port,
    });
  };

  /**
   * Navigate to game selection screen.
   */
  const goToGames = () => {
    if (!connectedServer) {
      Alert.alert('Not Connected', 'Please connect to a server first');
      return;
    }
    
    router.push({
      pathname: '/games',
      params: { 
        host: connectedServer.host, 
        port: connectedServer.port.toString(),
      },
    });
  };

  /**
   * Render a server item in the list.
   */
  const renderServer = ({ item }: { item: Server }) => {
    const isConnected = connectedServer?.id === item.id;
    
    return (
      <TouchableOpacity
        style={[styles.serverItem, isConnected && styles.serverItemConnected]}
        onPress={() => connectToServer(item)}
        disabled={connecting}
      >
        <View style={styles.serverInfo}>
          <Text style={styles.serverName}>{item.name}</Text>
          <Text style={styles.serverAddress}>{item.host}:{item.port}</Text>
        </View>
        {isConnected && (
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedText}>Connected</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header section */}
      <View style={styles.header}>
        <Text style={styles.title}>🎮 OnlineEmu</Text>
        <Text style={styles.subtitle}>Connect to a server to start playing</Text>
      </View>

      {/* Discovered servers */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Discovered Servers</Text>
          <TouchableOpacity 
            onPress={scanForServers} 
            disabled={scanning}
            style={styles.refreshButton}
          >
            {scanning ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <Text style={styles.refreshText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {servers.length === 0 && !scanning ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No servers found</Text>
            <Text style={styles.emptyHint}>Make sure the server is running on your PC</Text>
          </View>
        ) : (
          <FlatList
            data={servers}
            renderItem={renderServer}
            keyExtractor={(item) => item.id}
            style={styles.serverList}
          />
        )}
      </View>

      {/* Manual connection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Connection</Text>
        <View style={styles.manualInput}>
          <TextInput
            style={styles.input}
            placeholder="192.168.1.100:3000"
            placeholderTextColor="#666"
            value={manualIP}
            onChangeText={setManualIP}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity 
            style={styles.connectButton}
            onPress={connectManual}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.connectButtonText}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Continue button */}
      {connectedServer && (
        <TouchableOpacity style={styles.continueButton} onPress={goToGames}>
          <Text style={styles.continueButtonText}>Browse Games →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Export socket for use in other screens
export function getSocket(): Socket | null {
  return globalSocket;
}

export function getConnectedServer(): { host: string; port: number } | null {
  return globalSocket ? { 
    host: (globalSocket.io as any).opts.hostname || 'localhost',
    port: parseInt((globalSocket.io as any).opts.port || '3000', 10),
  } : null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    padding: 16,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  refreshButton: {
    padding: 8,
  },
  refreshText: {
    color: '#6366f1',
    fontSize: 14,
  },
  serverList: {
    maxHeight: 200,
  },
  serverItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serverItemConnected: {
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  serverInfo: {
    flex: 1,
  },
  serverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  serverAddress: {
    fontSize: 14,
    color: '#888',
  },
  connectedBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
  },
  manualInput: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  connectButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
