
import React, { useState, useEffect, useMemo } from 'react';
import { CardData, BattleRecord } from './types';
import InputForm from './components/InputForm';
import CardPreview from './components/CardPreview';
import Album from './components/Album';
import Battle from './components/Battle';
import History from './components/History';
import Deck from './components/Deck';
import Arena from './components/Arena';
import EmojiMellee from './components/EmojiMellee';
import SoloMode from './components/SoloMode';
import MelleeOnline from './components/MelleeOnline';
import { PlusCircleIcon, BookOpenIcon, SwordsIcon, HistoryIcon, DeckIcon, MobileIcon, DesktopIcon, ArenaIcon, EmojiBattleIcon, SoloIcon, ArrowLeftIcon, GlobeIcon } from './components/Icons';
import { initDB, saveImage, getImage, deleteImage } from './db';

type View = 'home' | 'creator' | 'album' | 'simulator' | 'history' | 'deck' | 'arena' | 'emoji-mellee' | 'solo' | 'mellee-online';
type Orientation = 'desktop' | 'mobile';

// Helper to generate a placeholder image as a dataURL
const generatePlaceholderImage = (width: number, height: number, text: string): string => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // transparent pixel

    // A simple gradient background
    const hue1 = Math.random() * 360;
    const hue2 = (hue1 + 120) % 360;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `hsl(${hue1}, 70%, 40%)`);
    gradient.addColorStop(1, `hsl(${hue2}, 70%, 20%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Adjust font size based on text length
    let fontSize = 40;
    ctx.font = `${fontSize}px "Bebas Neue", cursive`;
    while (ctx.measureText(text).width > width - 40 && fontSize > 10) {
        fontSize--;
        ctx.font = `${fontSize}px "Bebas Neue", cursive`;
    }
    
    ctx.fillText(text, width / 2, height / 2);
    
    return canvas.toDataURL('image/png');
};

// Helper to convert dataURL to Blob
const dataURLtoBlob = (dataurl: string): Blob | null => {
    try {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || arr.length < 2) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    } catch(e) {
        console.error("Error converting dataURL to Blob:", e);
        return null;
    }
}

const defaultCardData = [
  { name: 'Christopher', energy: '1000', power: '4', ability: 'Aumenta o BP de todos os personagens aliados em 100.' },
  { name: 'Eliza Maria', energy: '800', power: '3', ability: 'Compra 1 carta.' },
  { name: 'Ana Clara', energy: '700', power: '3', ability: 'Reduz o SP do oponente em 1.' },
  { name: 'Lucas', energy: '600', power: '3', ability: 'Aumenta o SP em 1.' },
  { name: 'Thais', energy: '900', power: '3', ability: 'Ignora o estado de congelamento ao atacar.' },
  { name: 'Alana', energy: '700', power: '3', ability: 'Compra 1 carta se causar dano direto.' },
  { name: 'Antunis', energy: '600', power: '3', ability: 'Pode atacar diretamente o HP do oponente.' },
  { name: 'Carlinha', energy: '400', power: '2', ability: 'Reduz o BP de 1 personagem inimigo em 300.' },
  { name: 'Deyse', energy: '500', power: '3', ability: 'Troca o HP com o personagem oponente que atacar.' },
  { name: 'Edilson', energy: '800', power: '3', ability: 'Destrói o personagem inimigo com menor BP.' },
  { name: 'Evanessa', energy: '700', power: '3', ability: 'Devolve 1 personagem do oponente à mão.' },
  { name: 'Evania', energy: '800', power: '3', ability: 'Causa 300 de dano direto ao HP do oponente.' },
  { name: 'Felipe (MJ)', energy: '900', power: '3', ability: 'Destrói um personagem com 700 BP ou menos.' },
  { name: 'Frank', energy: '800', power: '3', ability: 'Recupera 300 de HP.' },
  { name: 'Gabi', energy: '700', power: '3', ability: 'Causa 200 de dano a todos os personagens inimigos.' },
  { name: 'Gabriel (Cris)', energy: '800', power: '3', ability: 'Ignora o estado de congelamento e aumenta 200 de BP ao atacar.' },
  { name: 'Gabrielzinho', energy: '900', power: '4', ability: 'Ataca todos os personagens do oponente.' },
  { name: 'João Paulo', energy: '600', power: '3', ability: 'Tem 50% de chance de causar dano dobrado.' },
  { name: 'Juliane', energy: '900', power: '4', ability: 'Causa 200 de dano a todos os personagens.' },
  { name: 'Kenny', energy: '500', power: '3', ability: 'Destrói um personagem com suporte.' },
  { name: 'Maria Clara', energy: '800', power: '3', ability: 'Causa 300 de dano a todos os personagens, inclusive os seus.' },
  { name: 'Marlon', energy: '700', power: '3', ability: 'Pode atacar personagens em modo de suporte (back-up).' },
  { name: 'Milena', energy: '500', power: '3', ability: 'Reduz o BP de 1 personagem inimigo em 500.' },
  { name: 'Manu', energy: '600', power: '3', ability: 'Aumenta o BP de um aliado em 500.' },
  { name: 'Nathan', energy: '800', power: '3', ability: 'Causa 300 de dano ao personagem com maior BP do oponente.' },
  { name: 'Rai', energy: '1000', power: '4', ability: 'Ignora congelamento e pode atacar diretamente.' },
  { name: 'Renato', energy: '500', power: '2', ability: 'Ataca diretamente o HP do oponente se não houver personagens.' },
  { name: 'Rodrigo (Deise)', energy: '900', power: '3', ability: 'Compra 2 cartas ao causar dano.' },
  { name: 'Samuel', energy: '700', power: '3', ability: 'Aumenta o SP em 2.' },
  { name: 'Chico', energy: '700', power: '3', ability: 'Destrói 1 personagem com SP menor que 2.' },
  { name: 'Celly', energy: '1000', power: '4', ability: 'Aumenta 300 de BP ao atacar.' },
  { name: 'Fatima', energy: '800', power: '3', ability: 'Reduz o SP do oponente em 2.' },
  { name: 'Eudemir', energy: '700', power: '3', ability: 'Ignora personagens de suporte ao atacar diretamente.' },
  { name: 'Sidney', energy: '1000', power: '4', ability: 'Ignora congelamento e ataca direto o HP se possível.' },
  { name: 'Taciani', energy: '800', power: '3', ability: 'Descarta 1 carta da mão do oponente aleatoriamente.' },
  { name: 'Téia', energy: '800', power: '3', ability: 'Descarta 2 cartas do topo do baralho do oponente.' },
  { name: 'Nicolas', energy: '900', power: '4', ability: 'Descarta sua mão e compra +1 carta a mais que o total descartado.' },
  { name: 'Guilhermy', energy: '700', power: '3', ability: 'Se derrotar um personagem, compra 2 cartas.' },
  { name: 'Tauã', energy: '1000', power: '4', ability: 'Destrói qualquer personagem com 700 BP ou menos.' },
  { name: 'Thaynara', energy: '800', power: '3', ability: 'Olha a mão do oponente e descarta uma carta de ação.' },
  { name: 'Thasyla', energy: '1200', power: '5', ability: 'Destrói todos os personagens com 700 BP ou menos.' },
  { name: 'Valeria', energy: '700', power: '3', ability: 'Se destruída, causa 300 de dano ao HP do oponente.' },
  { name: 'Johnatan', energy: '700', power: '3', ability: 'Reduz o SP do oponente em 1 ao entrar em campo.' },
  { name: 'Evelyn', energy: '1000', power: '4', ability: 'Causa 400 de dano ao personagem com menor HP.' },
  { name: 'Derick', energy: '800', power: '3', ability: 'Recupera 300 de HP do jogador.' },
  { name: 'Jhonny', energy: '700', power: '3', ability: 'Aumenta o BP de Athena em 300 se estiver em campo.' },
  { name: 'Andrew', energy: '400', power: '3', ability: 'Diminui o BP de todos os personagens inimigos em 100.' },
  { name: 'Andressa', energy: '600', power: '3', ability: 'Compra 1 carta ao entrar em campo.' },
  { name: 'Isabela', energy: '1000', power: '4', ability: 'Se derrotar um personagem, ganha 1 SP.' },
  { name: 'Neni Kelly', energy: '700', power: '3', ability: 'Impede o uso de cartas Action no próximo turno.' }
];

const viewTitles: { [key in View]?: string } = {
    creator: 'Crie sua Carta',
    album: 'Álbum de Cartas',
    deck: 'Meu Deck',
    arena: 'Arena de Batalha',
    'emoji-mellee': 'Emoji Mellee',
    'mellee-online': 'Mellee Online',
    solo: 'Modo Solo',
    simulator: 'Simulador de Batalha',
    history: 'Histórico de Batalhas',
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');
  const [orientation, setOrientation] = useState<Orientation>('desktop');
  const [savedCards, setSavedCards] = useState<CardData[]>([]);
  const [battleHistory, setBattleHistory] = useState<BattleRecord[]>([]);
  const [deck, setDeck] = useState<string[]>([]);
  const [cardEnergies, setCardEnergies] = useState<{ [key: string]: number }>({});
  const [cardData, setCardData] = useState<CardData>({
    id: `card-${Date.now()}`,
    name: '',
    power: '',
    energy: '',
    ability: '',
    image: null,
    combination: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pseudonym, setPseudonym] = useState<string>('');
  const [showPseudonymModal, setShowPseudonymModal] = useState(false);
  const [targetView, setTargetView] = useState<View | null>(null);

  // Arena persistent state
  const [arenaBoard, setArenaBoard] = useState<(CardData | null)[]>([null, null, null]);
  const [arenaOpponentBoard, setArenaOpponentBoard] = useState<(CardData & { currentEnergy?: number })[]>([null, null, null]);
  const [arenaHand, setArenaHand] = useState<CardData[]>([]);
  const [arenaDrawPile, setArenaDrawPile] = useState<CardData[]>([]);
  const [arenaInitialized, setArenaInitialized] = useState(false);
  const [arenaPlayer1Hp, setArenaPlayer1Hp] = useState(2000);
  const [arenaPlayer2Hp, setArenaPlayer2Hp] = useState(2000);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        await initDB();
        setDbReady(true);
        
        const cardsJSON = localStorage.getItem('savedCards');
        const historyJSON = localStorage.getItem('battleHistory');
        const deckJSON = localStorage.getItem('deck');
        const energiesJSON = localStorage.getItem('cardEnergies');
        const storedEnergies = energiesJSON ? JSON.parse(energiesJSON) : {};
        const savedPseudonym = localStorage.getItem('pseudonym');

        if (savedPseudonym) setPseudonym(savedPseudonym);
        if (deckJSON) setDeck(JSON.parse(deckJSON));
        
        if (cardsJSON) {
          const storedCards: Omit<CardData, 'image'>[] = JSON.parse(cardsJSON);
          const fullCards = await Promise.all(
            storedCards.map(async (card) => {
              const imageBlob = await getImage(card.id);
              const imageUrl = imageBlob ? URL.createObjectURL(imageBlob) : null;
              return { ...card, image: imageUrl };
            })
          );
          setSavedCards(fullCards);
          
          const initialEnergies: { [key: string]: number } = {};
          fullCards.forEach(c => {
            initialEnergies[c.id] = parseInt(c.energy, 10) || 0;
          });
          setCardEnergies({ ...initialEnergies, ...storedEnergies });

        } else {
            // A curated pool of widely supported, single-codepoint emojis to prevent rendering issues.
            const emojiPool = [
                '✨', '🔮', '🔥', '🐉', '⚔️', '🛡️', '💀', '💎', '🌀', '⚡️', '👑', '💥', '❤️', '⭐', '🍀', '💰', '📜', '🗝️', '💣', '⏳', '🪄', '🔱', '💯', '💢', '💨', '💫', '💦', '🕳️',
                '😀', '😇', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '👽', '👾', '🤖', '🎃', '😺', '🐵', '🐶', '🐺', '🦊', '🐱', '🦁', '🐯', '🐴', '🦄', '🐮', '🐷', '🐗', '🐭', '🐹', '🐰',
                '🐻', '🐼', '🐸', '🐍', '🐲', '🐳', '🐬', '🐟', '🐠', '🦋', '🐛', '🐜', '🐝', '🐞', '🌍', '🌕', '☀️', '🌙', '🌟', '☄️', '🪐', '💧', '🌊', '🌪️', '🌈', '🌸', '🌹', '🌺', '🌻',
                '🌼', '🌷', '🌱', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍁', '🍄', '🍇', '🍉', '🍌', '🍍', '🍎', '🍏', '🍑', '🍒', '🍓', '🥝', '🍅', '🥥', '🥑', '🍆', '🌶️', '🍔', '🍕',
                '🎂', '⚽️', '🏀', '🏈', '⚾️', '🎾', '🏐', '🎱', '🎯', '🎲', '🎮', '🧩', '🎨', '🎵', '🎤', '🎧', '🎸', '🎺', '🥁', '🎬', '🏆', '🥇', '🥈', '🥉', '🎁', '🎉', '🎈', '💡'
            ];
            const generatedCombinations = new Set<string>();

            // A simple and stable hash function to generate deterministic values from card names.
            const simpleHash = (str: string): number => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash |= 0; // Convert to 32bit integer
                }
                return Math.abs(hash);
            };

            const newCardsPromises = defaultCardData.map(async (card, index): Promise<CardData | null> => {
                const cardId = `default-card-${Date.now()}-${index}`;
                const dataUrl = generatePlaceholderImage(300, 420, card.name);
                const blob = dataURLtoBlob(dataUrl);
                if (!blob) {
                    console.error("Failed to create blob for card:", card.name);
                    return null;
                }
                await saveImage(cardId, blob);
                const localImageUrl = URL.createObjectURL(blob);

                // Generate a unique, definitive combination based on the card's name for stability.
                let combination = '';
                const hash = simpleHash(card.name);
                const i1 = hash % emojiPool.length;
                // Use different parts of the hash to get different initial indices
                const i2 = (hash >> 8) % emojiPool.length;
                const i3 = (hash >> 16) % emojiPool.length;
                
                // Ensure the three emojis are different for more variety
                let finalI2 = i2;
                if (finalI2 === i1) {
                    finalI2 = (finalI2 + 1) % emojiPool.length;
                }
                let finalI3 = i3;
                if (finalI3 === i1 || finalI3 === finalI2) {
                    finalI3 = (finalI3 + 2) % emojiPool.length; // Use a different increment
                }
                 if (finalI3 === i1 || finalI3 === finalI2) { // Re-check after adjustment
                    finalI3 = (finalI3 + 1) % emojiPool.length;
                }
                
                combination = emojiPool[i1] + emojiPool[finalI2] + emojiPool[finalI3];

                // Ensure uniqueness against the rare case of a hash collision.
                let counter = 1;
                while(generatedCombinations.has(combination)) {
                    const new_i3 = (finalI3 + counter) % emojiPool.length;
                    combination = emojiPool[i1] + emojiPool[finalI2] + emojiPool[new_i3];
                    counter++;
                }
                generatedCombinations.add(combination);

                return {
                  id: cardId,
                  name: card.name,
                  power: card.power,
                  energy: card.energy,
                  ability: card.ability,
                  image: localImageUrl,
                  combination,
                };
          });
          const newCardsResult = await Promise.all(newCardsPromises);
          const newCards = newCardsResult.filter((c): c is CardData => c !== null);
          setSavedCards(newCards);
          
          const cardsForStorage = newCards.map(({ image, ...rest }) => rest);
          localStorage.setItem('savedCards', JSON.stringify(cardsForStorage));

          const initialEnergies: { [key: string]: number } = {};
          newCards.forEach(c => {
            initialEnergies[c.id] = parseInt(c.energy, 10) || 0;
          });
          setCardEnergies(initialEnergies);
          localStorage.setItem('cardEnergies', JSON.stringify(initialEnergies));
        }

        if (historyJSON) {
          type StoredBattleRecord = Omit<BattleRecord, 'fighter1' | 'fighter2'> & {
              fighter1: Omit<CardData, 'image'>;
              fighter2: Omit<CardData, 'image'>;
          };
          const storedHistory: StoredBattleRecord[] = JSON.parse(historyJSON);
          const fullHistory = await Promise.all(
              storedHistory.map(async (record) => {
                  const f1Blob = await getImage(record.fighter1.id);
                  const f1Url = f1Blob ? URL.createObjectURL(f1Blob) : null;
                  const f2Blob = await getImage(record.fighter2.id);
                  const f2Url = f2Blob ? URL.createObjectURL(f2Blob) : null;
                  return {
                      ...record,
                      fighter1: { ...record.fighter1, image: f1Url },
                      fighter2: { ...record.fighter2, image: f2Url },
                      mode: record.mode || 'simulator' // Backwards compatibility
                  };
              })
          );
          setBattleHistory(fullHistory as BattleRecord[]);
        }
      } catch (error) {
        console.error("Failed to initialize DB or load data from storage:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();

    return () => {
      savedCards.forEach(card => {
        if (card.image && card.image.startsWith('blob:')) URL.revokeObjectURL(card.image);
      });
      battleHistory.forEach(record => {
        if (record.fighter1.image && record.fighter1.image.startsWith('blob:')) URL.revokeObjectURL(record.fighter1.image);
        if (record.fighter2.image && record.fighter2.image.startsWith('blob:')) URL.revokeObjectURL(record.fighter2.image);
      });
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'combination') {
        const emojiRegex = /\p{Emoji}/u;
        const graphemes = Array.from(value);
        const emojiGraphemes = graphemes.filter(g => emojiRegex.test(g));
        const limitedValue = emojiGraphemes.slice(0, 3).join('');
        setCardData(prev => ({ ...prev, [name]: limitedValue }));
    } else {
        setCardData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (cardData.image && cardData.image.startsWith('blob:')) {
        URL.revokeObjectURL(cardData.image);
      }
      setImageFile(file);
      setCardData(prev => ({ ...prev, image: URL.createObjectURL(file) }));
    }
  };

  const handleSaveCard = async () => {
    if (!dbReady) {
        alert("O banco de dados não está pronto. Por favor, aguarde um momento.");
        return;
    }

    const isUpdating = savedCards.some(card => card.id === cardData.id);
    const newCard = isUpdating ? { ...cardData } : { ...cardData, id: `card-${Date.now()}` };

    try {
        if (imageFile) {
            await saveImage(newCard.id, imageFile);
        } else if (!isUpdating && newCard.image && newCard.image.startsWith('https')) {
            const response = await fetch(newCard.image);
            const blob = await response.blob();
            await saveImage(newCard.id, blob);
        }
    } catch (error) {
        console.error("Failed to save image to IndexedDB:", error);
        alert("Erro ao salvar a imagem. A cota de armazenamento do navegador pode ter sido excedida.");
        return;
    }

    const updatedCards = isUpdating
        ? savedCards.map(card => card.id === newCard.id ? newCard : card)
        : [...savedCards, newCard];
    
    setSavedCards(updatedCards);

    // Update energy state for the new/updated card
    const newEnergy = parseInt(newCard.energy, 10) || 0;
    handleUpdateCardEnergy(newCard.id, newEnergy);


    try {
        const cardsForStorage = updatedCards.map(({ image, ...rest }) => rest);
        localStorage.setItem('savedCards', JSON.stringify(cardsForStorage));
        alert(isUpdating ? 'Carta atualizada com sucesso!' : 'Carta salva com sucesso!');
        if (!isUpdating) resetCard();
    } catch (error) {
        console.error("Failed to save card metadata to localStorage:", error);
        alert("Erro ao salvar os dados da carta. O armazenamento local pode estar cheio.");
    }
  };
  
  const resetCard = () => {
    if (cardData.image && cardData.image.startsWith('blob:')) {
      URL.revokeObjectURL(cardData.image);
    }
    setImageFile(null);
    setCardData({
      id: `card-${Date.now()}`,
      name: '',
      power: '',
      energy: '',
      ability: '',
      image: null,
      combination: '',
    });
  }

  const handleDeleteCard = async (cardId: string) => {
    if (!dbReady) {
        alert("O banco de dados não está pronto. Por favor, aguarde um momento.");
        return;
    }
    
    const cardToDelete = savedCards.find(c => c.id === cardId);
    if(cardToDelete?.image && cardToDelete.image.startsWith('blob:')) {
        URL.revokeObjectURL(cardToDelete.image);
    }

    try {
        await deleteImage(cardId);
    } catch (error) {
        console.error("Failed to delete image from IndexedDB:", error);
    }
    
    const updatedCards = savedCards.filter(card => card.id !== cardId);
    setSavedCards(updatedCards);
    const cardsForStorage = updatedCards.map(({ image, ...rest }) => rest);
    localStorage.setItem('savedCards', JSON.stringify(cardsForStorage));

    // Remove from energies
    const newEnergies = { ...cardEnergies };
    delete newEnergies[cardId];
    setCardEnergies(newEnergies);
    localStorage.setItem('cardEnergies', JSON.stringify(newEnergies));

    handleRemoveFromDeck(cardId);
  };

  const handleEditCard = (cardToEdit: CardData) => {
    setImageFile(null);
    setCardData(cardToEdit);
    setView('creator');
  };

  const handleRoundEnd = (record: Omit<BattleRecord, 'id'>) => {
    const newRecord: BattleRecord = {
      id: `battle-${Date.now()}`,
      ...record
    };
    const updatedHistory = [newRecord, ...battleHistory];
    setBattleHistory(updatedHistory);
    
    try {
        const historyForStorage = updatedHistory.map(r => ({
            id: r.id,
            winnerId: r.winnerId,
            fighter1: (({ image, ...rest }) => rest)(r.fighter1),
            fighter2: (({ image, ...rest }) => rest)(r.fighter2),
            mode: r.mode,
        }));
        localStorage.setItem('battleHistory', JSON.stringify(historyForStorage));
    } catch(error) {
        console.error("Failed to save battle history to localStorage:", error);
    }
  };

  const handleClearHistory = () => {
    setBattleHistory([]);
    localStorage.removeItem('battleHistory');
  };

  const handleAddToDeck = (cardId: string) => {
    if (deck.length >= 50 || deck.includes(cardId)) {
        return;
    }
    const card = savedCards.find(c => c.id === cardId);
    if (!card) return;

    const newDeck = [...deck, cardId];
    setDeck(newDeck);
    localStorage.setItem('deck', JSON.stringify(newDeck));
  };
  
  const handleRemoveFromDeck = (cardId: string) => {
    const newDeck = deck.filter(id => id !== cardId);
    setDeck(newDeck);
    localStorage.setItem('deck', JSON.stringify(newDeck));
  };
  
  const handleUpdateCardEnergy = (cardId: string, newEnergy: number) => {
      const newEnergies = { ...cardEnergies, [cardId]: Math.max(0, newEnergy) };
      setCardEnergies(newEnergies);
      localStorage.setItem('cardEnergies', JSON.stringify(newEnergies));
  };

  const handleResetCardEnergy = (cardId: string) => {
    const originalCard = savedCards.find(c => c.id === cardId);
    if (originalCard) {
        const originalEnergy = parseInt(originalCard.energy, 10) || 0;
        const newEnergies = { ...cardEnergies, [cardId]: originalEnergy };
        setCardEnergies(newEnergies);
        localStorage.setItem('cardEnergies', JSON.stringify(newEnergies));
    }
  };

  const getDeckCards = (): CardData[] => {
    return deck
        .map(id => {
            const card = savedCards.find(c => c.id === id);
            if (!card) return null;
            const currentEnergy = cardEnergies[id] !== undefined ? cardEnergies[id] : parseInt(card.energy, 10);
            return {
                ...card,
                currentEnergy: currentEnergy
            };
        })
        .filter((card): card is CardData & { currentEnergy: number } => card !== null);
  };
  
  const allCardsWithCurrentEnergy = useMemo(() => {
    return savedCards.map(card => {
      const currentEnergy = cardEnergies[card.id] !== undefined
        ? cardEnergies[card.id]
        : parseInt(card.energy, 10) || 0;
      return { ...card, currentEnergy };
    });
  }, [savedCards, cardEnergies]);

  const handleViewChange = (view: View) => {
    if (view === 'mellee-online') {
      if (pseudonym) {
        setView('mellee-online');
      } else {
        setTargetView('mellee-online');
        setShowPseudonymModal(true);
      }
    } else {
      setView(view);
    }
  };
  
  const handlePseudonymSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).elements.namedItem('pseudonym') as HTMLInputElement;
    const newPseudonym = input.value.trim();
    if (newPseudonym) {
      localStorage.setItem('pseudonym', newPseudonym);
      setPseudonym(newPseudonym);
      setShowPseudonymModal(false);
      if (targetView) {
        setView(targetView);
        setTargetView(null);
      }
    }
  };

  const renderView = () => {
    const currentDeckCards = getDeckCards();
    switch (view) {
      case 'album':
        return <Album cards={savedCards} onEdit={handleEditCard} onDelete={handleDeleteCard} onAddToDeck={handleAddToDeck} onRemoveFromDeck={handleRemoveFromDeck} deck={deck} />;
      case 'simulator':
        return <Battle cards={allCardsWithCurrentEnergy} />;
      case 'history':
        return <History history={battleHistory} onClearHistory={handleClearHistory} />;
      case 'deck':
        return <Deck deckCards={currentDeckCards} onRemove={handleRemoveFromDeck} />;
      case 'arena':
        return <Arena 
          deckCards={currentDeckCards}
          board={arenaBoard}
          setBoard={setArenaBoard}
          hand={arenaHand}
          setHand={setArenaHand}
          drawPile={arenaDrawPile}
          setDrawPile={setArenaDrawPile}
          initialized={arenaInitialized}
          setInitialized={setArenaInitialized}
          savedCards={savedCards}
          opponentBoard={arenaOpponentBoard}
          setOpponentBoard={setArenaOpponentBoard}
          onUpdateCardEnergy={handleUpdateCardEnergy}
          onResetCardEnergy={handleResetCardEnergy}
          player1Hp={arenaPlayer1Hp}
          setPlayer1Hp={setArenaPlayer1Hp}
          player2Hp={arenaPlayer2Hp}
          setPlayer2Hp={setArenaPlayer2Hp}
        />;
      case 'emoji-mellee':
        return <EmojiMellee savedCards={savedCards} onRoundEnd={handleRoundEnd} />;
      case 'mellee-online':
        return <MelleeOnline savedCards={savedCards} onRoundEnd={handleRoundEnd} pseudonym={pseudonym} />;
      case 'solo':
        return <SoloMode savedCards={savedCards} onRoundEnd={handleRoundEnd} />;
      case 'creator':
      default:
        const creatorLayoutClasses = orientation === 'mobile'
          ? 'flex flex-col items-center'
          : 'grid grid-cols-2 items-start';

        return (
          <main className={`${creatorLayoutClasses} gap-10 mt-6`}>
            <div className="w-full bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
              <InputForm 
                onInputChange={handleInputChange} 
                onImageChange={handleImageChange}
                onSave={handleSaveCard}
                onReset={resetCard}
                cardData={cardData}
              />
            </div>
            <div className="w-full flex items-center justify-center">
              <CardPreview cardData={cardData} />
            </div>
          </main>
        );
    }
  };
  
  const OrientationButton: React.FC<{
    target: Orientation;
    label: string;
    icon: React.ReactNode;
  }> = ({ target, label, icon }) => (
    <button
      onClick={() => setOrientation(target)}
      className={`p-2 rounded-lg transition-colors ${
        orientation === target
          ? 'bg-purple-600 text-white shadow-lg'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );

  const HomeMenuButton: React.FC<{
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
  }> = ({ onClick, icon, label }) => (
      <button onClick={onClick} className="w-full flex items-center justify-center gap-4 p-4 bg-gray-800 rounded-lg shadow-lg hover:bg-purple-800/50 hover:shadow-purple-500/30 border border-gray-700 transition-all duration-300 transform hover:scale-105">
          {icon}
          <span className="font-bebas text-2xl tracking-wider text-gray-200">{label}</span>
      </button>
  );

  if (isLoading) {
    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center text-center p-4">
            <h1 className="text-4xl font-bebas text-purple-400">Carregando Jogo...</h1>
            <p className="text-gray-400 mt-2">Preparando as cartas pela primeira vez. Isso pode levar um minuto.</p>
        </div>
    );
  }

  const menuItems: { view: View, label: string, icon: React.ReactNode }[] = [
      { view: 'arena', label: 'Arena', icon: <ArenaIcon className="w-8 h-8 text-purple-400"/> },
      { view: 'album', label: 'Álbum', icon: <BookOpenIcon className="w-8 h-8 text-purple-400"/> },
      { view: 'creator', label: 'Crie sua Carta', icon: <PlusCircleIcon className="w-8 h-8 text-purple-400"/> },
      { view: 'deck', label: 'Deck', icon: <DeckIcon className="w-8 h-8 text-purple-400"/> },
      { view: 'emoji-mellee', label: 'Emoji Mellee', icon: <EmojiBattleIcon className="w-8 h-8 text-purple-400"/> },
      { view: 'mellee-online', label: 'Mellee Online', icon: <GlobeIcon className="w-8 h-8 text-purple-400"/> },
      { view: 'solo', label: 'Modo Solo', icon: <SoloIcon className="w-8 h-8 text-purple-400"/> },
      { view: 'simulator', label: 'Simulador', icon: <SwordsIcon className="w-8 h-8 text-purple-400"/> },
      { view: 'history', label: 'Histórico', icon: <HistoryIcon className="w-8 h-8 text-purple-400"/> },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white font-roboto p-4 sm:p-8">
      <div className={`container mx-auto ${orientation === 'desktop' ? 'max-w-7xl' : 'max-w-sm'} transition-all duration-500 ease-in-out relative`}>
        
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 flex gap-2">
            <OrientationButton target="mobile" label="Visualização Mobile" icon={<MobileIcon className="w-5 h-5" />} />
            <OrientationButton target="desktop" label="Visualização Desktop" icon={<DesktopIcon className="w-5 h-5" />} />
        </div>
        
        {showPseudonymModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-sm w-full">
              <h2 className="text-2xl font-bebas tracking-wide text-purple-300 mb-4">Defina seu Pseudônimo</h2>
              <p className="text-gray-400 mb-6">Escolha um nome para te identificar nas partidas online (máx. 11 caracteres).</p>
              <form onSubmit={handlePseudonymSubmit}>
                <input
                  type="text"
                  name="pseudonym"
                  maxLength={11}
                  required
                  className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white p-3"
                  placeholder="Seu nome de jogador"
                  autoFocus
                />
                <div className="flex gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowPseudonymModal(false)}
                    className="w-full flex justify-center py-3 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {view === 'home' ? (
            <div className="text-center animate-fade-in pt-12 sm:pt-8">
                 <h1 className="text-6xl font-bebas tracking-wider text-purple-400">EMOJI MELLEE</h1>
                 <p className="text-gray-400 mt-2">Um jogo de cartas híbrido criado por CAP Systems Jogos Híbridos</p>

                 <div className="mt-12 flex flex-col items-center gap-4 max-w-sm mx-auto">
                    {menuItems.map(item => (
                        <HomeMenuButton
                            key={item.view}
                            onClick={() => handleViewChange(item.view)}
                            icon={item.icon}
                            label={item.label}
                        />
                    ))}
                 </div>
            </div>
        ) : (
            <div>
                 <header className="flex items-center gap-4 mb-8">
                    <button 
                        onClick={() => setView('home')} 
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                        aria-label="Voltar ao Menu"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">Menu</span>
                    </button>
                    <h1 className="text-3xl font-bebas tracking-wider text-purple-400">{viewTitles[view]}</h1>
                 </header>
                {renderView()}
            </div>
        )}
      </div>
    </div>
  );
};

export default App;
