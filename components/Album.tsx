import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { CardData } from '../types';
import CardPreview from './CardPreview';
import { PencilIcon, TrashIcon, DeckIcon, ArrowLeftIcon, ArrowRightIcon, PowerIcon, EnergyIcon, AbilityIcon } from './Icons';

interface AlbumProps {
  cards: CardData[];
  onEdit: (card: CardData) => void;
  onDelete: (cardId: string) => void;
  onAddToDeck: (cardId: string) => void;
  onRemoveFromDeck: (cardId: string) => void;
  deck: string[];
}

const Album: React.FC<AlbumProps> = ({ cards, onEdit, onDelete, onAddToDeck, onRemoveFromDeck, deck }) => {
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const selectedIndex = selectedCard ? cards.findIndex(c => c.id === selectedCard.id) : -1;

  useEffect(() => {
    if (selectedCard) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup function to ensure scroll is restored on component unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedCard]);

  const handlePrevCard = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex > -1) {
        const prevIndex = (selectedIndex - 1 + cards.length) % cards.length;
        setSelectedCard(cards[prevIndex]);
    }
  };

  const handleNextCard = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedIndex > -1) {
          const nextIndex = (selectedIndex + 1) % cards.length;
          setSelectedCard(cards[nextIndex]);
      }
  };


  const handleDelete = () => {
    if (selectedCard && window.confirm(`Tem certeza que deseja excluir a carta "${selectedCard.name}"?`)) {
      onDelete(selectedCard.id);
      setSelectedCard(null);
    }
  };
  
  const handleEdit = () => {
    if (selectedCard) {
      onEdit(selectedCard);
      setSelectedCard(null);
    }
  };

  const handleGeneratePdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
        const { jsPDF } = (window as any).jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const cardsPerPage = 9; // 3x3 grid
        const totalPages = Math.ceil(cards.length / cardsPerPage);

        const SCALE_FACTOR = 0.8; // Reduce card size to 80% as requested
        const BASE_CARD_WIDTH = 300;
        const BASE_CARD_HEIGHT = 420;

        for (let i = 0; i < totalPages; i++) {
            const pageCards = cards.slice(i * cardsPerPage, (i + 1) * cardsPerPage);

            const container = document.createElement('div');
            // Dynamically calculate container dimensions based on scaled cards to prevent cut-offs
            const cardWidth = BASE_CARD_WIDTH * SCALE_FACTOR;
            const cardHeight = BASE_CARD_HEIGHT * SCALE_FACTOR;
            const gap = 20 * SCALE_FACTOR;
            const padding = 20 * SCALE_FACTOR;

            const numCols = 3;
            const numRows = Math.ceil(pageCards.length / numCols);

            const containerWidth = (numCols * cardWidth) + ((numCols - 1) * gap) + (2 * padding);
            const containerHeight = (numRows * cardHeight) + ((numRows - 1) * gap) + (2 * padding);

            container.style.width = `${containerWidth}px`;
            container.style.height = `${containerHeight}px`;
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.background = '#111827';
            container.style.padding = `${padding}px`;
            document.body.appendChild(container);

            const pageContent = (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: `${gap}px`,
                }}>
                    {pageCards.map(card => (
                        // This outer div acts as the grid cell and defines the space for the scaled card
                        <div key={card.id} style={{ width: `${cardWidth}px`, height: `${cardHeight}px` }}>
                            {/* This inner div scales the full-sized CardPreview component down */}
                            <div style={{ transform: `scale(${SCALE_FACTOR})`, transformOrigin: 'top left' }}>
                                <CardPreview 
                                    cardData={card} 
                                    // Override interactive/animated classes for static PDF rendering
                                    // AND force the base size to prevent responsive scaling issues.
                                    className="!w-[300px] !h-[420px] !scale-100 !shadow-none !animate-none"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            );
            
            const root = ReactDOM.createRoot(container);
            root.render(pageContent);
            
            // Wait for images to render
            await new Promise(r => setTimeout(r, 2000));

            const canvas = await (window as any).html2canvas(container, {
                useCORS: true,
                scale: 1.5, // Render at 1.5x resolution for clarity before compressing
                backgroundColor: '#111827',
            });
            
            root.unmount();
            document.body.removeChild(container);
            
            // Use JPEG with high compression for small file size
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const pageMargin = 10; // 10mm margin on all sides

            const canvasAspectRatio = canvas.width / canvas.height;
            
            // Calculate image dimensions to fit within page margins
            let imgWidthPdf = pdfWidth - (pageMargin * 2);
            let imgHeightPdf = imgWidthPdf / canvasAspectRatio;

            if (imgHeightPdf > pdfHeight - (pageMargin * 2)) {
                imgHeightPdf = pdfHeight - (pageMargin * 2);
                imgWidthPdf = imgHeightPdf * canvasAspectRatio;
            }

            const x = (pdfWidth - imgWidthPdf) / 2;
            const y = (pdfHeight - imgHeightPdf) / 2;

            if (i > 0) {
                pdf.addPage();
            }
            
            pdf.addImage(imgData, 'JPEG', x, y, imgWidthPdf, imgHeightPdf);
        }

        pdf.save('album-de-cartas-web.pdf');
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Ocorreu um erro ao gerar o PDF.");
    } finally {
        setIsGeneratingPdf(false);
    }
};

  if (cards.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-3xl font-bebas text-purple-300">Seu Álbum está vazio</h2>
        <p className="text-gray-400 mt-2">Vá para a aba 'Criador' para criar e salvar sua primeira carta!</p>
      </div>
    );
  }
  
  return (
    <React.Fragment>
      <div className="animate-fade-in">
        <div className="flex justify-center items-center gap-8 mb-8">
          <h2 className="text-3xl font-bebas text-purple-300 text-center tracking-wider">Álbum de Cartas</h2>
          <button
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-500 disabled:cursor-wait"
          >
              {isGeneratingPdf ? 'Gerando PDF...' : 'Gerar PDF'}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-8">
          {cards.map((card) => {
            const isInDeck = deck.includes(card.id);
            return (
              <div key={card.id} className="group flex flex-col justify-between">
                  <div>
                      <div className="cursor-pointer" onClick={() => setSelectedCard(card)}>
                          <div className="aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-purple-500/50 shadow-lg">
                              {card.image ? (
                              <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
                              ) : (
                              <div className="w-full h-full bg-gray-700 flex items-center justify-center p-2">
                                  <span className="text-gray-500 text-center text-sm">{card.name}</span>
                              </div>
                              )}
                          </div>
                          <p className="text-center mt-2 text-sm text-gray-300 truncate group-hover:text-white font-bold">{card.name}</p>
                      </div>
                       <div className="mt-2 px-1 space-y-1 text-xs text-gray-400">
                          <div className="flex items-center gap-1.5">
                              <PowerIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
                              <span className="font-semibold">{card.power} Poder</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                              <EnergyIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                              <span className="font-semibold">{card.energy} Energia</span>
                          </div>
                          <div className="flex items-start gap-1.5">
                              <AbilityIcon className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                              <p className="italic leading-tight line-clamp-2">{card.ability}</p>
                          </div>
                      </div>
                  </div>
                <div className="mt-3 text-center">
                   <button 
                    onClick={() => isInDeck ? onRemoveFromDeck(card.id) : onAddToDeck(card.id)}
                    disabled={!isInDeck && deck.length >= 50}
                    className={`flex items-center justify-center w-full gap-2 px-2 py-1 text-white text-xs rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed ${
                        isInDeck ? 'bg-red-700 hover:bg-red-600' : 'bg-green-700 hover:bg-green-600'
                    }`}
                   >
                     <DeckIcon className="w-4 h-4"/> 
                     {isInDeck ? 'Remover' : deck.length >= 50 ? 'Cheio' : 'Adicionar'}
                   </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedCard && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 overflow-y-auto"
          onClick={() => setSelectedCard(null)}
        >
            <button 
              onClick={handlePrevCard} 
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/20 rounded-full hover:bg-white/40 transition-colors"
              aria-label="Carta anterior"
            >
              <ArrowLeftIcon className="w-6 h-6 text-white"/>
            </button>
            <button 
              onClick={handleNextCard} 
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/20 rounded-full hover:bg-white/40 transition-colors"
              aria-label="Próxima carta"
            >
              <ArrowRightIcon className="w-6 h-6 text-white"/>
            </button>
          
            <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                <CardPreview cardData={selectedCard} />
                <div className="flex flex-wrap justify-center gap-4">
                   <button onClick={handleEdit} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                     <PencilIcon className="w-5 h-5"/> Editar
                   </button>
                   {(() => {
                        const isSelectedInDeck = deck.includes(selectedCard.id);
                        return (
                           <button 
                            onClick={() => isSelectedInDeck ? onRemoveFromDeck(selectedCard.id) : onAddToDeck(selectedCard.id)}
                            disabled={!isSelectedInDeck && deck.length >= 50}
                            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed ${
                                isSelectedInDeck ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                            }`}
                           >
                             <DeckIcon className="w-5 h-5"/> 
                             {isSelectedInDeck ? 'Remover do Deck' : deck.length >= 50 ? 'Deck Cheio' : 'Adicionar ao Deck'}
                           </button>
                        );
                   })()}
                   <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                      <TrashIcon className="w-5 h-5"/> Excluir
                   </button>
                </div>
            </div>
        </div>
      )}
    </React.Fragment>
  );
};

export default Album;
