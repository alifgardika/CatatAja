const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadScript() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("Kode.gs", "utf8"), context);
  vm.runInContext(fs.readFileSync("shortcut.gs", "utf8"), context);
  context.USERS = [123456789];
  context.SHORTCUT_TOKEN = "shortcut-secret";
  return context;
}

test("accepts an authorized JPEG Shortcut request", () => {
  const script = loadScript();
  const result = script.validateShortcutImageRequest({
    chat_id: 123456789,
    shortcut_token: "shortcut-secret",
    image_base64: "data:image/jpeg;base64,aGVsbG8=",
    mime_type: "image/jpeg",
    caption: "kopi"
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ok: true,
    chatId: 123456789,
    imageBase64: "aGVsbG8=",
    mimeType: "image/jpeg",
    caption: "kopi"
  });
});

test("rejects a Shortcut request with an invalid token", () => {
  const script = loadScript();
  const result = script.validateShortcutImageRequest({
    chat_id: 123456789,
    shortcut_token: "wrong-token",
    image_base64: "aGVsbG8=",
    mime_type: "image/jpeg"
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /token/i);
});

test("rejects an unsupported image type before calling Gemini", () => {
  const script = loadScript();
  const result = script.validateShortcutImageRequest({
    chat_id: 123456789,
    shortcut_token: "shortcut-secret",
    image_base64: "aGVsbG8=",
    mime_type: "application/pdf"
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /JPEG atau PNG/);
});
