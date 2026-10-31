import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/reader.js';
import type { DigestRow } from './digest/types.js';

export type NightSummary = {
  night: string;
  ok: number | null;
  retry: number | null;
  fail: number | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  nightSummaries: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    nightSummaries: nights.map((night) => {
      try {
        const digest = readNight(config.runsDir, night);
        if (!digest) return { night, ok: null, retry: null, fail: null };

        const retry = digest.rows.reduce((total: number, row: DigestRow) => total + row.retries, 0);
        const fail = digest.rows.reduce((total: number, row: DigestRow) => total + row.failures, 0);
        const runs = digest.rows.reduce((total: number, row: DigestRow) => total + row.runs, 0);
        return { night, ok: runs - retry - fail, retry, fail };
      } catch {
        // A night can disappear or become unreadable between listing and reading.
        return { night, ok: null, retry: null, fail: null };
      }
    }),
  };
}
