import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Qcm, SRSSettings } from '../types';
import { calculateNextReview, getCardsDue, formatInterval } from '../services/srsService';
import { Check, X, Clock, HelpCircle, Image as ImageIcon, LifeBuoy, ArrowRight, Maximize2, ZoomIn } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const IMG_PREFIX = ":::IMG:";
const IMG_SUFFIX = ":::";

const RevisionScreen: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useLiveQuery(() => db.users.orderBy('id').first());
  
  // Extract params
  const deckId = location.state?.deckId as number | undefined;
  const mode = (location.state?.mode || 'normal') as 'normal' | 'rescue';

  const allQcms = useLiveQuery(() => db.qcm.toArray());
  const [sessionQueue, setSessionQueue] = useState<Qcm[]>([]);
  const [currentCard, setCurrentCard] = useState<Qcm | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  
  // State for image zooming
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    if (allQcms) {
      let relevantCards = deckId 
        ? allQcms.filter(q => q.documentId === deckId)
        : allQcms;

      if (mode === 'normal') {
         // Filter due cards
         const due = getCardsDue(relevantCards);
         setSessionQueue(due);
         if (due.length > 0) setCurrentCard(due[0]);
      } else {
         const shuffled = [...relevantCards].sort(() => Math.random() - 0.5);
         setSessionQueue(shuffled);
         if (shuffled.length > 0) setCurrentCard(shuffled[0]);
      }
    }
  }, [allQcms, deckId, mode]);

  const handleAnswer = (index: number) => {
    setSelectedOption(index);
    setShowAnswer(true);
  };

  const handleRate = async (quality: number) => {
    if (!currentCard || !currentCard.id) return;

    if (mode === 'normal') {
        const updates = calculateNextReview(currentCard, quality, user?.srsSettings);
        await db.qcm.update(currentCard.id, updates);
        
        await db.revisionHistory.add({
          qcmId: currentCard.id,
          date: Date.now(),
          quality
        });

        if (user) {
            await db.users.update(user.id!, {
                totalReviews: user.totalReviews + 1,
                lastReviewDate: new Date().toISOString()
            })
        }
    }

    const nextQueue = sessionQueue.slice(1);
    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      correct: quality >= 3 ? prev.correct + 1 : prev.correct
    }));

    setSessionQueue(nextQueue);
    setCurrentCard(nextQueue.length > 0 ? nextQueue[0] : null);
    setShowAnswer(false);
    setSelectedOption(null);
  };

  // Helper to render mixed content
  const renderContent = (content: string, isOption = false) => {
      let imgPart = "";
      let textPart = content;

      if (content.startsWith(IMG_PREFIX)) {
          const endIdx = content.indexOf(IMG_SUFFIX, IMG_PREFIX.length);
          if (endIdx > -1) {
              imgPart = content.substring(IMG_PREFIX.length, endIdx);
              textPart = content.substring(endIdx + IMG_SUFFIX.length);
          }
      } else if (content.startsWith('data:image')) {
          // Legacy support for manual options that were only images
          imgPart = content;
          textPart = "";
      }

      return (
          <div className="flex flex-col sm:flex-row gap-4 items-start w-full">
              {imgPart && (
                  <div 
                    className="relative group cursor-zoom-in shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        setZoomedImage(imgPart);
                    }}
                  >
                      <img 
                        src={imgPart} 
                        className={`${isOption ? 'h-20 w-auto' : 'w-auto max-w-full max-h-60'} rounded-lg border border-gray-200 bg-white object-contain transition-transform hover:scale-[1.02]`} 
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-lg flex items-center justify-center">
                          <ZoomIn className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" size={24} />
                      </div>
                  </div>
              )}
              {textPart && <span className={`${isOption ? '' : 'text-lg font-bold text-gray-800'} mt-1 break-words w-full`}>{textPart}</span>}
          </div>
      );
  };

  // Get current button intervals for display
  const getIntervalLabel = (type: 'again' | 'hard' | 'good' | 'easy') => {
      if (!user || !user.srsSettings || !user.srsSettings.steps) {
          // Defaults if not loaded
           switch(type) {
               case 'again': return '< 1m';
               case 'hard': return '10m';
               case 'good': return '1d';
               case 'easy': return '4d';
           }
      }
      const steps = user.srsSettings.steps;
      if (currentCard && currentCard.repetition === 0) {
          // New Card Steps
           switch(type) {
               case 'again': return formatInterval(steps.again);
               case 'hard': return formatInterval(steps.hard);
               case 'good': return formatInterval(steps.good);
               case 'easy': return formatInterval(steps.easy);
           }
      } else if (currentCard) {
          // Review Card - simulate calculation
          let mod = (user.srsSettings.intervalModifier || 100) / 100;
          let ivl = currentCard.interval;
          let ef = currentCard.easeFactor;
          
          switch(type) {
              case 'again': return formatInterval(steps.again); // Reset
              case 'hard': return formatInterval(Math.max(steps.hard, ivl * 1.2 * 1440 * mod)); 
              case 'good': return formatInterval(ivl * ef * 1440 * mod);
              case 'easy': return formatInterval(ivl * ef * 1.3 * 1440 * mod);
          }
      }
      return '';
  };

  if (!allQcms) return <div className="p-8 text-center">{t.revise.loading}</div>;

  if (sessionQueue.length === 0 && !currentCard) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
        <div className="bg-green-100 p-4 rounded-full text-green-600">
          <Check size={48} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">{t.revise.caughtUp}</h2>
        <p className="text-gray-500">{t.revise.noCards}</p>
        
        {sessionStats.reviewed > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm border w-full mt-4">
            <h3 className="font-semibold mb-2">{t.revise.sessionSummary}</h3>
            <div className="flex justify-between text-sm">
              <span>{t.revise.reviewed}:</span>
              <span className="font-bold">{sessionStats.reviewed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t.revise.successRate}:</span>
              <span className="font-bold">
                {Math.round((sessionStats.correct / sessionStats.reviewed) * 100) || 0}%
              </span>
            </div>
            <button 
                onClick={() => navigate('/')}
                className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg font-bold"
            >
                OK
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!currentCard) return null;

  return (
    <div className="h-full flex flex-col max-h-[80vh]">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-semibold text-gray-400">
          {t.revise.remaining} {sessionQueue.length}
        </span>
        <div className="flex items-center gap-2">
            {mode === 'rescue' && (
                <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-full uppercase font-bold flex items-center gap-1">
                    <LifeBuoy size={10} /> {t.revise.rescueMode}
                </span>
            )}
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full uppercase font-bold">
            {currentCard.difficulty}
            </span>
        </div>
      </div>

      {/* Card Area */}
      <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col overflow-y-auto relative">
        {mode === 'rescue' && (
             <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                 <LifeBuoy size={100} />
             </div>
        )}

        {/* Legacy QCM Image Support (Top banner style) */}
        {currentCard.imageUrl && !currentCard.question.startsWith(IMG_PREFIX) && (
          <div 
            className="mb-4 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 z-10 cursor-zoom-in"
            onClick={() => setZoomedImage(currentCard.imageUrl || null)}
          >
            <img 
              src={currentCard.imageUrl} 
              alt="Question context" 
              className="w-full h-auto max-h-48 object-contain mx-auto" 
            />
          </div>
        )}

        <div className="mb-6 z-10 w-full">
            {renderContent(currentCard.question)}
        </div>

        <div className="space-y-3 z-10">
          {currentCard.options.map((option, idx) => {
            let btnClass = "w-full p-4 text-left rounded-xl border-2 transition-all font-medium text-sm ";
            
            if (showAnswer) {
              if (idx === currentCard.correctIndex) {
                btnClass += "border-green-500 bg-green-50 text-green-700";
              } else if (idx === selectedOption) {
                btnClass += "border-red-400 bg-red-50 text-red-700";
              } else {
                btnClass += "border-gray-100 text-gray-400 opacity-60";
              }
            } else {
              btnClass += "border-gray-100 hover:border-indigo-200 hover:bg-gray-50 text-gray-700";
            }

            return (
              <button
                key={idx}
                disabled={showAnswer}
                onClick={() => handleAnswer(idx)}
                className={btnClass}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0
                     ${showAnswer && idx === currentCard.correctIndex ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}
                  `}>
                     {String.fromCharCode(65 + idx)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {renderContent(option, true)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SRS Controls */}
      {showAnswer && (
        <div className="mt-6 animate-in slide-in-from-bottom fade-in duration-300">
            {mode === 'rescue' || selectedOption !== currentCard.correctIndex ? (
                <button
                    onClick={() => handleRate(selectedOption === currentCard.correctIndex ? 3 : 0)}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                    {t.revise.next} <ArrowRight size={20} />
                </button>
            ) : (
                <>
                <p className="text-center text-xs text-gray-400 mb-2 uppercase font-bold tracking-wide">
                    {t.revise.difficulty}
                </p>
                <div className="grid grid-cols-4 gap-2">
                    <button 
                    onClick={() => handleRate(0)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
                    >
                    <span className="font-bold text-sm">{t.revise.again}</span>
                    <span className="text-[10px] opacity-75">{getIntervalLabel('again')}</span>
                    </button>
                    <button 
                    onClick={() => handleRate(3)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-700 transition-colors"
                    >
                    <span className="font-bold text-sm">{t.revise.hard}</span>
                    <span className="text-[10px] opacity-75">{getIntervalLabel('hard')}</span>
                    </button>
                    <button 
                    onClick={() => handleRate(4)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors"
                    >
                    <span className="font-bold text-sm">{t.revise.good}</span>
                    <span className="text-[10px] opacity-75">{getIntervalLabel('good')}</span>
                    </button>
                    <button 
                    onClick={() => handleRate(5)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
                    >
                    <span className="font-bold text-sm">{t.revise.easy}</span>
                    <span className="text-[10px] opacity-75">{getIntervalLabel('easy')}</span>
                    </button>
                </div>
                </>
            )}
        </div>
      )}

      {/* Full Screen Image Modal */}
      {zoomedImage && (
        <div 
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-in fade-in duration-200 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
        >
            <button 
                className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                onClick={() => setZoomedImage(null)}
            >
                <X size={32} />
            </button>
            <img 
                src={zoomedImage} 
                alt="Zoomed view" 
                className="max-w-full max-h-[90vh] object-contain p-4"
            />
        </div>
      )}
    </div>
  );
};

export default RevisionScreen;