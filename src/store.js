import { create } from 'zustand';

const DEFAULT_CANVAS = { w: 1594, h: 1119 };

const getStoredFonts = () => {
  try { return JSON.parse(localStorage.getItem('tnc-fonts') || '[]'); } catch { return []; }
};

const makePhotoZone = (id, index) => ({
  id,
  type: 'photo',
  name: `Photo ${index}`,
  visible: true,
  x: 100 + index * 60,
  y: 100 + index * 40,
  w: 400,
  h: 300,
  rotation: 0,
  shape: 'rect',
});

const makeTextZone = (id, index) => ({
  id,
  type: 'text',
  name: `Text ${index}`,
  visible: true,
  x: 150,
  y: 80 + (index - 1) * 140,
  w: 500,
  h: 100,
  rotation: 0,
  label: `Zone ${index}`,
  sampleText: '',
  fontFamily: 'Georgia',
  fontUrl: '',
  fontWeight: 400,
  fontStyle: 'normal',       // 'normal' | 'italic'
  underline: false,
  strikethrough: false,
  textTransform: 'none',     // 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  resizing: 'Plain Text',    // 'Plain Text' | 'Fit' | 'Single Line ...' | 'Clamp'
  fontSize: 48,
  letterSpacing: 0,
  lineSpacing: 0,   // extra px gap between lines → CSS line-height = fontSize + lineSpacing
  bgColor: '',               // textbox background, '' = transparent
  wordBreak: false,          // force long words to be hyphenated
  color: '#ffffff',
  textAlign: 'center',
  verticalAnchor: 'middle',
});

// Use time + random to avoid collisions after loadDesign or HMR resets module scope
const uid = () => `z${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const useStore = create((set, get) => ({
  canvas: DEFAULT_CANVAS,
  zones: [],
  fonts: getStoredFonts(),   // global font library [{ name, url }] — persisted
  selectedId: null,
  baseImage: null,
  mode: 'design',
  snapEnabled: true,
  snapActive: { h: false, v: false },

  setCanvas: (dims) => set({ canvas: { ...get().canvas, ...dims } }),

  setBaseImage: (url) => set({ baseImage: url }),

  setMode: (mode) => set({ mode }),

  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  setSnapActive: (snap) => set({ snapActive: snap }),

  selectZone: (id) => set({ selectedId: id }),

  // Add or overwrite a font in the global library — persisted across sessions
  addFont: (name, url) => set((s) => {
    const fonts = s.fonts.some((f) => f.name === name)
      ? s.fonts.map((f) => (f.name === name ? { name, url } : f))
      : [...s.fonts, { name, url }];
    try { localStorage.setItem('tnc-fonts', JSON.stringify(fonts)); } catch {}
    return { fonts };
  }),

  removeFont: (name) => set((s) => {
    const fonts = s.fonts.filter((f) => f.name !== name);
    try { localStorage.setItem('tnc-fonts', JSON.stringify(fonts)); } catch {}
    return { fonts };
  }),

  newDesign: () => set({
    canvas: DEFAULT_CANVAS,
    zones: [],
    baseImage: null,
    selectedId: null,
    mode: 'design',
    // fonts stay — they are a global library
  }),

  renameDesign: (oldName, newName) => {
    try {
      const designs = JSON.parse(localStorage.getItem('tnc-designs') || '{}');
      if (designs[oldName] && newName.trim() && !designs[newName.trim()]) {
        designs[newName.trim()] = designs[oldName];
        delete designs[oldName];
        localStorage.setItem('tnc-designs', JSON.stringify(designs));
        return true;
      }
    } catch {}
    return false;
  },

  deleteDesign: (name) => {
    try {
      const designs = JSON.parse(localStorage.getItem('tnc-designs') || '{}');
      delete designs[name];
      localStorage.setItem('tnc-designs', JSON.stringify(designs));
      return true;
    } catch {}
    return false;
  },

  addPhotoZone: () => {
    const { zones } = get();
    const photoCount = zones.filter((z) => z.type === 'photo').length;
    if (photoCount >= 4) return;
    const id = uid();
    set((s) => ({
      zones: [...s.zones, makePhotoZone(id, photoCount + 1)],
      selectedId: id,
    }));
  },

  addTextZone: () => {
    const { zones } = get();
    const textCount = zones.filter((z) => z.type === 'text').length;
    if (textCount >= 4) return;
    const id = uid();
    set((s) => ({
      zones: [...s.zones, makeTextZone(id, textCount + 1)],
      selectedId: id,
    }));
  },

  updateZone: (id, props) =>
    set((s) => ({
      zones: s.zones.map((z) => (z.id === id ? { ...z, ...props } : z)),
    })),

  deleteZone: (id) =>
    set((s) => ({
      zones: s.zones.filter((z) => z.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  reorderZones: (fromIndex, toIndex) => {
    const zones = [...get().zones];
    const [moved] = zones.splice(fromIndex, 1);
    zones.splice(toIndex, 0, moved);
    set({ zones });
  },

  toggleVisibility: (id) =>
    set((s) => ({
      zones: s.zones.map((z) =>
        z.id === id ? { ...z, visible: !z.visible } : z,
      ),
    })),

  renameZone: (id, name) =>
    set((s) => ({
      zones: s.zones.map((z) => (z.id === id ? { ...z, name } : z)),
    })),

  saveDesign: (name) => {
    const { canvas, zones, baseImage, fonts } = get();
    const designs = JSON.parse(localStorage.getItem('tnc-designs') || '{}');
    const existing = designs[name] || {};
    designs[name] = { canvas, zones, baseImage, fonts, savedAt: Date.now(), createdAt: existing.createdAt || Date.now() };
    localStorage.setItem('tnc-designs', JSON.stringify(designs));
  },

  loadDesign: (name) => {
    const designs = JSON.parse(localStorage.getItem('tnc-designs') || '{}');
    const d = designs[name];
    if (!d) return false;
    set({
      canvas: d.canvas,
      zones: d.zones,
      baseImage: d.baseImage || null,
      fonts: d.fonts || [],
      selectedId: null,
    });
    return true;
  },

  listDesigns: () => {
    return Object.keys(JSON.parse(localStorage.getItem('tnc-designs') || '{}'));
  },
}));
