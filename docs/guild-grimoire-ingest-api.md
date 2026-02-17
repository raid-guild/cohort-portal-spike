# Guild Grimoire Ingest API

Push text notes into Guild Grimoire from an external bot or automation service.

## Endpoint

`POST /api/modules/guild-grimoire/ingest`

## Auth

Send the API key in a header:

```
x-grimoire-api-key: <GUILD_GRIMOIRE_INGEST_API_KEY>
```

## Request body

JSON only.

```json
{
  "text_content": "Build update: shipped the parser patch.",
  "visibility": "shared",
  "tag_ids": [
    "00000000-0000-0000-0000-000000000000"
  ]
}
```

Fields:
- `text_content` (required): string, trimmed, max 256 chars.
- `visibility` (optional): one of `private`, `shared`, `cohort`, `public`. Defaults to `shared`.
- `tag_ids` (optional): string array of existing `guild_grimoire_tags.id` values.

Notes:
- This ingest endpoint currently creates text notes only.
- Notes are created as the configured ingest user (`GUILD_GRIMOIRE_INGEST_USER_ID`).
- Invalid tag IDs do not fail note creation; tag-link errors are logged server-side.

## Responses

- `200 OK` — `{ "id": "<note-id>" }`
- `400 Bad Request` — invalid visibility or missing/invalid `text_content`
- `401 Unauthorized` — missing or invalid API key
- `429 Too Many Requests` — rate limit exceeded
- `500 Server Error` — missing server config or database error

## Rate limits (minimal protection)

- Per-IP: 30 requests per 10 minutes
- Per-key: 120 requests per 10 minutes

Rate limiting is implemented in-memory in the Next.js server process.

## Example

```bash
curl -X POST "https://<your-domain>/api/modules/guild-grimoire/ingest" \
  -H "Content-Type: application/json" \
  -H "x-grimoire-api-key: <GUILD_GRIMOIRE_INGEST_API_KEY>" \
  -d '{
    "text_content": "Daily bot note: standup starts in 15m.",
    "visibility": "shared"
  }'
```

## Environment

Set these in the app environment:
- `GUILD_GRIMOIRE_INGEST_API_KEY`
- `GUILD_GRIMOIRE_INGEST_USER_ID` (UUID of the account that should own bot-authored notes)
