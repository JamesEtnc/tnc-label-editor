import { useState } from 'react';
import { useStore } from '../store';
import { uploadFile } from '../api/shopify';

// ─── small reusable inputs ────────────────────────────────────────────────────

const NumInput = ({ value, onChange, step = 1, min, className = '' }) => (
  <input
    type="number"
    value={value}
    step={step}
    min={min}
    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    className={`bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs w-full ${className}`}
  />
);

const Section = ({ title }) => (
  <p className="text-xs font-bold text-gray-200 uppercase tracking-wider mb-2 mt-1">{title}</p>
);

const Row = ({ label, children }) => (
  <div className="flex items-center gap-2 mb-2">
    <label className="text-xs text-gray-400 w-24 flex-shrink-0">{label}</label>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const ToggleBtn = ({ active, onClick, children, title }) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex items-center justify-center w-8 h-7 rounded text-xs font-medium border transition-colors ${
      active
        ? 'bg-indigo-600 border-indigo-500 text-white'
        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
    }`}
  >
    {children}
  </button>
);

// ─── font upload helper ───────────────────────────────────────────────────────

function FontUpload({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [warning, setWarning] = useState('');

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    setUploading(true);
    setWarning('');

    try {
      const result = await uploadFile(file);
      if (result?.url) {
        onUploaded(name, result.url);
        setUploading(false);
        e.target.value = '';
        return;
      }
      throw new Error('No URL returned');
    } catch {
      // Fallback: store as base64 data URL (won't be included in Shopify metafields)
      setWarning('CDN upload failed — saved locally');
      const reader = new FileReader();
      reader.onload = (ev) => onUploaded(name, ev.target.result);
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <label className="cursor-pointer flex items-center gap-2">
      {uploading ? (
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <span className="inline-block w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          Uploading…
        </span>
      ) : (
        <span className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
          Upload Custom Font
        </span>
      )}
      {warning && <span className="text-xs text-yellow-500">{warning}</span>}
      <input
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        className="hidden"
        onChange={handleChange}
      />
    </label>
  );
}

// ─── main Inspector ───────────────────────────────────────────────────────────

export default function Inspector() {
  const { zones, fonts, selectedId, updateZone, deleteZone, addFont } = useStore();
  const zone = zones.find((z) => z.id === selectedId);

  if (!zone) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-xs text-center px-4">
        Select a zone to inspect
      </div>
    );
  }

  const upd = (props) => updateZone(zone.id, props);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {zone.type === 'photo' ? 'Photo Zone' : 'Text Zone'}
        </span>
        <button
          onClick={() => deleteZone(zone.id)}
          className="text-red-400 hover:text-red-300 text-xs px-2 py-0.5 rounded hover:bg-red-900/30"
        >
          Delete
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">

        {/* ── POSITION & SIZE ── */}
        <Section title="Position & Size" />
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[['X', 'x'], ['Y', 'y'], ['W', 'w'], ['H', 'h']].map(([lbl, key]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="text-xs text-gray-500 w-4">{lbl}</span>
              <NumInput value={zone[key]} min={key === 'w' || key === 'h' ? 1 : undefined} onChange={(v) => upd({ [key]: v })} />
              <span className="text-xs text-gray-600">px</span>
            </div>
          ))}
        </div>
        <Row label="Rotation">
          <div className="flex items-center gap-1">
            <NumInput value={zone.rotation} step={1} onChange={(v) => upd({ rotation: v })} />
            <span className="text-xs text-gray-600">°</span>
          </div>
        </Row>
        <p className="text-xs text-gray-600 mb-3">Ratio: {zone.w}/{zone.h}</p>

        {/* ── PHOTO ZONE ONLY ── */}
        {zone.type === 'photo' && (
          <>
            <div className="border-t border-gray-800 pt-3">
              <Section title="Shape" />
              <div className="flex rounded overflow-hidden border border-gray-700 text-xs mb-3">
                {[['rect', 'Rectangle'], ['circle', 'Circle']].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => upd({ shape: v })}
                    className={`flex-1 py-1.5 ${zone.shape === v ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Placid layer name for photo zone */}
            <div className="border-t border-gray-800 pt-3">
              <Section title="Placid" />
              <Row label="Layer name">
                <input
                  type="text"
                  value={zone.placidPhotoLayer || ''}
                  onChange={(e) => upd({ placidPhotoLayer: e.target.value })}
                  placeholder="e.g. photo_1"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                />
              </Row>
            </div>
          </>
        )}

        {/* ── TEXT ZONE ONLY ── */}
        {zone.type === 'text' && (
          <>
            {/* CONTENT */}
            <div className="border-t border-gray-800 pt-3">
              <Section title="Content" />
              <Row label="Zone label">
                <input
                  type="text"
                  value={zone.label}
                  onChange={(e) => upd({ label: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                />
              </Row>
              <Row label="Sample text">
                <textarea
                  value={zone.sampleText}
                  onChange={(e) => upd({ sampleText: e.target.value })}
                  placeholder="Type text to preview…"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs resize-none"
                />
              </Row>
              <Row label="Placid layer">
                <input
                  type="text"
                  value={zone.placidLayerName || ''}
                  onChange={(e) => upd({ placidLayerName: e.target.value })}
                  placeholder="e.g. text_1"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                />
              </Row>
            </div>

            {/* TEXT STYLE */}
            <div className="border-t border-gray-800 pt-3">
              <Section title="Text Style" />

              {/* Font selector */}
              <Row label="Font">
                <select
                  value={zone.fontFamily}
                  onChange={(e) => {
                    const f = fonts.find((x) => x.name === e.target.value);
                    upd({ fontFamily: e.target.value, fontUrl: f ? f.url : zone.fontUrl });
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                >
                  {fonts.length === 0 && !zone.fontFamily && (
                    <option value="">— upload a font —</option>
                  )}
                  {fonts.map((f) => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                  {zone.fontFamily && !fonts.find((f) => f.name === zone.fontFamily) && (
                    <option value={zone.fontFamily}>{zone.fontFamily}</option>
                  )}
                </select>
              </Row>
              <div className="mb-2 pl-[6.5rem]">
                <FontUpload
                  onUploaded={(name, url) => {
                    addFont(name, url);
                    upd({ fontFamily: name, fontUrl: url });
                  }}
                />
              </div>

              {/* Colour */}
              <Row label="Color">
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={zone.color}
                    onChange={(e) => upd({ color: e.target.value })}
                    className="w-7 h-7 rounded border border-gray-700 cursor-pointer bg-transparent flex-shrink-0"
                  />
                  <span className="text-xs text-gray-500">#</span>
                  <input
                    type="text"
                    value={zone.color.replace('#', '')}
                    onChange={(e) => upd({ color: `#${e.target.value.replace('#', '')}` })}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                    maxLength={8}
                  />
                </div>
              </Row>

              {/* Font weight */}
              <Row label="Weight">
                <select
                  value={zone.fontWeight || 400}
                  onChange={(e) => upd({ fontWeight: parseInt(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                >
                  <option value={100}>100 — Thin</option>
                  <option value={200}>200 — Extra Light</option>
                  <option value={300}>300 — Light</option>
                  <option value={400}>400 — Regular</option>
                  <option value={500}>500 — Medium</option>
                  <option value={600}>600 — Semi Bold</option>
                  <option value={700}>700 — Bold</option>
                  <option value={800}>800 — Extra Bold</option>
                  <option value={900}>900 — Black</option>
                </select>
              </Row>

              {/* Size & letter spacing */}
              <Row label="Size & Spacing">
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <NumInput
                      value={zone.fontSize}
                      min={1}
                      onChange={(v) => upd({ fontSize: v })}
                    />
                    <span className="text-xs text-gray-600 flex-shrink-0">px</span>
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-gray-500 text-xs flex-shrink-0" title="Letter spacing">↔</span>
                    <NumInput
                      value={zone.letterSpacing}
                      step={0.5}
                      onChange={(v) => upd({ letterSpacing: v })}
                    />
                    <span className="text-xs text-gray-600 flex-shrink-0">px</span>
                  </div>
                </div>
              </Row>

              {/* Style toggles — order matches Placid: I, S, U */}
              <Row label="Style">
                <div className="flex gap-1.5">
                  <ToggleBtn
                    active={zone.fontStyle === 'italic'}
                    onClick={() => upd({ fontStyle: zone.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    title="Italic"
                  >
                    <em style={{ fontStyle: 'italic' }}>I</em>
                  </ToggleBtn>
                  <ToggleBtn
                    active={!!zone.strikethrough}
                    onClick={() => upd({ strikethrough: !zone.strikethrough })}
                    title="Strikethrough"
                  >
                    <span style={{ textDecoration: 'line-through' }}>S</span>
                  </ToggleBtn>
                  <ToggleBtn
                    active={!!zone.underline}
                    onClick={() => upd({ underline: !zone.underline })}
                    title="Underline"
                  >
                    <span style={{ textDecoration: 'underline' }}>U</span>
                  </ToggleBtn>
                </div>
              </Row>

              {/* Transform */}
              <Row label="Transform">
                <select
                  value={zone.textTransform || 'none'}
                  onChange={(e) => upd({ textTransform: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                >
                  <option value="none">No Transformation</option>
                  <option value="uppercase">Uppercase</option>
                  <option value="lowercase">Lowercase</option>
                  <option value="capitalize">Capitalize</option>
                </select>
              </Row>
            </div>

            {/* TEXTBOX */}
            <div className="border-t border-gray-800 pt-3">
              <Section title="Textbox" />

              <Row label="Spacing">
                <div className="flex items-center gap-1">
                  <NumInput
                    value={zone.lineSpacing}
                    step={1}
                    min={-200}
                    onChange={(v) => upd({ lineSpacing: v })}
                  />
                  <span className="text-xs text-gray-600 flex-shrink-0">px</span>
                </div>
              </Row>

              {/* Resizing — matches Placid's 4 modes exactly */}
              <Row label="Resizing">
                <select
                  value={zone.resizing === 'Fixed' ? 'Plain Text' : zone.resizing === 'Fit' ? 'Fitty' : (zone.resizing || 'Plain Text')}
                  onChange={(e) => upd({ resizing: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                >
                  <option value="Plain Text">Plain Text</option>
                  <option value="Fitty">Fitty</option>
                  <option value="Single Line ...">Single Line ...</option>
                  <option value="Clamp">Clamp</option>
                </select>
              </Row>

              {/* Background colour */}
              <Row label="Background">
                <div className="flex items-center gap-1.5">
                  <div
                    style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #374151', background: zone.bgColor || 'transparent', backgroundImage: zone.bgColor ? 'none' : 'linear-gradient(45deg,#555 25%,transparent 25%,transparent 75%,#555 75%),linear-gradient(45deg,#555 25%,transparent 25%,transparent 75%,#555 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0,4px 4px', flexShrink: 0, cursor: 'pointer' }}
                    onClick={() => { if (zone.bgColor) upd({ bgColor: '' }); }}
                    title={zone.bgColor ? 'Click to clear' : 'Transparent'}
                  />
                  <input
                    type="color"
                    value={zone.bgColor || '#ffffff'}
                    onChange={(e) => upd({ bgColor: e.target.value })}
                    className="w-7 h-7 rounded border border-gray-700 cursor-pointer bg-transparent flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={zone.bgColor ? zone.bgColor.replace('#', '') : ''}
                    placeholder="transparent"
                    onChange={(e) => upd({ bgColor: e.target.value ? `#${e.target.value.replace('#', '')}` : '' })}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                    maxLength={8}
                  />
                </div>
              </Row>

              {/* Word-break */}
              <Row label="Word-break">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => upd({ wordBreak: !zone.wordBreak })}
                    className={`w-9 h-5 rounded-full relative transition-colors ${zone.wordBreak ? 'bg-indigo-600' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${zone.wordBreak ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-xs text-gray-400">Hyphenate long words</span>
                </label>
              </Row>

              {/* Alignment */}
              <Row label="Alignment">
                <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
                  {[
                    ['left',   'Left'],
                    ['center', 'Center'],
                    ['right',  'Right'],
                  ].map(([v, label], i) => (
                    <button
                      key={v}
                      title={label}
                      onClick={() => upd({ textAlign: v })}
                      className={`flex-1 py-1.5 text-sm ${zone.textAlign === v ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                    >
                      {i === 0 ? '⬅' : i === 1 ? '↔' : '➡'}
                    </button>
                  ))}
                </div>
              </Row>

              {/* Anchor */}
              <Row label="Anchor">
                <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
                  {[['top', '⬆', 'Top'], ['middle', '↕', 'Middle'], ['bottom', '⬇', 'Bottom']].map(([v, icon, label]) => (
                    <button
                      key={v}
                      title={label}
                      onClick={() => upd({ verticalAnchor: v })}
                      className={`flex-1 py-1.5 text-sm ${zone.verticalAnchor === v ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </Row>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
