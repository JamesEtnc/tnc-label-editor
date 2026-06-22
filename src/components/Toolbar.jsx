import { useRef, useState } from 'react';
import { useStore } from '../store';
import { generateOutput } from '../utils/generateOutput';
import { uploadFile, saveLabel } from '../api/shopify';
import { buildMetafields } from '../utils/buildMetafields';
import ProductPickerModal from './ProductPickerModal';

// Convert a base64 data URL back to a File object for uploading
function base64DataUrlToFile(dataUrl, fallbackName = 'file') {
  const [header, data] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
  return new File([bytes], `${fallbackName}.${ext}`, { type: mimeType });
}

export default function Toolbar({ currentDesignName, setCurrentDesignName, onBack }) {
  const {
    canvas, setCanvas, setBaseImage, addPhotoZone, addTextZone,
    mode, setMode, snapEnabled, toggleSnap, zones, saveDesign,
    linkedProductId, linkedProductTitle,
    isSavingToShopify, setIsSavingToShopify, setLastSavedAt,
    placidTemplateId, setPlacidTemplateId,
    updateZone, addFont,
  } = useStore();

  const fileRef = useRef();
  const [showOutput, setShowOutput] = useState(false);
  const [output, setOutput] = useState({ html: '', metafields: '' });
  const [copied, setCopied] = useState({});
  const [saveFlash, setSaveFlash] = useState(false);
  const [shopifyFlash, setShopifyFlash] = useState(false);
  const [baseUploading, setBaseUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleBaseUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setBaseUploading(true);
    try {
      const result = await uploadFile(file);
      if (result?.url) {
        setBaseImage(result.url);
        setBaseUploading(false);
        return;
      }
    } catch {
      // fall through to local blob URL
    }
    setBaseUploading(false);
    setBaseImage(URL.createObjectURL(file));
  };

  const handleGenerate = () => {
    const result = generateOutput({ canvas, zones });
    setOutput(result);
    setShowOutput(true);
  };

  const handleCopy = async (key, text) => {
    await navigator.clipboard.writeText(text);
    setCopied({ ...copied, [key]: true });
    setTimeout(() => setCopied((c) => ({ ...c, [key]: false })), 1500);
  };

  const handleSave = () => {
    const name = currentDesignName.trim() || `Template ${new Date().toLocaleDateString()}`;
    if (!currentDesignName.trim()) setCurrentDesignName(name);
    saveDesign(name);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const handleSaveToShopify = async () => {
    if (!linkedProductId) return;

    // Upload any fonts that are still stored as base64 data URLs
    const textZones = useStore.getState().zones.filter(z => z.type === 'text' && z.visible);
    for (const zone of textZones) {
      if (zone.fontUrl && zone.fontUrl.startsWith('data:')) {
        try {
          const file = base64DataUrlToFile(zone.fontUrl, zone.fontFamily || 'font');
          const result = await uploadFile(file);
          if (result?.url) {
            updateZone(zone.id, { fontUrl: result.url });
            addFont(zone.fontFamily, result.url);
          }
        } catch {
          // Keep base64, continue — it won't be included in metafields
        }
      }
    }

    // Upload the base layer image if it's a blob: or data: URL
    const currentBaseImage = useStore.getState().baseImage;
    if (currentBaseImage && (currentBaseImage.startsWith('blob:') || currentBaseImage.startsWith('data:'))) {
      try {
        let file;
        if (currentBaseImage.startsWith('blob:')) {
          const res = await fetch(currentBaseImage);
          const blob = await res.blob();
          file = new File([blob], 'base-image.jpg', { type: blob.type || 'image/jpeg' });
        } else {
          file = base64DataUrlToFile(currentBaseImage, 'base-image');
        }
        const result = await uploadFile(file);
        if (result?.url) setBaseImage(result.url);
      } catch {
        // Continue with save — base layer just won't be in metafields
      }
    }

    setIsSavingToShopify(true);
    try {
      const freshState = useStore.getState();
      const metafields = buildMetafields(freshState);
      await saveLabel(freshState.linkedProductId, metafields);
      setLastSavedAt(Date.now());
      setShopifyFlash(true);
      setTimeout(() => setShopifyFlash(false), 2000);
    } catch (err) {
      alert('Save to Shopify failed: ' + err.message);
    } finally {
      setIsSavingToShopify(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700 flex-wrap">

        {/* Back to dashboard */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs transition-colors"
          title="Back to Templates"
        >
          ← Templates
        </button>

        <div className="w-px h-5 bg-gray-700" />

        {/* Editable template name */}
        <input
          type="text"
          placeholder="Template name…"
          value={currentDesignName}
          onChange={(e) => setCurrentDesignName(e.target.value)}
          className="bg-transparent border-b border-gray-600 focus:border-indigo-500 px-1 py-0.5 text-white text-sm w-36 outline-none transition-colors"
        />

        {/* Linked product badge */}
        {linkedProductTitle && (
          <button
            onClick={() => setShowPicker(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-900/40 border border-purple-700 rounded text-xs text-purple-300 hover:text-white hover:border-purple-500 transition-colors max-w-[160px] truncate"
            title="Click to change linked Shopify product"
          >
            📦 {linkedProductTitle}
          </button>
        )}

        {/* Save locally */}
        <button
          onClick={handleSave}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            saveFlash
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
        >
          {saveFlash ? '✓ Saved' : 'Save'}
        </button>

        {/* Save to Shopify — only shown when a product is linked */}
        {linkedProductId && (
          <button
            onClick={handleSaveToShopify}
            disabled={isSavingToShopify}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              shopifyFlash
                ? 'bg-green-600 text-white'
                : isSavingToShopify
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-purple-700 hover:bg-purple-600 text-white'
            }`}
          >
            {shopifyFlash ? '✓ Saved to Shopify' : isSavingToShopify ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Saving…
              </>
            ) : 'Save to Shopify'}
          </button>
        )}

        <div className="w-px h-5 bg-gray-700" />

        {/* Placid Template UUID */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 whitespace-nowrap">Placid UUID</span>
          <input
            type="text"
            value={placidTemplateId}
            onChange={(e) => setPlacidTemplateId(e.target.value)}
            placeholder="e.g. abc123"
            className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded px-2 py-0.5 text-white text-xs w-28 outline-none transition-colors"
          />
        </div>

        <div className="w-px h-5 bg-gray-700" />

        {/* Canvas dims */}
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <span>W</span>
          <input
            type="number"
            value={canvas.w}
            onChange={(e) => setCanvas({ w: parseInt(e.target.value) || canvas.w })}
            className="w-16 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-white text-xs"
          />
          <span>H</span>
          <input
            type="number"
            value={canvas.h}
            onChange={(e) => setCanvas({ h: parseInt(e.target.value) || canvas.h })}
            className="w-16 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-white text-xs"
          />
        </div>

        <div className="w-px h-5 bg-gray-700" />

        {/* Upload base */}
        <button
          onClick={() => fileRef.current.click()}
          disabled={baseUploading}
          className={`px-2 py-1 rounded text-xs text-white transition-colors ${
            baseUploading ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {baseUploading ? 'Uploading…' : 'Upload Base'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBaseUpload} />

        <div className="w-px h-5 bg-gray-700" />

        {/* Add zones */}
        <button onClick={addPhotoZone} className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs text-white">
          + Photo Zone
        </button>
        <button onClick={addTextZone} className="px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded text-xs text-white">
          + Text Zone
        </button>

        <div className="w-px h-5 bg-gray-700" />

        {/* Mode toggle */}
        <div className="flex rounded overflow-hidden border border-gray-600 text-xs">
          <button
            onClick={() => setMode('design')}
            className={`px-2 py-1 ${mode === 'design' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            Design
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`px-2 py-1 ${mode === 'preview' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            Preview
          </button>
        </div>

        {/* Snap toggle */}
        <button
          onClick={toggleSnap}
          title="Toggle centre-line snapping"
          className={`px-2 py-1 rounded text-xs border ${snapEnabled ? 'bg-cyan-700 border-cyan-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
        >
          Snap {snapEnabled ? 'ON' : 'OFF'}
        </button>

        <div className="w-px h-5 bg-gray-700" />

        {/* Generate */}
        <button
          onClick={handleGenerate}
          className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs text-white"
        >
          Generate Output
        </button>
      </div>

      {/* Output modal */}
      {showOutput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 w-[700px] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Generated Output</h2>
              <button onClick={() => setShowOutput(false)} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">HTML Snippet</span>
                <button
                  onClick={() => handleCopy('html', output.html)}
                  className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
                >
                  {copied.html ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre className="bg-gray-800 text-green-300 text-xs p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {output.html}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Metafields</span>
                <button
                  onClick={() => handleCopy('meta', output.metafields)}
                  className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
                >
                  {copied.meta ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre className="bg-gray-800 text-blue-300 text-xs p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {output.metafields}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Product picker modal (for changing linked product from toolbar badge) */}
      {showPicker && (
        <ProductPickerModal
          onComplete={() => setShowPicker(false)}
          showSkip={true}
          skipLabel="Cancel"
        />
      )}
    </>
  );
}
