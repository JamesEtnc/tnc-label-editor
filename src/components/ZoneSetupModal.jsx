import { useState } from 'react';
import { useStore } from '../store';

function CountPicker({ label, description, icon, min, max, value, onChange }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-base">{icon}</span>
          <span className="text-white font-medium text-sm">{label}</span>
        </div>
        <p className="text-xs text-gray-500 pl-6">{description}</p>
      </div>
      <div className="flex gap-2 pl-6">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`w-11 h-11 rounded-xl border-2 text-base font-bold transition-all ${
              value === n
                ? 'bg-indigo-600 border-indigo-400 text-white scale-105 shadow-lg shadow-indigo-900/40'
                : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-indigo-500 hover:text-white'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ZoneSetupModal({ onComplete }) {
  const [photoCount, setPhotoCount] = useState(1);
  const [textCount, setTextCount] = useState(1);
  const { addPhotoZone, addTextZone } = useStore();

  const handleCreate = () => {
    for (let i = 0; i < photoCount; i++) addPhotoZone();
    for (let i = 0; i < textCount; i++) addTextZone();
    onComplete();
  };

  const total = photoCount + textCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-[500px] shadow-2xl flex flex-col gap-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-white">Set up your label template</h2>
          <p className="text-sm text-gray-400 mt-1">
            Select how many zones this label needs. These are required before saving to Shopify — you can always adjust them in the editor.
          </p>
        </div>

        {/* Zone pickers */}
        <div className="flex flex-col gap-5 bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
          <CountPicker
            label="Photo Upload Sections"
            description="Areas where customers upload their own photo"
            icon="📷"
            min={0}
            max={4}
            value={photoCount}
            onChange={setPhotoCount}
          />

          <div className="border-t border-gray-700/60" />

          <CountPicker
            label="Text Boxes"
            description="Areas where personalised text is placed on the label"
            icon="✏️"
            min={0}
            max={2}
            value={textCount}
            onChange={setTextCount}
          />
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between bg-gray-800/30 rounded-lg px-4 py-3 border border-gray-700/40">
          {total === 0 ? (
            <span className="text-amber-400 text-sm">⚠ No zones — the template will open blank. You can add zones manually.</span>
          ) : (
            <div className="flex gap-4 text-sm text-gray-400">
              {photoCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-700/50 text-blue-300 text-xs font-bold">{photoCount}</span>
                  photo {photoCount === 1 ? 'zone' : 'zones'}
                </span>
              )}
              {textCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-purple-700/50 text-purple-300 text-xs font-bold">{textCount}</span>
                  text {textCount === 1 ? 'box' : 'boxes'}
                </span>
              )}
            </div>
          )}
          <button
            onClick={handleCreate}
            className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            Create Template
            <span className="text-indigo-300">→</span>
          </button>
        </div>

      </div>
    </div>
  );
}
