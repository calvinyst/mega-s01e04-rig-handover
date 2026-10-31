import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  let runsDir: string;
  const night = '2026-10-28';
  const entry = { at: '2026-10-29T01:00:00+01:00', job: 'job', status: 'ok', owner: null };

  beforeEach(() => { runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-reader-')); });
  afterEach(() => { rmSync(runsDir, { recursive: true, force: true }); });

  function writeLines(lines: unknown[]) {
    writeFileSync(join(runsDir, `${night}.jsonl`), lines.map((line) => JSON.stringify(line)).join('\n'));
  }

  it('summarizes the real night into five ordered jobs and counts its one bad line', () => {
    const result = readNight(fileURLToPath(new URL('../runs/', import.meta.url)), night);
    expect(result?.badLineCount).toBe(1);
    expect(result?.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(result?.rows[0]).toEqual({
      job: 'digest/render', owner: null, runs: 1, retries: 0, failures: 0,
      lastStatus: 'ok', lastError: null,
      firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00',
    });
    expect(result?.rows[1]).toMatchObject({ runs: 4, retries: 3, failures: 0, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(result?.rows[2]).toMatchObject({ runs: 8, retries: 1, failures: 0, lastStatus: 'ok', lastError: 'lock held' });
    expect(result?.rows[3]).toMatchObject({ runs: 1, retries: 0, failures: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(result?.rows[4]).toMatchObject({ runs: 1, retries: 0, failures: 0, lastStatus: 'ok' });
  });

  it('distinguishes missing and empty nights', () => {
    expect(readNight(runsDir, night)).toBeNull();
    writeFileSync(join(runsDir, `${night}.jsonl`), '');
    expect(readNight(runsDir, night)).toEqual({ rows: [], badLineCount: 0 });
  });

  it.each(['\n', '\r\n'])('counts blank logical lines with %j delimiters, excluding the terminal split element', (newline) => {
    writeFileSync(join(runsDir, `${night}.jsonl`), `${newline}  ${newline}${JSON.stringify(entry)}${newline}`);
    expect(readNight(runsDir, night)).toMatchObject({ rows: [{ job: 'job' }], badLineCount: 2 });
    writeFileSync(join(runsDir, `${night}.jsonl`), newline);
    expect(readNight(runsDir, night)).toEqual({ rows: [], badLineCount: 1 });
  });

  it('counts malformed JSON and schema failures while retaining valid entries', () => {
    const invalid = [null, [], 7, {}, { ...entry, owner: undefined }, { ...entry, owner: 1 },
      { ...entry, job: ' ' }, { ...entry, status: 'pending' }, { ...entry, error: null },
      { ...entry, at: 'yesterday' }, { ...entry, at: '2026-02-30T01:00:00Z' },
      { ...entry, at: '2026-10-29T01:00:00' }];
    writeFileSync(join(runsDir, `${night}.jsonl`),
      [...invalid.map((value) => JSON.stringify(value)), '{broken', JSON.stringify(entry)].join('\n'));
    expect(readNight(runsDir, night)).toMatchObject({ rows: [{ owner: null, runs: 1 }], badLineCount: invalid.length + 1 });
  });

  it('orders instants across offsets, retains past failures and errors, and uses the latest owner', () => {
    writeLines([
      { ...entry, at: '2026-10-29T00:30:00Z', owner: null },
      { ...entry, at: '2026-10-29T01:00:00+02:00', status: 'retry', error: 'first', owner: 'before' },
      { ...entry, at: '2026-10-28T20:00:00-04:00', status: 'fail', error: 'latest', owner: 'middle' },
    ]);
    expect(readNight(runsDir, night)?.rows).toEqual([{
      job: 'job', owner: null, runs: 3, retries: 1, failures: 1,
      lastStatus: 'ok', lastError: 'latest',
      firstAt: '2026-10-29T01:00:00+02:00', lastAt: '2026-10-29T00:30:00Z',
    }]);
  });

  it('uses file order for entries with equal instants', () => {
    writeLines([entry, { ...entry, status: 'fail', error: 'last', owner: 'after' }]);
    expect(readNight(runsDir, night)?.rows[0]).toMatchObject({ owner: 'after', lastStatus: 'fail', lastError: 'last' });
  });

  it.each(['../2026-10-28', '..\\2026-10-28', '2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', ''])
    ('rejects invalid or path-like night %j', (invalidNight) => {
      expect(readNight(runsDir, invalidNight)).toBeNull();
    });

  it('accepts a leap day', () => {
    writeFileSync(join(runsDir, '2024-02-29.jsonl'), '');
    expect(readNight(runsDir, '2024-02-29')).toEqual({ rows: [], badLineCount: 0 });
  });
});
