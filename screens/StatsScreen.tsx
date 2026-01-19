import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';

const StatsScreen: React.FC = () => {
  const { t } = useLanguage();
  const qcms = useLiveQuery(() => db.qcm.toArray());
  const user = useLiveQuery(() => db.users.orderBy('id').first());

  if (!qcms) return <div>{t.revise.loading}</div>;

  // Anki Logic: Mature = interval > 21 days
  const mastered = qcms.filter(q => q.interval > 21).length;
  // Learning/Young = interval <= 21 days
  const learning = qcms.filter(q => q.interval <= 21 && q.interval > 0).length;
  // New = interval 0
  const hard = qcms.filter(q => q.interval === 0).length;

  const pieData = [
    { name: t.stats.levelMastered, value: mastered, color: '#10B981' },
    { name: t.stats.levelLearning, value: learning, color: '#3B82F6' },
    { name: t.stats.levelStruggling, value: hard, color: '#F59E0B' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{t.stats.title}</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
         <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">{t.stats.totalCards}</p>
            <p className="text-xl font-bold text-gray-800">{qcms.length}</p>
         </div>
         <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">{t.stats.reviews}</p>
            <p className="text-xl font-bold text-indigo-600">{user?.totalReviews || 0}</p>
         </div>
         <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">{t.stats.mastered}</p>
            <p className="text-xl font-bold text-green-600">{mastered}</p>
         </div>
      </div>

      {/* Pie Chart */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-sm mb-4">{t.stats.masteryLevel}</h3>
        <div className="w-full h-64 relative">
            {qcms.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <PieChart>
                        <Pie
                        data={pieData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        >
                        {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    No data
                </div>
            )}
        </div>
        <div className="flex justify-center gap-4 text-xs mt-4">
            {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></div>
                    <span>{d.name}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default StatsScreen;