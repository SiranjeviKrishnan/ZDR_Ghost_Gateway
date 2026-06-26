const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const extensionPath = path.resolve('/Users/siranjevigv/ghost_gateway');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await browser.newPage();
  
  // Wait a moment for extension to load
  await new Promise(r => setTimeout(r, 1000));
  
  // Navigate to a dummy page that mimics chatgpt's fetch behavior
  await page.goto(`data:text/html,<html><body><textarea id="prompt"></textarea><button id="send">Send</button><div id="chat"></div><script>
    document.getElementById("send").onclick = async () => {
      const text = document.getElementById("prompt").value;
      
      const userBubble = document.createElement("div");
      userBubble.className = "user-bubble";
      userBubble.innerText = text;
      document.getElementById("chat").appendChild(userBubble);
      
      const res = await fetch("https://chatgpt.com/backend-api/f/conversation", {
        method: "POST",
        body: JSON.stringify({ prompt: text })
      });
      const data = await res.json();
      
      const aiBubble = document.createElement("div");
      aiBubble.className = "ai-bubble";
      aiBubble.innerText = data.reply;
      document.getElementById("chat").appendChild(aiBubble);
    };
  </script></body></html>`);
  
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().includes('/backend-api/f/conversation')) {
      const postData = request.postData();
      console.log('NETWORK PAYLOAD SENT TO SERVER:', postData);
      
      const parsed = JSON.parse(postData);
      request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: `Echo from server: ${parsed.prompt}` })
      });
    } else {
      request.continue();
    }
  });

  console.log("Typing secret key...");
  await page.type('#prompt', 'value of AKIAIOSFODNN7EXAMPLE.?');
  
  console.log("Clicking send...");
  await page.click('#send');
  
  await new Promise(r => setTimeout(r, 2000));
  
  const chatHtml = await page.evaluate(() => document.getElementById('chat').innerHTML);
  console.log("DOM CHAT HTML:", chatHtml);
  
  await browser.close();
})();
