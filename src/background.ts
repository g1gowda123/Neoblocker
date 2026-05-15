import { analyzeContent } from "~utils/ai-router"

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze") {
    console.log(`[Firewall] Received analysis request for: "${request.text.substring(0, 50)}..."`);
    analyzeContent(request.text)
      .then((result) => {
        console.log(`[Firewall] Analysis result for "${request.text.substring(0, 20)}...":`, result);
        sendResponse(result);
      })
      .catch((err) => {
        console.error("AI Analysis Error in Background:", err);
        sendResponse({ action: "SAFE", error: err.message || String(err) });
      });
    return true; // Indicates async response
  }
});
