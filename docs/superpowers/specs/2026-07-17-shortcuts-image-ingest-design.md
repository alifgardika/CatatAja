# Shortcuts Image Ingest Design

## Goal

Allow an Apple Shortcut to submit a selected or captured receipt image directly to the deployed Google Apps Script web app, where it is parsed by Gemini Vision and recorded in the `Expenses` sheet.

## Why not Telegram `sendPhoto`

Telegram does not deliver messages a bot sends through the Bot API back to that bot's webhook. Posting a photo to `sendPhoto` therefore cannot trigger CatatAja's current image-processing flow.

## Request contract

The web app accepts `application/json` POST bodies with these fields:

```json
{
  "chat_id": 123456789,
  "photo": "<base64-encoded JPEG or PNG>"
}
```

`chat_id` must be in `USERS`. The endpoint accepts JPEG data URLs or bare base64 input, with a size limit before Gemini is called. The public web-app URL must be kept private because the simplified Shortcut contract has no separate shared secret.

## Processing flow

1. `doPost` identifies a Shortcut request by its `image_base64` field; Telegram webhook JSON remains unchanged.
2. The request validator checks the allowed chat ID and base64 payload.
3. The endpoint sends a Telegram progress message, calls the existing `parseImageWithAI` function, and reuses `recordTransaction` to write the normalized result and send the existing confirmation.
4. It returns a JSON response stating whether the request was accepted or why it was rejected. Errors are sent to Telegram when an authorized request reaches the parser.

## Shortcut recipe

The Shortcut base64-encodes a photo, puts the fields in a Dictionary, and uses `Get Contents of URL` with a JSON POST body to the Apps Script web-app URL. It does not call Telegram's `sendPhoto`.

## Testing

Because Apps Script services are unavailable locally, a small dependency-free Node test will load the pure request-validation helpers with service stubs. It will cover valid payloads, unauthorized chat IDs/tokens, unsupported MIME types, invalid base64, and Telegram webhook routing.
