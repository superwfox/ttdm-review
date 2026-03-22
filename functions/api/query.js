const TITAN_TYPES = ['pilot','legion','ronin','northstar','scorch','tone','monarch','ion','unknown']
const PAGE_SIZE = 8

function parseBinaryTimeline(base64Str) {
  const raw = atob(base64Str)
  const len = raw.length
  if (len % 7 !== 0) return []
  const samples = []
  for (let i = 0; i < len; i += 7) {
    const b = idx => raw.charCodeAt(i + idx)
    samples.push({
      sample_num: b(0) | (b(1) << 8),
      health: b(2) | (b(3) << 8),
      titan_type: TITAN_TYPES[b(4)] || 'unknown',
      is_doomed: b(5) === 1
    })
  }
  return samples
}

export async function onRequestGet(context) {
  const { env } = context
  const db = env.DB
  const url = new URL(context.request.url)
  const name = url.searchParams.get('name')
  const offset = Math.max(0, parseInt(url.searchParams.get('offset')) || 0)

  if (!name) {
    return Response.json({ ok: false, error: 'Missing name parameter' }, { status: 400 })
  }

  try {
    // Find paginated matches where this player appears, ordered by upload time DESC
    // Fetch one extra to determine has_more
    const matchRows = await db.prepare(
      `SELECT DISTINCT p.match_id, m.uploaded_at
       FROM players p
       JOIN matches m ON m.id = p.match_id
       WHERE p.name COLLATE NOCASE = ? COLLATE NOCASE
       ORDER BY m.uploaded_at DESC
       LIMIT ? OFFSET ?`
    ).bind(name, PAGE_SIZE + 1, offset).all()

    if (!matchRows.results.length) {
      return Response.json({ ok: true, matches: [], has_more: false })
    }

    const has_more = matchRows.results.length > PAGE_SIZE
    const pageRows = has_more ? matchRows.results.slice(0, PAGE_SIZE) : matchRows.results

    const matches = []
    for (const row of pageRows) {
      const matchId = row.match_id

      // Get all players in this match
      const players = await db.prepare(
        'SELECT name, kills, deaths, damage FROM players WHERE match_id = ?'
      ).bind(matchId).all()

      // Get timeline for the queried player (if they uploaded one)
      const timelineRow = await db.prepare(
        'SELECT sample_detail FROM timelines WHERE match_id = ? AND uploader_name COLLATE NOCASE = ? COLLATE NOCASE LIMIT 1'
      ).bind(matchId, name).first()

      let timeline = []
      if (timelineRow && timelineRow.sample_detail) {
        timeline = parseBinaryTimeline(timelineRow.sample_detail)
      }

      matches.push({
        id: matchId,
        uploaded_at: row.uploaded_at,
        players: players.results,
        timeline
      })
    }

    return Response.json({ ok: true, matches, has_more })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
