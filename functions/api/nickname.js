// GET /api/nickname — check if current IP has a nickname set
export async function onRequestGet(context) {
  const { env } = context
  const db = env.DB
  const ip = context.request.headers.get('cf-connecting-ip') || 'unknown'

  try {
    const row = await db.prepare(
      'SELECT player_name, nickname FROM nicknames WHERE ip = ? LIMIT 1'
    ).bind(ip).first()

    if (!row) {
      return Response.json({ ok: true, has_record: false })
    }

    return Response.json({
      ok: true,
      has_record: true,
      player_name: row.player_name,
      nickname: row.nickname || null,
      has_nickname: !!row.nickname
    })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// POST /api/nickname — set nickname for current IP
export async function onRequestPost(context) {
  const { env } = context
  const db = env.DB
  const ip = context.request.headers.get('cf-connecting-ip') || 'unknown'

  try {
    const { nickname } = await context.request.json()

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      return Response.json({ ok: false, error: 'Invalid nickname' }, { status: 400 })
    }

    const trimmed = nickname.trim()
    if (trimmed.length > 32) {
      return Response.json({ ok: false, error: 'Nickname too long (max 32)' }, { status: 400 })
    }

    // Check if this IP has a record (player_name must exist from upload)
    const row = await db.prepare(
      'SELECT id, player_name FROM nicknames WHERE ip = ? LIMIT 1'
    ).bind(ip).first()

    if (!row) {
      return Response.json({ ok: false, error: 'No player data found for your IP. Upload a match first.' }, { status: 404 })
    }

    // Check if this nickname is already taken by another player
    const existing = await db.prepare(
      'SELECT player_name FROM nicknames WHERE nickname COLLATE NOCASE = ? COLLATE NOCASE AND ip != ? LIMIT 1'
    ).bind(trimmed, ip).first()

    if (existing) {
      return Response.json({ ok: false, error: 'Nickname already taken' }, { status: 409 })
    }

    await db.prepare(
      'UPDATE nicknames SET nickname = ? WHERE ip = ?'
    ).bind(trimmed, ip).run()

    return Response.json({ ok: true, player_name: row.player_name, nickname: trimmed })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
