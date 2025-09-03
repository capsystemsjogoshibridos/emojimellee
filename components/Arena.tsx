import React, { useState, useEffect, useMemo } from 'react';
import type { CardData } from '../types';
import { EnergyIcon, TrashIcon, PowerIcon, SwordsIcon, PlusIcon, MinusIcon, TargetIcon } from './Icons';

interface ArenaProps {
  deckCards: CardData[];
  board: (CardData | null)[];
  setBoard: React.Dispatch<React.SetStateAction<(CardData | null)[]>>;
  hand: CardData[];
  setHand: React.Dispatch<React.SetStateAction<CardData[]>>;
  drawPile: CardData[];
  setDrawPile: React.Dispatch<React.SetStateAction<CardData[]>>;
  initialized: boolean;
  setInitialized: React.Dispatch<React.SetStateAction<boolean>>;
  savedCards: CardData[];
  opponentBoard: (CardData & { currentEnergy?: number })[];
  setOpponentBoard: React.Dispatch<React.SetStateAction<(CardData & { currentEnergy?: number })[]>>;
  onUpdateCardEnergy: (cardId: string, newEnergy: number) => void;
  onResetCardEnergy: (cardId: string) => void;
  player1Hp: number;
  setPlayer1Hp: React.Dispatch<React.SetStateAction<number>>;
  player2Hp: number;
  setPlayer2Hp: React.Dispatch<React.SetStateAction<number>>;
}

type BattlePhase = 'idle' | 'fighting' | 'finished';

const ArenaCard: React.FC<{ 
    card: CardData; 
    animation?: string;
    onClick?: () => void;
    onRemove?: () => void;
    size?: 'small' | 'medium';
}> = ({ card, animation, onClick, onRemove, size = 'medium' }) => {
  const sizeClasses = {
    medium: 'w-36 h-52 sm:w-40 sm:h-56',
    small: 'w-28 h-40'
  }
  const textSizeClasses = {
    medium: 'text-base',
    small: 'text-sm'
  }
  // Use card.currentEnergy if it exists, otherwise fall back to card.energy
  const displayEnergy = card.currentEnergy !== undefined ? card.currentEnergy : card.energy;

  return (
    <div 
        className={`relative group flex-shrink-0 ${sizeClasses[size]} ${onClick ? 'cursor-pointer' : ''} ${animation}`}
        onClick={onClick}
    >
      <div className="w-full h-full bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-purple-500/40">
        {card.image ? (
          <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-700 flex items-center justify-center p-2">
            <span className="text-gray-500 text-center text-sm">{card.name}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
        <div className="absolute bottom-1 left-2 right-2 text-white">
           <p className={`font-bebas ${textSizeClasses[size]} tracking-wider truncate drop-shadow-lg`}>{card.name}</p>
        </div>
        <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/60 backdrop-blur-sm p-1 rounded-md">
            <EnergyIcon className="w-3 h-3 text-blue-400"/>
            <span className="font-bebas text-sm text-white">{displayEnergy}</span>
        </div>
      </div>
      {onRemove && (
        <button 
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute -top-2 -right-2 bg-red-600 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform hover:scale-110"
            aria-label={`Remover ${card.name} do campo`}
        >
            <TrashIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};


const Arena: React.FC<ArenaProps> = ({ 
    deckCards, 
    board, setBoard, 
    hand, setHand, 
    drawPile, setDrawPile,
    initialized, setInitialized,
    savedCards,
    opponentBoard, setOpponentBoard,
    onUpdateCardEnergy,
    onResetCardEnergy,
    player1Hp, setPlayer1Hp,
    player2Hp, setPlayer2Hp
}) => {
  
  const [battlePhase, setBattlePhase] = useState<BattlePhase>('idle');
  const [animations, setAnimations] = useState<{[key: string]: string}>({});
  const [targets, setTargets] = useState<{ [playerSlot: number]: number | null }>({});

  const shuffleArray = (array: CardData[]) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  useEffect(() => {
    if (!initialized && deckCards.length > 0) {
        const availableCards = deckCards.filter(
          card => card.currentEnergy === undefined || card.currentEnergy > 0
        );
        const shuffled = shuffleArray([...availableCards]);
        setHand(shuffled.slice(0, 5));
        setDrawPile(shuffled.slice(5));
        setInitialized(true);
    }
  }, [deckCards, initialized, setHand, setDrawPile, setInitialized]);
  
  const handlePlayCard = (cardId: string) => {
    const firstEmptyIndex = board.findIndex(slot => slot === null);
    if (firstEmptyIndex === -1) {
        alert("O campo está cheio!");
        return;
    }

    const cardToPlay = hand.find(card => card.id === cardId);
    if (!cardToPlay) return;

    const newBoard = [...board];
    newBoard[firstEmptyIndex] = cardToPlay;
    setBoard(newBoard);

    setHand(hand.filter(card => card.id !== cardId));
  };
  
  const handleReturnCard = (slotIndex: number) => {
    const cardToReturn = board[slotIndex];
    if (!cardToReturn) return;
    
    onResetCardEnergy(cardToReturn.id);

    const originalCardData = savedCards.find(c => c.id === cardToReturn.id);
    const restoredCard = { 
      ...cardToReturn, 
      currentEnergy: originalCardData ? parseInt(originalCardData.energy, 10) : cardToReturn.currentEnergy 
    };

    setHand([...hand, restoredCard]);

    const newBoard = [...board];
    newBoard[slotIndex] = null;
    setBoard(newBoard);

    setTargets(prev => ({ ...prev, [slotIndex]: null }));
  };
  
  const handleDrawCard = () => {
    if (drawPile.length === 0) {
        alert("Não há mais cartas para pegar!");
        return;
    }
    const nextCard = drawPile[0];
    setHand([...hand, nextCard]);
    setDrawPile(drawPile.slice(1));
  };
  
  const handleSelectOpponentCard = (slotIndex: number, cardId: string) => {
    const card = savedCards.find(c => c.id === cardId);
    if (card) {
        const newOpponentBoard = [...opponentBoard];
        newOpponentBoard[slotIndex] = { ...card, currentEnergy: parseInt(card.energy, 10) };
        setOpponentBoard(newOpponentBoard);
    }
  };

  const handleRemoveOpponentCard = (slotIndex: number) => {
    const newOpponentBoard = [...opponentBoard];
    newOpponentBoard[slotIndex] = null;
    setOpponentBoard(newOpponentBoard);
    const newTargets = { ...targets };
    Object.keys(newTargets).forEach(key => {
        const playerSlot = parseInt(key, 10);
        if (newTargets[playerSlot] === slotIndex) {
            newTargets[playerSlot] = null;
        }
    });
    setTargets(newTargets);
  };

  const handleSetTarget = (playerSlot: number, opponentSlot: number) => {
    setTargets(prev => ({
        ...prev,
        [playerSlot]: prev[playerSlot] === opponentSlot ? null : opponentSlot
    }));
  };
  
  const handleBattle = async () => {
    setBattlePhase('fighting');
    const lungeAnimations: {[key: string]: string} = {};
    
    Object.keys(targets).forEach(playerSlotStr => {
        const playerSlot = parseInt(playerSlotStr, 10);
        const opponentSlot = targets[playerSlot];
        if (opponentSlot !== null && board[playerSlot] && opponentBoard[opponentSlot]) {
            lungeAnimations[`player-${playerSlot}`] = 'animate-lunge-right';
            lungeAnimations[`opponent-${opponentSlot}`] = 'animate-lunge-left';
        }
    });
    setAnimations(lungeAnimations);

    await new Promise(r => setTimeout(r, 1000));

    const finalAnimations: {[key: string]: string} = {};
    const newBoard = [...board];
    const newOpponentBoard = [...opponentBoard];

    for (const playerSlotStr in targets) {
        const playerSlot = parseInt(playerSlotStr, 10);
        const opponentSlot = targets[playerSlot];

        if (opponentSlot === null) continue;

        const playerCard = newBoard[playerSlot];
        const opponentCard = newOpponentBoard[opponentSlot];

        if (playerCard && opponentCard) {
            const playerEnergy = playerCard.currentEnergy ?? parseInt(playerCard.energy, 10);
            const opponentEnergy = opponentCard.currentEnergy ?? parseInt(opponentCard.energy, 10);

            if (playerEnergy > opponentEnergy) {
                const newEnergy = playerEnergy - opponentEnergy;
                onUpdateCardEnergy(playerCard.id, newEnergy);
                newBoard[playerSlot] = { ...playerCard, currentEnergy: newEnergy };
                newOpponentBoard[opponentSlot] = null;
                finalAnimations[`player-${playerSlot}`] = 'animate-winner-glow';
                finalAnimations[`opponent-${opponentSlot}`] = 'animate-disintegrate';
            } else if (opponentEnergy > playerEnergy) {
                onUpdateCardEnergy(playerCard.id, 0);
                newBoard[playerSlot] = null;
                const newOpponentEnergy = opponentEnergy - playerEnergy;
                newOpponentBoard[opponentSlot] = { ...opponentCard, currentEnergy: newOpponentEnergy };
                finalAnimations[`player-${playerSlot}`] = 'animate-disintegrate';
                finalAnimations[`opponent-${opponentSlot}`] = 'animate-winner-glow';
            } else {
                onUpdateCardEnergy(playerCard.id, 0);
                newBoard[playerSlot] = null;
                newOpponentBoard[opponentSlot] = null;
                finalAnimations[`player-${playerSlot}`] = 'animate-disintegrate';
                finalAnimations[`opponent-${opponentSlot}`] = 'animate-disintegrate';
            }
        }
    }

    setAnimations(finalAnimations);
    await new Promise(r => setTimeout(r, 1000));
    
    setBoard(newBoard);
    setOpponentBoard(newOpponentBoard);
    setTargets({});
    setAnimations({});
    setBattlePhase('idle');
  };

  const totalPower = useMemo(() => {
    return board.reduce((sum, card) => {
        return sum + (card ? parseInt(card.power, 10) || 0 : 0);
    }, 0);
  }, [board]);

  const canBattle = useMemo(() => 
    Object.values(targets).some(target => target !== null) && 
    Object.entries(targets).some(([playerSlot, opponentSlot]) => 
        opponentSlot !== null && board[parseInt(playerSlot, 10)] && opponentBoard[opponentSlot]
    ),
  [targets, board, opponentBoard]);

  if (deckCards.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <h2 className="text-3xl font-bebas text-purple-300">Seu deck está vazio</h2>
        <p className="text-gray-400 mt-2">Adicione cartas ao seu deck para usar a Arena.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-3xl font-bebas text-purple-300 text-center tracking-wider">Arena de Batalha</h2>
      
      {/* Opponent Board */}
      <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 min-h-[280px]">
        <h3 className="text-center font-bebas text-xl text-purple-400 mb-4">Campo do Oponente</h3>
        <div className="flex justify-center items-start gap-4">
          {opponentBoard.map((card, index) => (
            <div key={index} className="w-40 h-56 flex-shrink-0">
              {card ? (
                 <ArenaCard card={card} animation={animations[`opponent-${index}`]} onRemove={() => handleRemoveOpponentCard(index)} />
              ) : (
                <select 
                    onChange={(e) => handleSelectOpponentCard(index, e.target.value)}
                    value=""
                    className="w-full h-full rounded-lg border-2 border-dashed border-gray-600 bg-gray-200 text-black text-center focus:border-purple-500 focus:ring-purple-500"
                    disabled={battlePhase !== 'idle'}
                >
                    <option style={{color: 'black'}} value="" disabled>Escolher Oponente</option>
                    {savedCards.map(c => <option style={{color: 'black'}} key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Battle UI */}
      <div className="flex flex-col md:flex-row justify-around items-center gap-4 md:gap-0 md:h-20 px-4 py-4 md:py-0">
        {/* Player 1 HP Controls */}
        <div className="flex items-center gap-3 text-white">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-600 border-2 border-blue-400 rounded-full flex items-center justify-center font-bebas text-xl md:text-2xl shadow-lg">P1</div>
            <div className="flex flex-col items-center">
                <span className="font-bebas text-2xl md:text-3xl text-blue-300">{player1Hp}</span>
                <div className="flex items-center gap-2">
                    <button onClick={() => setPlayer1Hp(hp => Math.max(0, hp - 100))} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"><MinusIcon className="w-4 h-4" /></button>
                    <button onClick={() => setPlayer1Hp(hp => hp + 100)} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"><PlusIcon className="w-4 h-4" /></button>
                </div>
            </div>
        </div>

        {/* Battle Button */}
        <button 
            onClick={handleBattle}
            disabled={!canBattle || battlePhase !== 'idle'}
            className="order-first md:order-none disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-3 px-6 py-2 text-lg md:px-8 md:py-3 md:text-xl bg-red-600 rounded-lg hover:bg-red-700 transition-all font-bebas tracking-wider shadow-lg"
        >
            <SwordsIcon className="w-6 h-6"/>
            {battlePhase === 'fighting' ? 'Batalhando...' : 'Batalhar!'}
        </button>

        {/* Player 2 HP Controls */}
        <div className="flex items-center gap-3 text-white">
             <div className="flex flex-col items-center">
                <span className="font-bebas text-2xl md:text-3xl text-red-300">{player2Hp}</span>
                <div className="flex items-center gap-2">
                    <button onClick={() => setPlayer2Hp(hp => Math.max(0, hp - 100))} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"><MinusIcon className="w-4 h-4" /></button>
                    <button onClick={() => setPlayer2Hp(hp => hp + 100)} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"><PlusIcon className="w-4 h-4" /></button>
                </div>
            </div>
            <div className="w-12 h-12 md:w-16 md:h-16 bg-red-600 border-2 border-red-400 rounded-full flex items-center justify-center font-bebas text-xl md:text-2xl shadow-lg">P2</div>
        </div>
      </div>

      {/* Player Board */}
      <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 min-h-[340px]">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-center font-bebas text-xl text-purple-400">Seu Campo</h3>
            <div className="flex items-center gap-2 bg-black/30 px-3 py-1 rounded-lg">
                <span className="font-bebas text-lg text-gray-300">Poder Total:</span>
                <PowerIcon className="w-5 h-5 text-red-400" />
                <span className="font-bebas text-2xl text-white">{totalPower}</span>
            </div>
        </div>
        <div className="flex justify-center items-start gap-4">
          {board.map((card, index) => (
            <div key={index} className="w-40 flex flex-col items-center flex-shrink-0">
              {card ? (
                <div className="flex flex-col items-center gap-2">
                    <ArenaCard card={card} animation={animations[`player-${index}`]} onRemove={() => handleReturnCard(index)} />
                    <div className="flex justify-center gap-2 mt-1">
                        {[0, 1, 2].map(targetIndex => (
                            <button
                                key={targetIndex}
                                onClick={() => handleSetTarget(index, targetIndex)}
                                disabled={!opponentBoard[targetIndex] || battlePhase !== 'idle'}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border-2 text-white ${
                                    targets[index] === targetIndex
                                    ? 'bg-red-500 border-red-300'
                                    : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                                } disabled:bg-gray-800 disabled:border-gray-700 disabled:cursor-not-allowed disabled:text-gray-600`}
                                title={`Atacar oponente ${targetIndex + 1}`}
                            >
                                <span className="font-bebas text-lg">{targetIndex + 1}</span>
                            </button>
                        ))}
                    </div>
                </div>
              ) : (
                <div className="w-40 h-56 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center">
                  <span className="text-gray-500 text-sm">Espaço Vazio</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Hand and Deck Section */}
      <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
        <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
                 <h3 className="font-bebas text-xl text-purple-400 mb-4">Sua Mão ({hand.length})</h3>
                 <div className="flex flex-wrap items-center gap-3 min-h-[170px]">
                    {hand.length > 0 ? hand.map(card => (
                        <ArenaCard key={card.id} card={card} size="small" onClick={() => handlePlayCard(card.id)} />
                    )) : (
                        <p className="text-gray-500">Sua mão está vazia.</p>
                    )}
                 </div>
            </div>
            <div className="flex flex-col items-center gap-2">
                <h3 className="font-bebas text-xl text-purple-400">Deck</h3>
                <button
                    onClick={handleDrawCard}
                    disabled={drawPile.length === 0 || battlePhase !== 'idle'}
                    className="w-28 h-40 bg-purple-900/50 rounded-lg border-2 border-purple-500 flex flex-col items-center justify-center text-purple-300 hover:bg-purple-900/80 transition-colors disabled:bg-gray-700 disabled:border-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                    <span className="font-bebas text-lg">Pegar Carta</span>
                    <span className="font-bold text-2xl">{drawPile.length}</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Arena;