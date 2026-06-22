const WORKER_URL = 'https://tnc-new-label-editor-james.james-d2d.workers.dev';

export async function fetchLabels() {
  const res = await fetch(`${WORKER_URL}/labels`);
  if (!res.ok) throw new Error('Failed to fetch labels');
  return res.json();
}

export async function fetchLabel(id) {
  const res = await fetch(`${WORKER_URL}/labels/${id}`);
  if (!res.ok) throw new Error('Failed to fetch label');
  return res.json();
}

export async function saveLabel(id, metafields) {
  const res = await fetch(`${WORKER_URL}/labels/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metafields }),
  });
  if (!res.ok) throw new Error('Failed to save label');
  return res.json();
}

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${WORKER_URL}/files/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload file');
  return res.json(); // { url: '...' }
}
