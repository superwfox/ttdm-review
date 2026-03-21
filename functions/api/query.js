export async function onRequestGet(context) {
  const { env } = context
  const db = env.DB
  const url = new URL(context.request.url)
  const name = url.searchParams.get('name')

  if (!name) {
    return Response.json({ ok: false, error: 'Missing name parameter' }, { status: 400 })
  }

  try {
    // Find all matches where this player appears
    const matchRows = await db.prepare(
      'SELECT DISTINCT match_id FROM players WHERE name COLLATE NOCASE = ? COLLATE NOCASE'
    ).bind(name).all()

    if (!matchRows.results.length) {
      return Response.json({ ok: true, matches: [] })
    }

    const matchIds = matchRows.results.map(r => r.match_id)

    const matches = []
    for (const matchId of matchIds) {
      // Get match info
      const match = await db.prepare('SELECT * FROM matches WHERE id = ?').bind(matchId).first()

      // Get all players in this match
      const players = await db.prepare(
        'SELECT name, kills, deaths, damage FROM players WHERE match_id = ?'
      ).bind(matchId).all()

      // Get timeline for the queried player (if they uploaded one)
      const timeline = await db.prepare(
        'SELECT samples FROM timelines WHERE match_id = ? AND uploader_name COLLATE NOCASE = ? COLLATE NOCASE LIMIT 1'
      ).bind(matchId, name).first()

      matches.push({
        id: matchId,
        uploaded_at: match.uploaded_at,
        players: players.results,
        timeline: timeline ? JSON.parse(timeline.samples) : []
      })
    }

    return Response.json({ ok: true, matches })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
