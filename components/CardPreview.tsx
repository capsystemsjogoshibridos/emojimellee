import React from 'react';
import type { CardData } from '../types';
import { EnergyIcon, PowerIcon } from './Icons';

interface CardPreviewProps {
  cardData: CardData;
  className?: string;
}

const CardPreview: React.FC<CardPreviewProps> = ({ cardData, className }) => {
  const displayEnergy = cardData.currentEnergy !== undefined ? cardData.currentEnergy : cardData.energy;

  return (
    <div className={`w-[300px] h-[420px] sm:w-[350px] sm:h-[490px] rounded-2xl overflow-hidden shadow-lg relative transform transition-transform duration-300 hover:scale-105 animate-glow ${className}`}>
      <div className="absolute inset-0 bg-black">
        {cardData.image ? (
          <img src={cardData.image} alt={cardData.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
            <span className="text-gray-500">Sem Imagem</span>
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-start text-white">
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm p-2 rounded-lg">
          <PowerIcon className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
          <span className="font-bebas text-2xl sm:text-3xl tracking-wider drop-shadow-lg">{cardData.power}</span>
        </div>
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm p-2 rounded-lg">
          <EnergyIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
          <span className="font-bebas text-2xl sm:text-3xl tracking-wider drop-shadow-lg">{displayEnergy}</span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white">
        {cardData.combination && (
          <div className="text-center mb-1">
            <span className="text-2xl sm:text-3xl" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              {cardData.combination}
            </span>
          </div>
        )}
        <h3 className="font-bebas text-3xl sm:text-4xl tracking-wider drop-shadow-lg leading-tight">{cardData.name}</h3>
        <div className="mt-2 p-2 bg-black/60 backdrop-blur-sm rounded-md border-t-2 border-purple-400/50">
          <p className="text-xs sm:text-sm text-gray-200 font-roboto italic leading-snug">{cardData.ability}</p>
        </div>
      </div>
    </div>
  );
};

export default CardPreview;