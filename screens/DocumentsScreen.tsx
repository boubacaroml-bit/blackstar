import React, { useState, useRef, useEffect } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, FileText, ChevronRight, ArrowLeft, Image as ImageIcon, X, PenTool, Package, Edit2, Copy, Check } from 'lucide-react';
import { Qcm, QcmDifficulty } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const IMG_PREFIX = ":::IMG:";
const IMG_SUFFIX = ":::";

// --- RICH INPUT COMPONENT ---
// Moved outside component to prevent re-creation and focus loss on render
const RichInput = ({ 
    value, 
    onChange, 
    placeholder,
    minHeight = "h-24",
    addImageTitle
}: { 
    value: string, 
    onChange: (val: string) => void, 
    placeholder: string,
    minHeight?: string,
    addImageTitle: string
}) => {
    let textPart = value;
    let imgPart = "";
    if (value.startsWith(IMG_PREFIX)) {
        const endIdx = value.indexOf(IMG_SUFFIX, IMG_PREFIX.length);
        if (endIdx > -1) {
            imgPart = value.substring(IMG_PREFIX.length, endIdx);
            textPart = value.substring(endIdx + IMG_SUFFIX.length);
        }
    }

    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            const newVal = `${IMG_PREFIX}${base64}${IMG_SUFFIX}${textPart}`;
            onChange(newVal);
        };
        reader.readAsDataURL(file);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                if (blob) handleFile(blob);
                e.preventDefault(); 
                return;
            }
        }
    };

    const removeImage = () => {
        onChange(textPart);
    };

    return (
        <div className="w-full border border-gray-200 rounded-xl bg-gray-50 focus-within:ring-2 focus-within:ring-indigo-500 transition-shadow p-2 flex gap-3 items-start relative">
            {imgPart && (
                <div className="relative shrink-0 group">
                    <img src={imgPart} className="h-20 w-20 rounded-lg object-cover border border-gray-200 bg-white" alt="Input" />
                    <button 
                      onClick={removeImage} 
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors z-10"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
            <div className="flex-1 h-full relative">
                <textarea
                    className={`w-full bg-transparent outline-none text-sm resize-none ${minHeight}`}
                    placeholder={placeholder}
                    value={textPart}
                    onChange={(e) => {
                        const newText = e.target.value;
                        onChange(imgPart ? `${IMG_PREFIX}${imgPart}${IMG_SUFFIX}${newText}` : newText);
                    }}
                    onPaste={handlePaste}
                />
                 {!imgPart && (
                    <div className="absolute bottom-0 right-0">
                        <button 
                           onClick={() => fileRef.current?.click()}
                           className="text-gray-400 hover:text-indigo-600 p-2 bg-white/50 rounded-full"
                           title={addImageTitle}
                        >
                           <ImageIcon size={18} />
                        </button>
                        <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
                    </div>
                )}
            </div>
        </div>
    );
};

const DocumentsScreen: React.FC = () => {
  const { t } = useLanguage();
  const documents = useLiveQuery(() => db.documents.toArray());
  const allQcms = useLiveQuery(() => db.qcm.toArray());
  
  const [view, setView] = useState<'menu' | 'manual' | 'import' | 'list'>('menu');
  const [targetDeckId, setTargetDeckId] = useState<number | null>(null);

  // Manual & Edit Mode State
  const [editingQcmId, setEditingQcmId] = useState<number | null>(null);
  const [manualQcm, setManualQcm] = useState<Partial<Qcm>>({
    question: '',
    options: ['', ''],
    correctIndex: 0,
    difficulty: QcmDifficulty.MEDIUM,
  });
  
  // Import Mode State
  const [importContent, setImportContent] = useState('');
  const [qSep, setQSep] = useState('.');
  const [aSep, setASep] = useState(' ');
  const [copied, setCopied] = useState(false);

  // Management List State
  const [selectedDeckForEdit, setSelectedDeckForEdit] = useState<number | null>(null);

  useEffect(() => {
    if (documents && documents.length > 0 && !targetDeckId) {
      setTargetDeckId(documents[0].id!);
    }
  }, [documents, targetDeckId]);

  // --- ACTIONS ---

  const saveManualQcm = async () => {
    if (!targetDeckId) {
        alert(t.create.selectDeck);
        return;
    }
    if (!manualQcm.question || !manualQcm.options || manualQcm.options.length < 2) {
      alert("Question + 2 answers min.");
      return;
    }

    const cardData = {
      documentId: targetDeckId,
      question: manualQcm.question,
      options: manualQcm.options,
      correctIndex: manualQcm.correctIndex || 0,
      difficulty: manualQcm.difficulty || QcmDifficulty.MEDIUM,
      // Only set these if new
      ...(editingQcmId ? {} : {
          easeFactor: 2.5,
          interval: 0,
          repetition: 0,
          nextReviewDate: Date.now(),
          lastReviewed: null
      })
    };

    if (editingQcmId) {
        await db.qcm.update(editingQcmId, cardData);
        alert(t.create.cardUpdated);
        setEditingQcmId(null);
        setView('list'); // Return to list after edit
    } else {
        await db.qcm.add(cardData as Qcm);
        alert(t.create.cardAdded);
        setManualQcm({
          question: '',
          options: ['', ''],
          correctIndex: 0,
          difficulty: QcmDifficulty.MEDIUM,
        });
    }
  };

  const parseAndImport = async () => {
    if (!targetDeckId) {
        alert(t.create.selectDeck);
        return;
    }
    if (!importContent.trim()) return;

    const lines = importContent.split('\n').filter(l => l.trim().length > 0);
    const qcmsToAdd: any[] = [];

    lines.forEach(line => {
      const sepIndex = line.indexOf(qSep);
      if (sepIndex === -1) return;
      const qText = line.substring(0, sepIndex).trim();
      const aText = line.substring(sepIndex + 1).trim();
      const rawOptions = aText.split(aSep).filter(s => s.trim().length > 0);

      if (rawOptions.length >= 2) {
        let correctIdx = 0;
        const cleanOptions = rawOptions.map((opt, idx) => {
          if (opt.includes('*')) {
            correctIdx = idx;
            return opt.replace('*', '').trim();
          }
          return opt.trim();
        });

        qcmsToAdd.push({
          documentId: targetDeckId,
          question: qText,
          options: cleanOptions,
          correctIndex: correctIdx,
          difficulty: QcmDifficulty.MEDIUM,
          easeFactor: 2.5,
          interval: 0,
          repetition: 0,
          nextReviewDate: Date.now(),
          lastReviewed: null
        });
      }
    });

    if (qcmsToAdd.length > 0) {
      await db.qcm.bulkAdd(qcmsToAdd);
      alert(`${qcmsToAdd.length} ${t.create.importSuccess}`);
      setImportContent('');
      setView('list');
    } else {
      alert("Error parsing.");
    }
  };

  const copyPromptToClipboard = () => {
      navigator.clipboard.writeText(t.create.promptContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleEditClick = (q: Qcm) => {
      setEditingQcmId(q.id!);
      setManualQcm({
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          difficulty: q.difficulty
      });
      setTargetDeckId(q.documentId);
      setView('manual');
  };

  const handleDeleteCard = async (id: number) => {
      if (confirm('Delete this card?')) {
          await db.qcm.delete(id);
      }
  };

  const handleDeleteDoc = async (id: number) => {
    if(confirm(t.create.deleteConfirm)) {
      await (db as any).transaction('rw', db.documents, db.qcm, async () => {
        await db.documents.delete(id);
        await db.qcm.where({ documentId: id }).delete();
      });
      if (targetDeckId === id) setTargetDeckId(null);
      if (selectedDeckForEdit === id) setSelectedDeckForEdit(null);
    }
  };

  const DeckSelector = () => (
      <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm mb-4">
        <label className="block text-xs font-bold text-indigo-600 uppercase mb-1 flex items-center gap-1">
            <Package size={12} /> {t.create.targetDeck}
        </label>
        {documents && documents.length > 0 ? (
            <select 
                value={targetDeckId || ''} 
                onChange={e => setTargetDeckId(Number(e.target.value))}
                className="w-full bg-indigo-50 border-indigo-100 rounded-lg p-2 text-sm text-indigo-900 font-medium outline-none focus:ring-2 focus:ring-indigo-200"
            >
                {documents.map(d => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                ))}
            </select>
        ) : (
            <div className="text-sm text-red-500 flex items-center gap-2">
                {t.home.noDecks}
            </div>
        )}
      </div>
  );

  // --- VIEWS ---

  if (view === 'menu') {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
        <h2 className="text-2xl font-bold text-gray-800">{t.create.title}</h2>
        
        <div className="grid grid-cols-1 gap-4">
          <button 
            onClick={() => { setEditingQcmId(null); setView('manual'); }}
            disabled={!documents?.length}
            className="group relative bg-white p-6 rounded-2xl shadow-sm border-2 border-transparent hover:border-indigo-100 hover:shadow-md transition-all text-left disabled:opacity-50"
          >
            <div className="bg-indigo-100 w-12 h-12 rounded-xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
              <PenTool size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">{t.create.manual}</h3>
            <p className="text-sm text-gray-500 mt-1">{t.create.manualDesc}</p>
          </button>

          <button 
             onClick={() => setView('import')}
             disabled={!documents?.length}
             className="group relative bg-white p-6 rounded-2xl shadow-sm border-2 border-transparent hover:border-purple-100 hover:shadow-md transition-all text-left disabled:opacity-50"
          >
            <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">{t.create.import}</h3>
            <p className="text-sm text-gray-500 mt-1">{t.create.importDesc}</p>
          </button>

          <button 
            onClick={() => setView('list')}
            disabled={!documents?.length}
            className="group relative bg-white p-6 rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-100 hover:shadow-md transition-all text-left disabled:opacity-50"
          >
             <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
               <Edit2 size={24} />
             </div>
             <h3 className="text-lg font-bold text-gray-800">{t.create.manage}</h3>
             <p className="text-sm text-gray-500 mt-1">{t.create.manageDesc}</p>
          </button>
        </div>
      </div>
    );
  }

  if (view === 'manual') {
    return (
      <div className="animate-in slide-in-from-right duration-300 pb-20">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setView(editingQcmId ? 'list' : 'menu')} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">{editingQcmId ? t.create.editCard : t.create.newCard}</h2>
        </div>

        <DeckSelector />

        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">{t.create.question}</label>
            <RichInput 
                value={manualQcm.question || ''}
                onChange={(val) => setManualQcm({...manualQcm, question: val})}
                placeholder={t.create.writeQ}
                addImageTitle={t.create.addImage}
            />
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
             <div className="flex justify-between items-center mb-3">
                <label className="block text-xs font-bold text-gray-500 uppercase">{t.create.answers}</label>
                <button 
                  onClick={() => setManualQcm({
                    ...manualQcm, 
                    options: [...(manualQcm.options || []), '']
                  })}
                  className="text-xs flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded font-bold"
                >
                  <Plus size={14} /> {t.create.addAnswer}
                </button>
             </div>

             <div className="space-y-3">
               {manualQcm.options?.map((opt, idx) => (
                 <div key={idx} className="flex gap-2 items-start animate-in fade-in slide-in-from-bottom-1">
                   <input 
                      type="radio" 
                      name="correctIndex" 
                      checked={manualQcm.correctIndex === idx}
                      onChange={() => setManualQcm({...manualQcm, correctIndex: idx})}
                      className="mt-3 w-4 h-4 text-indigo-600 shrink-0"
                   />
                   <div className="flex-1">
                      <RichInput 
                        value={opt}
                        onChange={(val) => {
                            const newOpts = [...manualQcm.options!];
                            newOpts[idx] = val;
                            setManualQcm({...manualQcm, options: newOpts});
                        }}
                        placeholder={`${t.create.answerPlace} ${idx + 1}`}
                        minHeight="h-14"
                        addImageTitle={t.create.addImage}
                      />
                   </div>
                   
                   {manualQcm.options!.length > 2 && (
                      <button 
                        onClick={() => {
                           const newOpts = manualQcm.options!.filter((_, i) => i !== idx);
                           setManualQcm({...manualQcm, options: newOpts, correctIndex: 0});
                        }}
                        className="mt-2 text-gray-300 hover:text-red-500"
                      >
                         <Trash2 size={16} />
                      </button>
                   )}
                 </div>
               ))}
             </div>
          </div>

          <button onClick={saveManualQcm} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors">
            {editingQcmId ? t.create.saveChanges : t.create.addDeckBtn}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'import') {
      return (
        <div className="animate-in slide-in-from-right duration-300 pb-20">
            <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setView('menu')} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-xl font-bold">{t.create.importTitle}</h2>
            </div>

            <DeckSelector />

            <div className="space-y-4">
                {/* AI Tutoriel Helper */}
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-3">
                   <h3 className="font-bold text-indigo-800 flex items-center gap-2">
                       <FileText size={16} /> {t.create.tutoTitle}
                   </h3>
                   <div className="text-xs text-indigo-700 space-y-1">
                       <p>{t.create.tutoStep1}</p>
                       <p>{t.create.tutoStep2}</p>
                       <p>{t.create.tutoStep3}</p>
                   </div>
                   <button 
                      onClick={copyPromptToClipboard}
                      className="w-full bg-white border border-indigo-200 text-indigo-600 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
                   >
                       {copied ? <Check size={14} /> : <Copy size={14} />}
                       {copied ? 'Copied!' : t.create.copyPrompt}
                   </button>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-600 mb-2">{t.create.configSep}</h3>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] uppercase text-gray-400 font-bold">{t.create.sepQR}</label>
                            <input 
                                type="text" 
                                className="w-full border-b-2 border-indigo-100 bg-transparent py-1 text-center font-mono font-bold focus:border-indigo-500 outline-none"
                                value={qSep}
                                onChange={e => setQSep(e.target.value)}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] uppercase text-gray-400 font-bold">{t.create.sepAns}</label>
                            <input 
                                type="text" 
                                className="w-full border-b-2 border-indigo-100 bg-transparent py-1 text-center font-mono font-bold focus:border-indigo-500 outline-none"
                                value={aSep}
                                onChange={e => setASep(e.target.value)}
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                        {t.create.formatInfo} <br/> {t.create.starInfo}
                    </p>
                </div>

                <textarea 
                    className="w-full h-48 border rounded-xl p-4 font-mono text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    placeholder="Question. Answer1 Answer2 *CorrectAnswer3"
                    value={importContent}
                    onChange={e => setImportContent(e.target.value)}
                />
                
                <button 
                    onClick={parseAndImport}
                    disabled={!importContent.trim()}
                    className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-purple-700 disabled:opacity-50"
                >
                    {t.create.btnImport}
                </button>
            </div>
        </div>
      );
  }

  if (view === 'list') {
      return (
        <div className="animate-in slide-in-from-right duration-300 pb-20">
            <div className="flex items-center gap-2 mb-4">
                <button onClick={() => selectedDeckForEdit ? setSelectedDeckForEdit(null) : setView('menu')} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-xl font-bold">{selectedDeckForEdit ? t.create.manage : t.create.myDecks}</h2>
            </div>
            
            {!selectedDeckForEdit ? (
                // Deck List
                <div className="grid gap-3">
                    {documents?.map(doc => (
                    <button 
                        key={doc.id} 
                        onClick={() => setSelectedDeckForEdit(doc.id!)}
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center w-full hover:bg-gray-50"
                    >
                        <div>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Package size={16} className="text-indigo-500" />
                            {doc.title}
                        </h3>
                        <p className="text-xs text-gray-400">{allQcms?.filter(q => q.documentId === doc.id).length} cards</p>
                        </div>
                        <div className="flex gap-2">
                            <div 
                                onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id!); }}
                                className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                            >
                                <Trash2 size={18} />
                            </div>
                            <ChevronRight className="text-gray-300" />
                        </div>
                    </button>
                    ))}
                </div>
            ) : (
                // Card List for Selected Deck
                <div className="space-y-3">
                     {allQcms?.filter(q => q.documentId === selectedDeckForEdit).map(q => {
                         const qText = q.question.startsWith(IMG_PREFIX) ? '(Image Card)' : q.question.substring(0, 50) + '...';
                         return (
                            <div key={q.id} className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                                <p className="text-sm font-medium text-gray-700 truncate flex-1 pr-4">{qText}</p>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => handleEditClick(q)}
                                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteCard(q.id!)}
                                        className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                         );
                     })}
                     {allQcms?.filter(q => q.documentId === selectedDeckForEdit).length === 0 && (
                         <p className="text-center text-gray-400 mt-10">No cards in this deck.</p>
                     )}
                </div>
            )}
        </div>
      );
  }

  return null; // Should not reach
};

export default DocumentsScreen;