// content.js - DOM Ghost Interceptor & Message Bridge
console.log("🛡️ ZDR Ghost Gateway Active: ISOLATED bridge and DOM interceptor.");

// --- MAIN World <-> Background Bridge ---
window.addEventListener("message", (event) => {
  // Only accept messages from our MAIN world script
  if (event.source !== window || !event.data || event.data.source !== "ZDR_MAIN") return;

  const messageId = event.data.messageId;
  const action = event.data.action;
  const payload = event.data.payload;

  if (action === "tokenizeInput") {
    chrome.runtime.sendMessage({ action: "tokenizeInput", rawInput: payload }, (response) => {
      window.postMessage({
        source: "ZDR_ISOLATED",
        messageId: messageId,
        response: response
      }, "*");
    });
  } else if (action === "reconstructOutput") {
    chrome.runtime.sendMessage({ action: "reconstructOutput", sanitizedOutput: payload }, (response) => {
      window.postMessage({
        source: "ZDR_ISOLATED",
        messageId: messageId,
        response: response
      }, "*");
    });
  }
});

// --- Native React State Trigger Heuristics (Fallback DOM Interception) ---
async function processElementContent(target) {
  let rawInput = target.value || target.innerText || "";
  if (!rawInput.trim() || rawInput.includes("PERSON_") || rawInput.includes("SECRET_") || rawInput.includes("EMAIL_") || rawInput.includes("ORG_") || rawInput.includes("PHONE_")) return;

  chrome.runtime.sendMessage({
    action: "tokenizeInput",
    rawInput: rawInput
  }, (response) => {
    if (response && response.success && response.redactionCount > 0) {
      console.log(`🔒 ZDR Gateway Redacted ${response.redactionCount} item(s) in DOM.`);
      
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
        // Native React setter bypass
        try {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          setter.call(target, response.sanitizedText);
          target.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) {
          target.value = response.sanitizedText;
          target.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        target.innerText = response.sanitizedText;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Visual safety flash border
      const currentBorder = target.style.border;
      target.style.border = "2px solid #10b981";
      setTimeout(() => { target.style.border = currentBorder; }, 800);
    }
  });
}

// Hook keydown events on entry points
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    const target = document.activeElement;
    if (target && (target.tagName === "TEXTAREA" || target.isContentEditable)) {
      processElementContent(target);
    }
  }
}, true);

// Hook clicks on send buttons
document.addEventListener("pointerdown", (e) => {
  const target = e.target;
  if (target.closest("button")) {
    document.querySelectorAll("textarea, [contenteditable='true']").forEach(el => processElementContent(el));
  }
}, true);

// Watch for incoming matching tokens to translate back automatically in the DOM (Fallback for React streaming if fetch fails)
let isMutating = false;

function processNodeForReconstruction(rootNode) {
  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let currentNode;
  
  while ((currentNode = walker.nextNode())) {
    if (currentNode.nodeValue && (
      currentNode.nodeValue.includes("PERSON_") || 
      currentNode.nodeValue.includes("SECRET_") || 
      currentNode.nodeValue.includes("EMAIL_") || 
      currentNode.nodeValue.includes("ORG_") || 
      currentNode.nodeValue.includes("PHONE_")
    )) {
      textNodes.push(currentNode);
    }
  }

  textNodes.forEach(node => {
    chrome.runtime.sendMessage({
      action: "reconstructOutput",
      sanitizedOutput: node.nodeValue
    }, (response) => {
      if (response && response.success && response.restoredText !== node.nodeValue) {
        isMutating = true;
        node.nodeValue = response.restoredText;
        if (node.parentElement) {
          node.parentElement.style.borderLeft = "3px solid #10b981";
          node.parentElement.style.paddingLeft = "6px";
        }
        setTimeout(() => { isMutating = false; }, 50);
      }
    });
  });
}

const observer = new MutationObserver((mutations) => {
  if (isMutating) return;
  
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        processNodeForReconstruction(node);
      } else if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue && (
          node.nodeValue.includes("PERSON_") || 
          node.nodeValue.includes("SECRET_") || 
          node.nodeValue.includes("EMAIL_") || 
          node.nodeValue.includes("ORG_") || 
          node.nodeValue.includes("PHONE_")
        )) {
          chrome.runtime.sendMessage({
            action: "reconstructOutput",
            sanitizedOutput: node.nodeValue
          }, (response) => {
            if (response && response.success && response.restoredText !== node.nodeValue) {
              isMutating = true;
              node.nodeValue = response.restoredText;
              if (node.parentElement) {
                node.parentElement.style.borderLeft = "3px solid #10b981";
                node.parentElement.style.paddingLeft = "6px";
              }
              setTimeout(() => { isMutating = false; }, 50);
            }
          });
        }
      }
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });