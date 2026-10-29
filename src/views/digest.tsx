import type { DigestRow, NightDigest } from '../digest/types.js';

function DigestRowView({ row }: { row: DigestRow }) {
  const retryWarning = row.retries >= 3;
  const failureWarning = row.failures > 0;

  return (
    <tr>
      <td>{row.job}</td>
      <td>{row.owner ?? '—'}</td>
      <td>{row.runs}</td>
      <td class={retryWarning ? 'warn' : undefined}>{row.retries}</td>
      <td class={failureWarning ? 'warn' : undefined}>{row.failures}</td>
      <td class={failureWarning ? 'warn' : undefined}>{row.lastStatus}</td>
      <td>{row.lastError ?? '—'}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {digest.badLines > 0 && <p class="warn">{digest.badLines} malformed {digest.badLines === 1 ? 'line' : 'lines'} in run log</p>}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>failures</th>
              <th>last status</th><th>last error</th><th>first at</th><th>last at</th>
            </tr>
          </thead>
          <tbody>{digest.rows.map((row) => <DigestRowView row={row} />)}</tbody>
        </table>
      )}
    </>
  );
}
