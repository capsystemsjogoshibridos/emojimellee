
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CardData, GameState, OnlinePlayer, BattleRecord } from '../types';
import CardPreview from './CardPreview';
import { EmojiHappyIcon, ArrowLeftIcon } from './Icons';
import EmojiPicker from './EmojiPicker';

interface MelleeOnlineProps {
  savedCards: CardData[];
  onRoundEnd: (record: Omit<BattleRecord, 'id'>) => void;
  pseudonym: string;
}

const GAME_WS_URL_PREFIX = 'wss://pico-db.fly.dev/emoji-mellee-game-v4-';

const initialGameState: Omit<GameState, 'gameId' | 'lastUpdate'> = {
  hostId: null, guestId: null, players: {}, spectators: {},
  p1Hp: 2000, p2Hp: 2000, p1Emoji: '', p2Emoji: '', p1Card: null, p2Card: null,
  activePlayer: null, timer: 60, isTimerRunning: false, isPaused: false, winner: null,
  p1Anim: '', p2Anim: '', p1HpAnim: '', p2HpAnim: '', action: undefined,
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

const SetupUI: React.FC<{
    mode: 'host' | 'join';
    setMode: (mode: 'host' | 'join') => void;
    gameId: string | null;
    onJoin: (id: string) => void;
}> = ({ mode, setMode, gameId, onJoin }) => {
    const [joinInput, setJoinInput] = useState('');

    const handleJoinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(joinInput.trim()) {
            onJoin(joinInput.trim());
        }
    }

    if (mode === 'host') {
        return (
            <div className="text-center max-w-md mx-auto">
                <h2 className="text-2xl font-bebas text-purple-300 tracking-wider">Seu Jogo está Pronto!</h2>
                <p className="text-gray-400 mt-2">Compartilhe o ID abaixo com seu amigo para ele poder entrar.</p>
                <div className="my-6 p-4 bg-gray-900 rounded-lg border border-dashed border-gray-600">
                    <p className="text-sm text-gray-500">ID DO JOGO</p>
                    <p className="text-3xl font-bold tracking-widest text-white">{gameId || 'Gerando...'}</p>
                </div>
                <p className="text-yellow-400 animate-pulse">Aguardando oponente...</p>
                <button onClick={() => setMode('join')} className="mt-8 text-purple-400 hover:text-purple-300">
                    Quer entrar em um jogo?
                </button>
            </div>
        )
    }

    return (
        <div className="text-center max-w-md mx-auto">
            <h2 className="text-2xl font-bebas text-purple-300 tracking-wider">Entrar em um Jogo</h2>
            <p className="text-gray-400 mt-2">Digite o ID do jogo que seu amigo compartilhou.</p>
            <form onSubmit={handleJoinSubmit} className="my-6 flex flex-col items-center gap-4">
                <input
                    type="text"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    className="w-full max-w-xs text-center p-3 bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-lg text-white tracking-widest"
                    placeholder="Digite o ID do Jogo"
                    required
                />
                <button type="submit" className="px-8 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-bebas text-xl tracking-wider">
                    Entrar
                </button>
            </form>
            <button onClick={() => setMode('host')} className="mt-4 text-purple-400 hover:text-purple-300">
                Quer criar um novo jogo?
            </button>
        </div>
    )
}

const MelleeOnline: React.FC<MelleeOnlineProps> = ({ savedCards, onRoundEnd, pseudonym }) => {
    const [setupMode, setSetupMode] = useState<'host' | 'join'>('host');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [myId] = useState(sessionStorage.getItem('myId') || `user-${Date.now()}-${Math.random()}`);
    const [myRole, setMyRole] = useState<'host' | 'guest' | null>(null);
    const [isP1PickerOpen, setIsP1PickerOpen] = useState(false);
    const [isP2PickerOpen, setIsP2PickerOpen] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const gameWs = useRef<WebSocket | null>(null);
    const hostStateRef = useRef(gameState);
    const battleProcessor = useRef<Promise<void> | null>(null);

    useEffect(() => {
        hostStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        sessionStorage.setItem('myId', myId);
    }, [myId]);

    const connectToGame = useCallback((gameId: string, onOpen: () => void) => {
        if (gameWs.current) gameWs.current.close();
        setIsConnecting(true);

        const ws = new WebSocket(GAME_WS_URL_PREFIX + gameId);
        ws.onopen = () => {
            console.log(`Connected to game ${gameId}`);
            setIsConnecting(false);
            onOpen();
        };
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.state) {
                    setGameState(data.state);
                }
                if (myRole === 'host' && data.action) {
                    setGameState(currentState => {
                        if (!currentState || currentState.action) return currentState;
                        return { ...currentState, action: data.action };
                    });
                }
            } catch (error) { console.error("Failed to parse game data:", error) }
        };
        ws.onclose = () => { gameWs.current = null; setIsConnecting(false); };
        ws.onerror = (err) => { console.error('Game WebSocket error:', err); ws.close(); setIsConnecting(false); };
        gameWs.current = ws;
    }, [myRole]);

    const broadcastState = useCallback((state: GameState) => {
        if (gameWs.current?.readyState === WebSocket.OPEN) {
            gameWs.current.send(JSON.stringify({ state }));
        }
    }, []);

    const createGame = useCallback(() => {
        const gameId = `g-${Math.random().toString(36).substring(2, 7)}`;
        const me: OnlinePlayer = { id: myId, pseudonym };
        const newGame: GameState = {
            ...initialGameState, gameId, hostId: myId, players: { [myId]: me }, lastUpdate: Date.now(),
        };
        setMyRole('host');
        connectToGame(gameId, () => {
            setGameState(newGame);
            broadcastState(newGame);
        });
    }, [myId, pseudonym, connectToGame, broadcastState]);
    
    const joinGame = useCallback((gameId: string) => {
        setMyRole('guest');
        connectToGame(gameId, () => {
            const me: OnlinePlayer = { id: myId, pseudonym };
            const joinAction = { type: 'JOIN' as const, payload: me };
            if (gameWs.current?.readyState === WebSocket.OPEN) {
                gameWs.current.send(JSON.stringify({ action: joinAction }));
            }
        });
    }, [myId, pseudonym, connectToGame]);
    
    const leaveGame = useCallback(() => {
        if (gameWs.current) {
            gameWs.current.onclose = null;
            gameWs.current.close();
        }
        setGameState(null);
        setMyRole(null);
        setSetupMode('host'); // Default to hosting when returning
    }, []);
    
    useEffect(() => {
        if (setupMode === 'host' && !gameState) {
            createGame();
        } else if (setupMode === 'join' && gameState) {
            leaveGame(); // Clean up host game if switching to join
        }
    }, [setupMode, createGame, gameState, leaveGame]);

    useEffect(() => {
        // Main host logic
        if (myRole !== 'host' || !gameState) return;

        let newState = { ...gameState };
        let stateChanged = false;

        // Process guest actions
        if (newState.action) {
            const action = newState.action;
            if (action.type === 'JOIN' && !newState.guestId) {
                const guest = action.payload;
                newState.guestId = guest.id;
                newState.players[guest.id] = guest;
                newState.activePlayer = Math.random() < 0.5 ? 'P1' : 'P2';
                newState.isTimerRunning = true;
                newState.timer = 60;
                stateChanged = true;
            }
            if (action.type === 'EMOJI_SELECT' && newState.activePlayer === 'P2' && Array.from(newState.p2Emoji).length < 3) {
                newState.p2Emoji += action.payload;
                const card = savedCards.find(c => c.combination === newState.p2Emoji);
                if (card) {
                    newState.p2Card = { ...card, currentEnergy: parseInt(card.energy, 10) };
                    if (!newState.p1Card) {
                        newState.activePlayer = 'P1';
                        newState.timer = 60;
                    }
                }
                stateChanged = true;
            }
            newState.action = undefined;
        }

        // BATTLE LOGIC TRIGGER
        if (newState.p1Card && newState.p2Card && !newState.winner && !battleProcessor.current) {
            const runBattle = async () => {
                let battleState = { ...hostStateRef.current! };

                battleState.isTimerRunning = false;
                battleState.winner = "Batalha!";
                setGameState(battleState); broadcastState(battleState);
                await sleep(500);

                battleState.p1Anim = 'animate-lunge-right';
                battleState.p2Anim = 'animate-lunge-left';
                setGameState(battleState); broadcastState(battleState);
                await sleep(1500);

                const card1 = battleState.p1Card!, card2 = battleState.p2Card!;
                const p1Energy = card1.currentEnergy ?? parseInt(card1.energy, 10);
                const p2Energy = card2.currentEnergy ?? parseInt(card2.energy, 10);
                let winnerId: string | null = null;

                if (p1Energy > p2Energy) {
                    const diff = p1Energy - p2Energy;
                    battleState.p2Hp = Math.max(0, battleState.p2Hp - diff);
                    battleState.winner = `${card1.name} vence!`; winnerId = card1.id;
                    battleState.p1Anim = 'animate-winner-glow'; battleState.p2Anim = 'animate-disintegrate';
                    battleState.p2HpAnim = 'animate-hp-flash';
                } else if (p2Energy > p1Energy) {
                    const diff = p2Energy - p1Energy;
                    battleState.p1Hp = Math.max(0, battleState.p1Hp - diff);
                    battleState.winner = `${card2.name} vence!`; winnerId = card2.id;
                    battleState.p2Anim = 'animate-winner-glow'; battleState.p1Anim = 'animate-disintegrate';
                    battleState.p1HpAnim = 'animate-hp-flash';
                } else {
                    battleState.winner = 'Empate!';
                    battleState.p1Anim = 'animate-disintegrate'; battleState.p2Anim = 'animate-disintegrate';
                }
                
                onRoundEnd({ fighter1: card1, fighter2: card2, winnerId, mode: 'mellee' });
                setGameState(battleState); broadcastState(battleState);
                await sleep(500);
                battleState.p1HpAnim = ''; battleState.p2HpAnim = '';
                setGameState(battleState); broadcastState(battleState);
                
                await sleep(2500);

                // Check for game over
                if (battleState.p1Hp <= 0) {
                    battleState.winner = `${battleState.players[battleState.guestId!].pseudonym} venceu!`;
                } else if (battleState.p2Hp <= 0) {
                    battleState.winner = `${battleState.players[battleState.hostId!].pseudonym} venceu!`;
                } else {
                    // Reset for next round
                    battleState.p1Card = null; battleState.p2Card = null;
                    battleState.p1Emoji = ''; battleState.p2Emoji = '';
                    battleState.p1Anim = ''; battleState.p2Anim = '';
                    battleState.winner = null;
                    battleState.isTimerRunning = true;
                    battleState.activePlayer = Math.random() < 0.5 ? 'P1' : 'P2';
                    battleState.timer = 60;
                }
                setGameState(battleState); broadcastState(battleState);
                battleProcessor.current = null;
            };
            battleProcessor.current = runBattle();
            return;
        }

        if (stateChanged) {
            newState.lastUpdate = Date.now();
            broadcastState(newState);
        }
    }, [gameState, myRole, savedCards, broadcastState, onRoundEnd]);

    // Timer interval for host
    useEffect(() => {
        if (myRole !== 'host') return;
        const timerInterval = setInterval(() => {
            const state = hostStateRef.current;
            if (state && state.isTimerRunning && !state.isPaused && !state.winner) {
                if (state.timer > 0) {
                    setGameState(s => s ? {...s, timer: s.timer - 1} : null);
                } else {
                    setGameState(s => s ? {...s, timer: 60, activePlayer: s.activePlayer === 'P1' ? 'P2' : 'P1' } : null);
                }
            }
        }, 1000);
        return () => clearInterval(timerInterval);
    }, [myRole]);


    const handleEmojiSelect = (emoji: string) => {
      if(!gameState || !gameWs.current) return;
      const isMyTurnAsHost = myRole === 'host' && gameState.activePlayer === 'P1';
      const isMyTurnAsGuest = myRole === 'guest' && gameState.activePlayer === 'P2';

      if (isMyTurnAsHost && Array.from(gameState.p1Emoji).length < 3) {
         let newState = {...gameState};
         newState.p1Emoji += emoji;
         const matchedCard = savedCards.find(c => c.combination === newState.p1Emoji);
         if(matchedCard){
            newState.p1Card = { ...matchedCard, currentEnergy: parseInt(matchedCard.energy, 10) };
            if(!newState.p2Card) { newState.activePlayer = 'P2'; newState.timer = 60; }
         }
         broadcastState(newState);
      } else if (isMyTurnAsGuest && Array.from(gameState.p2Emoji).length < 3) {
        const action = { type: 'EMOJI_SELECT' as const, payload: emoji };
        gameWs.current.send(JSON.stringify({ action }));
      }
    };
    
    if (isConnecting) {
        return <div className="text-center text-gray-400 p-8">Conectando...</div>;
    }

    if (!gameState || !gameState.guestId) {
        return (
            <div className="animate-fade-in p-4">
                <SetupUI mode={setupMode} setMode={setSetupMode} gameId={gameState?.gameId || null} onJoin={joinGame} />
            </div>
        )
    }

    // --- Game View ---
    return (
      <div className="animate-fade-in text-center p-4">
        <button onClick={leaveGame} className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">
            <ArrowLeftIcon className="w-4 h-4" /> Sair
        </button>

        <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-start gap-4 max-w-6xl mx-auto mt-8">
          <div className="flex flex-col items-center gap-4">
            <PlayerStatus player="P1" hp={gameState.p1Hp} animation={gameState.p1HpAnim} name={gameState.players[gameState.hostId!]?.pseudonym} />
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
          
          <div className="col-span-2 md:col-span-1 order-first md:order-none flex flex-col items-center gap-6 pt-4 md:pt-16">
            <div className="font-bebas text-7xl text-yellow-300 drop-shadow-lg">{gameState.isTimerRunning ? gameState.timer : '--'}</div>
            <div className="h-20 mt-4">
               {gameState.winner && <div className="animate-fade-in"><h3 className="text-2xl font-bebas text-purple-300">{gameState.winner}</h3></div>}
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <PlayerStatus player="P2" hp={gameState.p2Hp} animation={gameState.p2HpAnim} name={gameState.players[gameState.guestId!]?.pseudonym} />
            <EmojiInput 
              emojis={gameState.p2Emoji} isPickerOpen={isP2PickerOpen} setIsPickerOpen={setIsP2PickerOpen}
              onEmojiSelect={handleEmojiSelect}
              isMyTurn={myRole === 'guest' && gameState.activePlayer === 'P2'} hasCard={!!gameState.p2Card}
            />
            <div className="w-full h-[210px] md:h-[336px] flex justify-center items-center">
                {gameState.p2Card ? <div className={`transform scale-[0.5] md:scale-[0.8] ${gameState.p2Anim}`}><CardPreview cardData={gameState.p2Card} /></div> : 
                <div className={`w-[150px] h-[210px] md:w-[240px] md:h-[336px] rounded-2xl border-4 border-dashed flex items-center justify-center text-gray-500 transition-all ${gameState.activePlayer === 'P2' ? 'border-red-500 animate-pulse' : 'border-gray-700'}`}>Aguardando P2</div>}
            </div>
          </div>
        </div>
      </div>
    );
};

export default MelleeOnline;
