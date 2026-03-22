function parseUploaderName(filename) {
  const base = filename.replace(/\.(csv|bin)$/i, '')
  // Match both HH-MM and HH-MM-SS timestamp formats
  const match = base.match(/^(.+)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}(?:-\d{2})?_(players|timeline)$/i)
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

const TITAN_TYPES = ['pilot','legion','ronin','northstar','scorch','tone','monarch','ion','unknown']

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
      titan_type: b(4),
      is_doomed: b(5) === 1 ? 1 : 0
    })
  }
  return samples
}

async function hashPlayers(playersText) {
  const normalized = playersText.trim().split('\n').map(l => l.trim()).sort().join('\n')
  const data = new TextEncoder().encode(normalized)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Signature verification ──────────────────────────────────────
const _KA = 0x5A3C
const _KB = 0x7F12
const _KC = 0x4E8D
const _KD = 0xA1B7
function _deriveKey() {
  return ((_KA << 16) | _KB) ^ ((_KC << 16) | _KD)
}

function ttdmHash(str, seed) {
  let h = seed >>> 0
  for (let i = 0; i < str.length; i++) {
    h = (h ^ str.charCodeAt(i)) >>> 0
    h = (Math.imul(h, 0x5bd1e995)) >>> 0
    h = (h ^ (h >>> 15)) >>> 0
  }
  h = (Math.imul(h, 0x27d4eb2d)) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  return h >>> 0
}

function verifySig(payload, ts, sig) {
  const key = _deriveKey()
  const h1 = ttdmHash(payload, key)
  const h2 = ttdmHash(String(ts), h1)
  const expected = ((h2 ^ key) >>> 0).toString(16)
  return expected === sig
}

// ── XOR decode ──────────────────────────────────────────────────
function xorDecode(encoded) {
  const key = _deriveKey()
  const bytes = atob(encoded)
  let result = ''
  for (let i = 0; i < bytes.length; i++) {
    const k = (key >>> ((i % 4) * 8)) & 0xFF
    result += String.fromCharCode(bytes.charCodeAt(i) ^ k)
  }
  return result
}

// ── IP rate limiting ────────────────────────────────────────────
async function checkIpRate(kv, ip) {
  const banKey = `ban:${ip}`
  if (await kv.get(banKey)) return false

  const rateKey = `rate:${ip}`
  const raw = await kv.get(rateKey)
  const now = Date.now()
  let hits = raw ? JSON.parse(raw) : []
  hits = hits.filter(t => now - t < 600000)
  hits.push(now)

  if (hits.length > 3) {
    await kv.put(banKey, '1', { expirationTtl: 86400 })
    return false
  }

  await kv.put(rateKey, JSON.stringify(hits), { expirationTtl: 600 })
  return true
}

export async function onRequestPost(context) {
  const { env } = context
  const db = env.DB

  // ── IP rate limit ──
  const ip = context.request.headers.get('cf-connecting-ip') || 'unknown'
  if (env.RATE_KV) {
    const allowed = await checkIpRate(env.RATE_KV, ip)
    if (!allowed) {
      return Response.json({ ok: false, error: 'Rate limited' }, { status: 403 })
    }
  }

  try {
    const json = await context.request.json()
    const { sig, ts, payload } = json

    // ── Signature check ──
    if (!sig || !ts || !payload) {
      return Response.json({ ok: false, error: 'Missing signature' }, { status: 403 })
    }

    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - ts) > 30) {
      return Response.json({ ok: false, error: 'Request expired' }, { status: 403 })
    }

    if (!verifySig(payload, ts, sig)) {
      return Response.json({ ok: false, error: 'Invalid signature' }, { status: 403 })
    }

    // ── Decode payload ──
    const decoded = JSON.parse(xorDecode(payload))
    const { players_filename, timeline_filename, players_csv, timeline_bin } = decoded

    if (!players_csv || !timeline_bin) {
      return Response.json({ ok: false, error: 'Need both players_csv and timeline_bin' }, { status: 400 })
    }

    const uploaderFromPlayers = parseUploaderName(players_filename || '')
    const uploaderFromTimeline = parseUploaderName(timeline_filename || '')
    const uploader = uploaderFromPlayers || uploaderFromTimeline

    if (!uploader) {
      return Response.json({ ok: false, error: 'Cannot parse uploader name from filename' }, { status: 400 })
    }

    const playersData = parseCSV(players_csv)
    const timelineData = parseBinaryTimeline(timeline_bin)

    if (!playersData.length || !timelineData.length) {
      return Response.json({ ok: false, error: 'Data is empty or malformed' }, { status: 400 })
    }

    // ── Data validation: drop invalid but return success ──
    const uploaderRow = playersData.find(p => p.name.toLowerCase() === uploader.toLowerCase())
    if (uploaderRow) {
      const damage = parseInt(uploaderRow.damage) || 0
      const deaths = parseInt(uploaderRow.deaths) || 0
      const avg = deaths > 0 ? Math.round(damage / deaths) : damage
      if (avg < 1000 || avg > 50000) {
        return Response.json({ ok: true, match_id: -1, uploader, dropped: true })
      }
    }

    const lastSample = timelineData[timelineData.length - 1]
    const lastIndex = lastSample?.sample_num || 0
    if (lastIndex < 900 || lastIndex > 1200) {
      return Response.json({ ok: true, match_id: -1, uploader, dropped: true })
    }

    const hash = await hashPlayers(players_csv)

    let match = await db.prepare('SELECT id FROM matches WHERE players_hash = ?').bind(hash).first()

    if (!match) {
      const insertMatch = await db.prepare('INSERT INTO matches (players_hash) VALUES (?)').bind(hash).run()
      const matchId = insertMatch.meta.last_row_id

      const playerStmt = db.prepare('INSERT INTO players (match_id, name, kills, deaths, damage) VALUES (?, ?, ?, ?, ?)')
      const playerBatch = playersData.map(p =>
        playerStmt.bind(matchId, p.name, parseInt(p.kills), parseInt(p.deaths), parseInt(p.damage))
      )
      await db.batch(playerBatch)

      match = { id: matchId }
    }

    const existing = await db.prepare(
      'SELECT 1 FROM timelines WHERE match_id = ? AND uploader_name = ? LIMIT 1'
    ).bind(match.id, uploader).first()

    if (!existing) {
      const insertTimeline = await db.prepare(
        'INSERT INTO timelines (match_id, uploader_name) VALUES (?, ?)'
      ).bind(match.id, uploader).run()
      const timelineId = insertTimeline.meta.last_row_id

      // Batch insert samples (D1 batch limit is 500 statements)
      const sampleStmt = db.prepare(
        'INSERT INTO samples (timeline_id, sample_num, health, titan_type, is_doomed) VALUES (?, ?, ?, ?, ?)'
      )
      const sorted = [...timelineData].sort((a, b) => a.sample_num - b.sample_num)
      for (let i = 0; i < sorted.length; i += 400) {
        const chunk = sorted.slice(i, i + 400)
        await db.batch(chunk.map(s =>
          sampleStmt.bind(timelineId, s.sample_num, s.health, s.titan_type, s.is_doomed)
        ))
      }
    }

    return Response.json({ ok: true, match_id: match.id, uploader })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
