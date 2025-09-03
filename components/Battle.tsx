import React, { useState, useEffect } from 'react';
import type { CardData } from '../types';
import CardPreview from './CardPreview';
import { SwordsIcon } from './Icons';

interface BattleProps {
  cards: CardData[];
}

type BattleState = 'selecting' | 'fighting' | 'finished';

const Battle: React.FC<BattleProps> = ({ cards }) => {
  const [fighter1, setFighter1] = useState<CardData | null>(null);
  const [fighter2, setFighter2] = useState<CardData | null>(null);
  const [battleState, setBattleState] = useState<BattleState>('selecting');
  const [winner, setWinner] = useState<string | null>(null);
  
  const [f1Anim, setF1Anim] = useState('');
  const [f2Anim, setF2Anim] = useState('');

  const handleSelect = (fighter: 1 | 2, cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    if (fighter === 1) {
        setFighter1(card);
    } else {
        setFighter2(card);
    }
  };
  
  const handleBattle = () => {
    if (!fighter1 || !fighter2) return;
    setBattleState('fighting');
    setWinner(null);
    setF1Anim('');
    setF2Anim('');
    
    setTimeout(() => {
        setF1Anim('animate-lunge-right');
        setF2Anim('animate-lunge-left');
    }, 500);

    setTimeout(() => {
        const p1Energy = fighter1.currentEnergy ?? parseInt(fighter1.energy, 10);
        const p2Energy = fighter2.currentEnergy ?? parseInt(fighter2.energy, 10);
        
        let winnerMessage = '';
        let f1FinalEnergy = p1Energy;
        let f2FinalEnergy = p2Energy;
        
        if (p1Energy < p2Energy) {
            winnerMessage = `${fighter2.name} venceu!`;
            setF1Anim('animate-disintegrate');
            setF2Anim('animate-winner-glow');
            f1FinalEnergy = 0;
            f2FinalEnergy = p2Energy - p1Energy;
        } else if (p2Energy < p1Energy) {
            winnerMessage = `${fighter1.name} venceu!`;
            setF1Anim('animate-winner-glow');
            setF2Anim('animate-disintegrate');
            f2FinalEnergy = 0;
            f1FinalEnergy = p1Energy - p2Energy;
        } else { // p1Energy === p2Energy
             winnerMessage = 'Derrota Mútua!';
             setF1Anim('animate-disintegrate');
             setF2Anim('animate-disintegrate');
             f1FinalEnergy = 0;
             f2FinalEnergy = 0;
        }
        
        setWinner(winnerMessage);
        
        // Update local state to reflect battle result visually
        setFighter1({ ...fighter1, currentEnergy: f1FinalEnergy });
        setFighter2({ ...fighter2, currentEnergy: f2FinalEnergy });
        
        setBattleState('finished');
    }, 1500);
  };
  
  const resetBattle = () => {
      setFighter1(null);
      setFighter2(null);
      setWinner(null);
      setF1Anim('');
      setF2Anim('');
      setBattleState('selecting');
  }

  const CardSelector: React.FC<{ fighterNum: 1 | 2, selectedId?: string }> = ({ fighterNum, selectedId }) => (
    <div className="flex-1 flex flex-col items-center">
        <h3 className="mb-2 text-lg font-bebas tracking-wide text-purple-300">Jogador {fighterNum}</h3>
        <select 
            onChange={(e) => handleSelect(fighterNum, e.target.value)}
            value={selectedId || ''}
            className="bg-gray-700 text-white p-2 rounded-md w-full max-w-xs focus:ring-purple-500 focus:border-purple-500"
            aria-label={`Select card for player ${fighterNum}`}
        >
            <option value="" disabled>Escolha uma carta</option>
            {cards.map(card => <option key={card.id} value={card.id}>{card.name} (E: {card.currentEnergy})</option>)}
        </select>
    </div>
  );

  if (cards.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-3xl font-bebas text-purple-300">Nenhuma Carta para Batalhar</h2>
        <p className="text-gray-400 mt-2">Você precisa de pelo menos 1 carta salva para iniciar uma batalha.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {battleState === 'selecting' && (
        <div className="flex flex-col md:flex-row gap-8 items-center justify-center mb-8">
            <CardSelector fighterNum={1} selectedId={fighter1?.id} />
            <div className="text-4xl text-purple-400 font-bebas">VS</div>
            <CardSelector fighterNum={2} selectedId={fighter2?.id} />
        </div>
      )}
      
      <div className="flex justify-center mt-4 h-20">
      {battleState === 'finished' ? (
           <div className="text-center animate-fade-in">
                <h2 className="text-3xl font-bebas text-purple-300">{winner}</h2>
                <button onClick={resetBattle} className="mt-2 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors">Nova Batalha</button>
           </div>
        ) : (
             <button onClick={handleBattle} disabled={!fighter1 || !fighter2 || battleState !== 'selecting'} className="disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-3 px-8 py-3 bg-red-600 rounded-lg hover:bg-red-700 transition-all text-xl font-bebas tracking-wider shadow-lg">
                <SwordsIcon className="w-6 h-6"/>
                Batalhar!
            </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-center justify-around mt-8 min-h-[500px]">
        <div className="transform scale-[0.7] md:scale-90">
            {fighter1 ? <CardPreview cardData={fighter1} className={f1Anim} /> : <div className="w-[210px] h-[294px] md:w-[315px] md:h-[441px] bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-2xl flex items-center justify-center"><span className="text-gray-500">Jogador 1</span></div>}
        </div>
        <div className="transform scale-[0.7] md:scale-90">
             {fighter2 ? <CardPreview cardData={fighter2} className={f2Anim} /> : <div className="w-[210px] h-[294px] md:w-[315px] md:h-[441px] bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-2xl flex items-center justify-center"><span className="text-gray-500">Jogador 2</span></div>}
        </div>
      </div>
    </div>
  );
};

export default Battle;