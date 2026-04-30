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

function parseATTBinaryTimeline(base64Str) {
  const raw = atob(base64Str)
  const len = raw.length
  if (len % 14 !== 0) return []
  const samples = []
  for (let i = 0; i < len; i += 14) {
    const b = idx => raw.charCodeAt(i + idx)
    samples.push({
      sample_num: b(0) | (b(1) << 8),
      health: b(2) | (b(3) << 8),
      titan_type: TITAN_TYPES[b(4)] || 'unknown',
      is_doomed: b(5) === 1,
      delta_kills: b(6),
      delta_deaths: b(7),
      delta_score: b(8) | (b(9) << 8),
      team_score: b(10) | (b(11) << 8),
      enemy_score: b(12) | (b(13) << 8)
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
    let actualName = name
    let redirectedFrom = null
    const nickRow = await db.prepare(
      'SELECT player_name FROM nicknames WHERE nickname COLLATE NOCASE = ? COLLATE NOCASE LIMIT 1'
    ).bind(name).first()
    if (nickRow) {
      actualName = nickRow.player_name
      redirectedFrom = name
    }

    const matchRows = await db.prepare(
      `SELECT DISTINCT p.match_id, m.uploaded_at, m.mode
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
      const isATT = row.mode === 'att'

      const players = await db.prepare(
        'SELECT name, kills, deaths, damage, team, score FROM players WHERE match_id = ?'
      ).bind(matchId).all()

      const timelineRow = await db.prepare(
        'SELECT sample_detail, score_rank FROM timelines WHERE match_id = ? AND uploader_name COLLATE NOCASE = ? COLLATE NOCASE LIMIT 1'
      ).bind(matchId, actualName).first()

      let timeline = []
      if (timelineRow && timelineRow.sample_detail) {
        timeline = isATT
          ? parseATTBinaryTimeline(timelineRow.sample_detail)
          : parseBinaryTimeline(timelineRow.sample_detail)
      }

      const matchObj = {
        id: matchId,
        uploaded_at: row.uploaded_at,
        mode: row.mode || 'tdm',
        players: players.results,
        timeline
      }

      const meta = await db.prepare(
        'SELECT map, match_duration, final_score_a, final_score_b, result, local_player_name FROM att_meta WHERE match_id = ?'
      ).bind(matchId).first()
      if (meta) {
        matchObj.map = meta.map
        matchObj.match_duration = meta.match_duration
        matchObj.final_score = [meta.final_score_a, meta.final_score_b]
        matchObj.result = meta.result
        matchObj.local_player_name = meta.local_player_name
      }
      if (isATT && timelineRow && timelineRow.score_rank != null) {
        matchObj.score_rank = timelineRow.score_rank
      }

      matches.push(matchObj)
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
