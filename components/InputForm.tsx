
import React, { useState } from 'react';
import type { CardData } from '../types';
import { UploadIcon, EmojiHappyIcon } from './Icons';
import EmojiPicker from './EmojiPicker';

interface InputFormProps {
  cardData: CardData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onReset: () => void;
}

const InputForm: React.FC<InputFormProps> = ({ cardData, onInputChange, onImageChange, onSave, onReset }) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleEmojiSelect = (emoji: string) => {
    const currentCombination = cardData.combination || '';
    if (Array.from(currentCombination).length < 3) {
      const newValue = currentCombination + emoji;
      // Create a synthetic event to pass to the handler in App.tsx
      const syntheticEvent = {
        target: {
          name: 'combination',
          value: newValue,
        },
      } as React.ChangeEvent<HTMLInputElement>;
      onInputChange(syntheticEvent);
    }
    // Close picker after selection if we are not at the limit, to allow multiple selections.
    if (Array.from(currentCombination).length >= 2) {
        setIsPickerOpen(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <h2 className="text-2xl font-bebas tracking-wide text-purple-300 border-b-2 border-purple-500/30 pb-2">Personalize sua Carta</h2>
      
      <div>
        <label htmlFor="image-upload" className="block text-sm font-medium text-gray-300 mb-2">Imagem da Carta</label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md hover:border-purple-400 transition-colors">
          <div className="space-y-1 text-center">
            <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
            <div className="flex text-sm text-gray-400">
              <label htmlFor="image-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-purple-400 hover:text-purple-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-purple-500">
                <span>Carregar um arquivo</span>
                <input id="image-upload" name="image-upload" type="file" className="sr-only" onChange={onImageChange} accept="image/*" />
              </label>
              <p className="pl-1">ou arraste e solte</p>
            </div>
            <p className="text-xs text-gray-500">PNG, JPG, GIF até 10MB</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300">Nome</label>
          <input
            type="text"
            name="name"
            id="name"
            value={cardData.name}
            onChange={onInputChange}
            className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white p-2"
            required
          />
        </div>
        <div>
            <label htmlFor="combination" className="block text-sm font-medium text-gray-300">Combinação</label>
             <div className="relative mt-1">
                <input
                    type="text"
                    name="combination"
                    id="combination"
                    value={cardData.combination || ''}
                    onChange={onInputChange}
                    className="block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white p-2 pr-10"
                    placeholder="Escolha até 3 emojis"
                />
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(prev => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-purple-400"
                  aria-label="Escolher emoji"
                >
                  <EmojiHappyIcon className="w-5 h-5" />
                </button>
              </div>
              {isPickerOpen && (
                <EmojiPicker
                  onEmojiSelect={handleEmojiSelect}
                  onClose={() => setIsPickerOpen(false)}
                />
              )}
        </div>
        <div>
          <label htmlFor="power" className="block text-sm font-medium text-gray-300">Poder</label>
          <input
            type="number"
            name="power"
            id="power"
            value={cardData.power}
            onChange={onInputChange}
            className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white p-2"
            required
          />
        </div>
        <div>
          <label htmlFor="energy" className="block text-sm font-medium text-gray-300">Energia</label>
          <input
            type="number"
            name="energy"
            id="energy"
            value={cardData.energy}
            onChange={onInputChange}
            className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white p-2"
            required
          />
        </div>
      </div>
      
      <div>
        <label htmlFor="ability" className="block text-sm font-medium text-gray-300">Habilidade</label>
        <textarea
          name="ability"
          id="ability"
          rows={3}
          value={cardData.ability}
          onChange={onInputChange}
          className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white p-2"
          required
        />
      </div>
      <div className="flex gap-4 pt-4">
        <button
            type="button"
            onClick={onReset}
            className="w-full flex justify-center py-3 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500"
        >
            Nova Carta
        </button>
        <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500"
        >
            Salvar Carta
        </button>
      </div>
    </form>
  );
};

export default InputForm;
