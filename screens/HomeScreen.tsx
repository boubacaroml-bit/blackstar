import React, { useEffect, useState } from 'react';
import { db, initUser } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { getCardsDue } from '../services/srsService';
import { Package, Brain, ChevronRight, Play, AlertCircle, X, LifeBuoy, PlusCircle, FolderPlus, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Document, Qcm } from '../types';

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const user = useLiveQuery(() => db.users.orderBy('id').first());
  const documents = useLiveQuery(() => db.documents.toArray());
  const allQcms = useLiveQuery(() => db.qcm.toArray());
  
  const [deckStats, setDeckStats] = useState<Record<number, { total: number, due: number, mastery: number }>>({});
  const [selectedDeck, setSelectedDeck] = useState<Document | null>(null);
  
  // Deck Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (allQcms && documents) {
      const stats: Record<number, { total: number, due: number, mastery: number }> = {};
      
      documents.forEach(doc => {
        const docCards = allQcms.filter(q => q.documentId === doc.id);
        const dueCards = getCardsDue(docCards);
        
        const avgEf = docCards.length > 0 
            ? docCards.reduce((acc, q) => acc + q.easeFactor, 0) / docCards.length 
            : 0;
        const mastery = avgEf > 0 ? Math.min(100, Math.round(((avgEf - 1.3) / 1.7) * 100)) : 0;

        stats[doc.id!] = {
          total: docCards.length,
          due: dueCards.length,
          mastery
        };
      });
      setDeckStats(stats);
    }
  }, [allQcms, documents]);

  const handleStartRevision = (mode: 'normal' | 'rescue') => {
    if (!selectedDeck || !selectedDeck.id) return;
    navigate('/revise', { state: { deckId: selectedDeck.id, mode: mode } });
    setSelectedDeck(null);
  };

  const handleCreateDeck = async () => {
    if (!newDeckTitle.trim()) return;
    try {
        await db.documents.add({
            title: newDeckTitle,
            content: "Deck",
            createdAt: new Date().toISOString()
        });
        setNewDeckTitle('');
        setShowCreateModal(false);
        // Optional: Trigger a refresh if needed, but useLiveQuery handles it
    } catch (e) {
        alert("Erreur");
    }
  };

  if (!user) return <div className="p-4">{t.revise.loading}</div>;

  const totalDue = Object.values(deckStats).reduce((acc, curr) => acc + curr.due, 0);

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="bg-indigo-600 -mx-4 -mt-4 p-6 pt-2 pb-8 rounded-b-3xl text-white shadow-lg">
        <p className="text-indigo-100 text-sm">{t.home.welcome}</p>
        <h2 className="text-2xl font-bold">{user.name}</h2>
        
        <div className="mt-6 flex justify-between items-center bg-white/10 p-4 rounded-xl backdrop-blur-sm">
          <div>
            <p className="text-xs text-indigo-200 uppercase font-semibold">{t.home.ready}</p>
            <p className="text-3xl font-bold mt-1">{totalDue}</p>
          </div>
          <div className="text-right">
             <p className="text-xs text-indigo-200 uppercase font-semibold">{t.home.totalCards}</p>
             <p className="text-xl font-bold mt-1">{allQcms?.length || 0}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Package size={20} className="text-indigo-600" /> {t.home.decks}
            </h3>
            <button 
                onClick={() => setShowCreateModal(true)}
                className="text-indigo-600 hover:text-indigo-800 transition-colors"
            >
                <PlusCircle size={24} fill="#EEF2FF" />
            </button>
        </div>

        <div className="space-y-3">
          {documents?.length === 0 && (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">
               <p className="text-gray-400 text-sm mb-4">{t.home.noDecks}</p>
               <button 
                 onClick={() => setShowCreateModal(true)}
                 className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold"
               >
                 {t.create.newDeck}
               </button>
            </div>
          )}

          {documents?.map(doc => {
            const stats = deckStats[doc.id!] || { total: 0, due: 0, mastery: 0 };
            return (
              <button
                key={doc.id}
                onClick={() => setSelectedDeck(doc)}
                className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-indigo-300 transition-all flex justify-between items-center group"
              >
                <div className="text-left">
                  <h4 className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{doc.title}</h4>
                  <div className="flex gap-3 text-xs mt-1">
                    <span className="text-gray-500">{stats.total} cards</span>
                    {stats.due > 0 ? (
                        <span className="text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded-full">{stats.due} due</span>
                    ) : (
                        <span className="text-green-500 font-medium bg-green-50 px-1.5 py-0.5 rounded-full">Done</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-indigo-400" size={20} />
              </button>
            );
          })}
        </div>
      </div>

      {/* CREATE DECK MODAL */}
      {showCreateModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-md">
             <div className="bg-white w-full max-w-xs rounded-2xl shadow-2xl animate-in zoom-in-95 overflow-hidden">
                <div className="bg-indigo-600 p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <FolderPlus size={20} /> {t.create.newDeck}
                    </h3>
                    <button onClick={() => setShowCreateModal(false)} className="text-white/80 hover:text-white"><X size={20} /></button>
                </div>
                <div className="p-6">
                    <input 
                        type="text"
                        placeholder={t.create.placeholderDeck}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 mb-4 transition-all"
                        value={newDeckTitle}
                        onChange={e => setNewDeckTitle(e.target.value)}
                        autoFocus
                    />
                    <button 
                        onClick={handleCreateDeck}
                        disabled={!newDeckTitle.trim()}
                        className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                    >
                        {t.create.addDeckBtn}
                    </button>
                </div>
             </div>
          </div>
      )}

      {/* DECK DETAILS MODAL */}
      {selectedDeck && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden">
              <div className="bg-indigo-600 p-6 flex justify-between items-start">
                 <div>
                    <h3 className="font-bold text-2xl text-white">{selectedDeck.title}</h3>
                    <p className="text-xs text-indigo-200 mt-1 opacity-80">{t.create.createdOn} {new Date(selectedDeck.createdAt).toLocaleDateString()}</p>
                 </div>
                 <button onClick={() => setSelectedDeck(null)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors">
                    <X size={24} />
                 </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-indigo-50 p-3 rounded-xl text-center">
                        <p className="text-xs text-indigo-400 font-bold uppercase">{t.home.cardsDue}</p>
                        <p className="text-2xl font-bold text-indigo-700">
                            {deckStats[selectedDeck.id!]?.due || 0}
                        </p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl text-center">
                        <p className="text-xs text-gray-400 font-bold uppercase">{t.home.totalDeckCards}</p>
                        <p className="text-2xl font-bold text-gray-700">
                            {deckStats[selectedDeck.id!]?.total || 0}
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => handleStartRevision('normal')}
                        disabled={!deckStats[selectedDeck.id!]?.due}
                        className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                    >
                        <Play size={20} fill="currentColor" /> {t.home.btnRevise}
                        {deckStats[selectedDeck.id!]?.due > 0 && (
                            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
                                {deckStats[selectedDeck.id!]?.due}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => handleStartRevision('rescue')}
                        disabled={!deckStats[selectedDeck.id!]?.total}
                        className="w-full bg-orange-50 text-orange-600 border border-orange-200 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors disabled:opacity-50"
                    >
                        <LifeBuoy size={20} /> {t.home.btnRescue}
                    </button>
                    
                    <div className="bg-blue-50 p-3 rounded-lg flex gap-2 text-xs text-blue-700 leading-tight">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <p>{t.home.rescueInfo}</p>
                    </div>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default HomeScreen;