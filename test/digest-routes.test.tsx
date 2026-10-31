import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const night = '2026-10-30';
const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: '',
};

let runsDir: string;

function addNight(contents: string, forNight = night) {
  writeFileSync(join(runsDir, `${forNight}.jsonl`), contents, 'utf8');
}

function app() {
  return createApp({ ...config, runsDir });
}

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('returns the same sorted digest data as JSON, including null owners and offsets', async () => {
    addNight(
      [
        JSON.stringify({ at: '2026-10-30T23:55:00-04:00', job: 'Zebra', status: 'retry', owner: 'Sam' }),
        JSON.stringify({ at: '2026-10-31T00:01:00-04:00', job: 'Zebra', status: 'retry', owner: 'Sam' }),
        JSON.stringify({ at: '2026-10-31T00:03:00-04:00', job: 'Zebra', status: 'retry', owner: 'Sam' }),
        JSON.stringify({ at: '2026-10-31T00:05:00-04:00', job: 'Zebra', status: 'retry', owner: 'Sam' }),
        JSON.stringify({
          at: '2026-10-31T00:07:00-04:00',
          job: 'Zebra',
          status: 'fail',
          owner: 'Sam',
          error: '<img src=x onerror="x"> & breakfast',
        }),
        JSON.stringify({ at: '2026-10-30T23:59:00+08:00', job: 'beta', status: 'fail', owner: 'Lee' }),
        JSON.stringify({ at: '2026-10-30T22:30:00+08:00', job: '_punct', status: 'ok', owner: 'Pat' }),
        JSON.stringify({ at: '2026-10-30T23:58:00+08:00', job: 'alpha', status: 'ok', owner: null }),
        '{not json',
      ].join('\n'),
    );

    const response = await app().request(`/api/digest/${night}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      rows: [
        {
          job: 'Zebra',
          owner: 'Sam',
          runs: 5,
          retries: 4,
          failures: 1,
          lastStatus: 'fail',
          lastError: '<img src=x onerror="x"> & breakfast',
          firstAt: '2026-10-30T23:55:00-04:00',
          lastAt: '2026-10-31T00:07:00-04:00',
        },
        {
          job: '_punct',
          owner: 'Pat',
          runs: 1,
          retries: 0,
          failures: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-30T22:30:00+08:00',
          lastAt: '2026-10-30T22:30:00+08:00',
        },
        {
          job: 'alpha',
          owner: null,
          runs: 1,
          retries: 0,
          failures: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-30T23:58:00+08:00',
          lastAt: '2026-10-30T23:58:00+08:00',
        },
        {
          job: 'beta',
          owner: 'Lee',
          runs: 1,
          retries: 0,
          failures: 1,
          lastStatus: 'fail',
          lastError: null,
          firstAt: '2026-10-30T23:59:00+08:00',
          lastAt: '2026-10-30T23:59:00+08:00',
        },
      ],
      badLineCount: 1,
    });
  });

  it('renders one escaped table with the lane banner, null owner, retries, failures, and original offsets', async () => {
    addNight(
      [
        JSON.stringify({ at: '2026-10-30T23:55:00-04:00', job: 'Zebra', status: 'retry', owner: 'Sam' }),
        JSON.stringify({
          at: '2026-10-31T00:01:00-04:00',
          job: 'Zebra',
          status: 'retry',
          owner: 'Sam',
          error: '<img src=x onerror="x"> & breakfast',
        }),
        JSON.stringify({ at: '2026-10-31T00:03:00-04:00', job: 'Zebra', status: 'retry', owner: 'Sam' }),
        JSON.stringify({ at: '2026-10-31T00:05:00-04:00', job: 'Zebra', status: 'retry', owner: 'Sam' }),
        JSON.stringify({ at: '2026-10-31T00:07:00-04:00', job: 'Zebra', status: 'ok', owner: 'Sam' }),
        JSON.stringify({ at: '2026-10-30T23:59:00+08:00', job: 'beta', status: 'fail', owner: 'Lee' }),
        JSON.stringify({ at: '2026-10-30T22:30:00+08:00', job: '_punct', status: 'ok', owner: 'Pat' }),
        JSON.stringify({ at: '2026-10-30T23:58:00+08:00', job: 'alpha', status: 'ok', owner: null }),
      ].join('\n'),
    );
    const previousMarker = process.env.LANE_MARKER;
    process.env.LANE_MARKER = 'ROUTE-TEST-MARKER';

    try {
      const response = await app().request(`/digest/${night}`);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('ROUTE-TEST-MARKER');
      expect(html.match(/<table\b/g)).toHaveLength(1);
      expect(html.indexOf('Zebra')).toBeLessThan(html.indexOf('_punct'));
      expect(html.indexOf('_punct')).toBeLessThan(html.indexOf('alpha'));
      expect(html).toContain('—');
      expect(html).toContain('2026-10-30T23:58:00+08:00');
      expect(html).toContain('2026-10-30T23:55:00-04:00');
      expect(html).toContain('2026-10-31T00:07:00-04:00');
      expect(html).toContain('<tr class="warn"><td>Zebra</td><td>Sam</td><td>5</td><td>4</td><td>ok</td>');
      expect(html).toContain('fail');
      expect(html).toContain('<tr class="warn"><td>beta</td>');
      expect(html).toContain('&lt;img');
      expect(html).toContain('&amp; breakfast');
      expect(html).not.toContain('<img src=x');
    } finally {
      if (previousMarker === undefined) delete process.env.LANE_MARKER;
      else process.env.LANE_MARKER = previousMarker;
    }
  });

  it('returns 404 for a missing file and an invalid night on both routes', async () => {
    for (const path of [`/digest/${night}`, `/api/digest/${night}`, '/digest/nope', '/api/digest/nope']) {
      const response = await app().request(path);
      expect(response.status, path).toBe(404);
    }
  });

  it('renders an empty file and returns an empty JSON digest', async () => {
    addNight('');

    const page = await app().request(`/digest/${night}`);
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('nothing ran');

    const json = await app().request(`/api/digest/${night}`);
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual({ rows: [], badLineCount: 0 });
  });

  it('keeps a malformed line as a bad-line count without failing either route', async () => {
    addNight('{bad json\n');

    const page = await app().request(`/digest/${night}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('bad lines: 1');

    const json = await app().request(`/api/digest/${night}`);
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual({ rows: [], badLineCount: 1 });
  });
});
