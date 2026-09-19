import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('hidden panels always override component display styles', async () => {
  const css = await readFile(new URL('public/styles.css', root), 'utf8');
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});

test('the connection badge reflects loading, ready, and error states', async () => {
  const app = await readFile(new URL('public/app.js', root), 'utf8');
  assert.match(app, /setConnectionStatus\('loading', 'กำลังโหลด'\)/);
  assert.match(app, /setConnectionStatus\('ready', 'พร้อมใช้งาน'\)/);
  assert.match(app, /setConnectionStatus\('error', 'เชื่อมต่อไม่ได้'\)/);
});

test('desktop hides mobile cards and the mobile breakpoint reveals them', async () => {
  const css = await readFile(new URL('public/styles.css', root), 'utf8');
  assert.match(css, /\.record-cards\s*\{\s*display:\s*none;/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.record-cards\s*\{\s*display:\s*flex;/);
});

test('clear form button is present in HTML and wired to reset form', async () => {
  const html = await readFile(new URL('public/index.html', root), 'utf8');
  assert.match(html, /id="clear-form-btn"/);
  assert.match(html, /ล้างข้อมูล/);

  const app = await readFile(new URL('public/app.js', root), 'utf8');
  assert.match(app, /\$\('clear-form-btn'\)\?\.addEventListener\('click', resetDialogForm\)/);
});

test('suppresses browser native search cancel button to prevent duplicate x icons', async () => {
  const css = await readFile(new URL('public/styles.css', root), 'utf8');
  assert.match(css, /input\[type="search"\]::-webkit-search-cancel-button/);
  assert.match(css, /appearance:\s*none;/);
});

test('sidebar collapse functionality is styled in CSS and wired in JS', async () => {
  const css = await readFile(new URL('public/styles.css', root), 'utf8');
  assert.match(css, /body\.sidebar-collapsed\s+\.app-sidebar/);
  assert.match(css, /\.sidebar-backdrop/);

  const app = await readFile(new URL('public/app.js', root), 'utf8');
  assert.match(app, /function toggleSidebar\(/);
  assert.match(app, /\$\('menu-toggle'\)\?\.addEventListener\('click',/);
});

test('supports filtering by major area groups (CC, PP, MX, PC, PR)', async () => {
  const html = await readFile(new URL('public/index.html', root), 'utf8');
  assert.match(html, /<option value="CC">กลุ่ม CC ทั้งหมด<\/option>/);
  assert.match(html, /<option value="PP">กลุ่ม PP ทั้งหมด<\/option>/);
  assert.match(html, /<option value="MX">กลุ่ม MX ทั้งหมด<\/option>/);
  assert.match(html, /<option value="PC">กลุ่ม PC ทั้งหมด<\/option>/);
  assert.match(html, /<option value="PR">กลุ่ม PR ทั้งหมด<\/option>/);

  const app = await readFile(new URL('public/app.js', root), 'utf8');
  assert.match(app, /function matchesAreaFilter\(/);
});

test('procurement pipeline status widget is present and calculated in app.js', async () => {
  const html = await readFile(new URL('public/index.html', root), 'utf8');
  assert.match(html, /id="sidebar-pipeline-widget"/);
  assert.match(html, /PR ยังไม่ได้ออก/);
  assert.match(html, /PO ยังไม่ได้ออก/);
  assert.match(html, /ยังไม่ได้รับ/);

  const css = await readFile(new URL('public/styles.css', root), 'utf8');
  assert.match(css, /\.sidebar-pipeline-widget/);
  assert.match(css, /\.pipeline-item/);

  const app = await readFile(new URL('public/app.js', root), 'utf8');
  assert.match(app, /function updatePipelineStats\(/);
  assert.match(app, /state\.pipelineFilter/);
});




