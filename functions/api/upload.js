// Parse uploader name from filename: "{name}_{date}_{time}_{type}.csv"
// e.g. "SudarkO_2026-03-21_04-07_players.csv" -> "SudarkO"
// Player name may contain underscores, so match the timestamp pattern from the right
function parseUploaderName(filename) {
  const base = filename.replace(/\.csv$/i, '')
  const match = base.match(/^(.+)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_(players|timeline)$/i)
  return match ? match[1] : null
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(',').map(v => v.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = values[i] })
    return obj
  })
}

async function hashPlayers(playersText) {
  const normalized = playersText.trim().split('\n').map(l => l.trim()).sort().join('\n')
  const data = new TextEncoder().encode(normalized)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function onRequestPost(context) {
  const { env } = context
  const db = env.DB

  try {
    const json = await context.request.json()
    const { players_filename, timeline_filename, players_csv, timeline_csv } = json

    if (!players_csv || !timeline_csv) {
      return Response.json({ ok: false, error: 'Need both players_csv and timeline_csv' }, { status: 400 })
    }

    const uploaderFromPlayers = parseUploaderName(players_filename || '')
    const uploaderFromTimeline = parseUploaderName(timeline_filename || '')
    const uploader = uploaderFromPlayers || uploaderFromTimeline

    if (!uploader) {
      return Response.json({ ok: false, error: 'Cannot parse uploader name from filename' }, { status: 400 })
    }

    const playersText = players_csv
    const timelineText = timeline_csv

    const playersData = parseCSV(playersText)
    const timelineData = parseCSV(timelineText)

    if (!playersData.length || !timelineData.length) {
      return Response.json({ ok: false, error: 'CSV files are empty or malformed' }, { status: 400 })
    }

    const hash = await hashPlayers(playersText)

    // Check if this match already exists
    let match = await db.prepare('SELECT id FROM matches WHERE players_hash = ?').bind(hash).first()

    if (!match) {
      // New match — insert match + players
      const insertMatch = await db.prepare('INSERT INTO matches (players_hash) VALUES (?)').bind(hash).run()
      const matchId = insertMatch.meta.last_row_id

      const playerStmt = db.prepare('INSERT INTO players (match_id, name, kills, deaths, damage) VALUES (?, ?, ?, ?, ?)')
      const playerBatch = playersData.map(p =>
        playerStmt.bind(matchId, p.name, parseInt(p.kills), parseInt(p.deaths), parseInt(p.damage))
      )
      await db.batch(playerBatch)

      match = { id: matchId }
    }

    // Check if this uploader already has timeline for this match
    const existing = await db.prepare(
      'SELECT 1 FROM timelines WHERE match_id = ? AND uploader_name = ? LIMIT 1'
    ).bind(match.id, uploader).first()

    if (!existing) {
      // Compress timeline into a single JSON blob
      const samples = timelineData.map(t => ({
        sample_num: parseInt(t.SampleNum),
        health: parseInt(t.health),
        titan_type: t.titanType
      }))
      samples.sort((a, b) => a.sample_num - b.sample_num)

      await db.prepare(
        'INSERT INTO timelines (match_id, uploader_name, samples) VALUES (?, ?, ?)'
      ).bind(match.id, uploader, JSON.stringify(samples)).run()
    }

    return Response.json({ ok: true, match_id: match.id, uploader })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
