import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

// Parse uploader name: strip last two underscore-separated segments (time, type)
function parseUploaderName(filename) {
  const base = filename.replace(/\.csv$/i, '')
  const parts = base.split('_')
  if (parts.length < 3) return null
  return parts.slice(0, -2).join('_')
}

async function hashPlayers(playersText) {
  const normalized = playersText.trim().split('\n').map(l => l.trim()).sort().join('\n')
  const data = new TextEncoder().encode(normalized)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const TITAN_TYPE_MAP = { pilot: 0, legion: 1, ronin: 2, northstar: 3, scorch: 4, tone: 5, monarch: 6, ion: 7, unknown: 8 }

async function main() {
  const refDir = path.join(__dirname, 'reference')
  const files = fs.readdirSync(refDir)

  const playerFiles = files.filter(f => f.toLowerCase().includes('players') && f.endsWith('.csv'))

  if (!playerFiles.length) {
    console.log('No player CSV files found in reference/')
    return
  }

  const statements = []

  for (const pFile of playerFiles) {
    // Find matching timeline file
    const prefix = pFile.replace(/players\.csv$/i, '')
    const tFile = files.find(f => f.startsWith(prefix) && f.toLowerCase().includes('timeline') && f.endsWith('.csv'))

    const uploader = parseUploaderName(pFile)
    if (!uploader) {
      console.log(`Cannot parse uploader from ${pFile}, skipping`)
      continue
    }

    console.log(`Processing: ${pFile} (uploader: ${uploader})`)

    const playersText = fs.readFileSync(path.join(refDir, pFile), 'utf-8')
    const playersData = parseCSV(playersText)
    const hash = await hashPlayers(playersText)

    // INSERT match
    statements.push(`INSERT OR IGNORE INTO matches (players_hash) VALUES ('${hash}');`)

    // We need the match id — use a subquery
    const matchIdExpr = `(SELECT id FROM matches WHERE players_hash = '${hash}')`

    // INSERT players
    for (const p of playersData) {
      const k = parseInt(p.kills), d = parseInt(p.deaths), dmg = parseInt(p.damage)
      const name = p.name.replace(/'/g, "''")
      statements.push(
        `INSERT OR IGNORE INTO players (match_id, name, kills, deaths, damage) SELECT ${matchIdExpr}, '${name}', ${k}, ${d}, ${dmg} WHERE NOT EXISTS (SELECT 1 FROM players WHERE match_id = ${matchIdExpr} AND name = '${name}');`
      )
    }

    // INSERT timeline + samples rows
    if (tFile) {
      console.log(`  Timeline: ${tFile}`)
      const timelineText = fs.readFileSync(path.join(refDir, tFile), 'utf-8')
      const timelineData = parseCSV(timelineText)

      const uploaderEsc = uploader.replace(/'/g, "''")
      const timelineIdExpr = `(SELECT id FROM timelines WHERE match_id = ${matchIdExpr} AND uploader_name = '${uploaderEsc}')`

      statements.push(
        `INSERT OR IGNORE INTO timelines (match_id, uploader_name) SELECT ${matchIdExpr}, '${uploaderEsc}' WHERE NOT EXISTS (SELECT 1 FROM timelines WHERE match_id = ${matchIdExpr} AND uploader_name = '${uploaderEsc}');`
      )

      const samples = timelineData.map(t => ({
        sample_num: parseInt(t.SampleNum),
        health: parseInt(t.health),
        titan_type: TITAN_TYPE_MAP[t.titanType] ?? 8,
        is_doomed: parseInt(t.isDoomed) || 0
      }))
      samples.sort((a, b) => a.sample_num - b.sample_num)

      for (const s of samples) {
        statements.push(
          `INSERT OR IGNORE INTO samples (timeline_id, sample_num, health, titan_type, is_doomed) SELECT ${timelineIdExpr}, ${s.sample_num}, ${s.health}, ${s.titan_type}, ${s.is_doomed} WHERE NOT EXISTS (SELECT 1 FROM samples WHERE timeline_id = ${timelineIdExpr} AND sample_num = ${s.sample_num});`
        )
      }
    } else {
      console.log(`  No timeline file found for ${pFile}`)
    }
  }

  // Write to a seed SQL file
  const outPath = path.join(__dirname, 'seed.sql')
  fs.writeFileSync(outPath, statements.join('\n') + '\n')
  console.log(`\nGenerated ${statements.length} SQL statements -> seed.sql`)
  console.log('Run: npx wrangler d1 execute DB --local --file=seed.sql')
}

main().catch(console.error)
