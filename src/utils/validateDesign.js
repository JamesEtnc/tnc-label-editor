export function validateDesign(state, templateName) {
  const { canvas, zones, placidTemplateId } = state;
  const errors = []; // [{ section, message }]

  const add = (section, message) => errors.push({ section, message });

  // ── Template ──────────────────────────────────────────────────────────────
  if (!templateName?.trim()) add('Template', 'Template name is required');
  if (!placidTemplateId?.trim()) add('Template', 'Placid Template UUID is required');

  // ── Canvas ────────────────────────────────────────────────────────────────
  if (!canvas.w || canvas.w <= 0) add('Canvas', 'Width is required');
  if (!canvas.h || canvas.h <= 0) add('Canvas', 'Height is required');

  // ── Photo zones ───────────────────────────────────────────────────────────
  zones.filter(z => z.type === 'photo' && z.visible).forEach((zone, i) => {
    const s = `Photo Zone ${i + 1}`;
    if (!zone.w || zone.w <= 0) add(s, 'Width is required');
    if (!zone.h || zone.h <= 0) add(s, 'Height is required');
    if (!zone.shape) add(s, 'Shape is required (Rectangle or Circle)');
    if (!zone.placidPhotoLayer?.trim()) add(s, 'Placid Layer name is required');
  });

  // ── Text zones ────────────────────────────────────────────────────────────
  zones.filter(z => z.type === 'text' && z.visible).forEach((zone, i) => {
    const s = `Text Zone ${i + 1}${zone.label?.trim() ? ` — ${zone.label.trim()}` : ''}`;
    if (!zone.w || zone.w <= 0) add(s, 'Width is required');
    if (!zone.h || zone.h <= 0) add(s, 'Height is required');
    if (!zone.label?.trim()) add(s, 'Zone label is required');
    if (!zone.sampleText?.trim()) add(s, 'Sample text is required');
    if (!zone.placidLayerName?.trim()) add(s, 'Placid Layer name is required');
    if (!zone.fontFamily?.trim()) add(s, 'Font is required');
    if (!zone.color?.trim()) add(s, 'Colour is required');
    if (!zone.fontSize || zone.fontSize <= 0) add(s, 'Font size is required');
    if (!zone.resizing?.trim()) add(s, 'Resizing mode is required');
    if (!zone.textAlign?.trim()) add(s, 'Text alignment is required');
    if (!zone.verticalAnchor?.trim()) add(s, 'Vertical anchor is required');
  });

  return errors;
}

// Group flat error array by section for display
export function groupErrors(errors) {
  const map = new Map();
  for (const { section, message } of errors) {
    if (!map.has(section)) map.set(section, []);
    map.get(section).push(message);
  }
  return [...map.entries()]; // [[section, [messages]], ...]
}
