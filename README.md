# 🛡️ ZDR Ghost Gateway PRO

ZDR Ghost Gateway PRO is an elite, enterprise-grade browser extension designed for Corporate Data Loss Prevention (DLP). It acts as a silent, transparent proxy that seamlessly secures sensitive credentials, Personally Identifiable Information (PII), and proprietary data from ever reaching third-party AI models like ChatGPT and Claude.

## ✨ Key Features

- **Deep Network Interception:** Operates natively in the browser's `MAIN` execution world to intercept raw `fetch` and `XMLHttpRequest` payloads *before* they leave your device.
- **Two-Way Seamless Tokenization:** Automatically redacts sensitive information (e.g., AWS IAM keys) into generic tokens (e.g., `SECRET_1`) on outbound requests, and seamlessly translates them back into the raw text on incoming response streams. The AI server never sees your data, but your UI remains perfectly readable.
- **Bulletproof React Compatibility:** Safely interacts with modern Single Page Applications (SPAs) like ChatGPT without breaking the Virtual DOM by directly triggering native HTML prototypes and utilizing safe `TreeWalker` DOM injections. 
- **High-Entropy Heuristics Engine:** A hardened Regex tokenizer capable of identifying high-risk AWS keys, JWTs, corporate emails, phone numbers, and arbitrary proprietary strings.
- **Manifest V3 Compliant:** Built on the latest, most secure Chrome extension APIs.

## 🛠️ How It Works

1. **The Interceptor (`interceptor.js`):** Injected directly into the `MAIN` world, this script overrides standard network requests. If an AI endpoint is detected, it intercepts the payload.
2. **The Bridge (`content.js`):** Operating in the `ISOLATED` world, this script securely routes intercepted payloads to the background service worker via `window.postMessage`.
3. **The Tokenizer (`background.js`):** The heuristic engine scans the payload, replacing sensitive data with ephemeral tokens mapping to the local vault. 
4. **The Reconstruction:** As the AI's streaming response arrives, the interceptor translates the tokens back to their original text on the fly, rendering a seamless chat experience for the user.

## 🚀 Installation

This extension is built for Chrome and Chromium-based browsers.

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **"Developer mode"** using the toggle in the top right corner.
4. Click **"Load unpacked"** and select the `ghost_gateway` folder.
5. The extension is now active!

## 🧪 Testing the Protection

1. Navigate to [ChatGPT](https://chatgpt.com/).
2. Type a dummy AWS credential into the chat prompt, for example: 
   `My access key is AKIAIOSFODNN7EXAMPLE. What does it do?`
3. Click send.
4. **The Proof:** If you look at the AI's response, it will say something like: *"I cannot determine a value like AKIAIOSFODNN7EXAMPLE... it's just a placeholder."* 
   - Notice the **green vertical line** next to the text in the response? That is visual proof that the AI actually replied with the word `SECRET_1`, and the ZDR Gateway successfully translated it back to your raw key locally on your screen!

## 🔒 Security & Privacy

All token mapping is completely ephemeral and stored locally in the extension's memory. No data is ever transmitted to a third-party server by the extension itself.

## 🔮 Future Roadmap

We are actively developing the next generation of features for ZDR Ghost Gateway PRO to expand its enterprise capabilities:
- **Comprehensive Admin Dashboard:** A dedicated control panel for security teams to configure custom regex heuristics, view metrics, and manage tokenization rules.
- **Expanded LLM Platform Support:** Extending native stream interception to platforms beyond ChatGPT and Claude, including Kimi, MiniMax, Gemini, and custom enterprise deployments.
- **Advanced Audit Logging & Maintenance:** Robust local storage of event logs, capturing the exact raw data, the ZDR transformed output, and contextual metadata.
- **Automated Evidence Capture:** Taking automatic, localized screenshots of the webpage at the exact moment a DLP violation is prevented to preserve context for security reviews.
- **Automated Report Generation:** Exportable compliance and security incident reports detailing prevented data loss events over time.

---
*Disclaimer: This extension is a prototype for Corporate DLP testing and should be configured to match your organization's specific heuristic requirements.*
