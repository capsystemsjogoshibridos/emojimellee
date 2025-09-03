import React from 'react';
import type { BattleRecord, CardData } from '../types';
import { CrownIcon, XIcon } from './Icons';

interface HistoryProps {
  history: BattleRecord[];
  onClearHistory: () => void;
}

const HistoryCard: React.FC<{ card: CardData; isWinner: boolean; isLoser: boolean }> = ({ card, isWinner, isLoser }) => (
  <div className="relative w-28 h-40 sm:w-32 sm:h-44 flex-shrink-0">
    <div className={`w-full h-full bg-gray-800 rounded-md overflow-hidden shadow-lg border-2 ${isWinner ? 'border-yellow-400' : isLoser ? 'border-red-600' : 'border-gray-700'}`}>
      {card.image ? (
        <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
      ) : (
         <div className="w-full h-full bg-gray-700 flex items-center justify-center p-1">
            <span className="text-gray-500 text-center text-xs">{card.name}</span>
         </div>
      )}
    </div>
    {isWinner && (
      <div className="absolute -top-3 -right-3 bg-yellow-400 p-1 rounded-full shadow-lg z-10">
        <CrownIcon className="w-6 h-6 text-white" />
      </div>
    )}
    {isLoser && (
      <div className="absolute -top-2 -right-2 bg-red-600 p-1 rounded-full shadow-lg z-10">
        <XIcon className="w-5 h-5 text-white" />
      </div>
    )}
    <p className="text-center mt-1 text-xs text-gray-300 truncate font-semibold">{card.name}</p>
  </div>
);

const HistoryColumn: React.FC<{ title: string; records: BattleRecord[] }> = ({ title, records }) => (
    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
        <h3 className="text-2xl font-bebas text-purple-300 text-center tracking-wider mb-6">{title}</h3>
        {records.length > 0 ? (
            <div className="space-y-6">
                {records.map((record) => {
                    const f1isWinner = record.winnerId === record.fighter1.id;
                    const f2isWinner = record.winnerId === record.fighter2.id;
                    const isDraw = record.winnerId === null;

                    return (
                        <div key={record.id} className="bg-gray-800 p-4 rounded-xl flex items-center justify-center gap-4 sm:gap-6 shadow-md border border-gray-700/50">
                            <HistoryCard card={record.fighter1} isWinner={f1isWinner} isLoser={f2isWinner || isDraw} />
                            <span className="text-2xl sm:text-4xl font-bebas text-red-500">VS</span>
                            <HistoryCard card={record.fighter2} isWinner={f2isWinner} isLoser={f1isWinner || isDraw} />
                        </div>
                    );
                })}
            </div>
        ) : (
            <p className="text-center text-gray-500 mt-4">Nenhuma batalha registrada neste modo.</p>
        )}
    </div>
);

const History: React.FC<HistoryProps> = ({ history, onClearHistory }) => {
  const melleeHistory = history.filter(r => r.mode === 'mellee');
  const soloHistory = history.filter(r => r.mode === 'solo');

  if (melleeHistory.length === 0 && soloHistory.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <h2 className="text-3xl font-bebas text-purple-300">Nenhuma Batalha Registrada</h2>
        <p className="text-gray-400 mt-2">Jogue os modos Emoji Mellee ou Solo para ver seu histórico!</p>
      </div>
    );
  }
  
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        {history.length > 0 && (
            <button 
                onClick={onClearHistory}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
                Limpar Histórico
            </button>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
        <HistoryColumn title="Emoji Mellee" records={melleeHistory} />
        <HistoryColumn title="Modo Solo" records={soloHistory} />
      </div>
    </div>
  );
};

export default History;