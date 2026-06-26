// background.js - Enterprise ZDR Headless Engine
const localMappingVault = new Map();
let tokenCounter = { PERSON: 0, SECRET: 0, ORG: 0, EMAIL: 0, PHONE: 0 };

function tokenizePayload(rawText) {
  let sanitizedText = rawText;
  let riskScore = 0;
  let redactionCount = 0;

  const patterns = {
    SECRET: { 
      // Matches high entropy strings (20+ chars), AWS AKIA, and common JWT structures (ey...)
      regex: /\b([A-Za-z0-9+/]{40,}|AKIA[0-9A-Z]{16}|ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, 
      weight: 40 
    },
    EMAIL: { 
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, 
      weight: 20 
    },
    PHONE: {
      // Matches various corporate phone numbers e.g. +1 (555) 555-5555, 555-555-5555
      regex: /\+?\b[1-9]\d{0,2}[ -.]?(?:\(\d{3}\)|\d{3})[ -.]?\d{3}[ -.]?\d{4}\b/g,
      weight: 10
    },
    PERSON: { 
      // Multi-word structural capitalized strings (2 to 4 words)
      regex: /\b([A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)?(?: [A-Z][a-z]+)?)\b/g, 
      weight: 10 
    }
  };

  for (const [type, config] of Object.entries(patterns)) {
    try {
      sanitizedText = sanitizedText.replace(config.regex, (match) => {
        // Only replace if we haven't already mapped it
        for (const [token, value] of localMappingVault.entries()) {
          if (value === match) {
             redactionCount++;
             return token;
          }
        }
        tokenCounter[type]++;
        const token = `${type}_${tokenCounter[type]}`;
        localMappingVault.set(token, match);
        riskScore += config.weight;
        redactionCount++;
        return token;
      });
    } catch (e) {
      console.error(`ZDR Regex Error [${type}]:`, e);
    }
  }

  const riskLevel = riskScore > 70 ? 'CRITICAL' : (riskScore > 40 ? 'HIGH' : (riskScore > 15 ? 'MEDIUM' : 'LOW'));
  return { sanitizedText, metadata: { riskScore, redactionCount, riskLevel } };
}

function reconstructResponse(sanitizedResponse) {
  let finalResponse = sanitizedResponse;
  for (const [token, rawValue] of localMappingVault.entries()) {
    try {
      finalResponse = finalResponse.split(token).join(rawValue);
    } catch (e) {
      console.error(`ZDR Reconstruct Error [${token}]:`, e);
    }
  }
  return finalResponse;
}

async function saveToAuditLog(platform, metadata, originalSnippet, sanitizedSnippet) {
  try {
    const data = await chrome.storage.local.get({ auditHistory: [] });
    data.auditHistory.unshift({
      id: 'TX-' + Math.floor(Math.random() * 1000000),
      timestamp: new Date().toISOString(),
      platform: platform,
      riskLevel: metadata.riskLevel,
      redactionCount: metadata.redactionCount,
      snippet: sanitizedSnippet.substring(0, 50) + (sanitizedSnippet.length > 50 ? '...' : '')
    });
    if (data.auditHistory.length > 50) data.auditHistory.pop();
    await chrome.storage.local.set({ auditHistory: data.auditHistory });
  } catch (e) {
    console.error("ZDR Storage Error:", e);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "tokenizeInput") {
    try {
      const { sanitizedText, metadata } = tokenizePayload(request.rawInput);
      
      if (metadata.redactionCount > 0) {
        let platform = "AI Platform";
        if (sender.tab && sender.tab.url) {
          if (sender.tab.url.includes("claude.ai")) platform = "Claude";
          else if (sender.tab.url.includes("chatgpt.com") || sender.tab.url.includes("openai.com")) platform = "ChatGPT";
          else if (sender.tab.url.includes("gemini.google.com")) platform = "Gemini";
        }
        saveToAuditLog(platform, metadata, request.rawInput, sanitizedText);
      }
      
      sendResponse({ success: true, sanitizedText: sanitizedText, redactionCount: metadata.redactionCount });
    } catch (e) {
      console.error("ZDR Tokenize Error:", e);
      sendResponse({ success: false, error: e.toString() });
    }
    return true;
  }
  
  if (request.action === "reconstructOutput") {
    try {
      const restoredText = reconstructResponse(request.sanitizedOutput);
      sendResponse({ success: true, restoredText: restoredText });
    } catch (e) {
      console.error("ZDR Reconstruct Error:", e);
      sendResponse({ success: false, error: e.toString() });
    }
    return true;
  }
});