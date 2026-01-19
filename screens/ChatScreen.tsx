import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Send, Bot, User } from 'lucide-react';
import { chatWithDocuments } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

const ChatScreen: React.FC = () => {
  const { t } = useLanguage();
  const documents = useLiveQuery(() => db.documents.toArray());
  const history = useLiveQuery(() => db.chatHistory.toArray());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleSend = async () => {
    if (!input.trim() || !documents) return;
    
    const userMsg = input;
    setInput('');
    setIsLoading(true);

    await db.chatHistory.add({
      role: 'user',
      content: userMsg,
      timestamp: Date.now()
    });

    try {
      const currentHistory = await db.chatHistory.toArray();
      const mappedHistory = currentHistory.map(h => ({ role: h.role, content: h.content }));
      
      const response = await chatWithDocuments(userMsg, mappedHistory, documents);

      await db.chatHistory.add({
        role: 'model',
        content: response,
        timestamp: Date.now()
      });
    } catch (e) {
      await db.chatHistory.add({
        role: 'model',
        content: t.chat.error,
        timestamp: Date.now()
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex-1 overflow-y-auto space-y-4 px-2">
        {history?.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <Bot size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm">{t.chat.empty}</p>
          </div>
        )}
        
        {history?.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-green-100 text-green-600'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`p-3 rounded-2xl max-w-[80%] text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
           </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-full flex items-center px-2 py-2 shadow-sm">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t.chat.placeholder}
          className="flex-1 bg-transparent px-4 py-2 outline-none text-sm"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
        >
          <Send size={18} className="ml-0.5" />
        </button>
      </div>
    </div>
  );
};

export default ChatScreen;