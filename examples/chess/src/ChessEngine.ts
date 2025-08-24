import { BaseResourceManager, InMemoryResourceManager } from '@multiplayer-engine/core';
import { GridGameEngine, GridGameRules, GridMoveResult, GridCell } from '@multiplayer-engine/grid';

/**
 * Chess game implementation using the multiplayer game engine
 * Demonstrates how to create a turn-based game in ~100 lines
 */

export interface ChessGameState {
  gameId: string;
  currentPlayer: 'white' | 'black';
  board: Map<string, ChessPiece>;
  gameStatus: 'waiting' | 'active' | 'checkmate' | 'stalemate' | 'draw';
  moveHistory: ChessMove[];
}

export interface ChessPiece {
  type: 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
  color: 'white' | 'black';
  hasMoved?: boolean;
}

export interface ChessMove {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  piece: ChessPiece;
  capturedPiece?: ChessPiece;
  timestamp: Date;
}

export interface ChessRules extends GridGameRules {
  gridOptions: {
    width: 8;
    height: 8;
    finite: true;
    chunkSize: 8;
  };
  resources: {
    max: 1;
    regenSeconds: 0; // Turn-based - no time limit
    starting: 1;
  };
}

/**
 * Chess Engine - Turn-based game using grid engine
 */
export class ChessEngine extends GridGameEngine<ChessGameState, ChessRules> {
  private board: Map<string, ChessPiece> = new Map();
  private currentPlayer: 'white' | 'black' = 'white';
  private moveHistory: ChessMove[] = [];

  constructor(gameId: string) {
    const rules: ChessRules = {
      gridOptions: {
        width: 8,
        height: 8,
        finite: true,
        chunkSize: 8
      },
      resources: {
        max: 1,
        regenSeconds: 0, // Turn-based
        starting: 1
      }
    };

    super(gameId, rules);
    this.initializeBoard();
  }

  protected createResourceManager(): BaseResourceManager {
    return new InMemoryResourceManager(this.rules.resources);
  }

  protected createMoveValidator() {
    return new ChessMoveValidator();
  }

  /**
   * Initialize chess board with starting positions
   */
  private initializeBoard() {
    // Clear board
    this.board.clear();

    // Place pawns
    for (let x = 0; x < 8; x++) {
      this.board.set(`${x},1`, { type: 'pawn', color: 'white' });
      this.board.set(`${x},6`, { type: 'pawn', color: 'black' });
    }

    // Place other pieces
    const backRow: ChessPiece['type'][] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    
    for (let x = 0; x < 8; x++) {
      this.board.set(`${x},0`, { type: backRow[x], color: 'white' });
      this.board.set(`${x},7`, { type: backRow[x], color: 'black' });
    }
  }

  /**
   * Check if a chess move is valid
   */
  async canPlaceAt(_x: number, _y: number, _playerId: string): Promise<boolean> {
    // For chess, we need fromX, fromY in the move data
    // This method is called by the base class but chess moves are different
    return true; // Actual validation happens in validateChessMove
  }

  /**
   * Validate a complete chess move
   */
  async validateChessMove(fromX: number, fromY: number, toX: number, toY: number, playerId: string): Promise<boolean> {
    // Check bounds
    if (fromX < 0 || fromX >= 8 || fromY < 0 || fromY >= 8 ||
        toX < 0 || toX >= 8 || toY < 0 || toY >= 8) {
      return false;
    }

    // Check if player owns the piece
    const piece = this.board.get(`${fromX},${fromY}`);
    if (!piece) return false;

    const playerColor = playerId === 'player1' ? 'white' : 'black';
    if (piece.color !== playerColor) return false;

    // Check if it's player's turn
    if (this.currentPlayer !== playerColor) return false;

    // Check if destination has own piece
    const destPiece = this.board.get(`${toX},${toY}`);
    if (destPiece && destPiece.color === playerColor) return false;

    // Check piece-specific movement rules
    return this.isValidPieceMove(piece, fromX, fromY, toX, toY);
  }

  /**
   * Check if move is valid for specific piece type
   */
  private isValidPieceMove(piece: ChessPiece, fromX: number, fromY: number, toX: number, toY: number): boolean {
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);

    switch (piece.type) {
      case 'pawn':
        return this.isValidPawnMove(piece, fromX, fromY, toX, toY);
      case 'rook':
        return (dx === 0 || dy === 0) && this.isPathClear(fromX, fromY, toX, toY);
      case 'bishop':
        return (dx === dy) && this.isPathClear(fromX, fromY, toX, toY);
      case 'queen':
        return ((dx === 0 || dy === 0) || (dx === dy)) && this.isPathClear(fromX, fromY, toX, toY);
      case 'king':
        return dx <= 1 && dy <= 1;
      case 'knight':
        return (dx === 2 && dy === 1) || (dx === 1 && dy === 2);
      default:
        return false;
    }
  }

  private isValidPawnMove(piece: ChessPiece, fromX: number, fromY: number, toX: number, toY: number): boolean {
    const direction = piece.color === 'white' ? 1 : -1;
    const dy = toY - fromY;
    const dx = Math.abs(toX - fromX);

    // Forward move
    if (dx === 0) {
      if (dy === direction && !this.board.has(`${toX},${toY}`)) return true;
      if (dy === 2 * direction && !piece.hasMoved && !this.board.has(`${toX},${toY}`)) return true;
    }
    
    // Capture
    if (dx === 1 && dy === direction) {
      return this.board.has(`${toX},${toY}`);
    }

    return false;
  }

  private isPathClear(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const dx = Math.sign(toX - fromX);
    const dy = Math.sign(toY - fromY);
    
    let x = fromX + dx;
    let y = fromY + dy;
    
    while (x !== toX || y !== toY) {
      if (this.board.has(`${x},${y}`)) return false;
      x += dx;
      y += dy;
    }
    
    return true;
  }

  /**
   * Apply chess move
   */
  async applyGridMove(_x: number, _y: number, _playerId: string): Promise<GridMoveResult> {
    // For chess, we need additional move data
    return { success: false, error: 'Use applyChessMove instead' };
  }

  /**
   * Apply complete chess move
   */
  async applyChessMove(fromX: number, fromY: number, toX: number, toY: number, playerId: string): Promise<GridMoveResult> {
    const isValid = await this.validateChessMove(fromX, fromY, toX, toY, playerId);
    if (!isValid) {
      return { success: false, error: 'Invalid move' };
    }

    const piece = this.board.get(`${fromX},${fromY}`)!;
    const capturedPiece = this.board.get(`${toX},${toY}`);

    // Execute move
    this.board.delete(`${fromX},${fromY}`);
    this.board.set(`${toX},${toY}`, { ...piece, hasMoved: true });

    // Record move
    const move: ChessMove = {
      fromX, fromY, toX, toY,
      piece,
      capturedPiece,
      timestamp: new Date()
    };
    this.moveHistory.push(move);

    // Switch players
    this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';

    const changedCells: GridCell[] = [
      { x: fromX, y: fromY, owner: null },
      { x: toX, y: toY, owner: piece.color, data: { piece } }
    ];

    return {
      success: true,
      changedCells,
      affectedChunks: this.getAffectedChunks(changedCells)
    };
  }

  async calculateScore(): Promise<{ scores: Map<string, number>; totalCells?: number }> {
    const scores = new Map<string, number>();
    let whitePoints = 0;
    let blackPoints = 0;

    // Count material value
    this.board.forEach(piece => {
      const value = this.getPieceValue(piece.type);
      if (piece.color === 'white') {
        whitePoints += value;
      } else {
        blackPoints += value;
      }
    });

    scores.set('white', whitePoints);
    scores.set('black', blackPoints);

    return { scores, totalCells: this.board.size };
  }

  private getPieceValue(type: ChessPiece['type']): number {
    const values = {
      pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0
    };
    return values[type];
  }

  async checkWinCondition(): Promise<{ hasWinner: boolean; winner?: string; reason?: string }> {
    // Simplified - in real chess you'd check for checkmate/stalemate
    const hasWhiteKing = Array.from(this.board.values()).some(p => p.type === 'king' && p.color === 'white');
    const hasBlackKing = Array.from(this.board.values()).some(p => p.type === 'king' && p.color === 'black');

    if (!hasWhiteKing) {
      return { hasWinner: true, winner: 'black', reason: 'King captured' };
    }
    if (!hasBlackKing) {
      return { hasWinner: true, winner: 'white', reason: 'King captured' };
    }

    return { hasWinner: false };
  }

  async getGameState(): Promise<ChessGameState> {
    return {
      gameId: this.gameId,
      currentPlayer: this.currentPlayer,
      board: new Map(this.board),
      gameStatus: 'active',
      moveHistory: [...this.moveHistory]
    };
  }

  // Abstract method implementations (simplified for demo)
  protected async loadCells(): Promise<GridCell[]> {
    const cells: GridCell[] = [];
    this.board.forEach((piece, key) => {
      const [x, y] = key.split(',').map(Number);
      cells.push({ x, y, owner: piece.color, data: { piece } });
    });
    return cells;
  }

  protected async saveCells(_cells: GridCell[]): Promise<void> {
    // In a real implementation, save to database
  }
}

/**
 * Chess move validator
 */
class ChessMoveValidator {
  async validate(_playerId: string, moveData: any): Promise<import('@multiplayer-engine/core').ValidationResult> {
    // Basic validation for chess move data
    if (!moveData.fromX || !moveData.fromY || !moveData.toX || !moveData.toY) {
      return { isValid: false, error: 'Missing move coordinates' };
    }

    return { isValid: true };
  }
}