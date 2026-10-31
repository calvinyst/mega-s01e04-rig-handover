import type { NightDigest } from '../digest/types.js';

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  const rows = digest.rows;

  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">bad lines: {digest.badLineCount}</p>
      {rows.length === 0 && <p class="mute">nothing ran</p>}
      <table>
        <thead>
          <tr>
            <th>job</th>
            <th>owner</th>
            <th>runs</th>
            <th>retries</th>
            <th>last status</th>
            <th>last error</th>
            <th>first / last time</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colspan={7}>—</td></tr>
          ) : (
            rows.map((row) => (
              <tr class={row.retries >= 3 || row.failures > 0 ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt} / {row.lastAt}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
