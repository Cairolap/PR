import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

function databaseStub() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const execution = {
        async all() { return { results: [] }; },
        async run() { return { meta: { changes: 1, last_row_id: 9 } }; }
      };
      return {
        bind(...values) {
          calls.push({ sql, values });
          return execution;
        },
        all() {
          calls.push({ sql, values: [] });
          return execution.all();
        }
      };
    }
  };
}

test('archives a record instead of deleting it', async () => {
  const DB = databaseStub();
  const response = await worker.fetch(new Request('https://example.test/api/records/9/archive', { method: 'POST' }), { DB });
  assert.equal(response.status, 200);
  assert.match(DB.calls[0].sql, /SET archived_at = \?/);
  assert.doesNotMatch(DB.calls[0].sql, /DELETE FROM/i);
});

test('does not expose a DELETE endpoint', async () => {
  const DB = databaseStub();
  const response = await worker.fetch(new Request('https://example.test/api/records/9', { method: 'DELETE' }), { DB });
  assert.equal(response.status, 404);
  assert.equal(DB.calls.length, 0);
});

test('requests the archive list separately from the primary list', async () => {
  const DB = databaseStub();
  const response = await worker.fetch(new Request('https://example.test/api/records?archived=true'), { DB });
  assert.equal(response.status, 200);
  assert.match(DB.calls[0].sql, /archived_at IS NOT NULL/);
});
