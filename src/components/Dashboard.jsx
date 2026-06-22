import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import ProductPickerModal from './ProductPickerModal';
import ZoneSetupModal from './ZoneSetupModal';

// ── Mini canvas thumbnail ─────────────────────────────────────────────────────

function DesignThumbnail({ design }) {
  const { canvas, zones = [], baseImage } = design || {};
  if (!canvas) return <div style={{ width: '100%', aspectRatio: '16/9', background: '#374151' }} />;

  const W = canvas.w;
  const H = canvas.h;

  return (
    <div style={{ width: '100%', aspectRatio: `${W}/${H}`, position: 'relative', overflow: 'hidden', background: '#ffffff' }}>
      {baseImage ? (
        <img src={baseImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#e5e7eb 0%,#f9fafb 100%)' }} />
      )}

      {/* Render zones at native scale, container will CSS-scale */}
      <div style={{ position: 'absolute', inset: 0, width: W, height: H, transformOrigin: 'top left' }}>
        {zones.filter((z) => z.visible).map((z) => {
          const alignItems = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[z.verticalAnchor] || 'center';
          const justifyContent = { left: 'flex-start', center: 'center', right: 'flex-end' }[z.textAlign] || 'center';
          return (
            <div
              key={z.id}
              style={{
                position: 'absolute',
                left: z.x, top: z.y, width: z.w, height: z.h,
                transform: `rotate(${z.rotation}deg)`,
                transformOrigin: 'center center',
                overflow: 'hidden',
                display: 'flex', alignItems, justifyContent,
                ...(z.bgColor ? { background: z.bgColor } : {}),
              }}
            >
              {z.type === 'text' && (z.sampleText || z.label) && (
                <span style={{
                  fontFamily: `'${z.fontFamily}', sans-serif`,
                  fontWeight: z.fontWeight || 400,
                  fontStyle: z.fontStyle || 'normal',
                  fontSize: `${z.fontSize || 48}px`,
                  lineHeight: (z.lineSpacing || 0) > 0 ? `${z.lineSpacing}px` : 'normal',
                  color: z.color || '#ffffff',
                  textAlign: z.textAlign || 'center',
                  textTransform: z.textTransform || 'none',
                  width: '100%', padding: '2px 4px',
                  overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  opacity: z.sampleText ? 1 : 0.5,
                }}>
                  {z.sampleText || z.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ name, design, onEdit, onDelete, onRename }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(name, trimmed);
    else setDraft(name);
    setIsRenaming(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col group">
      {/* Thumbnail — click to edit */}
      <div className="relative cursor-pointer overflow-hidden" onClick={onEdit}>
        <DesignThumbnail design={design} />
        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-indigo-600 text-white text-xs font-medium px-2 py-1 rounded shadow">Edit</span>
        </div>
        {design.linkedProductTitle && (
          <div className="absolute top-1 right-1 bg-purple-900/80 border border-purple-700 rounded px-1 py-0.5 text-purple-300 backdrop-blur-sm" style={{ fontSize: 9 }}>
            📦
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-1.5 flex flex-col gap-1">
        {isRenaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setDraft(name); setIsRenaming(false); }
            }}
            className="w-full bg-gray-700 border border-indigo-500 rounded px-1.5 py-0.5 text-white text-xs outline-none"
          />
        ) : (
          <p
            className="text-xs text-gray-200 truncate leading-tight cursor-pointer hover:text-indigo-300"
            onClick={() => setIsRenaming(true)}
            title={name}
          >
            {name}
          </p>
        )}

        <div className="flex gap-1">
          <button
            onClick={() => setIsRenaming(true)}
            className="flex-1 text-center py-0.5 rounded text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
            style={{ fontSize: 10 }}
            title="Rename"
          >
            ✎
          </button>
          {confirmDelete ? (
            <button
              onClick={() => { onDelete(name); setConfirmDelete(false); }}
              className="flex-1 py-0.5 rounded text-red-400 border border-red-700 transition-colors"
              style={{ fontSize: 10 }}
            >
              Sure?
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              onBlur={() => setConfirmDelete(false)}
              className="flex-1 py-0.5 rounded text-gray-600 hover:text-red-400 border border-gray-700 hover:border-red-700 transition-colors"
              style={{ fontSize: 10 }}
              title="Delete"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard({ onEdit, onNew }) {
  const { loadDesign, newDesign, renameDesign, deleteDesign } = useStore();
  const [search, setSearch] = useState('');
  const [designs, setDesigns] = useState({});
  // Product picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoneSetupOpen, setZoneSetupOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState(null); // { type: 'new' } | { type: 'edit', name: string }

  const reload = useCallback(() => {
    try {
      setDesigns(JSON.parse(localStorage.getItem('tnc-designs') || '{}'));
    } catch {
      setDesigns({});
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleEdit = (name) => {
    loadDesign(name);
    // If the design already has a linked product, go straight to the editor
    if (useStore.getState().linkedProductId) {
      onEdit(name);
    } else {
      setPendingNav({ type: 'edit', name });
      setPickerOpen(true);
    }
  };

  const handleNew = () => {
    newDesign();
    setPendingNav({ type: 'new' });
    setPickerOpen(true);
  };

  const handlePickerComplete = () => {
    setPickerOpen(false);
    if (pendingNav?.type === 'new') {
      // Show zone setup before opening the editor for new templates
      setZoneSetupOpen(true);
    } else {
      onEdit(pendingNav?.name || '');
      setPendingNav(null);
    }
  };

  const handleZoneSetupComplete = () => {
    setZoneSetupOpen(false);
    onNew();
    setPendingNav(null);
  };

  const handleRename = (oldName, newName) => {
    renameDesign(oldName, newName);
    reload();
  };

  const handleDelete = (name) => {
    deleteDesign(name);
    reload();
  };

  const allNames = Object.keys(designs).sort((a, b) => {
    const at = designs[b]?.savedAt || 0;
    const bt = designs[a]?.savedAt || 0;
    return at - bt; // newest first
  });

  const filtered = search.trim()
    ? allNames.filter((n) => n.toLowerCase().includes(search.trim().toLowerCase()))
    : allNames;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-8 py-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">L</div>
          <div>
            <h1 className="text-xl font-bold leading-none">Label Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">The Neighbours Cellar</p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Template
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 px-8 py-6 overflow-auto">
        {/* Title + search row */}
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold">Templates</h2>
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">⌕</span>
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-white text-sm placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">×</button>
            )}
          </div>
          <span className="text-xs text-gray-500">{filtered.length} template{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {filtered.map((name) => (
              <TemplateCard
                key={name}
                name={name}
                design={designs[name]}
                onEdit={() => handleEdit(name)}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4 text-2xl">🏷️</div>
            {search ? (
              <>
                <p className="text-gray-400 font-medium">No templates match "{search}"</p>
                <button onClick={() => setSearch('')} className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm">Clear search</button>
              </>
            ) : (
              <>
                <p className="text-gray-400 font-medium">No templates yet</p>
                <p className="text-gray-600 text-sm mt-1">Create your first label template to get started</p>
                <button
                  onClick={handleNew}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  + New Template
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Product picker modal */}
      {pickerOpen && (
        <ProductPickerModal
          onComplete={handlePickerComplete}
          showSkip={true}
          skipLabel="Skip — don't link to Shopify"
          filterLinked={pendingNav?.type === 'new'}
        />
      )}

      {/* Zone setup modal — shown after product picker for new templates */}
      {zoneSetupOpen && (
        <ZoneSetupModal onComplete={handleZoneSetupComplete} />
      )}
    </div>
  );
}
