// interceptor.js - MAIN world network interceptor
(function() {
  console.log("🛡️ ZDR Gateway: MAIN World Interceptor Loaded");

  const originalFetch = window.fetch;
  const originalXhrOpen = window.XMLHttpRequest.prototype.open;
  const originalXhrSend = window.XMLHttpRequest.prototype.send;

  function isAIEndpoint(url) {
    if (!url) return false;
    const urlStr = url.toString();
    return (urlStr.includes("/backend-api/") && urlStr.includes("conversation")) || 
           urlStr.includes("/api/organizations/") || 
           urlStr.includes("/_/BardChatUi"); 
  }

  // Helper to send message to ISOLATED world and wait for response
  function sendToIsolatedWorld(action, payload) {
    return new Promise((resolve) => {
      const messageId = Math.random().toString(36).substring(2, 15);
      
      const listener = (event) => {
        // We only accept messages from ourselves
        if (event.source !== window || !event.data || event.data.source !== "ZDR_ISOLATED") return;
        
        if (event.data.messageId === messageId) {
          window.removeEventListener("message", listener);
          resolve(event.data.response);
        }
      };
      
      window.addEventListener("message", listener);
      
      window.postMessage({
        source: "ZDR_MAIN",
        messageId: messageId,
        action: action,
        payload: payload
      }, "*");
    });
  }

  window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1];

    if (isAIEndpoint(url) && options && options.body) {
      try {
        let originalBody = options.body;

        if (typeof originalBody === "string") {
           const tokenizationResponse = await sendToIsolatedWorld("tokenizeInput", originalBody);
           
           if (tokenizationResponse && tokenizationResponse.success && tokenizationResponse.sanitizedText) {
             options.body = tokenizationResponse.sanitizedText;
           }
        }
      } catch (e) {
        // Silently fallback if JSON parse fails or other error
        // console.error("ZDR Fetch Intercept Error (Request):", e);
      }
    }

    const response = await originalFetch.apply(this, args);

    if (isAIEndpoint(url)) {
      try {
        if (response.body) {
          const originalGetReader = response.body.getReader;
          response.body.getReader = function() {
            const reader = originalGetReader.call(this);
            const originalRead = reader.read;
            
            reader.read = async function() {
              const result = await originalRead.call(this);
              if (result.done) return result;
              
              try {
                const decoder = new TextDecoder();
                const textChunk = decoder.decode(result.value, { stream: true });
                
                const reconstructResponse = await sendToIsolatedWorld("reconstructOutput", textChunk);
                if (reconstructResponse && reconstructResponse.success && reconstructResponse.restoredText) {
                  const encoder = new TextEncoder();
                  result.value = encoder.encode(reconstructResponse.restoredText);
                }
              } catch (e) {
                // Silently fallback
              }
              
              return result;
            };
            return reader;
          };
        }
        
        const originalText = response.text;
        response.text = async function() {
          const text = await originalText.call(this);
          try {
            const reconstructResponse = await sendToIsolatedWorld("reconstructOutput", text);
            if (reconstructResponse && reconstructResponse.success && reconstructResponse.restoredText) {
              return reconstructResponse.restoredText;
            }
          } catch(e) {
             // Fallback
          }
          return text;
        };

        const originalJson = response.json;
        response.json = async function() {
          const text = await originalText.call(this);
          try {
            const reconstructResponse = await sendToIsolatedWorld("reconstructOutput", text);
            if (reconstructResponse && reconstructResponse.success && reconstructResponse.restoredText) {
              return JSON.parse(reconstructResponse.restoredText);
            }
          } catch(e) {
             // Fallback
          }
          return JSON.parse(text);
        };
        
      } catch (e) {
        // Fallback
      }
    }

    return response;
  };

  window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._zdrUrl = url;
    return originalXhrOpen.call(this, method, url, ...rest);
  };

  window.XMLHttpRequest.prototype.send = function(body) {
    if (isAIEndpoint(this._zdrUrl) && body && typeof body === "string") {
      try {
        sendToIsolatedWorld("tokenizeInput", body).then(tokenizationResponse => {
          let finalBody = body;
          if (tokenizationResponse && tokenizationResponse.success && tokenizationResponse.sanitizedText) {
             finalBody = tokenizationResponse.sanitizedText;
          }
          originalXhrSend.call(this, finalBody);
        }).catch(e => {
          originalXhrSend.call(this, body);
        });
        
        return;
      } catch (e) {
        // Fallback
      }
    }
    
    return originalXhrSend.call(this, body);
  };

})();
