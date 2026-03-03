// ── Chorify CSV utilities ──────────────────────────────────────────────────────
// Serialises Task[] to RFC 4180 CSV and parses CSV back to typed task rows.

import type { Category, Member, Recurrence, Room, Task } from '@/types'

// ── Column spec ───────────────────────────────────────────────────────────────

export const CSV_HEADERS = [
  'id', 'title', 'category', 'recurrence',
  'room', 'assigned_to', 'next_due', 'notes',
] as const

const VALID_RECURRENCES: readonly string[] = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'biannual', 'annual', 'once']

// ── Serialisation ─────────────────────────────────────────────────────────────

function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

/**
 * Converts the household's tasks to a CSV string ready for export.
 * Rooms and members are resolved to human-readable names so the file
 * is editable in any spreadsheet app.
 */
export function tasksToCSV(tasks: Task[], rooms: Room[], members: Member[]): string {
  const lines: string[] = [CSV_HEADERS.join(',')]

  for (const task of tasks) {
    const room   = task.room_id    ? rooms.find((r) => r.id === task.room_id)       : null
    const member = task.assigned_to ? members.find((m) => m.id === task.assigned_to) : null

    const row: string[] = [
      task.id,
      task.title,
      task.category,
      task.recurrence,
      room?.name           ?? '',
      member?.display_name ?? '',
      task.next_due        ?? '',
      task.notes           ?? '',
    ]

    lines.push(row.map(escapeField).join(','))
  }

  return lines.join('\r\n')
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/** Minimal RFC 4180-compliant CSV parser. Returns rows as string arrays. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row:      string[] = []
  let field  = ''
  let inQuotes = false

  const flush  = () => { row.push(field); field = '' }
  const newRow = () => {
    flush()
    if (rows.length > 0 || row.some(Boolean)) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch   = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"')             { inQuotes = false }
      else                             { field += ch }
    } else {
      if      (ch === '"')                       { inQuotes = true }
      else if (ch === ',')                       { flush() }
      else if (ch === '\r' && next === '\n')     { i++; newRow() }
      else if (ch === '\r' || ch === '\n')       { newRow() }
      else                                       { field += ch }
    }
  }

  // flush last field / row
  flush()
  if (row.some(Boolean)) rows.push(row)

  return rows
}

// ── Typed row ─────────────────────────────────────────────────────────────────

export interface ParsedTaskRow {
  id:         string
  title:      string
  category:   Category
  recurrence: Recurrence
  room:       string   // room name (resolved to ID during import)
  assignedTo: string   // member display_name (resolved to ID during import)
  nextDue:    string   // YYYY-MM-DD or ''
  notes:      string
  errors:     string[]
}

/**
 * Parses a raw CSV string into validated ParsedTaskRow objects.
 * Fully empty rows are skipped. Rows with validation errors keep
 * the errors[] field populated so the caller can count/report them.
 * Returns an empty array if the header row doesn't contain a `title` column.
 */
export function parseTaskRows(csvText: string): ParsedTaskRow[] {
  const raw = parseCSV(csvText)
  if (raw.length < 2) return []

  const header   = raw[0].map((h) => h.trim().toLowerCase())
  const idx      = (name: string) => header.indexOf(name)

  const titleIdx      = idx('title')
  if (titleIdx === -1) return []  // can't import without title

  const idIdx         = idx('id')
  const categoryIdx   = idx('category')
  const recurrenceIdx = idx('recurrence')
  const roomIdx       = idx('room')
  const assignedIdx   = idx('assigned_to')
  const nextDueIdx    = idx('next_due')
  const notesIdx      = idx('notes')

  const get = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')

  return raw.slice(1).flatMap((row): ParsedTaskRow[] => {
    // Skip fully blank lines
    if (!row.some(Boolean)) return []

    const errors: string[] = []

    const title      = get(row, titleIdx)
    const categoryRaw  = get(row, categoryIdx)  || 'home'
    const recurrRaw    = get(row, recurrenceIdx) || 'weekly'
    const nextDue      = get(row, nextDueIdx)

    if (!title)                                            errors.push('title is required')
    if (!VALID_RECURRENCES.includes(recurrRaw))            errors.push(`invalid recurrence "${recurrRaw}"`)
    if (nextDue && !/^\d{4}-\d{2}-\d{2}$/.test(nextDue)) errors.push(`next_due must be YYYY-MM-DD, got "${nextDue}"`)

    return [{
      id:         get(row, idIdx),
      title,
      category:   categoryRaw as Category,
      recurrence: recurrRaw   as Recurrence,
      room:       get(row, roomIdx),
      assignedTo: get(row, assignedIdx),
      nextDue,
      notes:      get(row, notesIdx),
      errors,
    }]
  })
}
