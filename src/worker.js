import { normalizeRecord, validateRecord, ALLOWED_AREAS } from './core.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function recordId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function bodyJson(request) {
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error('ส่งข้อมูลไม่ถูกต้อง'), { status: 400 });
  }
}

async function listRecords(database, archived) {
  const result = await database.prepare(`
    SELECT id, order_number AS orderNumber, description, quantity,
      price_satang AS priceSatang, request_ref AS requestRef, po_number AS poNumber,
      delivery_date AS deliveryDate, area, created_date AS createdDate, updated_at AS updatedAt,
      archived_at AS archivedAt
    FROM requisitions
    WHERE ${archived ? 'archived_at IS NOT NULL' : 'archived_at IS NULL'}
    ORDER BY created_date DESC, id DESC
  `).all();
  return result.results ?? [];
}

async function createRecord(request, database) {
  const record = normalizeRecord(await bodyJson(request));
  const updatedAt = new Date().toISOString();
  const result = await database.prepare(`
    INSERT INTO requisitions (order_number, description, quantity, price_satang, request_ref, po_number, delivery_date, area, created_date, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.orderNumber, record.description, record.quantity, record.priceSatang,
    record.requestRef, record.poNumber, record.deliveryDate, record.area, record.createdDate, updatedAt
  ).run();
  return json({ ok: true, id: result.meta.last_row_id });
}

async function updateRecord(request, database, id) {
  const record = normalizeRecord(await bodyJson(request));
  const result = await database.prepare(`
    UPDATE requisitions
    SET order_number = ?, description = ?, quantity = ?, price_satang = ?, request_ref = ?,
      po_number = ?, delivery_date = ?, area = ?, created_date = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    record.orderNumber, record.description, record.quantity, record.priceSatang,
    record.requestRef, record.poNumber, record.deliveryDate, record.area, record.createdDate,
    new Date().toISOString(), id
  ).run();
  if (!result.meta.changes) return json({ error: 'ไม่พบรายการที่ต้องการแก้ไข' }, 404);
  return json({ ok: true });
}

async function archiveRecord(database, id) {
  const result = await database.prepare('UPDATE requisitions SET archived_at = ? WHERE id = ? AND archived_at IS NULL')
    .bind(new Date().toISOString(), id).run();
  if (!result.meta.changes) return json({ error: 'ไม่พบรายการที่ต้องการจัดเก็บ' }, 404);
  return json({ ok: true });
}

async function restoreRecord(database, id) {
  const result = await database.prepare('UPDATE requisitions SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL')
    .bind(id).run();
  if (!result.meta.changes) return json({ error: 'ไม่พบรายการที่ต้องการนำกลับ' }, 404);
  return json({ ok: true });
}

// Bulk Actions: Update area or archive for multiple IDs
async function handleBatch(request, database) {
  const body = await bodyJson(request);
  const action = body.action;
  const now = new Date().toISOString();

  if (action === 'batchUpdate') {
    const updates = Array.isArray(body.updates) ? body.updates : [];
    if (!updates.length) return json({ error: 'ไม่พบข้อมูลที่ต้องการแก้ไข' }, 400);

    const stmts = [];
    for (const item of updates) {
      const id = Number(item.id);
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      const normalized = normalizeRecord(item);
      const errors = validateRecord(normalized);
      if (Object.keys(errors).length > 0) {
        return json({ error: `รายการ ORDER "${item.orderNumber || id}" ข้อมูลไม่ถูกต้อง: ${Object.values(errors).join(', ')}`, fields: errors }, 400);
      }
      stmts.push(
        database.prepare(`
          UPDATE requisitions
          SET created_date = ?, order_number = ?, description = ?, quantity = ?, price_satang = ?,
              request_ref = ?, po_number = ?, delivery_date = ?, area = ?, updated_at = ?
          WHERE id = ?
        `).bind(
          normalized.createdDate,
          normalized.orderNumber,
          normalized.description,
          normalized.quantity,
          normalized.priceSatang,
          normalized.requestRef,
          normalized.poNumber,
          normalized.deliveryDate,
          normalized.area,
          now,
          id
        )
      );
    }
    if (stmts.length) {
      await database.batch(stmts);
    }
    return json({ ok: true, count: stmts.length });
  }

  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0) : [];
  if (!ids.length) return json({ error: 'ไม่พบรหัสรายการที่เลือก' }, 400);

  if (action === 'archive') {
    const placeholders = ids.map(() => '?').join(',');
    await database.prepare(`UPDATE requisitions SET archived_at = ? WHERE id IN (${placeholders}) AND archived_at IS NULL`)
      .bind(now, ...ids).run();
    return json({ ok: true, count: ids.length });
  }

  if (action === 'restore') {
    const placeholders = ids.map(() => '?').join(',');
    await database.prepare(`UPDATE requisitions SET archived_at = NULL WHERE id IN (${placeholders}) AND archived_at IS NOT NULL`)
      .bind(...ids).run();
    return json({ ok: true, count: ids.length });
  }

  if (action === 'updateArea') {
    const area = body.area ? String(body.area).trim() : null;
    if (area && !ALLOWED_AREAS.includes(area)) {
      return json({ error: 'พื้นที่ไม่ถูกต้องตามรายการที่กำหนด' }, 400);
    }
    const placeholders = ids.map(() => '?').join(',');
    await database.prepare(`UPDATE requisitions SET area = ?, updated_at = ? WHERE id IN (${placeholders})`)
      .bind(area, now, ...ids).run();
    return json({ ok: true, count: ids.length });
  }

  return json({ error: 'ไม่รองรับการกระทำนี้' }, 400);
}

async function handleApi(request, env, url) {
  const path = url.pathname;
  if (path === '/api/records' && request.method === 'GET') {
    return json({ records: await listRecords(env.DB, url.searchParams.get('archived') === 'true') });
  }
  if (path === '/api/records' && request.method === 'POST') return createRecord(request, env.DB);

  if (path === '/api/records/batch' && request.method === 'POST') {
    return handleBatch(request, env.DB);
  }

  const actionMatch = /^\/api\/records\/(\d+)\/(archive|restore)$/.exec(path);
  if (actionMatch && request.method === 'POST') {
    const id = recordId(actionMatch[1]);
    if (!id) return json({ error: 'รหัสรายการไม่ถูกต้อง' }, 400);
    return actionMatch[2] === 'archive' ? archiveRecord(env.DB, id) : restoreRecord(env.DB, id);
  }

  const match = /^\/api\/records\/(\d+)$/.exec(path);
  if (match) {
    const id = recordId(match[1]);
    if (!id) return json({ error: 'รหัสรายการไม่ถูกต้อง' }, 400);
    if (request.method === 'PUT') return updateRecord(request, env.DB, id);
  }
  return json({ error: 'ไม่พบ API นี้' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, PUT, OPTIONS' } });
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        if (error.fields) return json({ error: error.message, fields: error.fields }, 400);
        const status = error.status ?? 500;
        console.error(error);
        return json({ error: status === 500 ? 'ระบบบันทึกข้อมูลขัดข้อง กรุณาลองใหม่' : error.message }, status);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
