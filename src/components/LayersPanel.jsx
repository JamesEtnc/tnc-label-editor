import { useRef } from 'react';
import { useStore } from '../store';

const EyeIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

export default function LayersPanel() {
  const { zones, selectedId, selectZone, toggleVisibility, renameZone, reorderZones, baseImage } = useStore();
  const dragIdx = useRef(null);

  const handleDragStart = (e, idx) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    reorderZones(dragIdx.current, idx);
    dragIdx.current = null;
  };

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  // Reverse so top of stack = top of list
  const reversed = [...zones].map((z, i) => ({ z, i })).reverse();

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Layers</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {reversed.map(({ z, i }) => (
          <div
            key={z.id}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragOver={handleDragOver}
            onClick={() => selectZone(z.id)}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-gray-800 group
              ${selectedId === z.id ? 'bg-indigo-900/40 border-l-2 border-l-indigo-500' : 'hover:bg-gray-800'}
            `}
          >
            {/* Type dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${z.type === 'photo' ? 'bg-blue-400' : z.type === 'overlay' ? 'bg-emerald-400' : 'bg-purple-400'}`} />

            {/* Editable name */}
            <input
              type="text"
              value={z.name}
              onChange={(e) => renameZone(z.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-transparent text-xs text-gray-200 outline-none min-w-0 cursor-text"
            />

            {/* Visibility toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleVisibility(z.id); }}
              className={`flex-shrink-0 p-0.5 rounded ${z.visible ? 'text-gray-400 hover:text-white' : 'text-gray-600'}`}
              title={z.visible ? 'Hide' : 'Show'}
            >
              <EyeIcon open={z.visible} />
            </button>
          </div>
        ))}
        {zones.length === 0 && !baseImage && (
          <p className="text-gray-600 text-xs text-center mt-8">No zones yet.<br />Add Photo or Text zones above.</p>
        )}

        {/* Base layer — always at bottom, non-interactive */}
        {baseImage && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 opacity-60">
            <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-500" />
            <span className="flex-1 text-xs text-gray-400 truncate">Base layer</span>
            <EyeIcon open={true} />
          </div>
        )}
      </div>
    </div>
  );
}
