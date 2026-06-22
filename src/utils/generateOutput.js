export function generateOutput({ canvas, zones }) {
  const { w: cw, h: ch } = canvas;
  const pct = (v, dim) => ((v / dim) * 100).toFixed(2);

  const visibleZones = zones.filter((z) => z.visible);
  let photoIdx = 0;
  let textIdx = 0;

  const zoneDivs = visibleZones.map((z) => {
    const xPct = pct(z.x, cw);
    const yPct = pct(z.y, ch);
    const wPct = pct(z.w, cw);
    const hPct = pct(z.h, ch);

    if (z.type === 'photo') {
      photoIdx++;
      const ratio = `${z.w}/${z.h}`;
      const borderRadius = z.shape === 'circle' ? '50%' : '0';
      return `  <!-- photo zone ${photoIdx} -->
  <div class="tnc-photo-zone" data-zone="${photoIdx}" data-shape="${z.shape}" data-ratio="${ratio}"
       style="position:absolute; top:${yPct}%; left:${xPct}%; width:${wPct}%; height:${hPct}%; overflow:hidden;
              border-radius:${borderRadius}; transform:rotate(${z.rotation}deg); transform-origin:center; background:rgba(0,0,0,0.05);">
    <img class="tnc-photo-upload-preview" src="" alt="" style="width:100%; height:100%; object-fit:cover; display:none;">
  </div>`;
    } else {
      textIdx++;
      const alignMap = { left: 'left', center: 'center', right: 'right' };
      const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
      const alignItemsMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
      const resizing = z.resizing === 'Fixed' ? 'Plain Text'
        : z.resizing === 'Fitty' ? 'Fit'
        : (z.resizing || 'Plain Text');
      const isFit = resizing === 'Fit';
      const isSingleLine = resizing === 'Single Line ...';
      const isClamp = resizing === 'Clamp';

      // Placid: "Spacing" = absolute CSS line-height in native canvas px.
      // When spacing=0, fall back to CSS 'normal'.
      const lhPx = (z.lineSpacing || 0) > 0 ? `${z.lineSpacing}px` : 'normal';
      const fontSizeStyle = isFit ? '' : `font-size:${z.fontSize}px; `;

      // Text decoration
      const textDec = [z.underline && 'underline', z.strikethrough && 'line-through'].filter(Boolean).join(' ');

      // Overflow/clamp styles per resizing mode
      let overflowStyles = 'overflow:hidden; ';
      if (isSingleLine) {
        overflowStyles = 'overflow:hidden; white-space:nowrap; text-overflow:ellipsis; ';
      } else if (isClamp) {
        const lineCount = Math.max(1, Math.floor(z.h / (z.fontSize + (z.lineSpacing || 0) || z.fontSize)));
        overflowStyles = `overflow:hidden; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:${lineCount}; `;
      }

      const bgStyle = z.bgColor ? `background:${z.bgColor}; ` : '';
      const wordBreakStyle = z.wordBreak ? 'word-break:break-all; hyphens:auto; ' : '';
      const italicStyle = z.fontStyle === 'italic' ? 'font-style:italic; ' : '';
      const transformStyle = z.textTransform && z.textTransform !== 'none' ? `text-transform:${z.textTransform}; ` : '';
      const decorStyle = textDec ? `text-decoration:${textDec}; ` : '';
      const fitAttr = isFit ? ' data-resizing="fit"' : isClamp ? ' data-resizing="clamp"' : isSingleLine ? ' data-resizing="singleline"' : '';

      return `  <!-- text zone ${textIdx} -->
  <div class="tnc-text-zone" data-zone="${textIdx}" data-label="${z.label}"${fitAttr}
       style="position:absolute; top:${yPct}%; left:${xPct}%; width:${wPct}%; height:${hPct}%;
              font-family:'${z.fontFamily}', sans-serif; font-weight:${z.fontWeight || 400};
              ${fontSizeStyle}${italicStyle}${decorStyle}${transformStyle}${wordBreakStyle}${bgStyle}color:${z.color};
              letter-spacing:${z.letterSpacing || 0}px; line-height:${lhPx};
              ${overflowStyles}text-align:${alignMap[z.textAlign]}; display:flex;
              align-items:${alignItemsMap[z.verticalAnchor]}; justify-content:${justifyMap[z.textAlign]};
              transform:rotate(${z.rotation}deg); transform-origin:center;">
    <span class="tnc-text-content">Your text here</span>
  </div>`;
    }
  });

  const html = `<div class="tnc-label-preview" style="position:relative; width:100%; aspect-ratio:${cw}/${ch}; overflow:hidden;">
  <img class="tnc-label-bg" src="" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;">
${zoneDivs.join('\n')}
</div>`;

  // Build metafields
  const lines = [`custom.preview_template_html: ${html}`];
  let pi = 0;
  let ti = 0;
  visibleZones.forEach((z) => {
    if (z.type === 'photo') {
      pi++;
      lines.push(`custom.photo_zone_${pi}_cropper_shape: ${z.shape}`);
      lines.push(`custom.photo_zone_${pi}_aspect_ratio: ${z.w}/${z.h}`);
    } else {
      ti++;
      lines.push(`custom.text_zone_${ti}_label: ${z.label}`);
      lines.push(`custom.text_zone_${ti}_font_family_name: ${z.fontFamily}`);
      lines.push(`custom.text_zone_${ti}_font_url: ${z.fontUrl}`);
    }
  });

  return { html, metafields: lines.join('\n') };
}
