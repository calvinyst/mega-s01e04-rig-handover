export type RunStatus = 'ok' | 'retry' | 'fail'

export interface DigestRow {
  job: string
  /** Owner on the chronologically latest entry; null remains missing. */
  owner: string | null
  /** All valid entries for this job, including retries and failures. */
  runs: number
  retries: number
  /** Number of fail entries, even if the job later recovers. */
  failures: number
  lastStatus: RunStatus
  /** Most recent error supplied by any entry, or null when none exists. */
  lastError: string | null
  /** Original timestamp strings, including their logged offsets. */
  firstAt: string
  lastAt: string
}

export interface NightDigest {
  /** One row per job, sorted ascending by job. */
  rows: DigestRow[]
  badLineCount: number
}

/**
 * Implemented by readNight in ./reader.js. Missing files and invalid YYYY-MM-DD
 * nights return null. Empty files return { rows: [], badLineCount: 0 }.
 * Malformed JSON or invalid entry schemas count as bad lines without throwing.
 */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null
