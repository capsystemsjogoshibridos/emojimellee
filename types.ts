
export interface CardData {
  id: string;
  name: string;
  power: string;
  energy: string;
  ability: string;
  image: string | null;
  combination?: string;
  currentEnergy?: number;
}

export interface BattleRecord {
  id: string;
  fighter1: CardData;
  fighter2: CardData;
  winnerId: string | null; // null for a draw
  mode: 'simulator' | 'mellee' | 'solo';
}

export interface OnlinePlayer {
  id: string;
  pseudonym: string;
}

export interface LobbyInfo {
  gameId: string;
  hostPseudonym: string;
  status: 'waiting' | 'in-progress';
  lastUpdate: number;
}

export interface GameState {
  // Player management
  hostId: string | null;
  guestId: string | null;
  players: Record<string, OnlinePlayer>;
  spectators: Record<string, OnlinePlayer>;

  // Game progress state
  p1Hp: number;
  p2Hp: number;
  p1Emoji: string;
  p2Emoji: string;
  p1Card: CardData | null;
  p2Card: CardData | null;
  activePlayer: 'P1' | 'P2' | null;
  timer: number;
  isTimerRunning: boolean;
  isPaused: boolean;
  winner: string | null;

  // Animation state
  p1Anim: string;
  p2Anim: string;
  p1HpAnim: string;
  p2HpAnim: string;

  // Guest -> Host communication
  guestAction?: { type: 'EMOJI_SELECT'; payload: string } | { type: 'CLEAR_EMOJI' };

  // Sync info
  lastUpdate: number;
  gameId: string; // To differentiate between separate games
}