/**
 * Systems API Route
 * 
 * GET /api/systems - List all supported emulator systems
 */

import { NextResponse } from 'next/server';
import { getSupportedSystems, SYSTEM_NAMES } from '@/lib/game-library';
import type { ApiResponse, EmulatorSystem } from '@/types';

interface SystemInfo {
  id: EmulatorSystem;
  name: string;
  emulatorCore: string | undefined;
}

/**
 * Map of system IDs to EmulatorJS core names.
 * These correspond to the cores available in EmulatorJS.
 * Note: External systems (ps2, gamecube) don't have EmulatorJS cores.
 */
const SYSTEM_CORES: Partial<Record<EmulatorSystem, string>> = {
  nes: 'nes',
  snes: 'snes',
  gb: 'gb',
  gba: 'gba',
  n64: 'n64',
  nds: 'nds',
  segaMD: 'segaMD',
  segaMS: 'segaMS',
  segaGG: 'segaGG',
  segaCD: 'segaCD',
  psx: 'psx',
  psp: 'psp',
  atari2600: 'atari2600',
  arcade: 'arcade',
  // ps2 and gamecube don't have EmulatorJS cores - they use external emulators
};

/**
 * GET /api/systems
 * 
 * Returns a list of all supported emulator systems.
 */
export async function GET() {
  try {
    const systems = getSupportedSystems();
    
    const systemsInfo: SystemInfo[] = systems.map(system => ({
      id: system,
      name: SYSTEM_NAMES[system],
      emulatorCore: SYSTEM_CORES[system],
    }));

    const response: ApiResponse<{ systems: SystemInfo[] }> = {
      success: true,
      data: {
        systems: systemsInfo,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[API] Error fetching systems:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch systems',
    }, { status: 500 });
  }
}
