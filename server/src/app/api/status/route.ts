/**
 * Server Status API Route
 * 
 * GET /api/status - Get server status and connection info
 */

import { NextResponse } from 'next/server';
import { getPrimaryLocalIp, getLocalIpAddresses, isAdvertising } from '@/lib/mdns-service';
import { getSupportedSystems } from '@/lib/game-library';
import { getCurrentGameState } from '@/lib/socket-server';
import type { ApiResponse } from '@/types';

interface ServerStatus {
  online: boolean;
  version: string;
  uptime: number;
  network: {
    primaryIp: string | null;
    allIps: string[];
    port: number;
    mdnsAdvertising: boolean;
  };
  emulation: {
    supportedSystems: string[];
    currentGame: {
      title: string;
      system: string;
    } | null;
    gameState: 'playing' | 'paused' | 'stopped';
    connectedPlayers: number;
  };
}

// Track server start time
const serverStartTime = Date.now();

/**
 * GET /api/status
 * 
 * Returns current server status including network info and game state.
 */
export async function GET() {
  try {
    const gameState = getCurrentGameState();
    const port = parseInt(process.env.PORT || '3000', 10);

    const status: ServerStatus = {
      online: true,
      version: '1.0.0',
      uptime: Math.floor((Date.now() - serverStartTime) / 1000), // seconds
      network: {
        primaryIp: getPrimaryLocalIp(),
        allIps: getLocalIpAddresses(),
        port,
        mdnsAdvertising: isAdvertising(),
      },
      emulation: {
        supportedSystems: getSupportedSystems(),
        currentGame: gameState.game ? {
          title: gameState.game.title,
          system: gameState.game.system,
        } : null,
        gameState: gameState.state,
        connectedPlayers: gameState.players.filter(p => p.connected).length,
      },
    };

    const response: ApiResponse<ServerStatus> = {
      success: true,
      data: status,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[API] Error getting status:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get server status',
    }, { status: 500 });
  }
}
