try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "salvarDados") {
            let dataToStore = {};
            dataToStore['crm-' + request.uid] = request.data;
            chrome.storage.local.set(dataToStore, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true });
                }
            });
        } else if (request.action === "carregarDados") {
            const storageKey = 'crm-' + request.uid;
            chrome.storage.local.get(storageKey, (result) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse(result[storageKey] || {});
                }
            });
        }
        return true; // Essencial para respostas assíncronas
    });
} catch (e) {
    console.error("Error in background script:", e);
}