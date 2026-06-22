// Cloudflare Worker — TNC Label Editor Shopify bridge
// Paste this file into the Cloudflare Workers editor (not part of the Vite project).
//
// Required environment variables (set in Cloudflare dashboard → Workers → Settings → Variables):
//   SHOPIFY_STORE       e.g. "theneighbourscellar.myshopify.com"
//   SHOPIFY_TOKEN       Admin API access token (starts with "shpat_")
//   SHOPIFY_API_VERSION e.g. "2024-01"
//
// Routes handled:
//   GET  /labels            → list all products in the "all-labels" collection
//   GET  /labels/:id        → single product + metafields
//   PUT  /labels/:id        → upsert metafields array
//   POST /files/upload      → staged upload (multipart/form-data, field: "file")
//   OPTIONS *               → CORS preflight

const ALLOWED_ORIGINS = [
  'https://tnc-label-editor.vercel.app',
  'http://localhost:5173',
];

const COLLECTION_HANDLES = ['all-labels', 'all-label', 'labels'];

// ─── CORS ────────────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ─── Shopify helpers ──────────────────────────────────────────────────────────

async function shopifyRest(env, path, options = {}) {
  const url = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'TNC-Label-Editor/1.0',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify REST ${res.status} (${url}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function shopifyGraphQL(env, query, variables = {}) {
  const url = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'TNC-Label-Editor/1.0',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.errors?.length) {
    throw new Error(`Shopify GraphQL: ${data.errors.map(e => e.message).join('; ')}`);
  }
  return data.data;
}

// ─── Metafield utilities ──────────────────────────────────────────────────────

// Resolve Shopify file_reference GIDs (e.g. gid://shopify/MediaImage/123) to CDN URLs
async function resolveFileGids(env, gids) {
  if (!gids.length) return {};
  const query = `
    query ResolveFiles($ids: [ID!]!) {
      nodes(ids: $ids) {
        id
        ... on MediaImage { image { url } }
        ... on GenericFile { url }
      }
    }
  `;
  try {
    const data = await shopifyGraphQL(env, query, { ids: gids });
    const out = {};
    for (const node of (data?.nodes || [])) {
      if (node?.id) out[node.id] = node.image?.url || node.url || null;
    }
    return out;
  } catch {
    return {};
  }
}

// Build key→value map; automatically resolves file_reference GIDs to CDN URLs
async function metafieldsToMap(env, metafields = []) {
  const map = {};
  const gidEntries = [];
  for (const m of metafields) {
    if (m.type === 'file_reference' && typeof m.value === 'string' && m.value.startsWith('gid://')) {
      gidEntries.push({ key: m.key, gid: m.value });
    } else {
      map[m.key] = m.value;
    }
  }
  if (gidEntries.length) {
    const resolved = await resolveFileGids(env, gidEntries.map(e => e.gid));
    for (const { key, gid } of gidEntries) {
      if (resolved[gid]) map[key] = resolved[gid]; // skip unresolvable GIDs
    }
  }
  return map;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function handleGetLabels(env, origin) {
  // COLLECTION_ID env var is the most reliable override — set it to the numeric
  // Shopify collection ID from the admin URL: /admin/collections/<COLLECTION_ID>
  let collectionId = env.COLLECTION_ID || null;

  if (!collectionId) {
    // Try to find by handle (requires read_products scope on the token)
    for (const handle of COLLECTION_HANDLES) {
      try {
        const data = await shopifyRest(env, `custom_collections.json?handle=${handle}&fields=id,handle,title`);
        if (data.custom_collections?.length) { collectionId = data.custom_collections[0].id; break; }
      } catch {}
      try {
        const data = await shopifyRest(env, `smart_collections.json?handle=${handle}&fields=id,handle,title`);
        if (data.smart_collections?.length) { collectionId = data.smart_collections[0].id; break; }
      } catch {}
    }
  }

  let products = [];
  if (collectionId) {
    // products.json?collection_id works for both manual AND smart collections
    const productsData = await shopifyRest(
      env,
      `products.json?collection_id=${collectionId}&fields=id,title,images&limit=250`,
    );
    products = productsData.products || [];
  } else {
    // Fallback: return all products in the store (user can filter in the picker UI)
    const productsData = await shopifyRest(
      env,
      `products.json?fields=id,title,images&limit=250`,
    );
    products = productsData.products || [];
  }

  // Fetch metafields for each product
  const metafieldResults = await Promise.all(
    products.map(p =>
      shopifyRest(env, `products/${p.id}/metafields.json?namespace=custom&limit=250`)
        .then(async r => ({ id: p.id, metafields: await metafieldsToMap(env, r.metafields) }))
        .catch(() => ({ id: p.id, metafields: {} })),
    ),
  );
  const metaMap = Object.fromEntries(metafieldResults.map(r => [r.id, r.metafields]));

  const shaped = products.map(p => ({
    id: String(p.id),
    title: p.title,
    thumbnail: p.images?.[0]?.src || null,
    metafields: metaMap[p.id] || {},
  }));

  return json({ products: shaped }, 200, origin);
}

async function handleGetLabel(env, productId, origin) {
  const [productData, metafieldData] = await Promise.all([
    shopifyRest(env, `products/${productId}.json?fields=id,title,images`),
    shopifyRest(env, `products/${productId}/metafields.json?namespace=custom&limit=250`),
  ]);

  const p = productData.product;
  return json({
    id: String(p.id),
    title: p.title,
    thumbnail: p.images?.[0]?.src || null,
    metafields: await metafieldsToMap(env, metafieldData.metafields || []),
  }, 200, origin);
}

async function handlePutLabel(env, productId, body, origin) {
  // body.metafields = [{ key, value, type, namespace }]
  const { metafields: incoming = [] } = body;
  if (!incoming.length) return json({ ok: true }, 200, origin);

  // Use metafieldsSet (GraphQL) — upserts all in one call, no pre-fetch needed.
  // Shopify allows max 25 metafields per metafieldsSet call, so batch if needed.
  const gid = `gid://shopify/Product/${productId}`;
  const mutation = `
    mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { key }
        userErrors { field message code }
      }
    }
  `;

  const prepared = incoming.map(mf => {
    const type = mf.type || 'single_line_text_field';
    let value = String(mf.value);
    // Shopify rejects newlines in single_line_text_field (e.g. multi-line sample text)
    if (type === 'single_line_text_field') value = value.replace(/[\r\n]+/g, ' ').trim();
    return { ownerId: gid, namespace: mf.namespace || 'custom', key: mf.key, value, type };
  });

  const skipped = [];
  for (let i = 0; i < prepared.length; i += 25) {
    const batch = prepared.slice(i, i + 25);
    const data = await shopifyGraphQL(env, mutation, { metafields: batch });
    const errors = data?.metafieldsSet?.userErrors || [];
    for (const err of errors) {
      if (err.message?.includes('must be consistent')) {
        // Type conflict with a Shopify admin metafield definition — track which key
        const fieldPath = Array.isArray(err.field) ? err.field.join('.') : String(err.field || '');
        const idx = parseInt(fieldPath.match(/(\d+)/)?.[1] ?? '-1');
        skipped.push(idx >= 0 && batch[idx] ? batch[idx].key : '(unknown)');
      } else {
        throw new Error(`metafieldsSet error: ${err.message}`);
      }
    }
  }

  return json({ ok: true, skipped: skipped.length ? skipped : undefined }, 200, origin);
}

async function handleUploadFile(env, request, origin) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data' }, 400, origin);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return json({ error: 'No file field in form data' }, 400, origin);
  }

  const filename = file.name || 'upload';
  const mimeType = file.type || 'application/octet-stream';
  const isImage = mimeType.startsWith('image/');
  const resource = isImage ? 'IMAGE' : 'FILE';

  // Read bytes first — needed for fileSize param and S3 upload
  const fileBytes = await file.arrayBuffer();

  // Step 1: Request staged upload target from Shopify
  const stagedQuery = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }
  `;
  const stagedData = await shopifyGraphQL(env, stagedQuery, {
    input: [{
      resource,
      filename,
      mimeType,
      httpMethod: 'POST',
      fileSize: String(fileBytes.byteLength),
    }],
  });

  const targets = stagedData?.stagedUploadsCreate?.stagedTargets;
  if (!targets?.length) {
    const errs = stagedData?.stagedUploadsCreate?.userErrors;
    throw new Error(`stagedUploadsCreate failed: ${JSON.stringify(errs)}`);
  }

  const { url: s3Url, resourceUrl, parameters } = targets[0];

  // Step 2: Upload to S3 (file must be last)
  const s3Form = new FormData();
  for (const param of parameters) {
    s3Form.append(param.name, param.value);
  }
  s3Form.append('file', new Blob([fileBytes], { type: mimeType }), filename);

  const s3Res = await fetch(s3Url, { method: 'POST', body: s3Form });
  if (!s3Res.ok) {
    const text = await s3Res.text();
    throw new Error(`S3 upload failed ${s3Res.status}: ${text.slice(0, 200)}`);
  }

  // Step 3: Register with Shopify fileCreate
  const createQuery = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          ... on MediaImage { id image { url } status }
          ... on GenericFile { id url status }
        }
        userErrors { field message }
      }
    }
  `;
  const createData = await shopifyGraphQL(env, createQuery, {
    files: [{ originalSource: resourceUrl, contentType: isImage ? 'IMAGE' : 'FILE' }],
  });

  const files = createData?.fileCreate?.files;
  if (!files?.length) {
    const errs = createData?.fileCreate?.userErrors;
    throw new Error(`fileCreate failed: ${JSON.stringify(errs)}`);
  }

  const fileId = files[0].id;

  // Step 4: Poll until Shopify has processed the file and returned a permanent CDN URL.
  // fileCreate returns immediately with a staged URL; the real cdn.shopify.com URL
  // is only available once status === READY.
  const pollQuery = `
    query getFile($id: ID!) {
      node(id: $id) {
        ... on MediaImage { id image { url } status }
        ... on GenericFile { id url status }
      }
    }
  `;

  let cdnUrl = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const pollData = await shopifyGraphQL(env, pollQuery, { id: fileId });
      const node = pollData?.node;
      const url = node?.image?.url || node?.url || null;
      if (node?.status === 'READY' && url?.startsWith('https://cdn.shopify.com')) {
        cdnUrl = url;
        break;
      }
    } catch {
      // continue polling
    }
  }

  return json({ url: cdnUrl || resourceUrl }, 200, origin);
}

// ─── Main fetch handler ───────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
    // parts[0] = segment 0, parts[1] = segment 1, etc.
    // /labels           → ['labels']
    // /labels/123       → ['labels', '123']
    // /files/upload     → ['files', 'upload']

    try {
      if (parts[0] === 'labels') {
        if (parts.length === 1 && request.method === 'GET') {
          return await handleGetLabels(env, origin);
        }
        if (parts.length === 2 && parts[1]) {
          const productId = parts[1];
          if (request.method === 'GET') {
            return await handleGetLabel(env, productId, origin);
          }
          if (request.method === 'PUT') {
            const body = await request.json();
            return await handlePutLabel(env, productId, body, origin);
          }
        }
      }

      if (parts[0] === 'files' && parts[1] === 'upload' && request.method === 'POST') {
        return await handleUploadFile(env, request, origin);
      }

      // Debug: list all collection handles so you can identify the right one
      if (parts[0] === 'debug' && parts[1] === 'collections') {
        const [custom, smart] = await Promise.all([
          shopifyRest(env, 'custom_collections.json?fields=id,handle,title&limit=250').then(r => r.custom_collections || []).catch(() => []),
          shopifyRest(env, 'smart_collections.json?fields=id,handle,title&limit=250').then(r => r.smart_collections || []).catch(() => []),
        ]);
        return json({ custom_collections: custom, smart_collections: smart }, 200, origin);
      }

      // Debug: show resolved env vars (token shown as prefix only)
      if (parts[0] === 'debug' && parts[1] === 'env') {
        return json({
          SHOPIFY_STORE_DOMAIN: env.SHOPIFY_STORE_DOMAIN || '(not set)',
          SHOPIFY_API_VERSION: env.SHOPIFY_API_VERSION || '(not set)',
          SHOPIFY_TOKEN_PREFIX: env.SHOPIFY_ACCESS_TOKEN ? env.SHOPIFY_ACCESS_TOKEN.slice(0, 10) + '…' : '(not set)',
          COLLECTION_ID: env.COLLECTION_ID || '(not set)',
          test_url: `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/products.json?limit=1`,
        }, 200, origin);
      }

      return json({ error: 'Not found' }, 404, origin);
    } catch (err) {
      console.error(err);
      return json({ error: err.message }, 500, origin);
    }
  },
};
