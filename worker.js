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
  const url = `https://${env.SHOPIFY_STORE}/admin/api/${env.SHOPIFY_API_VERSION}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': env.SHOPIFY_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'TNC-Label-Editor/1.0',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify REST ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function shopifyGraphQL(env, query, variables = {}) {
  const url = `https://${env.SHOPIFY_STORE}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': env.SHOPIFY_TOKEN,
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

function metafieldsToMap(metafields = []) {
  const map = {};
  for (const m of metafields) {
    map[m.key] = m.value;
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
        .then(r => ({ id: p.id, metafields: metafieldsToMap(r.metafields) }))
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
    metafields: metafieldsToMap(metafieldData.metafields || []),
  }, 200, origin);
}

async function handlePutLabel(env, productId, body, origin) {
  // body.metafields = [{ key, value, type, namespace }]
  const { metafields: incoming = [] } = body;

  // Fetch existing metafields to determine IDs for update vs create
  const existing = await shopifyRest(
    env,
    `products/${productId}/metafields.json?namespace=custom&limit=250`,
  );
  const existingByKey = Object.fromEntries(
    (existing.metafields || []).map(m => [m.key, m]),
  );

  // Upsert each incoming metafield
  const ops = incoming.map(async (mf) => {
    const ex = existingByKey[mf.key];
    if (ex) {
      // Update existing by ID
      await shopifyRest(env, `products/${productId}/metafields/${ex.id}.json`, {
        method: 'PUT',
        body: JSON.stringify({ metafield: { id: ex.id, value: mf.value, type: mf.type || ex.type } }),
      });
    } else {
      // Create new
      await shopifyRest(env, `products/${productId}/metafields.json`, {
        method: 'POST',
        body: JSON.stringify({
          metafield: {
            namespace: mf.namespace || 'custom',
            key: mf.key,
            value: mf.value,
            type: mf.type || 'single_line_text_field',
          },
        }),
      });
    }
  });

  await Promise.all(ops);
  return json({ ok: true }, 200, origin);
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
    }],
  });

  const targets = stagedData?.stagedUploadsCreate?.stagedTargets;
  if (!targets?.length) {
    const errs = stagedData?.stagedUploadsCreate?.userErrors;
    throw new Error(`stagedUploadsCreate failed: ${JSON.stringify(errs)}`);
  }

  const { url: s3Url, resourceUrl, parameters } = targets[0];

  // Step 2: Upload to S3
  const s3Form = new FormData();
  for (const param of parameters) {
    s3Form.append(param.name, param.value);
  }
  // File MUST be last in S3 multipart upload
  const fileBytes = await file.arrayBuffer();
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
          ... on MediaImage { id image { url } }
          ... on GenericFile { id url }
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

  const created = files[0];
  const cdnUrl = created.image?.url || created.url || resourceUrl;

  return json({ url: cdnUrl }, 200, origin);
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

      return json({ error: 'Not found' }, 404, origin);
    } catch (err) {
      console.error(err);
      return json({ error: err.message }, 500, origin);
    }
  },
};
