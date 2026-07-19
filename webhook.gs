// CONFIGURATION
var token = "change_your_key"; // Your Telegram bot token (dari @BotFather)
// Your Google Apps Script Web App URL. Jika WEBHOOK_SECRET diisi di Kode.gs,
// tambahkan "?secret=<nilai_WEBHOOK_SECRET>" di akhir URL ini.
var url = "change_your_webapp_url";

// Function to set the Telegram webhook
function setWebhook() {
  var apiEndpoint = `https://api.telegram.org/bot${token}/setWebhook?url=${url}`;

  try {
    // Make the HTTP request to set the webhook
    var response = UrlFetchApp.fetch(apiEndpoint);
    
    // Log the response to the Logger for debugging
    Logger.log(response.getContentText());
  } catch (error) {
    Logger.log("Error setting webhook: " + error);
  }
}
