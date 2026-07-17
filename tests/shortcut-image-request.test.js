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
  return context;
}

test("accepts a Shortcut request containing only chat_id and photo", () => {
  const script = loadScript();
  const result = script.validateShortcutImageRequest({
    chat_id: 123456789,
    photo: "aGVsbG8="
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ok: true,
    chatId: 123456789,
    imageBase64: "aGVsbG8=",
    mimeType: "image/jpeg",
    caption: ""
  });
});

test("rejects a Shortcut request from an unauthorized chat ID", () => {
  const script = loadScript();
  script.USERS = [987654321];
  const result = script.validateShortcutImageRequest({
    chat_id: 123456789,
    photo: "aGVsbG8="
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /akses/i);
});

test("rejects an invalid photo payload before calling Gemini", () => {
  const script = loadScript();
  const result = script.validateShortcutImageRequest({
    chat_id: 123456789,
    photo: "not valid base64"
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /Data gambar/);
});
