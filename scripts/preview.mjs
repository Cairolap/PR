import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const contentTypes = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8' };
let nextId = 3;
let records = [
  { id: 1, orderNumber: 'ORDER-2026-001', description: 'น้ำมันหล่อลื่นสำหรับปั๊มไฮดรอลิก', quantity: 2, priceSatang: 125075, requestRef: 'PR-2026-004', poNumber: 'PO-2026-019', deliveryDate: '2026-09-25', area: 'CC Line 1', createdDate: '2026-09-18', updatedAt: new Date().toISOString(), archivedAt: null },
  { id: 2, orderNumber: 'ORDER-2026-002', description: 'อุปกรณ์ป้องกันส่วนบุคคลสำหรับคลังสินค้า', quantity: 12, priceSatang: 8500, requestRef: 'เบิกสโตร์-078', poNumber: null, deliveryDate: '2026-10-02', area: 'PP 28IR', createdDate: '2026-09-17', updatedAt: new Date().toISOString(), archivedAt: null }
];

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
  response.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost:4173');
  const archive = url.searchParams.get('archived') === 'true';
  if (url.pathname === '/api/records' && request.method === 'GET') return send(response, 200, { records: records.filter((record) => Boolean(record.archivedAt) === archive) });
  if (url.pathname === '/api/records' && request.method === 'POST') {
    const input = await readBody(request);
    const record = { id: nextId++, ...input, quantity: Number(input.quantity), priceSatang: Math.round(Number(input.price) * 100), requestRef: input.requestRef || null, poNumber: input.poNumber || null, deliveryDate: input.deliveryDate || null, area: input.area || null, updatedAt: new Date().toISOString(), archivedAt: null };
    delete record.price;
    records.unshift(record);
    return send(response, 200, { ok: true, id: record.id });
  }
  if (url.pathname === '/api/records/batch' && request.method === 'POST') {
    const body = await readBody(request);
    const ids = (body.ids || []).map(Number);
    if (body.action === 'archive') {
      records.forEach((r) => { if (ids.includes(r.id)) r.archivedAt = new Date().toISOString(); });
      return send(response, 200, { ok: true });
    }
    if (body.action === 'restore') {
      records.forEach((r) => { if (ids.includes(r.id)) r.archivedAt = null; });
      return send(response, 200, { ok: true });
    }
    if (body.action === 'updateArea') {
      records.forEach((r) => { if (ids.includes(r.id)) r.area = body.area || null; });
      return send(response, 200, { ok: true });
    }
    return send(response, 400, { error: 'Unknown batch action' });
  }
  const match = /^\/api\/records\/(\d+)(?:\/(archive|restore))?$/.exec(url.pathname);
  if (match) {
    const record = records.find((item) => item.id === Number(match[1]));
    if (!record) return send(response, 404, { error: 'ไม่พบรายการ' });
    if (request.method === 'POST' && match[2] === 'archive') { record.archivedAt = new Date().toISOString(); return send(response, 200, { ok: true }); }
    if (request.method === 'POST' && match[2] === 'restore') { record.archivedAt = null; return send(response, 200, { ok: true }); }
    if (request.method === 'PUT') {
      const input = await readBody(request);
      Object.assign(record, input, { quantity: Number(input.quantity), priceSatang: Math.round(Number(input.price) * 100), requestRef: input.requestRef || null, poNumber: input.poNumber || null, deliveryDate: input.deliveryDate || null, area: input.area || null, updatedAt: new Date().toISOString() });
      delete record.price;
      return send(response, 200, { ok: true });
    }
  }
  const safePath = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^([.][.][\\/])+/g, '');
  try {
    const file = await readFile(join(root, safePath));
    send(response, 200, file, contentTypes[extname(safePath)] || 'application/octet-stream');
  } catch { send(response, 404, 'Not found', 'text/plain; charset=utf-8'); }
});

server.listen(4173, () => console.log('Preview: http://localhost:4173'));
