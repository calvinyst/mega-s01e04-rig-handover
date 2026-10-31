import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type RunEntry = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

function validNight(night: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return false;
  const time = Date.parse(`${night}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === night;
}

function validTimestamp(at: string): boolean {
  // Require an explicit zone so server locale cannot change the ordering.
  return /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(at)
    && validNight(at.slice(0, 10)) && Number.isFinite(Date.parse(at));
}

function isRunEntry(value: unknown): value is RunEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.at === 'string' && validTimestamp(entry.at)
    && typeof entry.job === 'string' && entry.job.trim().length > 0
    && (entry.status === 'ok' || entry.status === 'retry' || entry.status === 'fail')
    && (typeof entry.owner === 'string' || entry.owner === null)
    && (entry.error === undefined || typeof entry.error === 'string');
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!validNight(night)) return null;
  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const entries: RunEntry[] = [];
  let badLineCount = 0;
  const lines = contents === '' ? [] : contents.split(/\r?\n/);
  // A terminal newline ends the preceding line; it does not add a blank line.
  if (contents.endsWith('\n')) lines.pop();
  for (const line of lines) {
    try {
      const value: unknown = JSON.parse(line);
      if (isRunEntry(value)) entries.push(value);
      else badLineCount++;
    } catch {
      badLineCount++;
    }
  }

  // Stable sorting keeps file order for equal instants. Preserve strings for display.
  entries.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  const jobs = new Map<string, DigestRow>();
  for (const entry of entries) {
    let row = jobs.get(entry.job);
    if (!row) {
      row = {
        job: entry.job, owner: entry.owner, runs: 0, retries: 0, failures: 0,
        lastStatus: entry.status, lastError: null, firstAt: entry.at, lastAt: entry.at,
      };
      jobs.set(entry.job, row);
    }
    row.runs++;
    if (entry.status === 'retry') row.retries++;
    if (entry.status === 'fail') row.failures++;
    row.owner = entry.owner;
    row.lastStatus = entry.status;
    if (entry.error !== undefined) row.lastError = entry.error;
    row.lastAt = entry.at;
  }

  const rows = [...jobs.values()].sort((left, right) =>
    left.job < right.job ? -1 : left.job > right.job ? 1 : 0);
  return { rows, badLineCount };
};
