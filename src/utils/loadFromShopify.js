export function metafieldsToStoreState(metafields, currentStore) {
  const mf = metafields; // flat key/value object

  const canvas = {
    w: parseInt(mf.canvas_width) || 1594,
    h: parseInt(mf.canvas_height) || 1119,
  };

  const zones = [];

  // Reconstruct photo zones
  for (let n = 1; n <= 4; n++) {
    const x = mf[`photo_zone_${n}_x`];
    if (!x) break;

    const pxX = (parseFloat(x) / 100) * canvas.w;
    const pxY = (parseFloat(mf[`photo_zone_${n}_y`]) / 100) * canvas.h;
    const pxW = (parseFloat(mf[`photo_zone_${n}_width`]) / 100) * canvas.w;
    const pxH = (parseFloat(mf[`photo_zone_${n}_height`]) / 100) * canvas.h;

    zones.push({
      id: `loaded-photo-${n}-${Date.now()}`,
      type: 'photo',
      name: `Photo ${n}`,
      visible: true,
      x: Math.round(pxX),
      y: Math.round(pxY),
      w: Math.round(pxW),
      h: Math.round(pxH),
      rotation: parseInt(mf[`photo_zone_${n}_rotation`]) || 0,
      shape: mf[`photo_zone_${n}_shape`] || 'rect',
      placidPhotoLayer: mf[`photo_zone_${n}_placid_layer`] || '',
    });
  }

  // Reconstruct overlay / decorative zones (between photo and text for correct z-order)
  for (let n = 1; n <= 4; n++) {
    const x = mf[`overlay_zone_${n}_x`];
    if (!x) break;

    const pxX = (parseFloat(x) / 100) * canvas.w;
    const pxY = (parseFloat(mf[`overlay_zone_${n}_y`]) / 100) * canvas.h;
    const pxW = (parseFloat(mf[`overlay_zone_${n}_width`]) / 100) * canvas.w;
    const pxH = (parseFloat(mf[`overlay_zone_${n}_height`]) / 100) * canvas.h;

    zones.push({
      id: `loaded-overlay-${n}-${Date.now()}`,
      type: 'overlay',
      name: `Decorative Layer ${n}`,
      visible: true,
      x: Math.round(pxX),
      y: Math.round(pxY),
      w: Math.round(pxW),
      h: Math.round(pxH),
      rotation: parseInt(mf[`overlay_zone_${n}_rotation`]) || 0,
      imageUrl: mf[`overlay_zone_${n}_image`] || null,
    });
  }

  // Reconstruct text zones
  for (let n = 1; n <= 4; n++) {
    const x = mf[`text_zone_${n}_x`];
    if (!x) break;

    const pxX = (parseFloat(x) / 100) * canvas.w;
    const pxY = (parseFloat(mf[`text_zone_${n}_y`]) / 100) * canvas.h;
    const pxW = (parseFloat(mf[`text_zone_${n}_width`]) / 100) * canvas.w;
    const pxH = (parseFloat(mf[`text_zone_${n}_height`]) / 100) * canvas.h;

    zones.push({
      id: `loaded-text-${n}-${Date.now()}`,
      type: 'text',
      name: `Text ${n}`,
      visible: true,
      x: Math.round(pxX),
      y: Math.round(pxY),
      w: Math.round(pxW),
      h: Math.round(pxH),
      rotation: parseInt(mf[`text_zone_${n}_rotation`]) || 0,
      label: mf[`text_zone_${n}_label`] || `Zone ${n}`,
      sampleText: mf[`text_zone_${n}_sample_text`] || '',
      fontFamily: mf[`text_zone_${n}_font_family_name`] || 'Georgia',
      fontUrl: mf[`text_zone_${n}_font_url`] || '',
      fontSize: parseInt(mf[`text_zone_${n}_font_size`]) || 48,
      fontWeight: parseInt(mf[`text_zone_${n}_font_weight`]) || 400,
      fontStyle: mf[`text_zone_${n}_font_style`] || 'normal',
      letterSpacing: parseFloat(mf[`text_zone_${n}_letter_spacing`]) || 0,
      lineSpacing: parseFloat(mf[`text_zone_${n}_line_spacing`]) || 0,
      color: mf[`text_zone_${n}_colour`] || '#000000',
      textAlign: mf[`text_zone_${n}_alignment`] || 'center',
      verticalAnchor: mf[`text_zone_${n}_vertical_anchor`] || 'middle',
      resizing: mf[`text_zone_${n}_resizing`] || 'Fitty',
      placidLayerName: mf[`text_zone_${n}_placid_layer`] || '',
      underline: false,
      strikethrough: false,
      textTransform: 'none',
      bgColor: '',
      wordBreak: false,
    });
  }

  return {
    canvas,
    zones,
    baseImage: mf.base_layer_image || null,
    placidTemplateId: mf.placid_template_id || '',
  };
}
