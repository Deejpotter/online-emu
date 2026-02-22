/**
 * Game Detail API Route
 * 
 * GET /api/games/[id] - Get a specific game by ID
 * PATCH /api/games/[id] - Update game metadata
 * DELETE /api/games/[id] - Remove game from library
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getGameById, 
  updateGame, 
  deleteGame,
  markGameAsPlayed 
} from '@/lib/game-library';
import type { ApiResponse, ApiError, Game } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/games/[id]
 * 
 * Returns a single game by its ID.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const game = await getGameById(id);

    if (!game) {
      const errorResponse: ApiError = {
        success: false,
        error: `Game not found: ${id}`,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const response: ApiResponse<{ game: Game }> = {
      success: true,
      data: { game },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[API] Error fetching game:', error);
    
    const errorResponse: ApiError = {
      success: false,
      error: 'Failed to fetch game',
      details: error instanceof Error ? error.message : String(error),
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PATCH /api/games/[id]
 * 
 * Update game metadata.
 * Body can include: title, coverArt, description
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check for special 'play' action
    if (body.action === 'play') {
      const game = await markGameAsPlayed(id);
      
      if (!game) {
        const errorResponse: ApiError = {
          success: false,
          error: `Game not found: ${id}`,
        };
        return NextResponse.json(errorResponse, { status: 404 });
      }

      const response: ApiResponse<{ game: Game }> = {
        success: true,
        data: { game },
      };

      return NextResponse.json(response);
    }

    // Regular metadata update
    const { title, coverArt, description } = body;
    
    const game = await updateGame(id, {
      ...(title && { title }),
      ...(coverArt && { coverArt }),
      ...(description !== undefined && { description }),
    });

    if (!game) {
      const errorResponse: ApiError = {
        success: false,
        error: `Game not found: ${id}`,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const response: ApiResponse<{ game: Game }> = {
      success: true,
      data: { game },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[API] Error updating game:', error);
    
    const errorResponse: ApiError = {
      success: false,
      error: 'Failed to update game',
      details: error instanceof Error ? error.message : String(error),
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * DELETE /api/games/[id]
 * 
 * Remove a game from the library (metadata only, not the ROM file).
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const deleted = await deleteGame(id);

    if (!deleted) {
      const errorResponse: ApiError = {
        success: false,
        error: `Game not found: ${id}`,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[API] Error deleting game:', error);
    
    const errorResponse: ApiError = {
      success: false,
      error: 'Failed to delete game',
      details: error instanceof Error ? error.message : String(error),
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
