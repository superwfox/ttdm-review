# TTDM Review

Titanfall 2 对局数据查询工具。上传对局 CSV 数据，按玩家 ID 查询历史对局统计和泰坦生命值时间线。

**https://ttdm-review.pages.dev**

---

## API

Base URL: `https://ttdm-review.pages.dev`

### 查询玩家对局

```
GET /api/query?name={playerName}
```

按玩家 ID 查询所有关联对局，大小写不敏感。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 玩家 ID |

**响应**

```json
{
  "ok": true,
  "matches": [
    {
      "id": 1,
      "uploaded_at": "2025-01-01 12:00:00",
      "players": [
        { "name": "SudarkO", "kills": 6, "deaths": 3, "damage": 81776 },
        { "name": "Player2", "kills": 8, "deaths": 2, "damage": 30981 }
      ],
      "timeline": [
        { "sample_num": 1, "health": 25, "titan_type": "pilot" },
        { "sample_num": 30, "health": 25, "titan_type": "legion" },
        { "sample_num": 36, "health": 12500, "titan_type": "legion" }
      ]
    }
  ]
}
```

- `players` — 该对局所有玩家的击杀、死亡、伤害数据
- `timeline` — 查询玩家的泰坦生命值采样序列（仅上传者有数据，未上传则为空数组）

### 上传对局数据

```
POST /api/upload
Content-Type: multipart/form-data
```

上传一局的 players 和 timeline CSV 文件。文件名格式：`{玩家ID}_{时间}_{类型}.csv`

**参数**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 文件名含 `players` 的 CSV |
| file | File | 是 | 文件名含 `timeline` 的 CSV |

**Players CSV 格式**

```csv
name,kills,deaths,damage
SudarkO,6,3,81776
Player2,8,2,30981
```

**Timeline CSV 格式**

```csv
SampleNum,health,titanType
1,25,pilot
30,25,legion
36,12500,legion
```

**响应**

```json
{
  "ok": true,
  "match_id": 1,
  "uploader": "SudarkO"
}
```

**去重逻辑**
- 同一局（players 内容 hash 相同）不会重复创建
- 同一上传者对同一局的 timeline 不会重复写入

---

## 本地开发

```bash
npm install
node seed-gen.js                              # 从 reference/ 生成 seed.sql
npx wrangler d1 execute DB --local --file=schema.sql
npx wrangler d1 execute DB --local --file=seed.sql
npm run dev                                   # vite build + wrangler pages dev
```

## 技术栈

- Vue 3 + Vite
- Chart.js + vue-chartjs
- Cloudflare Pages + D1 (SQLite)
