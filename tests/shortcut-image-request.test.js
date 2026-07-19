const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadScript() {
  const context = {
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(payload) {
        return {
          payload,
          setMimeType() { return this; }
        };
      }
    }
  };
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

test("does not throw when Apps Script runs doPost without an HTTP event", () => {
  const script = loadScript();

  assert.doesNotThrow(() => script.doPost({}));
});

test("ignores POSTs missing the configured secret", () => {
  const script = loadScript();
  script.WEBHOOK_SECRET = "topsecret";
  script.handleShortcutPost = () => { throw new Error("should not be reached"); };

  const result = script.doPost({
    postData: { type: "application/json", contents: "{}" },
    parameter: {}
  });

  assert.equal(result, undefined);
});

test("processes POSTs that include the matching secret", () => {
  const script = loadScript();
  script.WEBHOOK_SECRET = "topsecret";
  let handled = false;
  script.handleShortcutPost = () => { handled = true; return null; };

  script.doPost({
    postData: { type: "application/json", contents: "{}" },
    parameter: { secret: "topsecret" }
  });

  assert.equal(handled, true);
});

test("accepts Base64 photo data from an Apple Shortcut form body", () => {
  const script = loadScript();
  let image;
  script.handleShortcutImageTransaction = (request) => { image = request; };

  const response = script.handleShortcutPost({
    postData: { type: "application/x-www-form-urlencoded" },
    parameter: { chat_id: "123456789", photo: "aGVsbG8=", caption: "gaji masuk" }
  });

  assert.equal(response.payload, '{"ok":true,"message":"Gambar sedang diproses."}');
  assert.equal(image.caption, "gaji masuk");
});

test("passes the Shortcut caption to the shared transaction recorder", () => {
  const script = loadScript();
  let recordArgs;
  script.sendMessage = () => ({ result: { message_id: 1 } });
  script.parseImageWithAI = () => ({
    ok: true,
    data: { isTransaction: true }
  });
  script.recordTransaction = (...args) => { recordArgs = args; };

  script.handleShortcutImageTransaction({
    chatId: 123456789,
    imageBase64: "aGVsbG8=",
    mimeType: "image/jpeg",
    caption: "gaji masuk"
  });

  assert.equal(recordArgs[4], "gaji masuk");
});
