import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CardData, BattleRecord, GameState, LobbyInfo, OnlinePlayer } from '../types';
import CardPreview from './CardPreview';
import { EmojiHappyIcon, ArrowLeftIcon } from './Icons';
import EmojiPicker from './EmojiPicker';

interface MelleeOnlineProps {
  savedCards: CardData[];
  onRoundEnd: (record: Omit<BattleRecord, 'id'>) => void;
  pseudonym: string;
}

// --- Constants and Helpers ---
const LOBBY_LIST_KEY = 'mellee-online-lobby-list';
const GAME_STATE_PREFIX = 'mellee-game-';
const STALE_THRESHOLD = 15000; // 15 seconds

const initialGameState: Omit<GameState, 'gameId' | 'lastUpdate'> = {
  hostId: null, guestId: null, players: {}, spectators: {},
  p1Hp: 2000, p2Hp: 2000, p1Emoji: '', p2Emoji: '', p1Card: null, p2Card: null,
  activePlayer: null, timer: 60, isTimerRunning: false, isPaused: false, winner: null,
  p1Anim: '', p2Anim: '', p1HpAnim: '', p2HpAnim: '', guestAction: undefined,
};

const readLobbyList = (): LobbyInfo[] => {
  try {
    const rawList = localStorage.getItem(LOBBY_LIST_KEY);
    return rawList ? JSON.parse(rawList) : [];
  } catch (e) { return []; }
};

const writeLobbyList = (list: LobbyInfo[]) => {
  try {
    localStorage.setItem(LOBBY_LIST_KEY, JSON.stringify(list));
  } catch (e) { console.error("Failed to write lobby list", e); }
};

const readGameState = (gameId: string): GameState | null => {
  try {
    const rawState = localStorage.getItem(GAME_STATE_PREFIX + gameId);
    return rawState ? JSON.parse(rawState) : null;
  } catch (e) { return null; }
};

const writeGameState = (gameId: string, state: GameState) => {
  try {
    localStorage.setItem(GAME_STATE_PREFIX + gameId, JSON.stringify(state));
  } catch (e) { console.error("Failed to write game state", e); }
};


// --- UI Subcomponents ---

const PlayerStatus: React.FC<{ player: 'P1' | 'P2', hp: number, animation: string, name?: string }> = ({ player, hp, animation, name }) => {
    const isP1 = player === 'P1';
    const colorClasses = isP1 ? 'bg-blue-600 border-blue-400' : 'bg-red-600 border-red-400';
    const hpColor = isP1 ? 'text-blue-300' : 'text-red-300';

    return (
        <div className="flex flex-col items-center gap-2">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center font-bebas text-4xl shadow-lg border-4 ${colorClasses}`}>
                <span>{player}</span>
                <span className="text-sm -mt-2 truncate max-w-[80px]">{name || '...'}</span>
            </div>
            <div className={`font-bebas text-4xl transition-all duration-300 ${hpColor} ${animation}`}>{hp} HP</div>
        </div>
    );
};

const EmojiInput: React.FC<{
    emojis: string;
    isPickerOpen: boolean;
    setIsPickerOpen: (isOpen: boolean) => void;
    onEmojiSelect: (emoji: string) => void;
    isMyTurn: boolean;
    hasCard: boolean;
}> = ({ emojis, isPickerOpen, setIsPickerOpen, onEmojiSelect, isMyTurn, hasCard }) => {
    return (
        <div className="relative w-full">
            <div className={`text-2xl w-full p-2 rounded-lg bg-gray-700 border-2 flex items-center justify-center min-h-[52px] pr-10 transition-colors ${isMyTurn && !hasCard ? 'border-purple-500' : 'border-gray-600' }`}>
                {emojis ? <span className="text-3xl tracking-widest">{emojis}</span> : <span className="text-gray-400 text-base">...</span>}
            </div>
            <button
                type="button"
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                disabled={!isMyTurn || hasCard}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-purple-400 disabled:hover:text-gray-400 disabled:cursor-not-allowed">
                <EmojiHappyIcon className="w-6 h-6" />
            </button>
            {isPickerOpen && <EmojiPicker onEmojiSelect={onEmojiSelect} onClose={() => setIsPickerOpen(false)} />}
        </div>
    );
};

const LobbyUI: React.FC<{
  lobbyList: LobbyInfo[];
  onCreate: () => void;
  onJoin: (gameId: string) => void;
  pseudonym: string;
}> = ({ lobbyList, onCreate, onJoin, pseudonym }) => {
  return (
    <div className="max-w-md mx-auto bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-2xl animate-fade-in">
      <h2 className="text-3xl font-bebas text-purple-300 text-center tracking-wider">Lobby Online</h2>
      <p className="text-center text-gray-400 mb-6">Bem-vindo, {pseudonym}!</p>
      
      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
        {lobbyList.length > 0 ? (
          lobbyList.map(game => (
            <div key={game.gameId} className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
              <div>
                <p className="font-bold text-white">{game.hostPseudonym}'s Game</p>
                <p className={`text-sm ${game.status === 'waiting' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {game.status === 'waiting' ? 'Aguardando oponente' : 'Em progresso'}
                </p>
              </div>
              <button
                onClick={() => onJoin(game.gameId)}
                disabled={game.status !== 'waiting'}
                className="px-4 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                Entrar
              </button>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-4">Nenhum jogo disponível. Crie um!</p>
        )}
      </div>

      <button
        onClick={onCreate}
        className="mt-6 w-full py-3 bg-green-600 text-white font-bebas text-xl tracking-wider rounded-lg hover:bg-green-700 transition-colors shadow-lg"
      >
        Criar Jogo
      </button>
    </div>
  );
};


// --- Main Component ---

const MelleeOnline: React.FC<MelleeOnlineProps> = ({ savedCards, onRoundEnd, pseudonym }) => {
    const [view, setView] = useState<'lobby' | 'game'>('lobby');
    const [lobbyList, setLobbyList] = useState<LobbyInfo[]>([]);
    const [currentGameId, setCurrentGameId] = useState<string | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [myId] = useState(sessionStorage.getItem('myId') || `user-${Date.now()}-${Math.random()}`);
    const [myRole, setMyRole] = useState<'host' | 'guest' | null>(null);
    const [isP1PickerOpen, setIsP1PickerOpen] = useState(false);
    const [isP2PickerOpen, setIsP2PickerOpen] = useState(false);

    const gameLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    useEffect(() => {
        sessionStorage.setItem('myId', myId);
    }, [myId]);

    // --- Lobby Management ---
    useEffect(() => {
        const updateLobby = () => {
            const now = Date.now();
            const currentList = readLobbyList();
            const freshList = currentList.filter(game => (now - game.lastUpdate) < STALE_THRESHOLD);
            if(freshList.length < currentList.length) {
                writeLobbyList(freshList);
            }
            setLobbyList(freshList);
        };

        const intervalId = setInterval(updateLobby, 2000);
        const handleStorage = (e: StorageEvent) => {
            if (e.key === LOBBY_LIST_KEY) updateLobby();
        };
        window.addEventListener('storage', handleStorage);
        updateLobby();

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    const handleCreateGame = useCallback(() => {
        const gameId = `game-${myId}-${Date.now()}`;
        const me: OnlinePlayer = { id: myId, pseudonym };
        const newGame: GameState = {
            ...initialGameState,
            gameId,
            hostId: myId,
            players: { [myId]: me },
            lastUpdate: Date.now(),
        };
        
        writeGameState(gameId, newGame);
        
        const newLobbyInfo: LobbyInfo = { gameId, hostPseudonym: pseudonym, status: 'waiting', lastUpdate: Date.now() };
        const currentList = readLobbyList().filter(g => g.gameId !== gameId);
        writeLobbyList([...currentList, newLobbyInfo]);

        setCurrentGameId(gameId);
        setGameState(newGame);
        setMyRole('host');
        setView('game');
    }, [myId, pseudonym]);

    const handleJoinGame = useCallback((gameId: string) => {
        const game = readGameState(gameId);
        if (!game || game.guestId) {
            alert("Não foi possível entrar no jogo. Pode já estar cheio ou ter sido encerrado.");
            return;
        }

        const me: OnlinePlayer = { id: myId, pseudonym };
        game.guestId = myId;
        game.players[myId] = me;
        writeGameState(gameId, game);
        
        const currentList = readLobbyList();
        // FIX: Add 'as const' to prevent TypeScript from widening the 'status' literal type to a generic 'string'.
        const updatedList = currentList.map(g => g.gameId === gameId ? {...g, status: 'in-progress' as const} : g);
        writeLobbyList(updatedList);

        setCurrentGameId(gameId);
        setGameState(game);
        setMyRole('guest');
        setView('game');
    }, [myId, pseudonym]);

    const handleLeaveGame = useCallback(() => {
        if (!currentGameId) return;

        const list = readLobbyList().filter(g => g.gameId !== currentGameId);
        writeLobbyList(list);
        localStorage.removeItem(GAME_STATE_PREFIX + currentGameId);

        setCurrentGameId(null);
        setGameState(null);
        setMyRole(null);
        setView('lobby');
    }, [currentGameId]);


    // --- In-Game Logic ---
    useEffect(() => {
        if (view !== 'game' || !currentGameId) return;

        const handleGameSync = (e: StorageEvent) => {
            if (e.key === GAME_STATE_PREFIX + currentGameId && e.newValue) {
                setGameState(JSON.parse(e.newValue));
            }
        };
        window.addEventListener('storage', handleGameSync);

        return () => window.removeEventListener('storage', handleGameSync);
    }, [view, currentGameId]);

    // Main Game Loop (HOST ONLY)
    useEffect(() => {
        if (myRole !== 'host' || !gameState || !currentGameId) return;
        
        const hostLoop = () => {
            let state = readGameState(currentGameId);
            if (!state) return;

            // Update lobby heartbeat
            const lobby = readLobbyList().map(g => g.gameId === currentGameId ? {...g, lastUpdate: Date.now()} : g);
            writeLobbyList(lobby);

            if (!state.isTimerRunning || state.isPaused || state.winner) {
                 return; // Loop is active but game is paused/ended
            }

            // Process guest actions
            if (state.guestAction?.type === 'EMOJI_SELECT') {
                const newCombination = state.p2Emoji + state.guestAction.payload;
                const matchedCard = savedCards.find(card => card.combination === newCombination);
                if (matchedCard) {
                    state.p2Card = { ...matchedCard, currentEnergy: parseInt(matchedCard.energy, 10) };
                    if (state.p1Card) {
                        // BATTLE! handled below
                    } else {
                        state.activePlayer = 'P1'; state.timer = 60;
                    }
                }
                state.p2Emoji = newCombination;
                state.guestAction = undefined;
            }
            
            // Handle battle
            if (state.p1Card && state.p2Card) {
                // Battle logic here... (omitted for brevity, will be added in handleBattle call)
            }


            // Handle timer
            if (state.timer > 0) {
                state.timer -= 1;
            } else {
                // Handle timeout
            }
            
            state.lastUpdate = Date.now();
            writeGameState(currentGameId, state);
        };

        const intervalId = setInterval(hostLoop, 1000);
        return () => clearInterval(intervalId);

    }, [myRole, gameState, currentGameId, savedCards]);
    
    const handleGameControl = () => {
        if(myRole !== 'host' || !gameState || !currentGameId) return;
        let newState = {...gameState};
        if(!newState.isTimerRunning) {
            if(!newState.guestId) { alert("Aguardando oponente..."); return; }
            newState.isTimerRunning = true;
            newState.isPaused = false;
            newState.activePlayer = Math.random() < 0.5 ? 'P1' : 'P2';
            newState.timer = 60;
        } else {
            newState.isPaused = !newState.isPaused;
        }
        writeGameState(currentGameId, newState);
    };

    const handleEmojiSelect = (emoji: string) => {
      if(!gameState || !currentGameId) return;

      if(myRole === 'host' && gameState.activePlayer === 'P1' && Array.from(gameState.p1Emoji).length < 3){
         let newState = {...gameState};
         newState.p1Emoji += emoji;
         const matchedCard = savedCards.find(c => c.combination === newState.p1Emoji);
         if(matchedCard){
            newState.p1Card = { ...matchedCard, currentEnergy: parseInt(matchedCard.energy, 10) };
            if(!newState.p2Card) {
                newState.activePlayer = 'P2'; newState.timer = 60;
            }
         }
         writeGameState(currentGameId, newState);
      } else if (myRole === 'guest' && gameState.activePlayer === 'P2' && Array.from(gameState.p2Emoji).length < 3) {
        let newState = {...gameState};
        newState.guestAction = { type: 'EMOJI_SELECT', payload: emoji };
        writeGameState(currentGameId, newState);
      }
    };
    
  if (view === 'lobby') {
    return <LobbyUI lobbyList={lobbyList} onCreate={handleCreateGame} onJoin={handleJoinGame} pseudonym={pseudonym} />
  }

  if (view === 'game' && gameState) {
    const isMyTurn = (myRole === 'host' && gameState.activePlayer === 'P1') || (myRole === 'guest' && gameState.activePlayer === 'P2');
    return (
      <div className="animate-fade-in text-center p-4">
        <button onClick={handleLeaveGame} className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">
            <ArrowLeftIcon className="w-4 h-4" /> Lobby
        </button>

        <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-start gap-4 max-w-6xl mx-auto mt-8">
          {/* Player 1 Area */}
          <div className="flex flex-col items-center gap-4">
            <PlayerStatus player="P1" hp={gameState.p1Hp} animation={gameState.p1HpAnim} name={gameState.hostId ? gameState.players[gameState.hostId]?.pseudonym : ''} />
            <EmojiInput 
              emojis={gameState.p1Emoji} isPickerOpen={isP1PickerOpen} setIsPickerOpen={setIsP1PickerOpen}
              onEmojiSelect={(e) => handleEmojiSelect(e)}
              isMyTurn={myRole === 'host' && gameState.activePlayer === 'P1'} hasCard={!!gameState.p1Card}
            />
            <div className="w-full h-[210px] md:h-[336px] flex justify-center items-center">
                {gameState.p1Card ? <div className={`transform scale-[0.5] md:scale-[0.8] ${gameState.p1Anim}`}><CardPreview cardData={gameState.p1Card} /></div> : 
                <div className={`w-[150px] h-[210px] md:w-[240px] md:h-[336px] rounded-2xl border-4 border-dashed flex items-center justify-center text-gray-500 transition-all ${gameState.activePlayer === 'P1' ? 'border-blue-500 animate-pulse' : 'border-gray-700'}`}>Aguardando P1</div>}
            </div>
          </div>
          
          {/* Center Area */}
          <div className="col-span-2 md:col-span-1 order-first md:order-none flex flex-col items-center gap-6 pt-4 md:pt-16">
            <div className="font-bebas text-7xl text-yellow-300 drop-shadow-lg">{gameState.isTimerRunning ? gameState.timer : '--'}</div>
            <div className="h-20 mt-4">
               {gameState.winner && <div className="animate-fade-in"><h3 className="text-2xl font-bebas text-purple-300">{gameState.winner}</h3></div>}
            </div>
          </div>
          
          {/* Player 2 Area */}
          <div className="flex flex-col items-center gap-4">
            <PlayerStatus player="P2" hp={gameState.p2Hp} animation={gameState.p2HpAnim} name={gameState.guestId ? gameState.players[gameState.guestId]?.pseudonym : ''} />
            <EmojiInput 
              emojis={gameState.p2Emoji} isPickerOpen={isP2PickerOpen} setIsPickerOpen={setIsP2PickerOpen}
              onEmojiSelect={(e) => handleEmojiSelect(e)}
              isMyTurn={myRole === 'guest' && gameState.activePlayer === 'P2'} hasCard={!!gameState.p2Card}
            />
            <div className="w-full h-[210px] md:h-[336px] flex justify-center items-center">
                {gameState.p2Card ? <div className={`transform scale-[0.5] md:scale-[0.8] ${gameState.p2Anim}`}><CardPreview cardData={gameState.p2Card} /></div> : 
                <div className={`w-[150px] h-[210px] md:w-[240px] md:h-[336px] rounded-2xl border-4 border-dashed flex items-center justify-center text-gray-500 transition-all ${gameState.activePlayer === 'P2' ? 'border-red-500 animate-pulse' : 'border-gray-700'}`}>Aguardando P2</div>}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-4 mt-8">
            <button
                onClick={handleGameControl}
                disabled={myRole !== 'host'}
                className="px-6 py-2 bg-green-600 text-white font-bebas text-xl tracking-wider rounded-lg hover:bg-green-700 transition-colors shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                {gameState.isTimerRunning ? (gameState.isPaused ? 'Continuar' : 'Pausar') : 'Começar'}
            </button>
        </div>
      </div>
    );
  }

  return <div className="text-center text-gray-400 p-8">Carregando...</div>;
};

export default MelleeOnline;