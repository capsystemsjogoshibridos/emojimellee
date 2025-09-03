
import React, { useState, useEffect, useRef } from 'react';
import { CardData, BattleRecord } from '../types';
import CardPreview from './CardPreview';
import { EmojiHappyIcon } from './Icons';
import EmojiPicker from './EmojiPicker';

interface EmojiMelleeProps {
  savedCards: CardData[];
  onRoundEnd: (record: Omit<BattleRecord, 'id'>) => void;
}

// Subcomponente para exibir o status do jogador
const PlayerStatus: React.FC<{ player: 'P1' | 'P2', hp: number, animation: string }> = ({ player, hp, animation }) => {
    const isP1 = player === 'P1';
    const colorClasses = isP1 ? 'bg-blue-600 border-blue-400' : 'bg-red-600 border-red-400';
    const hpColor = isP1 ? 'text-blue-300' : 'text-red-300';

    return (
        <div className="flex flex-col items-center gap-2">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center font-bebas text-4xl shadow-lg border-4 ${colorClasses}`}>
                {player}
            </div>
            <div className={`font-bebas text-4xl transition-all duration-300 ${hpColor} ${animation}`}>{hp} HP</div>
        </div>
    );
};

// Props para o subcomponente EmojiInput
interface EmojiInputProps {
    player: 'P1' | 'P2';
    emojis: string;
    card: CardData | null;
    isPickerOpen: boolean;
    setIsPickerOpen: (isOpen: boolean) => void;
    activePlayer: 'P1' | 'P2' | null;
    onEmojiSelect: (emoji: string) => void;
    onClear: () => void;
}

// Subcomponente para a entrada de emoji
const EmojiInput: React.FC<EmojiInputProps> = ({ 
    player, 
    emojis, 
    card, 
    isPickerOpen, 
    setIsPickerOpen, 
    activePlayer, 
    onEmojiSelect, 
    onClear 
}) => {
    const handleClearClick = () => {
        if (activePlayer === player && !card) {
            onClear();
        }
    };

    return (
        <div className="relative w-full">
            <div
                onClick={handleClearClick}
                className={`text-2xl w-full p-2 rounded-lg bg-gray-700 border-2 flex items-center justify-center min-h-[52px] pr-10 transition-colors ${activePlayer === player && !card ? 'border-purple-500 cursor-pointer' : 'border-gray-600' }`}
                aria-label={`Emojis do ${player}`}
            >
                {emojis ? (
                    <span className="text-3xl tracking-widest">{emojis}</span>
                ) : (
                    <span className="text-gray-400 text-base">Escolha os Emojis</span>
                )}
            </div>
            <button
                type="button"
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                disabled={activePlayer !== player || !!card}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-purple-400 disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                aria-label={`Escolher emoji para ${player}`}
            >
                <EmojiHappyIcon className="w-6 h-6" />
            </button>
            {isPickerOpen && (
                <EmojiPicker
                    onEmojiSelect={onEmojiSelect}
                    onClose={() => setIsPickerOpen(false)}
                />
            )}
        </div>
    );
};


const EmojiMellee: React.FC<EmojiMelleeProps> = ({ savedCards, onRoundEnd }) => {
  const [p1Hp, setP1Hp] = useState(2000);
  const [p2Hp, setP2Hp] = useState(2000);

  const [p1Emoji, setP1Emoji] = useState('');
  const [p2Emoji, setP2Emoji] = useState('');
  
  const [isP1PickerOpen, setIsP1PickerOpen] = useState(false);
  const [isP2PickerOpen, setIsP2PickerOpen] = useState(false);

  const [p1Card, setP1Card] = useState<CardData | null>(null);
  const [p2Card, setP2Card] = useState<CardData | null>(null);

  const [timer, setTimer] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activePlayer, setActivePlayer] = useState<'P1' | 'P2' | null>(null);

  const [winner, setWinner] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [p1Anim, setP1Anim] = useState('');
  const [p2Anim, setP2Anim] = useState('');
  const [p1HpAnim, setP1HpAnim] = useState('');
  const [p2HpAnim, setP2HpAnim] = useState('');
  
  const [isProcessingTimeout, setIsProcessingTimeout] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  
  useEffect(() => {
    if (winner && winner.includes('Supremo')) {
        endGame();
        return;
    }

    if (isTimerRunning && !isPaused && timer > 0) {
        timerRef.current = setTimeout(() => setTimer((t) => t - 1), 1000);
    } else if (isTimerRunning && !isPaused && timer === 0) {
      if (isProcessingTimeout) return; 

      const handleTimeout = () => {
        setIsProcessingTimeout(true); // Lock to prevent re-triggering

        const p1TimedOut = activePlayer === 'P1' && !p1Card;
        const p2TimedOut = activePlayer === 'P2' && !p2Card;

        if (p1TimedOut && p2Card) {
          const damage = p2Card.currentEnergy ?? parseInt(p2Card.energy, 10);
          const newP1Hp = Math.max(0, p1Hp - damage);
          setWinner(`${p2Card.name} ataca por tempo!`);
          setP1HpAnim('animate-hp-flash');
          setTimeout(() => setP1HpAnim(''), 500);
          setP1Hp(newP1Hp);
          
          if (newP1Hp <= 0) {
            setTimeout(() => setWinner('Jogador 2 é o Vencedor Supremo!'), 2000);
          } else {
            setTimeout(() => {
                setWinner(null);
                // Reset for next round
                setP1Card(null); setP1Emoji(''); setP1Anim('');
                setP2Card(null); setP2Emoji(''); setP2Anim('');
                setActivePlayer(Math.random() < 0.5 ? 'P1' : 'P2');
                setTimer(60);
                setIsProcessingTimeout(false); // Unlock
            }, 2500);
          }
        } else if (p2TimedOut && p1Card) {
          const damage = p1Card.currentEnergy ?? parseInt(p1Card.energy, 10);
          const newP2Hp = Math.max(0, p2Hp - damage);
          setWinner(`${p1Card.name} ataca por tempo!`);
          setP2HpAnim('animate-hp-flash');
          setTimeout(() => setP2HpAnim(''), 500);
          setP2Hp(newP2Hp);

          if (newP2Hp <= 0) {
            setTimeout(() => setWinner('Jogador 1 é o Vencedor Supremo!'), 2000);
          } else {
            setTimeout(() => {
                setWinner(null);
                // Reset for next round
                setP1Card(null); setP1Emoji(''); setP1Anim('');
                setP2Card(null); setP2Emoji(''); setP2Anim('');
                setActivePlayer(Math.random() < 0.5 ? 'P1' : 'P2');
                setTimer(60);
                setIsProcessingTimeout(false); // Unlock
            }, 2500);
          }
        } else {
          // No one has a card, or the active player timed out but opponent has no card
          // Just switch turns
          setActivePlayer((prev) => (prev === 'P1' ? 'P2' : 'P1'));
          setTimer(60);
          setIsProcessingTimeout(false); // Unlock immediately
        }
      };

      handleTimeout();
    }


    return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isTimerRunning, isPaused, timer, p1Card, p2Card, activePlayer]);


  const handleGameControl = () => {
    if (winner && (winner.includes('Supremo'))) return;

    if (!isTimerRunning) {
        setIsTimerRunning(true);
        setIsPaused(false);
        setActivePlayer(Math.random() < 0.5 ? 'P1' : 'P2');
        setTimer(60);
    } else {
        setIsPaused(prev => !prev);
    }
  };
  
  const handleNewFight = () => {
    setP1Hp(2000);
    setP2Hp(2000);
    setP1Emoji('');
    setP2Emoji('');
    setP1Card(null);
    setP2Card(null);
    setTimer(60);
    setIsTimerRunning(false);
    setIsPaused(false);
    setActivePlayer(null);
    setWinner(null);
    setP1Anim('');
    setP2Anim('');
    setP1HpAnim('');
    setP2HpAnim('');
    setIsP1PickerOpen(false);
    setIsP2PickerOpen(false);
    setIsProcessingTimeout(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };
  
  const endGame = () => {
    setIsTimerRunning(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setActivePlayer(null);
  }

  const handleEmojiSelect = (player: 'P1' | 'P2', emoji: string) => {
    if (player !== activePlayer) return;

    const currentEmojis = player === 'P1' ? p1Emoji : p2Emoji;
    if (Array.from(currentEmojis).length >= 3) return;
    
    const newCombination = currentEmojis + emoji;

    if (player === 'P1') setP1Emoji(newCombination);
    else setP2Emoji(newCombination);
    
    if (Array.from(newCombination).length >= 3) {
      if (player === 'P1') setIsP1PickerOpen(false);
      else setIsP2PickerOpen(false);
    }

    const matchedCard = savedCards.find(card => card.combination === newCombination);
    if (matchedCard) {
        const cardWithEnergy = { ...matchedCard, currentEnergy: parseInt(matchedCard.energy, 10) };
      if (player === 'P1') {
        setP1Card(cardWithEnergy);
        if (p2Card) {
          setTimeout(() => handleBattle(cardWithEnergy, p2Card), 100);
        } else if(isTimerRunning) {
          setActivePlayer('P2'); setTimer(60);
        }
      } else {
        setP2Card(cardWithEnergy);
        if (p1Card) {
          setTimeout(() => handleBattle(p1Card, cardWithEnergy), 100);
        } else if(isTimerRunning) {
          setActivePlayer('P1'); setTimer(60);
        }
      }
    }
  };

 const handleBattle = (card1: CardData, card2: CardData) => {
    endGame();

    setTimeout(() => {
        setP1Anim('animate-lunge-right');
        setP2Anim('animate-lunge-left');
    }, 500);

    setTimeout(() => {
        const p1Energy = card1.currentEnergy ?? parseInt(card1.energy, 10);
        const p2Energy = card2.currentEnergy ?? parseInt(card2.energy, 10);
        
        let battleWinnerMessage = '';
        let finalP1Hp = p1Hp;
        let finalP2Hp = p2Hp;
        let winnerId: string | null = null;

        if (p1Energy > p2Energy) {
            const remainingEnergy = p1Energy - p2Energy;
            finalP2Hp = Math.max(0, p2Hp - remainingEnergy);
            setP2Hp(finalP2Hp);
            setP2HpAnim('animate-hp-flash');
            setTimeout(() => setP2HpAnim(''), 500);
            
            setP1Card(prev => prev ? { ...prev, currentEnergy: remainingEnergy } : null);
            battleWinnerMessage = `${card1.name} vence a rodada!`;
            winnerId = card1.id;
            setP1Anim('animate-winner-glow');
            setP2Anim('animate-disintegrate');

        } else if (p2Energy > p1Energy) {
            const remainingEnergy = p2Energy - p1Energy;
            finalP1Hp = Math.max(0, p1Hp - remainingEnergy);
            setP1Hp(finalP1Hp);
            setP1HpAnim('animate-hp-flash');
            setTimeout(() => setP1HpAnim(''), 500);
            
            setP2Card(prev => prev ? { ...prev, currentEnergy: remainingEnergy } : null);
            battleWinnerMessage = `${card2.name} vence a rodada!`;
            winnerId = card2.id;
            setP2Anim('animate-winner-glow');
            setP1Anim('animate-disintegrate');
        } else {
            battleWinnerMessage = 'Empate! Ambas são destruídas.';
            winnerId = null;
            setP1Anim('animate-disintegrate');
            setP2Anim('animate-disintegrate');
        }
        
        setWinner(battleWinnerMessage);
        onRoundEnd({ fighter1: card1, fighter2: card2, winnerId, mode: 'mellee' });

        if (finalP1Hp <= 0) {
            setTimeout(() => setWinner('Jogador 2 é o Vencedor Supremo!'), 1500);
            endGame();
            return;
        } else if (finalP2Hp <= 0) {
            setTimeout(() => setWinner('Jogador 1 é o Vencedor Supremo!'), 1500);
            endGame();
            return;
        } else {
             setTimeout(() => {
                setWinner(null);
                setP1Emoji('');
                setP2Emoji('');
                setP1Card(null);
                setP2Card(null);
                setP1Anim('');
                setP2Anim('');
                setIsProcessingTimeout(false);
                setIsTimerRunning(true);
                setIsPaused(false);
                setActivePlayer(Math.random() < 0.5 ? 'P1' : 'P2');
                setTimer(60);
            }, 3000);
        }
    }, 1500);
  };
  
  return (
    <div className="animate-fade-in text-center p-4">
      <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-start gap-4 max-w-6xl mx-auto">
        {/* Player 1 Area */}
        <div className="flex flex-col items-center gap-4">
          <PlayerStatus player="P1" hp={p1Hp} animation={p1HpAnim} />
          <EmojiInput 
            player="P1" emojis={p1Emoji} card={p1Card}
            isPickerOpen={isP1PickerOpen} setIsPickerOpen={setIsP1PickerOpen}
            activePlayer={activePlayer}
            onEmojiSelect={(emoji) => handleEmojiSelect('P1', emoji)}
            onClear={() => setP1Emoji('')}
          />
          <div className="w-full h-[210px] md:h-[336px] flex justify-center items-center">
              {p1Card ? (
                  <div className={`transform scale-[0.5] md:scale-[0.8] ${p1Anim}`}>
                      <CardPreview cardData={p1Card} />
                  </div>
              ) : (
                  <div className={`w-[150px] h-[210px] md:w-[240px] md:h-[336px] rounded-2xl border-4 border-dashed flex items-center justify-center text-gray-500 transition-all ${activePlayer === 'P1' ? 'border-blue-500 animate-pulse' : 'border-gray-700'}`}>Aguardando P1</div>
              )}
          </div>
        </div>
        
        {/* Center Area: Timer and Winner Message. Top on mobile, middle on desktop */}
        <div className="col-span-2 md:col-span-1 order-first md:order-none flex flex-col items-center gap-6 pt-4 md:pt-16">
          <div className="font-bebas text-7xl text-yellow-300 drop-shadow-lg">{timer}</div>
          <div className="h-20 mt-4">
             {winner && (
                <div className="animate-fade-in">
                    <h3 className="text-2xl font-bebas text-purple-300">{winner}</h3>
                </div>
             )}
          </div>
        </div>
        
        {/* Player 2 Area */}
        <div className="flex flex-col items-center gap-4">
          <PlayerStatus player="P2" hp={p2Hp} animation={p2HpAnim} />
          <EmojiInput 
            player="P2" emojis={p2Emoji} card={p2Card}
            isPickerOpen={isP2PickerOpen} setIsPickerOpen={setIsP2PickerOpen}
            activePlayer={activePlayer}
            onEmojiSelect={(emoji) => handleEmojiSelect('P2', emoji)}
            onClear={() => setP2Emoji('')}
          />
          <div className="w-full h-[210px] md:h-[336px] flex justify-center items-center">
              {p2Card ? (
                  <div className={`transform scale-[0.5] md:scale-[0.8] ${p2Anim}`}>
                      <CardPreview cardData={p2Card} />
                  </div>
              ) : (
                  <div className={`w-[150px] h-[210px] md:w-[240px] md:h-[336px] rounded-2xl border-4 border-dashed flex items-center justify-center text-gray-500 transition-all ${activePlayer === 'P2' ? 'border-red-500 animate-pulse' : 'border-gray-700'}`}>Aguardando P2</div>
              )}
          </div>
        </div>

      </div>
      
      {/* Control Buttons Area */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <button
            onClick={handleGameControl}
            disabled={!!winner && winner.includes('Supremo')}
            className="px-6 py-2 bg-green-600 text-white font-bebas text-xl tracking-wider rounded-lg hover:bg-green-700 transition-colors shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
            {isTimerRunning ? (isPaused ? 'Continuar' : 'Pausar') : 'Começar'}
        </button>
        <button
            onClick={handleNewFight}
            className="px-6 py-2 bg-purple-600 text-white font-bebas text-xl tracking-wider rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
        >
            Nova Luta
        </button>
      </div>
    </div>
  );
};

export default EmojiMellee;
