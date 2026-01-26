# Email Referrals API

Collects unique emails plus an optional free-form referral string. This endpoint is intended
for external forms posted from a browser on another domain.

## Endpoint

`POST /api/email-referrals`

## Auth

Send the API key in a header:

```
x-form-api-key: <FORM_INGEST_API_KEY>
```

## CORS

This route responds with:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, x-form-api-key
```

If you need an allowlist, update the route handler to restrict `Access-Control-Allow-Origin`.

## Request body

Accepts either JSON or `application/x-www-form-urlencoded`.

JSON:
```json
{
  "email": "name@domain.com",
  "referral": "twitter"
}
```

Form-encoded:
```
email=name%40domain.com&referral=twitter
```

## Responses

- `200 OK` — `{ "ok": true }`
- `400 Bad Request` — invalid or missing email
- `401 Unauthorized` — missing/invalid API key
- `409 Conflict` — email already registered
- `429 Too Many Requests` — rate limit or email cooldown hit
- `500 Server Error` — server misconfiguration or database error

## Rate limits (minimal protection)

- Per-IP: 5 requests per 10 minutes
- Per-email: 1 request per hour

## Environment

Set `FORM_INGEST_API_KEY` in the app environment.
