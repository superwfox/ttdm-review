const TITAN_TYPES = ['pilot','legion','ronin','northstar','scorch','tone','monarch','ion','unknown']
const PAGE_SIZE = 8

function parseBinaryTimeline(base64Str) {
  const raw = atob(base64Str)
  const len = raw.length
  const is9 = len % 9 === 0
  const is7 = len % 7 === 0
  if (!is9 && !is7) return []
  const step = is9 ? 9 : 7
  const samples = []
  for (let i = 0; i < len; i += step) {
    const b = idx => raw.charCodeAt(i + idx)
    const s = {
      sample_num: b(0) | (b(1) << 8),
      health: b(2) | (b(3) << 8),
      titan_type: TITAN_TYPES[b(4)] || 'unknown',
      is_doomed: b(5) === 1
    }
    if (is9) {
      s.delta_damage = b(6) | (b(7) << 8)
      s.delta_kills = b(8)
    }
    samples.push(s)
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
    // Check if name matches a nickname, redirect to player_name
    let actualName = name
    let redirectedFrom = null
    const nickRow = await db.prepare(
      'SELECT player_name FROM nicknames WHERE nickname COLLATE NOCASE = ? COLLATE NOCASE LIMIT 1'
    ).bind(name).first()
    if (nickRow) {
      actualName = nickRow.player_name
      redirectedFrom = name
    }
    // Find paginated matches where this player appears, ordered by upload time DESC
    // Fetch one extra to determine has_more
    const matchRows = await db.prepare(
      `SELECT DISTINCT p.match_id, m.uploaded_at
       FROM players p
       JOIN matches m ON m.id = p.match_id
       WHERE p.name COLLATE NOCASE = ? COLLATE NOCASE
       ORDER BY m.uploaded_at DESC
       LIMIT ? OFFSET ?`
    ).bind(actualName, PAGE_SIZE + 1, offset).all()

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
      ).bind(matchId, actualName).first()

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

    const result = { ok: true, matches, has_more }
    if (redirectedFrom) {
      result.redirected_from = redirectedFrom
      result.actual_name = actualName
    }
    return Response.json(result)
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
