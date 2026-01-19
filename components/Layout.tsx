import React, { useState, useEffect } from 'react';
import { PlusSquare, CheckCircle, MessageSquare, BarChart2, Home, Settings, X, Globe, Sliders, Clock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../db';
import { SRSSettings } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { t, language, setLanguage } = useLanguage();
  const [showSettings, setShowSettings] = useState(false);
  const [srsSettings, setSrsSettings] = useState<SRSSettings>({
    initialEase: 2.5,
    intervalModifier: 100,
    maxInterval: 365,
    steps: {
        again: 1,
        hard: 10,
        good: 1440,
        easy: 5760
    }
  });

  // Load settings when modal opens
  useEffect(() => {
    if (showSettings) {
        db.users.orderBy('id').first().then(user => {
            if (user && user.srsSettings) {
                // Ensure steps exist (migration)
                const steps = user.srsSettings.steps || { again: 1, hard: 10, good: 1440, easy: 5760 };
                setSrsSettings({ ...user.srsSettings, steps });
            }
        });
    }
  }, [showSettings]);

  const saveSettings = async () => {
    const user = await db.users.orderBy('id').first();
    if (user) {
        await db.users.update(user.id!, { srsSettings });
    }
    setShowSettings(false);
  };

  const navItems = [
    { id: 'home', icon: Home, label: t.nav.home },
    { id: 'docs', icon: PlusSquare, label: t.nav.create },
    { id: 'revise', icon: CheckCircle, label: t.nav.revise },
    { id: 'chat', icon: MessageSquare, label: t.nav.chat },
    { id: 'stats', icon: BarChart2, label: t.nav.stats },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-gray-200">
      <header className="bg-indigo-600/90 backdrop-blur-md text-white p-4 sticky top-0 z-10 shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">🧠</span> SmartRecall
        </h1>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <Settings size={20} />
        </button>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {children}
      </main>

      <nav className="bg-white border-t border-gray-200 fixed bottom-0 w-full max-w-md z-20 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center mb-6 border-b pb-2">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Settings size={20} /> {t.settings.title}
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Language Section */}
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2 flex items-center gap-2">
                  <Globe size={16} /> {t.settings.language}
                </label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setLanguage('fr')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${language === 'fr' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}
                  >
                    Français
                  </button>
                  <button 
                    onClick={() => setLanguage('en')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${language === 'en' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* SRS Section */}
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                  <Sliders size={16} /> {t.settings.srsTitle}
                </label>
                
                <div className="space-y-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span>{t.settings.initialEase}</span>
                            <span className="font-bold text-indigo-600">{srsSettings.initialEase}</span>
                        </div>
                        <input 
                            type="range" min="1.3" max="3.0" step="0.1"
                            value={srsSettings.initialEase}
                            onChange={(e) => setSrsSettings({...srsSettings, initialEase: parseFloat(e.target.value)})}
                            className="w-full accent-indigo-600"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span>{t.settings.intervalMod}</span>
                            <span className="font-bold text-indigo-600">{srsSettings.intervalModifier}%</span>
                        </div>
                        <input 
                            type="range" min="50" max="200" step="10"
                            value={srsSettings.intervalModifier}
                            onChange={(e) => setSrsSettings({...srsSettings, intervalModifier: parseInt(e.target.value)})}
                            className="w-full accent-indigo-600"
                        />
                    </div>
                </div>
              </div>

              {/* Steps Section */}
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                  <Clock size={16} /> {t.settings.stepsTitle}
                </label>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-red-50 p-2 rounded-lg">
                       <label className="text-[10px] uppercase font-bold text-red-500">{t.settings.stepAgain}</label>
                       <input 
                          type="number" 
                          value={srsSettings.steps.again}
                          onChange={e => setSrsSettings({...srsSettings, steps: {...srsSettings.steps, again: parseInt(e.target.value)}})}
                          className="w-full bg-white border border-red-200 rounded p-1 text-sm mt-1"
                       />
                   </div>
                   <div className="bg-orange-50 p-2 rounded-lg">
                       <label className="text-[10px] uppercase font-bold text-orange-500">{t.settings.stepHard}</label>
                       <input 
                          type="number" 
                          value={srsSettings.steps.hard}
                          onChange={e => setSrsSettings({...srsSettings, steps: {...srsSettings.steps, hard: parseInt(e.target.value)}})}
                          className="w-full bg-white border border-orange-200 rounded p-1 text-sm mt-1"
                       />
                   </div>
                   <div className="bg-blue-50 p-2 rounded-lg">
                       <label className="text-[10px] uppercase font-bold text-blue-500">{t.settings.stepGood}</label>
                       <input 
                          type="number" 
                          value={srsSettings.steps.good / 1440} // Display as Days
                          onChange={e => setSrsSettings({...srsSettings, steps: {...srsSettings.steps, good: parseInt(e.target.value) * 1440}})}
                          className="w-full bg-white border border-blue-200 rounded p-1 text-sm mt-1"
                       />
                   </div>
                   <div className="bg-green-50 p-2 rounded-lg">
                       <label className="text-[10px] uppercase font-bold text-green-500">{t.settings.stepEasy}</label>
                       <input 
                          type="number" 
                          value={srsSettings.steps.easy / 1440} // Display as Days
                          onChange={e => setSrsSettings({...srsSettings, steps: {...srsSettings.steps, easy: parseInt(e.target.value) * 1440}})}
                          className="w-full bg-white border border-green-200 rounded p-1 text-sm mt-1"
                       />
                   </div>
                </div>
              </div>
            </div>

            <button 
              onClick={saveSettings}
              className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-colors"
            >
              {t.settings.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;