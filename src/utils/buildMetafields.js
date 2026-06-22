export function buildMetafields(state) {
  const { canvas, zones, baseImage, placidTemplateId } = state;
  const metafields = [];

  const add = (key, value) => {
    if (value !== null && value !== undefined && value !== '') {
      metafields.push({
        key,
        value: String(value),
        type: 'single_line_text_field',
      });
    }
  };

  // Canvas
  add('canvas_width', canvas.w);
  add('canvas_height', canvas.h);
  add('placid_template_id', placidTemplateId);

  // Base layer image — only if it's a CDN URL (not a blob or base64 URL)
  if (baseImage && baseImage.startsWith('https://')) {
    add('base_layer_image', baseImage);
  }

  // Photo zones
  const photoZones = zones.filter(z => z.type === 'photo' && z.visible);
  photoZones.forEach((zone, i) => {
    const n = i + 1;
    const pct = (v, dim) => ((v / dim) * 100).toFixed(2);
    add(`photo_zone_${n}_x`, pct(zone.x, canvas.w));
    add(`photo_zone_${n}_y`, pct(zone.y, canvas.h));
    add(`photo_zone_${n}_width`, pct(zone.w, canvas.w));
    add(`photo_zone_${n}_height`, pct(zone.h, canvas.h));
    add(`photo_zone_${n}_rotation`, zone.rotation || 0);
    add(`photo_zone_${n}_shape`, zone.shape || 'rect');
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const g = gcd(Math.round(zone.w), Math.round(zone.h));
    add(`photo_zone_${n}_aspect_ratio`, `${Math.round(zone.w / g)}/${Math.round(zone.h / g)}`);
    add(`photo_zone_${n}_cropper_shape`, zone.shape || 'rect');
    add(`photo_zone_${n}_placid_layer`, zone.placidPhotoLayer || '');
  });

  // Text zones
  const textZones = zones.filter(z => z.type === 'text' && z.visible);
  textZones.forEach((zone, i) => {
    const n = i + 1;
    const pct = (v, dim) => ((v / dim) * 100).toFixed(2);
    add(`text_zone_${n}_x`, pct(zone.x, canvas.w));
    add(`text_zone_${n}_y`, pct(zone.y, canvas.h));
    add(`text_zone_${n}_width`, pct(zone.w, canvas.w));
    add(`text_zone_${n}_height`, pct(zone.h, canvas.h));
    add(`text_zone_${n}_rotation`, zone.rotation || 0);
    add(`text_zone_${n}_label`, zone.label || '');
    add(`text_zone_${n}_sample_text`, zone.sampleText || '');
    add(`text_zone_${n}_font_family_name`, zone.fontFamily || '');
    add(`text_zone_${n}_font_size`, zone.fontSize || 48);
    add(`text_zone_${n}_font_weight`, zone.fontWeight || 400);
    add(`text_zone_${n}_font_style`, zone.fontStyle || 'normal');
    add(`text_zone_${n}_letter_spacing`, zone.letterSpacing || 0);
    add(`text_zone_${n}_line_spacing`, zone.lineSpacing || 0);
    add(`text_zone_${n}_colour`, zone.color || '#000000');
    add(`text_zone_${n}_alignment`, zone.textAlign || 'center');
    add(`text_zone_${n}_vertical_anchor`, zone.verticalAnchor || 'middle');
    add(`text_zone_${n}_resizing`, zone.resizing || 'Fitty');
    add(`text_zone_${n}_placid_layer`, zone.placidLayerName || '');
    // Font URL — only CDN URLs (not base64 data URLs)
    if (zone.fontUrl && zone.fontUrl.startsWith('https://')) {
      add(`text_zone_${n}_font_url`, zone.fontUrl);
    }
  });

  return metafields;
}
