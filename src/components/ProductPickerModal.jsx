import { useState, useEffect } from 'react';
import { fetchLabels } from '../api/shopify';
import { useStore } from '../store';
import { metafieldsToStoreState } from '../utils/loadFromShopify';

// Shared modal used by Dashboard (before entering editor) and Toolbar (to re-link).
// All Shopify state mutations happen here; the caller is notified via onComplete().
export default function ProductPickerModal({
  onComplete,
  showSkip = true,
  skipLabel = 'Skip — don\'t link to Shopify',
}) {
  const { setLinkedProduct, loadFromShopifyData } = useStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [confirmProduct, setConfirmProduct] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchLabels()
      .then(data => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = search.trim()
    ? products.filter(p => p.title.toLowerCase().includes(search.trim().toLowerCase()))
    : products;

  const handleProductClick = (product) => {
    const hasData = product.metafields && Object.keys(product.metafields).length > 0;
    if (hasData) {
      setConfirmProduct(product);
    } else {
      setLinkedProduct(product.id, product.title);
      onComplete();
    }
  };

  const handleConfirmLoad = (loadData) => {
    setLinkedProduct(confirmProduct.id, confirmProduct.title);
    if (loadData) {
      loadFromShopifyData(metafieldsToStoreState(confirmProduct.metafields));
    }
    setConfirmProduct(null);
    onComplete();
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '80vh' }}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <h2 className="text-white font-semibold text-base">Link to Shopify Product</h2>
          {showSkip && (
            <button
              onClick={handleSkip}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
            >
              {skipLabel}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-700 flex-shrink-0">
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center text-gray-400 py-16">
              <div className="text-3xl mb-3">⏳</div>
              <p className="text-sm">Loading products from Shopify…</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-400 py-16">
              <p className="font-medium text-sm">Failed to load products</p>
              <p className="text-xs text-red-500 mt-1">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-16 text-sm">
              {search ? `No products matching "${search}"` : 'No products found in the all-labels collection'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map(product => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="bg-gray-800 border border-gray-700 hover:border-indigo-500 rounded-lg overflow-hidden text-left transition-all group"
                >
                  <div className="aspect-video bg-gray-700 overflow-hidden">
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-3xl">🏷</div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs text-gray-200 font-medium leading-snug group-hover:text-white line-clamp-2">{product.title}</p>
                    {product.metafields && Object.keys(product.metafields).length > 0 && (
                      <p className="text-xs text-indigo-400 mt-1">Has Shopify data</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Confirm load overlay */}
        {confirmProduct && (
          <div className="absolute inset-0 bg-black/75 flex items-center justify-center rounded-xl" style={{ zIndex: 10 }}>
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <h3 className="text-white font-semibold mb-2">Load existing Shopify data?</h3>
              <p className="text-sm text-gray-400 mb-5 leading-relaxed">
                <span className="text-gray-200 font-medium">{confirmProduct.title}</span> already has zone
                data saved in Shopify. Load it into the editor now?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleConfirmLoad(true)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  Yes, load data
                </button>
                <button
                  onClick={() => handleConfirmLoad(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  No, start fresh
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
