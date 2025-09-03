import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Import BattleRecord type to be used in onRoundEnd prop.
import { CardData, GameState, LobbyInfo, OnlinePlayer, BattleRecord } from '../types';
import CardPreview from './CardPreview';
import { EmojiHappyIcon, ArrowLeftIcon } from './Icons';
import EmojiPicker from './EmojiPicker';

interface MelleeOnlineProps {
  savedCards: CardData[];
  onRoundEnd: (record: Omit<BattleRecord, 'id'>) => void;
  pseudonym: string;
}

// --- Constants and WebSocket Service ---
const LOBBY_WS_URL = 'wss://pico-db.fly.dev/emoji-mellee-lobby-v3';
const GAME_WS_URL_PREFIX = 'wss://pico-db.fly.dev/emoji-mellee-game-v3-';

const initialGameState: Omit<GameState, 'gameId' | 'lastUpdate'> = {
  hostId: null, guestId: null, players: {}, spectators: {},
  p1Hp: 2000, p2Hp: 2000, p1Emoji: '', p2Emoji: '', p1Card: null, p2Card: null,
  activePlayer: null, timer: 60, isTimerRunning: false, isPaused: false, winner: null,
  p1Anim: '', p2Anim: '', p1HpAnim: '', p2HpAnim: '', action: undefined,
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
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [myId] = useState(sessionStorage.getItem('myId') || `user-${Date.now()}-${Math.random()}`);
    const [myRole, setMyRole] = useState<'host' | 'guest' | null>(null);
    const [isP1PickerOpen, setIsP1PickerOpen] = useState(false);
    const [isP2PickerOpen, setIsP2PickerOpen] = useState(false);

    const lobbyWs = useRef<WebSocket | null>(null);
    const gameWs = useRef<WebSocket | null>(null);
    const hostGameLoop = useRef<ReturnType<typeof setInterval> | null>(null);
    const myRoleRef = useRef(myRole);

    useEffect(() => {
        myRoleRef.current = myRole;
    }, [myRole]);

    useEffect(() => {
        sessionStorage.setItem('myId', myId);
    }, [myId]);

    // --- WebSocket Management ---
    const connectToLobby = useCallback(() => {
        if (lobbyWs.current?.readyState === WebSocket.OPEN) return;
        if (lobbyWs.current) lobbyWs.current.close();
        
        const ws = new WebSocket(LOBBY_WS_URL);
        ws.onopen = () => console.log('Connected to lobby');
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const lobbies: LobbyInfo[] = Object.values(data).filter(Boolean) as LobbyInfo[];
                const now = Date.now();
                const freshLobbies = lobbies.filter(l => (now - l.lastUpdate) < 30000); 
                setLobbyList(freshLobbies);
            } catch (error) {
                console.error("Failed to parse lobby data:", error)
            }
        };
        ws.onclose = () => {
            lobbyWs.current = null;
            // Always try to reconnect while the component is mounted.
            // The cleanup function in the main useEffect will prevent this on unmount.
            console.log('Disconnected from lobby. Reconnecting...');
            setTimeout(connectToLobby, 2000);
        };
        ws.onerror = (err) => {
            console.error('Lobby WebSocket error:', err);
            ws.close();
        };
        lobbyWs.current = ws;
    }, []);

    const connectToGame = useCallback((gameId: string) => {
        if (gameWs.current) gameWs.current.close();

        const ws = new WebSocket(GAME_WS_URL_PREFIX + gameId);
        ws.onopen = () => console.log(`Connected to game ${gameId}`);
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const currentRole = myRoleRef.current;

                // Guest always accepts the state from the host
                if (currentRole === 'guest' && data.state) {
                    setGameState(data.state);
                    return;
                }

                // Host processes actions from guest and merges them into its state
                if (currentRole === 'host') {
                    // Handle state messages (could be echoes or from other sources)
                    if (data.state) {
                         setGameState(currentState => {
                            if (!currentState || data.state.lastUpdate > currentState.lastUpdate) {
                                return data.state;
                            }
                            return currentState;
                        });
                    }
                    // Handle action messages from the guest
                    if (data.action) {
                        setGameState(currentState => {
                            if (!currentState || currentState.action) return currentState; // Don't overwrite an unprocessed action
                            return { ...currentState, action: data.action };
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to parse game data:", error)
            }
        };
        ws.onclose = () => {
            gameWs.current = null;
        };
        ws.onerror = (err) => {
            console.error('Game WebSocket error:', err);
            ws.close();
        }
        gameWs.current = ws;
    }, []);

    // --- Lobby Connection Lifecycle ---
    useEffect(() => {
        connectToLobby();
        return () => {
            if (lobbyWs.current) {
                lobbyWs.current.onclose = null; // Prevent reconnect on component unmount
                lobbyWs.current.close();
                lobbyWs.current = null;
            }
        };
    }, [connectToLobby]);

    const handleCreateGame = useCallback(() => {
        const gameId = `game-${myId.substring(5, 10)}-${Date.now()}`;
        const me: OnlinePlayer = { id: myId, pseudonym };
        const newGame: GameState = {
            ...initialGameState,
            gameId,
            hostId: myId,
            players: { [myId]: me },
            lastUpdate: Date.now(),
        };
        
        const newLobbyInfo: LobbyInfo = { gameId, hostPseudonym: pseudonym, status: 'waiting', lastUpdate: Date.now() };
        if (lobbyWs.current?.readyState === WebSocket.OPEN) {
            lobbyWs.current.send(JSON.stringify({ [gameId]: newLobbyInfo }));
        }

        connectToGame(gameId);
        setMyRole('host');
        setView('game');

        setTimeout(() => {
            if(gameWs.current?.readyState === WebSocket.OPEN) {
                gameWs.current.send(JSON.stringify({ state: newGame }));
            }
        }, 500);
        
        // This will be set by the onmessage handler, but we set it locally for immediate UI update.
        setGameState(newGame);
    }, [myId, pseudonym, connectToGame]);

    const handleJoinGame = useCallback((gameId: string) => {
        const lobbyInfo = lobbyList.find(l => l.gameId === gameId);
        if (!lobbyInfo) return;

        const updatedLobbyInfo = { ...lobbyInfo, status: 'in-progress' as const, lastUpdate: Date.now() };
        if (lobbyWs.current?.readyState === WebSocket.OPEN) {
            lobbyWs.current.send(JSON.stringify({ [gameId]: updatedLobbyInfo }));
        }

        connectToGame(gameId);
        setMyRole('guest');
        setView('game');

        setTimeout(() => {
            const me: OnlinePlayer = { id: myId, pseudonym };
            const joinAction = { type: 'JOIN', payload: me };
            if (gameWs.current?.readyState === WebSocket.OPEN) {
                // When a guest joins, it sends an action that will overwrite the server state.
                // The host will receive this action, update the state, and broadcast the new full state.
                gameWs.current.send(JSON.stringify({ action: joinAction }));
            }
        }, 1000);
    }, [myId, pseudonym, connectToGame, lobbyList]);

    const handleLeaveGame = useCallback(() => {
        const gameId = gameState?.gameId;
        if (gameId && myRole === 'host' && lobbyWs.current) {
            // Tell the lobby this game is gone.
            lobbyWs.current.send(JSON.stringify({ [gameId]: null }));
        }
        if (gameWs.current) {
            gameWs.current.onclose = null;
            gameWs.current.close();
            gameWs.current = null;
        }
        if (hostGameLoop.current) clearInterval(hostGameLoop.current);

        setGameState(null);
        setMyRole(null);
        setView('lobby');
    }, [gameState, myRole]);


    // Guest Join Handler (for Host)
    useEffect(() => {
      if(myRole === 'host' && gameState) {
        const joinAction = gameState.action;
        if(joinAction?.type === 'JOIN' && !gameState.guestId) {
            const guestPlayer = joinAction.payload as OnlinePlayer;
            const newState = {
                ...gameState,
                guestId: guestPlayer.id,
                players: { ...gameState.players, [guestPlayer.id]: guestPlayer },
                action: undefined // Clear the action
            };
            if(gameWs.current?.readyState === WebSocket.OPEN){
                gameWs.current.send(JSON.stringify({ state: newState }));
            }
            if (lobbyWs.current?.readyState === WebSocket.OPEN) {
                const lobbyInfoUpdate: LobbyInfo = {
                    gameId: gameState.gameId,
                    hostPseudonym: pseudonym,
                    status: 'in-progress',
                    lastUpdate: Date.now()
                };
                lobbyWs.current.send(JSON.stringify({ [gameState.gameId]: lobbyInfoUpdate }));
            }
        }
      }
    }, [gameState, myRole, pseudonym]);


    // --- Host Game Loop ---
    useEffect(() => {
        if (myRole !== 'host' || !gameState?.gameId) {
            if (hostGameLoop.current) clearInterval(hostGameLoop.current);
            return;
        }

        hostGameLoop.current = setInterval(() => {
            if (!gameWs.current || gameWs.current.readyState !== WebSocket.OPEN) return;
            
            setGameState(currentGameState => {
                if (!currentGameState) return null;

                let state = { ...currentGameState };
                let updated = false;

                // Process actions from guest
                if (state.action && state.action.type === 'EMOJI_SELECT') {
                    if (state.activePlayer === 'P2' && Array.from(state.p2Emoji).length < 3) {
                        state.p2Emoji += state.action.payload;
                        const card = savedCards.find(c => c.combination === state.p2Emoji);
                        if (card) {
                            state.p2Card = { ...card, currentEnergy: parseInt(card.energy, 10) };
                            if (!state.p1Card) {
                                state.activePlayer = 'P1';
                                state.timer = 60;
                            }
                        }
                    }
                    state.action = undefined;
                    updated = true;
                }

                if (state.isTimerRunning && !state.isPaused && !state.p1Card && !state.p2Card) {
                    if (state.timer > 0) {
                        state.timer--;
                    } else {
                        state.activePlayer = state.activePlayer === 'P1' ? 'P2' : 'P1';
                        state.timer = 60;
                    }
                    updated = true;
                }
                
                // Keep lobby informed with a heartbeat
                if (lobbyWs.current?.readyState === WebSocket.OPEN) {
                    const lobbyInfoUpdate: LobbyInfo = {
                        gameId: state.gameId,
                        hostPseudonym: pseudonym,
                        status: state.guestId ? 'in-progress' : 'waiting',
                        lastUpdate: Date.now()
                    };
                    lobbyWs.current.send(JSON.stringify({ [state.gameId]: lobbyInfoUpdate }));
                }

                if (updated) {
                    const finalState = {...state, lastUpdate: Date.now() };
                    if (gameWs.current?.readyState === WebSocket.OPEN) {
                        gameWs.current.send(JSON.stringify({ state: finalState }));
                    }
                    return finalState;
                }
                return state;
            });
        }, 1000);

        return () => {
            if (hostGameLoop.current) clearInterval(hostGameLoop.current);
        };
    }, [myRole, gameState?.gameId, savedCards, pseudonym]);


    const handleGameControl = () => {
        if(myRole !== 'host' || !gameState || !gameWs.current) return;
        let newState = {...gameState, lastUpdate: Date.now()};
        if(!newState.isTimerRunning) {
            if(!newState.guestId) { alert("Aguardando oponente..."); return; }
            newState.isTimerRunning = true;
            newState.isPaused = false;
            newState.activePlayer = Math.random() < 0.5 ? 'P1' : 'P2';
            newState.timer = 60;
        } else {
            newState.isPaused = !newState.isPaused;
        }
        gameWs.current.send(JSON.stringify({ state: newState }));
    };

    const handleEmojiSelect = (emoji: string) => {
      if(!gameState || !gameWs.current) return;

      if(myRole === 'host' && gameState.activePlayer === 'P1' && Array.from(gameState.p1Emoji).length < 3){
         let newState = {...gameState, lastUpdate: Date.now()};
         newState.p1Emoji += emoji;
         const matchedCard = savedCards.find(c => c.combination === newState.p1Emoji);
         if(matchedCard){
            newState.p1Card = { ...matchedCard, currentEnergy: parseInt(matchedCard.energy, 10) };
            if(!newState.p2Card) {
                newState.activePlayer = 'P2'; newState.timer = 60;
            }
         }
         gameWs.current.send(JSON.stringify({ state: newState }));
      } else if (myRole === 'guest' && gameState.activePlayer === 'P2' && Array.from(gameState.p2Emoji).length < 3) {
        const action = { type: 'EMOJI_SELECT', payload: emoji };
        gameWs.current.send(JSON.stringify({ action }));
      }
    };
    
  if (view === 'lobby') {
    return <LobbyUI lobbyList={lobbyList} onCreate={handleCreateGame} onJoin={handleJoinGame} pseudonym={pseudonym} />
  }

  if (view === 'game' && gameState) {
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
              onEmojiSelect={handleEmojiSelect}
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
              onEmojiSelect={handleEmojiSelect}
              isMyTurn={myRole === 'guest' && gameState.activePlayer === 'P2'} hasCard={!!gameState.p2Card}
            />
            <div className="w-full h-[210px] md:h-[336px] flex justify-center items-center">
                {gameState.p2Card ? <div className={`transform scale-[0.5] md:scale-[0.8] ${gameState.p2Anim}`}><CardPreview cardData={gameState.p2Card} /></div> : 
                <div className={`w-[150px] h-[210px] md:w-[240px] md:h-[336px] rounded-2xl border-4 border-dashed flex items-center justify-center text-gray-500 transition-all ${gameState.activePlayer === 'P2' ? 'border-red-500 animate-pulse' : 'border-gray-700'}`}>{gameState.guestId ? 'Aguardando P2' : 'Vazio'}</div>}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-4 mt-8">
            <button
                onClick={handleGameControl}
                disabled={myRole !== 'host' || !!gameState.winner}
                className="px-6 py-2 bg-green-600 text-white font-bebas text-xl tracking-wider rounded-lg hover:bg-green-700 transition-colors shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                {gameState.isTimerRunning ? (gameState.isPaused ? 'Continuar' : 'Pausar') : 'Começar'}
            </button>
        </div>
      </div>
    );
  }

  return <div className="text-center text-gray-400 p-8">Conectando ao servidor...</div>;
};

export default MelleeOnline;