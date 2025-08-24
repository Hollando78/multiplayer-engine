import { ChessEngine } from './ChessEngine';

/**
 * Simple demo showing chess engine in action
 */
async function runChessDemo() {
  console.log('🏁 Starting Chess Engine Demo');
  
  // Create a new chess game
  const game = new ChessEngine('demo-game-1');
  
  console.log('\n📋 Initial game state:');
  const initialState = await game.getGameState();
  console.log(`Current player: ${initialState.currentPlayer}`);
  console.log(`Board pieces: ${initialState.board.size}`);
  
  // Display board
  console.log('\n♟️  Initial Board:');
  displayBoard(initialState.board);
  
  // Make some moves
  console.log('\n🎮 Making moves...');
  
  // White pawn e2-e4
  const move1 = await game.applyChessMove(4, 1, 4, 3, 'player1');
  console.log('Move 1 - White pawn e2-e4:', move1.success ? '✅' : '❌');
  
  if (move1.success) {
    const state1 = await game.getGameState();
    console.log(`Current player: ${state1.currentPlayer}`);
  }
  
  // Black pawn e7-e5
  const move2 = await game.applyChessMove(4, 6, 4, 4, 'player2');
  console.log('Move 2 - Black pawn e7-e5:', move2.success ? '✅' : '❌');
  
  // White knight g1-f3
  const move3 = await game.applyChessMove(6, 0, 5, 2, 'player1');
  console.log('Move 3 - White knight g1-f3:', move3.success ? '✅' : '❌');
  
  // Display final board
  const finalState = await game.getGameState();
  console.log('\n♟️  Board after moves:');
  displayBoard(finalState.board);
  
  // Check scores
  const scores = await game.calculateScore();
  console.log('\n📊 Current scores:');
  scores.scores.forEach((score: number, player: string) => {
    console.log(`${player}: ${score} points`);
  });
  
  // Check win condition
  const winResult = await game.checkWinCondition();
  console.log('\n🏆 Win condition:', winResult.hasWinner ? 
    `${winResult.winner} wins! (${winResult.reason})` : 'Game continues');
  
  console.log('\n✨ Demo complete!');
}

/**
 * Simple board display function
 */
function displayBoard(board: Map<string, any>) {
  const pieces = new Map([
    ['white_pawn', '♙'], ['white_rook', '♖'], ['white_knight', '♘'],
    ['white_bishop', '♗'], ['white_queen', '♕'], ['white_king', '♔'],
    ['black_pawn', '♟'], ['black_rook', '♜'], ['black_knight', '♞'], 
    ['black_bishop', '♝'], ['black_queen', '♛'], ['black_king', '♚']
  ]);

  console.log('  a b c d e f g h');
  for (let y = 7; y >= 0; y--) {
    let row = `${y + 1} `;
    for (let x = 0; x < 8; x++) {
      const piece = board.get(`${x},${y}`);
      if (piece) {
        const pieceKey = `${piece.data.piece.color}_${piece.data.piece.type}`;
        row += pieces.get(pieceKey) || '?';
      } else {
        row += (x + y) % 2 === 0 ? '·' : ' ';
      }
      row += ' ';
    }
    console.log(row);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runChessDemo().catch(console.error);
}

export { runChessDemo };