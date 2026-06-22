import { useRef, useState, useEffect, useLayoutEffect, useCallback, Component } from 'react';
import { Rnd } from 'react-rnd';
import { useStore } from '../store';

const SNAP_PX = 16; // screen-pixel snap radius — larger value means guides appear sooner

class CanvasErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1f2937', color: '#f87171', flexDirection: 'column', gap: 8, padding: 24 }}>
          <strong>Canvas error</strong>
          <pre style={{ fontSize: 11, color: '#fca5a5', whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ padding: '4px 12px', background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function useFontFace(zones, fonts) {
  useEffect(() => {
    // Inject global font library.
    // Use font-weight: 100 900 so any CSS weight renders using the uploaded file
    // (prevents the browser from synthesising fake bold/thin variants).
    fonts.forEach(({ name, url }) => {
      const id = `ff-lib-${name.replace(/\W+/g, '-')}`;
      const css = `@font-face { font-family: '${name}'; src: url('${url}'); font-weight: 100 900; font-style: normal; }`;
      let el = document.getElementById(id);
      if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
      if (el.textContent !== css) el.textContent = css;
    });
    // Also inject per-zone fontUrl for backward-compat (legacy saves without a library)
    zones.forEach((z) => {
      if (z.type !== 'text' || !z.fontUrl || !z.fontFamily) return;
      const id = `ff-${z.id}`;
      const css = `@font-face { font-family: '${z.fontFamily}'; src: url('${z.fontUrl}'); font-weight: 100 900; font-style: normal; }`;
      let el = document.getElementById(id);
      if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
      if (el.textContent !== css) el.textContent = css;
    });
  }, [zones, fonts]);
}

export default function Canvas() {
  return (
    <CanvasErrorBoundary>
      <CanvasInner />
    </CanvasErrorBoundary>
  );
}

function CanvasInner() {
  const {
    canvas, zones, fonts, selectedId, baseImage,
    mode, snapEnabled,
    selectZone, updateZone,
  } = useStore();

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const snapHRef = useRef(null);
  const snapVRef = useRef(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const [editingId, setEditingId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  useFontFace(zones, fonts);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const { offsetWidth, offsetHeight } = containerRef.current;
      if (!offsetWidth || !offsetHeight) return;
      const s = Math.min((offsetWidth - 24) / canvas.w, (offsetHeight - 24) / canvas.h, 1);
      if (s > 0) { setScale(s); scaleRef.current = s; }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [canvas.w, canvas.h]);

  // Update snap guide lines by direct DOM mutation — no React re-render during drag.
  // hGuideY / vGuideX are SCREEN px positions within the canvas div, or null to hide.
  const showGuides = useCallback((hGuideY, vGuideX) => {
    if (snapHRef.current) {
      if (hGuideY !== null) {
        snapHRef.current.style.display = 'block';
        snapHRef.current.style.top = `${hGuideY}px`;
      } else {
        snapHRef.current.style.display = 'none';
      }
    }
    if (snapVRef.current) {
      if (vGuideX !== null) {
        snapVRef.current.style.display = 'block';
        snapVRef.current.style.left = `${vGuideX}px`;
      } else {
        snapVRef.current.style.display = 'none';
      }
    }
  }, []);

  const hideGuides = useCallback(() => showGuides(null, null), [showGuides]);

  // Everything here works in SCREEN px so there is no toNative conversion error.
  // d.x / d.y from react-rnd are screen px relative to the canvas div top-left.
  // Zone w/h are native px — multiply by scale to get screen px.
  // Returns snapped native-px x/y (for storing) + guide positions in screen px.
  const checkSnap = useCallback((screenX, screenY, nativeW, nativeH) => {
    const s = scaleRef.current;
    if (!snapEnabled) {
      return { x: Math.round(screenX / s), y: Math.round(screenY / s), hGuideY: null, vGuideX: null };
    }

    const sw = nativeW * s;           // zone width  in screen px
    const sh = nativeH * s;           // zone height in screen px
    const cw = canvas.w * s;          // canvas width  in screen px
    const ch = canvas.h * s;          // canvas height in screen px

    // [snap-to position in screen px,  guide line position in screen px]
    const xSnaps = [
      [0,            0    ],   // zone left   → canvas left edge
      [cw - sw,      cw   ],   // zone right  → canvas right edge
      [(cw - sw)/2,  cw/2 ],   // zone centre → canvas centre
      [cw/2,         cw/2 ],   // zone LEFT   → canvas centre line
      [cw/2 - sw,    cw/2 ],   // zone RIGHT  → canvas centre line
    ];
    const ySnaps = [
      [0,            0    ],   // zone top    → canvas top edge
      [ch - sh,      ch   ],   // zone bottom → canvas bottom edge
      [(ch - sh)/2,  ch/2 ],   // zone centre → canvas centre
      [ch/2,         ch/2 ],   // zone TOP    → canvas centre line
      [ch/2 - sh,    ch/2 ],   // zone BOTTOM → canvas centre line
    ];

    let nx = screenX, vGuideX = null, bestX = SNAP_PX;
    xSnaps.forEach(([target, guide]) => {
      const dist = Math.abs(screenX - target);
      if (dist < bestX) { bestX = dist; nx = target; vGuideX = guide; }
    });

    let ny = screenY, hGuideY = null, bestY = SNAP_PX;
    ySnaps.forEach(([target, guide]) => {
      const dist = Math.abs(screenY - target);
      if (dist < bestY) { bestY = dist; ny = target; hGuideY = guide; }
    });

    return {
      x: Math.round(nx / s),   // native px for store
      y: Math.round(ny / s),
      hGuideY,                  // screen px for guide line
      vGuideX,
    };
  }, [canvas.w, canvas.h, snapEnabled]);

  const handleDrag = useCallback((_e, d, zone) => {
    const { hGuideY, vGuideX } = checkSnap(d.x, d.y, zone.w, zone.h);
    showGuides(hGuideY, vGuideX);
  }, [checkSnap, showGuides]);

  const handleDragStop = useCallback((_e, d, zone) => {
    const { x, y } = checkSnap(d.x, d.y, zone.w, zone.h);
    updateZone(zone.id, { x, y });
    hideGuides();
  }, [checkSnap, updateZone, hideGuides]);

  // Shared snap logic for resize: checks all 4 edges against canvas edges + centre.
  // Returns adjusted screen-px { x, y, w, h } and guide positions.
  const snapResize = useCallback((screenX, screenY, screenW, screenH) => {
    const s = scaleRef.current;
    const cw = canvas.w * s;
    const ch = canvas.h * s;

    let x = screenX, y = screenY, w = screenW, h = screenH;
    let hGuideY = null, vGuideX = null;

    const xTargets = [0, cw, cw / 2];
    const yTargets = [0, ch, ch / 2];

    // Right edge
    const re = x + w;
    for (const t of xTargets) {
      if (Math.abs(re - t) < SNAP_PX) { w = t - x; vGuideX = t; break; }
    }
    // Left edge (only if not already snapped right)
    if (vGuideX === null) {
      for (const t of xTargets) {
        if (Math.abs(x - t) < SNAP_PX) { w += x - t; x = t; vGuideX = t; break; }
      }
    }
    // Bottom edge
    const be = y + h;
    for (const t of yTargets) {
      if (Math.abs(be - t) < SNAP_PX) { h = t - y; hGuideY = t; break; }
    }
    // Top edge (only if not already snapped bottom)
    if (hGuideY === null) {
      for (const t of yTargets) {
        if (Math.abs(y - t) < SNAP_PX) { h += y - t; y = t; hGuideY = t; break; }
      }
    }

    return { x, y, w: Math.max(20, w), h: Math.max(20, h), hGuideY, vGuideX };
  }, [canvas.w, canvas.h]);

  const handleResize = useCallback((zone, _e, _dir, ref, _delta, pos) => {
    const { hGuideY, vGuideX } = snapResize(
      pos.x, pos.y,
      parseFloat(ref.style.width),
      parseFloat(ref.style.height),
    );
    showGuides(hGuideY, vGuideX);
  }, [snapResize, showGuides]);

  const handleResizeStop = useCallback((zone, _e, _dir, ref, _delta, pos) => {
    const s = scaleRef.current;
    const { x, y, w, h } = snapResize(
      pos.x, pos.y,
      parseFloat(ref.style.width),
      parseFloat(ref.style.height),
    );
    updateZone(zone.id, {
      x: Math.round(x / s),
      y: Math.round(y / s),
      w: Math.round(w / s),
      h: Math.round(h / s),
    });
    hideGuides();
  }, [snapResize, updateZone, hideGuides]);

  const startRotate = useCallback((e, zoneId) => {
    e.preventDefault();
    e.stopPropagation();
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.left + (zone.x + zone.w / 2) * scaleRef.current;
    const cy = rect.top + (zone.y + zone.h / 2) * scaleRef.current;

    const onMove = (me) => {
      const angle = Math.atan2(me.clientY - cy, me.clientX - cx) * (180 / Math.PI) + 90;
      updateZone(zoneId, { rotation: Math.round(angle) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [zones, updateZone]);

  const scaledW = canvas.w * scale;
  const scaledH = canvas.h * scale;

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#374151', overflow: 'hidden' }}
      onClick={() => { selectZone(null); setEditingId(null); }}
    >
      <div
        ref={canvasRef}
        style={{ width: scaledW, height: scaledH, position: 'relative', flexShrink: 0, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
      >
        {/* Base layer */}
        {baseImage ? (
          <img src={baseImage} alt="base"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#fff' }} />
        )}

        {/* Snap guides — shown/moved via DOM ref, never cause a React re-render */}
        <div ref={snapHRef} style={{
          display: 'none', position: 'absolute', left: -4, right: -4,
          height: 2, top: 0, background: '#00e5ff', pointerEvents: 'none', zIndex: 9999,
          boxShadow: '0 0 4px #00e5ff',
        }} />
        <div ref={snapVRef} style={{
          display: 'none', position: 'absolute', top: -4, bottom: -4,
          width: 2, left: 0, background: '#00e5ff', pointerEvents: 'none', zIndex: 9999,
          boxShadow: '0 0 4px #00e5ff',
        }} />

        {/* Zones */}
        {zones.map((zone, idx) => {
          if (!zone.visible) return null;
          const isSelected = selectedId === zone.id && mode === 'design';

          // Selected zone floats to top so it wins pointer events in overlapping areas.
          const zIndex = isSelected ? zones.length + 100 : idx + 1;
          // While any zone is being dragged, kill pointer events on all other zones
          // so the drag can never accidentally "leak" into a sibling zone.
          const pointerEvents = draggingId && draggingId !== zone.id ? 'none' : 'auto';

          return (
            <Rnd
              key={zone.id}
              position={{ x: zone.x * scale, y: zone.y * scale }}
              size={{ width: zone.w * scale, height: zone.h * scale }}
              cancel=".rnd-rotate-handle"
              onDragStart={(e) => { e.stopPropagation(); selectZone(zone.id); setDraggingId(zone.id); }}
              onDrag={(e, d) => handleDrag(e, d, zone)}
              onDragStop={(e, d) => { handleDragStop(e, d, zone); setDraggingId(null); }}
              onResizeStart={() => { selectZone(zone.id); setDraggingId(zone.id); }}
              onResize={(e, dir, ref, delta, pos) => handleResize(zone, e, dir, ref, delta, pos)}
              onResizeStop={(e, dir, ref, delta, pos) => { handleResizeStop(zone, e, dir, ref, delta, pos); setDraggingId(null); }}
              disableDragging={mode === 'preview' || editingId === zone.id}
              enableResizing={mode === 'design' && editingId !== zone.id}
              style={{ zIndex, pointerEvents }}
            >
              <div
                onClick={(e) => { e.stopPropagation(); selectZone(zone.id); }}
                onDoubleClick={(e) => {
                  if (zone.type === 'text' && mode === 'design') {
                    e.stopPropagation();
                    selectZone(zone.id);
                    setEditingId(zone.id);
                  }
                }}
                style={{
                  width: '100%', height: '100%', position: 'relative',
                  transform: `rotate(${zone.rotation}deg)`,
                  transformOrigin: 'center center',
                }}
              >
                <ZoneContent
                  zone={zone} isSelected={isSelected} mode={mode} scale={scale}
                  isEditing={editingId === zone.id}
                  onExitEdit={() => setEditingId(null)}
                  onTextChange={(v) => updateZone(zone.id, { sampleText: v })}
                />
                {isSelected && (
                  <div
                    className="rnd-rotate-handle"
                    onMouseDown={(e) => { e.stopPropagation(); startRotate(e, zone.id); }}
                    title="Drag to rotate"
                    style={{
                      position: 'absolute', top: -22, left: '50%',
                      transform: 'translateX(-50%)',
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#818cf8', cursor: 'grab', zIndex: 200,
                      border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                    }}
                  />
                )}
              </div>
            </Rnd>
          );
        })}
      </div>
    </div>
  );
}

function ZoneContent({ zone, isSelected, mode, scale, isEditing = false, onExitEdit, onTextChange }) {
  // Hooks must all be called unconditionally (before any early return)
  const [fitFontSize, setFitFontSize] = useState(48);

  const borderStyle = isEditing
    ? '2px solid #818cf8'
    : mode === 'design' && isSelected
    ? '2px solid #818cf8'
    : mode === 'design'
    ? '1.5px dashed rgba(129,140,248,0.35)'
    : 'none';

  // Normalise legacy resizing values.
  // Note: Placid's mode is literally called "Fitty" — do NOT rename it to "Fit".
  const resizing = zone.resizing === 'Fixed' ? 'Plain Text'
    : zone.resizing === 'Fit' ? 'Fitty'   // fix a prior incorrect rename
    : (zone.resizing || 'Plain Text');

  const displayText = zone.sampleText || (mode === 'design' ? (zone.label || 'Double-click to type…') : '');

  // Placid's "Spacing" is the absolute CSS line-height in native canvas px —
  // NOT an extra gap. So spacing=185 means line-height:185px (can be < fontSize).
  // For Fitty, Placid scales both fontSize and lineSpacing proportionally,
  // preserving the ratio: lineHeightRatio = lineSpacing / fontSize.
  // When lineSpacing=0, fall back to CSS 'normal' (~1.2x).
  const hasCustomSpacing = zone.type === 'text' && (zone.lineSpacing || 0) > 0;
  const lineHeightRatio = hasCustomSpacing && (zone.fontSize || 0) > 0
    ? zone.lineSpacing / zone.fontSize
    : 1.2;  // CSS 'normal' approximation

  useLayoutEffect(() => {
    if (zone.type !== 'text' || resizing !== 'Fitty') return;

    const maxFontSizePx = Math.max(4, Math.round(zone.fontSize * scale));
    const maxW = zone.w * scale - 8;   // 8px for 4px l/r padding
    const maxH = zone.h * scale - 4;   // 4px for 2px t/b padding
    if (maxW <= 0 || maxH <= 0) { setFitFontSize(maxFontSizePx); return; }

    // Apply text-transform before measuring so widths match rendered output
    const text = zone.textTransform === 'uppercase' ? (displayText || '').toUpperCase()
               : zone.textTransform === 'lowercase' ? (displayText || '').toLowerCase()
               : (displayText || '');

    if (!text) { setFitFontSize(maxFontSizePx); return; }

    const ctx = document.createElement('canvas').getContext('2d');

    // Simulate CSS word-wrap: count how many lines text wraps to at the current font
    function countWrappedLines() {
      const spaceW = ctx.measureText(' ').width;
      const paragraphs = text.split('\n');
      let total = 0;
      for (const para of paragraphs) {
        const words = para.split(' ').filter(Boolean);
        if (!words.length) { total++; continue; }
        let lineW = 0;
        let lines = 1;
        for (const word of words) {
          const ww = ctx.measureText(word).width;
          if (lineW === 0) {
            lineW = ww;
          } else if (lineW + spaceW + ww <= maxW) {
            lineW += spaceW + ww;
          } else {
            lines++;
            lineW = ww;
          }
        }
        total += lines;
      }
      return total;
    }

    // Binary search: largest font where wrapped text fits in both width and height
    let lo = 4, hi = maxFontSizePx, best = 4;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      ctx.font = `${zone.fontStyle || 'normal'} ${zone.fontWeight || 400} ${mid}px '${zone.fontFamily}', sans-serif`;
      if (zone.letterSpacing && ctx.letterSpacing !== undefined) {
        ctx.letterSpacing = `${zone.letterSpacing * scale}px`;
      }

      const numLines = countWrappedLines();
      const totalH = numLines * (mid * lineHeightRatio);

      // No single word may overflow width
      const allWords = text.split(/[\n ]+/).filter(Boolean);
      const maxWordW = allWords.length ? Math.max(...allWords.map(w => ctx.measureText(w).width)) : 0;

      if (totalH <= maxH && maxWordW <= maxW) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    setFitFontSize(best);
  }, [
    resizing, zone.type, zone.w, zone.h, zone.fontSize, zone.fontFamily, zone.fontWeight,
    zone.fontStyle, zone.letterSpacing, zone.textTransform, displayText, scale, lineHeightRatio,
  ]);

  if (zone.type === 'photo') {
    return (
      <div style={{
        width: '100%', height: '100%',
        borderRadius: zone.shape === 'circle' ? '50%' : '0',
        border: borderStyle,
        background: mode === 'design' ? 'rgba(96,165,250,0.12)' : 'rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', boxSizing: 'border-box',
      }}>
        {mode === 'design' && (
          <svg
            width={Math.max(8, Math.min(32, zone.w * scale * 0.35))}
            height={Math.max(8, Math.min(28, zone.h * scale * 0.35))}
            viewBox="0 0 24 24" fill="none" stroke="rgba(147,197,253,0.7)" strokeWidth="1.5"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        )}
      </div>
    );
  }

  if (zone.type === 'overlay') {
    return (
      <div style={{
        width: '100%', height: '100%',
        border: borderStyle,
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        background: 'transparent',
      }}>
        {zone.imageUrl ? (
          <img
            src={zone.imageUrl}
            alt="overlay"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'fill',
              pointerEvents: 'none',
              display: 'block',
            }}
          />
        ) : mode === 'design' ? (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 4,
            background: 'rgba(52,211,153,0.06)',
          }}>
            <span style={{ fontSize: Math.max(10, Math.min(28, zone.w * scale * 0.06)), opacity: 0.55 }}>✨</span>
            <span style={{ fontSize: Math.max(8, 10 * scale), color: 'rgba(110,231,183,0.6)', textAlign: 'center' }}>
              Decorative layer<br />Upload PNG in inspector
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  const alignItems = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[zone.verticalAnchor] || 'center';
  const justifyContent = { left: 'flex-start', center: 'center', right: 'flex-end' }[zone.textAlign] || 'center';

  // For Fitty: use binary-searched size × proportional ratio (matches Placid's scaling).
  // For other modes: lineSpacing IS the CSS line-height in native px (Placid's formula).
  // When lineSpacing=0, use CSS 'normal'.
  const fontSizePx = resizing === 'Fitty' ? fitFontSize : zone.fontSize * scale;
  const lineHeightPx = resizing === 'Fitty'
    ? fitFontSize * lineHeightRatio
    : hasCustomSpacing
    ? (zone.lineSpacing || 0) * scale
    : null;  // null → 'normal'

  // Text-decoration combines underline + strikethrough
  const textDecoration = [
    zone.underline && 'underline',
    zone.strikethrough && 'line-through',
  ].filter(Boolean).join(' ') || 'none';

  const fontStyles = {
    fontFamily: `'${zone.fontFamily}', sans-serif`,
    fontWeight: zone.fontWeight || 400,
    fontStyle: zone.fontStyle || 'normal',
    fontSize: `${fontSizePx}px`,
    lineHeight: lineHeightPx != null ? `${lineHeightPx}px` : 'normal',
    color: zone.color,
    letterSpacing: `${(zone.letterSpacing || 0) * scale}px`,
    textAlign: zone.textAlign,
    textTransform: zone.textTransform || 'none',
    textDecoration,
    ...(zone.wordBreak ? { wordBreak: 'break-all', hyphens: 'auto' } : { wordBreak: 'break-word' }),
  };

  // Per-mode overflow behaviour
  const modeStyles = resizing === 'Single Line ...'
    ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
    : resizing === 'Clamp'
    ? {
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: Math.max(1, Math.floor(zone.h / ((zone.fontSize || 48) + (zone.lineSpacing || 0) || (zone.fontSize || 48)))),
        whiteSpace: 'normal',
      }
    : { whiteSpace: 'pre-wrap', overflow: 'visible' };

  const bgStyle = zone.bgColor ? { background: zone.bgColor } : {};

  if (isEditing) {
    return (
      <div style={{ width: '100%', height: '100%', border: borderStyle, position: 'relative', boxSizing: 'border-box', ...bgStyle }}>
        <textarea
          autoFocus
          value={zone.sampleText ?? ''}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={onExitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onExitEdit();
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{
            ...fontStyles,
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            background: 'transparent',
            border: 'none', outline: 'none',
            resize: 'none',
            padding: '2px 4px',
            boxSizing: 'border-box',
            caretColor: '#818cf8',
            whiteSpace: 'pre-wrap',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      border: borderStyle,
      display: 'flex', alignItems, justifyContent,
      overflow: resizing === 'Plain Text' || resizing === 'Fitty' ? 'visible' : 'hidden',
      boxSizing: 'border-box',
      position: 'relative',
      ...bgStyle,
    }}>
      <span style={{
        ...fontStyles,
        ...modeStyles,
        width: '100%', padding: '2px 4px',
        opacity: zone.sampleText ? 1 : 0.45,
      }}>
        {displayText}
      </span>
    </div>
  );
}
