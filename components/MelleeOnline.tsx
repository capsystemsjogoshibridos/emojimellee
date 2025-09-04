import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CardData, GameState, OnlinePlayer, BattleRecord, LobbyInfo } from '../types';
import CardPreview from './CardPreview';
import { EmojiHappyIcon, ArrowLeftIcon, GlobeIcon } from './Icons';
import EmojiPicker from './EmojiPicker';

interface MelleeOnlineProps {
  savedCards: CardData[];
  onRoundEnd: (record: Omit<BattleRecord, 'id'>) => void;
  pseudonym: string;
}

const LOBBY_WS_URL = 'wss://pico-db.fly.dev/emoji-mellee-lobby-v11';
const GAME_WS_URL_PREFIX = 'wss://pico-db.fly.dev/emoji-mellee-game-v11-';

const initialGameState: Omit<GameState, 'gameId' | 'lastUpdate'> = {
  hostId: null, guestId: null, players: {}, spectators: {},
  p1Hp: 2000, p2Hp: 2000, p1Emoji: '', p2Emoji: '', p1Card: null, p2Card: null,
  activePlayer: null, timer: 60, isTimerRunning: false, isPaused: false, winner: null,
  p1Anim: '', p2Anim: '', p1HpAnim: '', p2HpAnim: '', action: undefined,
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Toast simples para mostrar code/reason dos WS */
const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50">
    <div className="text-sm whitespace-pre-wrap">{message}</div>
    <button className="ml-3 text-xs underline" onClick={onClose}>fechar</button>
  </div>
);

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

const MelleeOnline: React.FC<MelleeOnlineProps> = ({ savedCards, onRoundEnd, pseudonym }) => {
  const [view, setView] = useState<'lobby' | 'hosting' | 'playing'>('lobby');
  const [availableGames, setAvailableGames] = useState<LobbyInfo[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId] = useState(sessionStorage.getItem('myId') || `user-${Date.now()}-${Math.random()}`);
  const [myRole, setMyRole] = useState<'host' | 'guest' | null>(null);
  const [isP1PickerOpen, setIsP1PickerOpen] = useState(false);
  const [isP2PickerOpen, setIsP2PickerOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lobbyStatus, setLobbyStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 6000);
  }, []);

  const lobbyWs = useRef<WebSocket | null>(null);
  const gameWs = useRef<WebSocket | null>(null);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null); // lobby keepalive
  const gameHeartbeat = useRef<ReturnType<typeof setInterval> | null>(null);     // game keepalive
  const battleProcessor = useRef<Promise<void> | null>(null);
  const hostStateRef = useRef(gameState);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => { hostStateRef.current = gameState; }, [gameState]);

  const connectToLobby = useCallback(() => {
    if (lobbyWs.current && lobbyWs.current.readyState < 2) return;

    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    if (reconnectAttempts.current >= 5) {
      setLobbyStatus('failed');
      console.error("Lobby connection failed after multiple attempts.");
      return;
    }

    setLobbyStatus('connecting');
    const ws = new WebSocket(LOBBY_WS_URL);
    lobbyWs.current = ws;

    ws.onopen = () => {
      setLobbyStatus('connected');
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.lobbies) setAvailableGames(data.lobbies);
      } catch (e) { console.error('Lobby parse error', e); }
    };

    const scheduleReconnect = () => {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 15000);
      reconnectAttempts.current++;
      reconnectTimeout.current = setTimeout(connectToLobby, delay);
    };

    ws.onclose = (ev) => {
      console.warn("Lobby WS closed", ev.code, ev.reason, ev.wasClean);
      if (lobbyWs.current === ws && ws.onclose) {
        lobbyWs.current = null;
        setLobbyStatus('disconnected');
        showToast(`Lobby fechado (code ${ev.code})\n${ev.reason || 'sem reason'}`);
        scheduleReconnect();
      }
    };

    ws.onerror = (err) => {
      console.error('Lobby WS error', err);
      showToast('Erro no socket do lobby (veja o console).');
      // onclose será disparado pelo browser.
    };
  }, [showToast]);

  const sendToLobby = useCallback((message: object) => {
    if (lobbyWs.current?.readyState === WebSocket.OPEN) {
      lobbyWs.current.send(JSON.stringify(message));
    }
  }, []);

  const cleanupConnections = useCallback(() => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    reconnectAttempts.current = 0;

    if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    heartbeatInterval.current = null;

    if (gameHeartbeat.current) clearInterval(gameHeartbeat.current);
    gameHeartbeat.current = null;

    if (gameWs.current) {
      gameWs.current.onclose = null;
      try { gameWs.current.close(); } catch {}
      gameWs.current = null;
    }
    if (lobbyWs.current) {
      lobbyWs.current.onclose = null; // evita reconectar ao fechar manual
      try { lobbyWs.current.close(); } catch {}
      lobbyWs.current = null;
    }
  }, []);

  const goBackToLobby = useCallback(() => {
    cleanupConnections();
    setGameState(null);
    setMyRole(null);
    setView('lobby');
    setError(null);
    setTimeout(connectToLobby, 100);
  }, [cleanupConnections, connectToLobby]);

  useEffect(() => {
    sessionStorage.setItem('myId', myId);
    connectToLobby();
    return () => cleanupConnections();
  }, [myId, connectToLobby, cleanupConnections]);

  const handleCreateGame = useCallback(() => {
    // permitir criar jogo mesmo sem lobby conectado
    setMyRole('host');

    // ID legível + sufixo curto para evitar colisão; codifique no path do WS
    const baseId = `${pseudonym}-${myId.slice(-4)}`;
    const encodedId = encodeURIComponent(baseId); // evita quebrar URL com espaços/emoji

    const me: OnlinePlayer = { id: myId, pseudonym };
    const newGame: GameState = {
      ...initialGameState,
      gameId: baseId,
      hostId: myId,
      players: { [myId]: me },
      lastUpdate: Date.now()
    };

    setIsConnecting(true);
    const ws = new WebSocket(GAME_WS_URL_PREFIX + encodedId);
    gameWs.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      setGameState(newGame);
      setView('hosting');

      const lobbyInfo: LobbyInfo = { gameId: baseId, hostPseudonym: pseudonym, status: 'waiting', lastUpdate: Date.now() };
      sendToLobby({ action: 'CREATE', lobby: lobbyInfo });

      // heartbeat do lobby (se conectado)
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = setInterval(() => {
        if (lobbyWs.current?.readyState === WebSocket.OPEN) {
          sendToLobby({ action: 'HEARTBEAT', gameId: baseId });
        }
      }, 5000);

      // heartbeat do jogo (app-level)
      if (gameHeartbeat.current) clearInterval(gameHeartbeat.current);
      gameHeartbeat.current = setInterval(() => {
        if (gameWs.current?.readyState === WebSocket.OPEN) {
          gameWs.current.send(JSON.stringify({ type: 'PING', t: Date.now() }));
        }
      }, 25000);

      // publica estado inicial no servidor do jogo
      ws.send(JSON.stringify({ state: newGame }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.state) {
        setGameState(data.state);
        return;
      }
      if (data.action) {
        setGameState(currentState => {
          if (!currentState) return null;
          const updatedState = { ...currentState, action: data.action };
          if (data.action.type === 'JOIN') {
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
            sendToLobby({ action: 'DELETE', gameId: currentState.gameId });
          }
          return updatedState;
        });
      }
    };

    ws.onclose = (ev) => {
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      if (gameHeartbeat.current) clearInterval(gameHeartbeat.current);
      sendToLobby({ action: 'DELETE', gameId: baseId });
      showToast(`Jogo fechado (code ${ev.code})\n${ev.reason || 'sem reason'}`);
      goBackToLobby();
    };

    ws.onerror = () => {
      setError('Não foi possível criar a sala. O nome pode já estar em uso.');
      showToast('Erro no socket do jogo (host).');
      goBackToLobby();
    };
  }, [myId, pseudonym, sendToLobby, goBackToLobby]);

  const handleJoinGame = useCallback((gameToJoin: LobbyInfo) => {
    setMyRole('guest');
    setIsConnecting(true);
    const { gameId } = gameToJoin;
    const encodedId = encodeURIComponent(gameId);

    const ws = new WebSocket(GAME_WS_URL_PREFIX + encodedId);
    gameWs.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      setView('playing');
      const me: OnlinePlayer = { id: myId, pseudonym };
      ws.send(JSON.stringify({ action: { type: 'JOIN', payload: me } }));

      if (gameHeartbeat.current) clearInterval(gameHeartbeat.current);
      gameHeartbeat.current = setInterval(() => {
        if (gameWs.current?.readyState === WebSocket.OPEN) {
          gameWs.current.send(JSON.stringify({ type: 'PING', t: Date.now() }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.state) setGameState(msg.state);
      else if (msg.action) setGameState(cur => cur ? ({ ...cur, action: msg.action }) : cur);
    };

    ws.onclose = (ev) => {
      showToast(`Jogo fechado (code ${ev.code})\n${ev.reason || 'sem reason'}`);
      alert('O anfitrião desconectou.');
      goBackToLobby();
    };

    ws.onerror = () => {
      setError('Não foi possível conectar à sala.');
      showToast('Erro no socket do jogo (guest).');
      goBackToLobby();
    };
  }, [myId, pseudonym, goBackToLobby]);

  // Host Game Loop
  useEffect(() => {
    if (myRole !== 'host' || !gameState) return;

    let newState = { ...gameState };
    let stateChanged = false;

    if (newState.action) {
      const { type, payload } = newState.action;

      if (type === 'JOIN' && !newState.guestId) {
        newState = {
          ...newState,
          guestId: payload.id,
          players: { ...newState.players, [payload.id]: payload }, // imutável
          activePlayer: Math.random() < 0.5 ? 'P1' : 'P2',
          isTimerRunning: true,
          timer: 60,
        };
        setView('playing');
        stateChanged = true;
      }

      if (type === 'EMOJI_SELECT' && newState.activePlayer === 'P2' && Array.from(newState.p2Emoji).length < 3) {
        newState.p2Emoji += payload;
        const card = savedCards.find(c => c.combination === newState.p2Emoji);
        if (card) {
          newState.p2Card = { ...card, currentEnergy: parseInt(card.energy, 10) };
          if (!newState.p1Card) { newState.activePlayer = 'P1'; newState.timer = 60; }
        }
        stateChanged = true;
      }
      newState.action = undefined;
    }

    if (newState.isTimerRunning && !newState.isPaused && newState.timer <= 0) {
      newState.timer = 60;
      newState.activePlayer = newState.activePlayer === 'P1' ? 'P2' : 'P1';
      stateChanged = true;
    }

    if (newState.p1Card && newState.p2Card && !newState.winner && !battleProcessor.current) {
      const runBattle = async () => {
        try {
          let battleState = { ...hostStateRef.current! };
          battleState.isTimerRunning = false;
          battleState.winner = "Batalha!";
          setGameState(battleState); gameWs.current?.send(JSON.stringify({ state: battleState })); await sleep(500);

          battleState.p1Anim = 'animate-lunge-right'; battleState.p2Anim = 'animate-lunge-left';
          setGameState(battleState); gameWs.current?.send(JSON.stringify({ state: battleState })); await sleep(1500);

          const card1 = battleState.p1Card!, card2 = battleState.p2Card!;
          const p1Energy = card1.currentEnergy!, p2Energy = card2.currentEnergy!;
          let winnerId: string | null = null;

          if (p1Energy > p2Energy) {
            const diff = p1Energy - p2Energy;
            battleState.p2Hp = Math.max(0, battleState.p2Hp - diff);
            battleState.winner = `${card1.name} vence!`; winnerId = card1.id;
            battleState.p1Anim = 'animate-winner-glow'; battleState.p2Anim = 'animate-disintegrate'; battleState.p2HpAnim = 'animate-hp-flash';
          } else if (p2Energy > p1Energy) {
            const diff = p2Energy - p1Energy;
            battleState.p1Hp = Math.max(0, battleState.p1Hp - diff);
            battleState.winner = `${card2.name} vence!`; winnerId = card2.id;
            battleState.p2Anim = 'animate-winner-glow'; battleState.p1Anim = 'animate-disintegrate'; battleState.p1HpAnim = 'animate-hp-flash';
          } else {
            battleState.winner = 'Empate!';
            battleState.p1Anim = 'animate-disintegrate'; battleState.p2Anim = 'animate-disintegrate';
          }

          onRoundEnd({ fighter1: card1, fighter2: card2, winnerId, mode: 'mellee' });
          setGameState(battleState); gameWs.current?.send(JSON.stringify({ state: battleState })); await sleep(500);

          battleState.p1HpAnim = ''; battleState.p2HpAnim = '';
          setGameState(battleState); gameWs.current?.send(JSON.stringify({ state: battleState })); await sleep(2500);

          if (battleState.p1Hp <= 0) battleState.winner = `${battleState.players[battleState.guestId!].pseudonym} venceu!`;
          else if (battleState.p2Hp <= 0) battleState.winner = `${battleState.players[battleState.hostId!].pseudonym} venceu!`;
          else {
            battleState = {
              ...battleState,
              p1Card: null, p2Card: null, p1Emoji: '', p2Emoji: '',
              p1Anim: '', p2Anim: '', winner: null,
              isTimerRunning: true, activePlayer: Math.random() < 0.5 ? 'P1' : 'P2', timer: 60
            };
          }

          setGameState(battleState); gameWs.current?.send(JSON.stringify({ state: battleState }));
        } finally {
          battleProcessor.current = null; // garante liberar mesmo com erro
        }
      };
      battleProcessor.current = runBattle();
      return;
    }

    if (stateChanged) {
      newState.lastUpdate = Date.now();
      setGameState(newState);
      if (gameWs.current?.readyState === WebSocket.OPEN) {
        gameWs.current.send(JSON.stringify({ state: newState }));
      }
    }
  }, [gameState, myRole, savedCards, onRoundEnd]);

  // Host Timer Interval (clamp e broadcast)
  useEffect(() => {
    if (myRole !== 'host') return;
    const timerInterval = setInterval(() => {
      const state = hostStateRef.current;
      if (state?.isTimerRunning && !state.isPaused && !state.winner) {
        const t = Math.max(0, state.timer - 1); // evita negativo
        const newState = { ...state, timer: t };
        setGameState(newState);
        if (gameWs.current?.readyState === WebSocket.OPEN) {
          gameWs.current.send(JSON.stringify({ state: newState }));
        }
      }
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [myRole]);

  const handleEmojiSelect = (emoji: string) => {
    if (!gameState || !gameWs.current) return;
    const isMyTurnAsHost = myRole === 'host' && gameState.activePlayer === 'P1';
    const isMyTurnAsGuest = myRole === 'guest' && gameState.activePlayer === 'P2';

    if (isMyTurnAsHost && Array.from(gameState.p1Emoji).length < 3) {
      let newState = { ...gameState };
      newState.p1Emoji += emoji;
      const matchedCard = savedCards.find(c => c.combination === newState.p1Emoji);
      if (matchedCard) {
        newState.p1Card = { ...matchedCard, currentEnergy: parseInt(matchedCard.energy, 10) };
        if (!newState.p2Card) { newState.activePlayer = 'P2'; newState.timer = 60; }
      }
      setGameState(newState);
      if (gameWs.current.readyState === WebSocket.OPEN) {
        gameWs.current.send(JSON.stringify({ state: newState }));
      }
    } else if (isMyTurnAsGuest && Array.from(gameState.p2Emoji).length < 3) {
      const action = { type: 'EMOJI_SELECT' as const, payload: emoji };
      if (gameWs.current.readyState === WebSocket.OPEN) {
        gameWs.current.send(JSON.stringify({ action }));
      }
    }
  };

  // Renders
  if (view === 'lobby') {
    return (
      <div className="animate-fade-in text-center p-4 max-w-lg mx-auto">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}

        <h2 className="text-3xl font-bebas text-purple-300 tracking-wider">Lobby Online</h2>
        <div className="h-12 mt-2 flex items-center justify-center">
          {lobbyStatus === 'connecting' && <p className="text-yellow-400">Conectando ao lobby...</p>}
          {lobbyStatus === 'disconnected' && <p className="text-red-400">Conexão perdida. Tentando reconectar...</p>}
          {lobbyStatus === 'failed' && (
            <div className="text-red-400 text-center">
              <p>Falha ao conectar ao lobby.</p>
              <button
                onClick={() => {
                  reconnectAttempts.current = 0;
                  connectToLobby();
                }}
                className="mt-1 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-semibold"
              >
                Tentar Novamente
              </button>
            </div>
          )}
          {error && <p className="text-red-400">{error}</p>}
        </div>

        <div className="my-6">
          <button
            onClick={handleCreateGame}
            disabled={isConnecting}  // liberado mesmo sem lobby conectado
            className="w-full px-8 py-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-bebas text-2xl tracking-wider disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isConnecting && myRole === 'host' ? 'Criando...' : 'Criar Novo Jogo'}
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-bebas text-gray-400">Jogos Disponíveis</h3>
          {lobbyStatus === 'connected' && availableGames.length > 0 ? availableGames.map(game => (
            <div key={game.gameId} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center border border-gray-700">
              <div className="flex items-center gap-3">
                <GlobeIcon className="w-6 h-6 text-purple-400" />
                <span className="font-bold text-white">{game.hostPseudonym}</span>
              </div>
              <button
                onClick={() => handleJoinGame(game)}
                disabled={isConnecting}
                className="px-5 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-semibold text-sm disabled:bg-gray-500"
              >
                {isConnecting && myRole === 'guest' ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          )) : (
            <p className="text-gray-500 pt-4">
              {lobbyStatus === 'connected' ? 'Nenhum jogo encontrado. Crie um!' : 'Aguardando conexão com o lobby...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (view === 'hosting') {
    return (
      <div className="animate-fade-in text-center p-8">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}

        <h2 className="text-3xl font-bebas text-purple-300">Aguardando Oponente...</h2>
        <p className="text-gray-400 mt-2">Sua sala <span className="font-bold text-white">{pseudonym}</span> está visível no lobby.</p>
        <div className="lds-ellipsis"><div></div><div></div><div></div><div></div></div>
        <button onClick={goBackToLobby} className="mt-8 px-6 py-2 bg-red-600 text-white rounded-lg">Cancelar</button>
        <style>{`.lds-ellipsis{display:inline-block;position:relative;width:80px;height:80px}.lds-ellipsis div{position:absolute;top:33px;width:13px;height:13px;border-radius:50%;background:#fff;animation-timing-function:cubic-bezier(0,1,1,0)}.lds-ellipsis div:nth-child(1){left:8px;animation:lds-ellipsis1 .6s infinite}.lds-ellipsis div:nth-child(2){left:8px;animation:lds-ellipsis2 .6s infinite}.lds-ellipsis div:nth-child(3){left:32px;animation:lds-ellipsis2 .6s infinite}.lds-ellipsis div:nth-child(4){left:56px;animation:lds-ellipsis3 .6s infinite}@keyframes lds-ellipsis1{0%{transform:scale(0)}100%{transform:scale(1)}}@keyframes lds-ellipsis3{0%{transform:scale(1)}100%{transform:scale(0)}}@keyframes lds-ellipsis2{0%{transform:translate(0,0)}100%{transform:translate(24px,0)}}`}</style>
      </div>
    );
  }

  if (view === 'playing' && gameState) {
    return (
      <div className="animate-fade-in text-center p-4">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}

        <button onClick={goBackToLobby} className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 z-10">
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
  }

  return <div className="text-center p-8 text-gray-400">Carregando...</div>
};

export default MelleeOnline;
