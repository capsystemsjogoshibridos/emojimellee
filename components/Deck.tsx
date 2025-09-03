
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import type { CardData } from '../types';
import { EnergyIcon, TrashIcon } from './Icons';
import CardPreview from './CardPreview';


interface DeckProps {
  deckCards: CardData[];
  onRemove: (cardId: string) => void;
}

const DeckCard: React.FC<{ card: CardData; onRemove: (cardId: string) => void; }> = ({ card, onRemove }) => {
  const isDefeated = card.currentEnergy !== undefined && card.currentEnergy <= 0;
  return (
    <div className="relative group animate-fade-in">
      <div className={`aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-all duration-300 ${isDefeated ? 'grayscale' : ''}`}>
        {card.image ? (
          <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-700 flex items-center justify-center p-2">
            <span className="text-gray-500 text-center text-sm">{card.name}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        <div className="absolute bottom-2 left-2 right-2 text-white">
           <p className="font-bebas text-lg tracking-wider truncate drop-shadow-lg">{card.name}</p>
        </div>
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm p-1 rounded-md">
            <EnergyIcon className="w-4 h-4 text-blue-400"/>
            <span className="font-bebas text-lg text-white">{card.currentEnergy ?? card.energy}</span>
        </div>
      </div>
      <button 
        onClick={() => onRemove(card.id)}
        className="absolute -top-2 -right-2 bg-red-600 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform hover:scale-110"
        aria-label={`Remover ${card.name} do Deck`}
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

const Deck: React.FC<DeckProps> = ({ deckCards, onRemove }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleGeneratePdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
        const { jsPDF } = (window as any).jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const cardsPerPage = 9; // 3x3 grid
        const totalPages = Math.ceil(deckCards.length / cardsPerPage);

        const SCALE_FACTOR = 0.8; 
        const BASE_CARD_WIDTH = 300;
        const BASE_CARD_HEIGHT = 420;

        for (let i = 0; i < totalPages; i++) {
            const pageCards = deckCards.slice(i * cardsPerPage, (i + 1) * cardsPerPage);

            const container = document.createElement('div');
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
                        <div key={card.id} style={{ width: `${cardWidth}px`, height: `${cardHeight}px` }}>
                            <div style={{ transform: `scale(${SCALE_FACTOR})`, transformOrigin: 'top left' }}>
                                <CardPreview 
                                    cardData={card} 
                                    className="!w-[300px] !h-[420px] !scale-100 !shadow-none !animate-none"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            );
            
            const root = ReactDOM.createRoot(container);
            root.render(pageContent);
            
            await new Promise(r => setTimeout(r, 2000));

            const canvas = await (window as any).html2canvas(container, {
                useCORS: true,
                scale: 1.5, 
                backgroundColor: '#111827',
            });
            
            root.unmount();
            document.body.removeChild(container);
            
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const pageMargin = 10;

            const canvasAspectRatio = canvas.width / canvas.height;
            
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

        pdf.save('deck-de-cartas-web.pdf');
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Ocorreu um erro ao gerar o PDF.");
    } finally {
        setIsGeneratingPdf(false);
    }
};

  if (deckCards.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <h2 className="text-3xl font-bebas text-purple-300">Seu Deck está vazio</h2>
        <p className="text-gray-400 mt-2">Vá para 'Álbum' e adicione cartas ao seu deck para começar!</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-center items-center gap-8 mb-8">
        <h2 className="text-3xl font-bebas text-purple-300 text-center tracking-wider">Meu Deck ({deckCards.length}/50)</h2>
        <button
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-500 disabled:cursor-wait"
        >
            {isGeneratingPdf ? 'Gerando PDF...' : 'Gerar PDF'}
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
        {deckCards.map((card) => (
          <DeckCard key={card.id} card={card} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
};

export default Deck;