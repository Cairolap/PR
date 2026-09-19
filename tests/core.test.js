import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord, validateRecord, ALLOWED_AREAS } from '../src/core.js';

const validRecord = {
  orderNumber: 'ORDER-001',
  description: 'น้ำมันหล่อลื่นสำหรับปั๊มไฮดรอลิก',
  quantity: '2.5',
  price: '1,250.75',
  requestRef: 'PR-2026-004',
  poNumber: 'PO-2026-019',
  deliveryDate: '2026-10-15',
  area: 'CC Line 1',
  createdDate: '2026-09-18'
};

test('normalizes a form record and keeps money as satang', () => {
  const record = normalizeRecord(validRecord);
  assert.equal(record.orderNumber, 'ORDER-001');
  assert.equal(record.quantity, 2.5);
  assert.equal(record.priceSatang, 125075);
  assert.equal(record.createdDate, '2026-09-18');
  assert.equal(record.area, 'CC Line 1');
});

test('allows blank price (optional price defaults to 0 satang)', () => {
  const noPrice = { ...validRecord, price: '' };
  const errors = validateRecord(noPrice);
  assert.equal(errors.price, undefined);
  const normalized = normalizeRecord(noPrice);
  assert.equal(normalized.priceSatang, 0);

  const nullPrice = { ...validRecord, price: null };
  assert.equal(validateRecord(nullPrice).price, undefined);
  assert.equal(normalizeRecord(nullPrice).priceSatang, 0);
});

test('rejects a record without an order, description, positive quantity, or valid date', () => {
  const errors = validateRecord({ ...validRecord, orderNumber: '', description: '', quantity: '0', deliveryDate: '18/09/2026' });
  assert.match(errors.orderNumber, /ORDER/);
  assert.match(errors.description, /รายละเอียด/);
  assert.match(errors.quantity, /มากกว่า 0/);
  assert.match(errors.deliveryDate, /YYYY-MM-DD/);
});

test('normalizes blank optional reference fields to null', () => {
  const record = normalizeRecord({ ...validRecord, requestRef: '   ', poNumber: '', area: '' });
  assert.equal(record.requestRef, null);
  assert.equal(record.poNumber, null);
  assert.equal(record.area, null);
});

test('validates area against allowed list', () => {
  const valid = validateRecord({ ...validRecord, area: 'PP 28IR' });
  assert.equal(valid.area, undefined);

  const invalid = validateRecord({ ...validRecord, area: 'UNKNOWN_AREA' });
  assert.match(invalid.area, /พื้นที่ไม่ถูกต้อง/);
});
