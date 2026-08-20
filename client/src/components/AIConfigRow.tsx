import React from 'react';
import { Star, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import type { AIConfig } from '../types';

interface AIConfigRowProps {
  conf: AIConfig;
  canManageAI: boolean;
  isLoading: boolean;
  isBeingEdited: boolean;
  onToggleActive: (conf: AIConfig) => void;
  onStartEdit: (conf: AIConfig) => void;
  onDelete: (conf: AIConfig) => void;
}

export const AIConfigRow: React.FC<AIConfigRowProps> = ({
  conf,
  canManageAI,
  isLoading,
  isBeingEdited,
  onToggleActive,
  onStartEdit,
  onDelete,
}) => (
  <div
    key={conf.id}
    className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl transition-colors ${
      isBeingEdited ? 'bg-blue-50/50 dark:bg-blue-950/20 px-3' : ''
    }`}
  >
    <div className="flex items-center gap-3.5 min-w-0">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-sm ${
          conf.isActive
            ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/20'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
        }`}
      >
        {conf.provider.slice(0, 3)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
            {conf.provider}
          </span>
          {conf.isActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
              <CheckCircle2 className="w-3 h-3" />
              Mac dinh
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold animate-pulse ${
            'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
          }`}>
            Dang chinh sua
          </span>
        </div>
        <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
          Model: <span className="text-slate-700 dark:text-slate-300 font-semibold">{conf.modelName}</span>
          {conf.baseUrl && ` • ${conf.baseUrl}`}
        </p>
      </div>
    </div>

    {/* Action Buttons */}
    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
      {/* Toggle Default Button */}
      {canManageAI && (
        <button
          type="button"
          onClick={() => onToggleActive(conf)}
          disabled={isLoading}
          className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            conf.isActive
              ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100'
              : 'text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={conf.isActive ? 'Dang la mac dinh' : 'Dat lam mac dinh'}
        >
          <Star className={`w-4 h-4 ${conf.isActive ? 'fill-amber-500 text-amber-500' : ''}`} />
          <span className="hidden sm:inline text-xs">
            {conf.isActive ? 'Mac dinh' : 'Dat mac dinh'}
          </span>
        </button>
      )}

      {/* Edit Button */}
      {canManageAI && (
        <button
          type="button"
          onClick={() => onStartEdit(conf)}
          disabled={isLoading}
          className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors flex items-center gap-1 text-xs font-semibold"
          title="Chinh sua cau hinh"
        >
          <Edit3 className="w-4 h-4" />
          <span className="hidden sm:inline">Sua</span>
        </button>
      )}

      {/* Delete Button */}
      {canManageAI && (
        <button
          type="button"
          onClick={() => onDelete(conf)}
          disabled={isLoading}
          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center gap-1 text-xs font-semibold"
          title="Xoa cau hinh"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Xoa</span>
        </button>
      )}
    </div>
  </div>
);

export default AIConfigRow;