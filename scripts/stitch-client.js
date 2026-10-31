import fs from 'fs';

const STITCH_KEY = process.env.STITCH_API_KEY;
const STITCH_URL = `https://stitch.googleapis.com/mcp?key=${STITCH_KEY || ''}`;

let reqId = 1;

export async function callStitch(method, params = {}) {
  if (!STITCH_KEY) {
    throw new Error('STITCH_API_KEY environment variable is required');
  }

  const payload = {
    jsonrpc: '2.0',
    id: reqId++,
    method,
    params,
  };

  const res = await fetch(STITCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': STITCH_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stitch HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Stitch Error ${data.error.code}: ${data.error.message}`);
  }

  return data.result;
}

export async function listProjects() {
  return await callStitch('tools/call', {
    name: 'list_projects',
    arguments: {},
  });
}

export async function createProject(title) {
  return await callStitch('tools/call', {
    name: 'create_project',
    arguments: { title },
  });
}

export async function generateScreen(projectId, prompt, options = {}) {
  return await callStitch('tools/call', {
    name: 'generate_screen_from_text',
    arguments: {
      projectId,
      prompt,
      deviceType: options.deviceType || 'MOBILE',
    },
  });
}

export async function downloadFile(name) {
  return await callStitch('tools/call', {
    name: 'download_file',
    arguments: { name },
  });
}
