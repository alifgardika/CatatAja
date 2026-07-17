// Apple Shortcut image endpoint. Keep this file alongside Kode.gs in the same
// Apps Script project so it can reuse the existing Gemini and sheet functions.
var SHORTCUT_TOKEN = "change_this_to_a_long_random_secret";
var SHORTCUT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function handleShortcutPost(e) {
  if (!e || !e.postData || e.postData.type !== "application/json") return null;

  var request;
  try {
    request = JSON.parse(e.postData.contents);
  } catch (error) {
    return shortcutJsonResponse({ ok: false, error: "JSON tidak valid." });
  }

  // Telegram updates do not contain image_base64, so Kode.gs handles them.
  if (!request || !request.image_base64) return null;

  var image = validateShortcutImageRequest(request);
  if (!image.ok) return shortcutJsonResponse({ ok: false, error: image.error });

  handleShortcutImageTransaction(image);
  return shortcutJsonResponse({ ok: true, message: "Gambar sedang diproses." });
}

function validateShortcutImageRequest(request) {
  var chatId = Number(request.chat_id);
  if (!chatId || !USERS.includes(chatId)) {
    return { ok: false, error: "Chat ID tidak memiliki akses." };
  }
  if (!SHORTCUT_TOKEN || SHORTCUT_TOKEN === "change_this_to_a_long_random_secret"
      || request.shortcut_token !== SHORTCUT_TOKEN) {
    return { ok: false, error: "Shortcut token tidak valid." };
  }

  var rawImage = String(request.image_base64 || "").replace(/\s/g, "");
  var dataUrl = rawImage.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/i);
  var mimeType = String(request.mime_type || "").toLowerCase();
  if (dataUrl) {
    mimeType = dataUrl[1].toLowerCase();
    rawImage = dataUrl[2];
  }
  if (mimeType !== "image/jpeg" && mimeType !== "image/png") {
    return { ok: false, error: "Gambar harus bertipe JPEG atau PNG." };
  }
  if (!rawImage || rawImage.length > Math.ceil(SHORTCUT_MAX_IMAGE_BYTES * 4 / 3)
      || !/^[A-Za-z0-9+/]*={0,2}$/.test(rawImage) || rawImage.length % 4 !== 0) {
    return { ok: false, error: "Data gambar tidak valid atau terlalu besar." };
  }

  return {
    ok: true,
    chatId: chatId,
    imageBase64: rawImage,
    mimeType: mimeType,
    caption: String(request.caption || "")
  };
}

function handleShortcutImageTransaction(image) {
  var sent = sendMessage({ chat_id: image.chatId, text: "Membaca gambar/struk..." });
  var msgId = sent && sent.result && sent.result.message_id;

  try {
    var result = parseImageWithAI(image.imageBase64, image.mimeType, image.caption);
    if (!result.ok) {
      editOrSend(image.chatId, msgId, "AI gagal membaca gambar. Coba lagi atau ketik manual.");
      return;
    }
    if (!result.data.isTransaction) {
      editOrSend(image.chatId, msgId, result.data.response || "Tidak terdeteksi transaksi pada gambar.");
      return;
    }
    recordTransaction(
      image.chatId,
      msgId,
      result.data,
      "Gagal membaca transaksi dari gambar. Coba ulangi dengan gambar yang lebih jelas."
    );
  } catch (error) {
    console.error("Shortcut image parser error:", error);
    editOrSend(image.chatId, msgId, "Terjadi error saat membaca gambar. Coba lagi.");
  }
}

function shortcutJsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
