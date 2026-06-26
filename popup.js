document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await chrome.storage.local.get({ auditHistory: [] });
    const container = document.getElementById('historyContainer');
    
    if (data.auditHistory && data.auditHistory.length > 0) {
      container.innerHTML = '';
      data.auditHistory.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        
        const badgeClass = `badge-${item.riskLevel.toLowerCase()}`;
        const timeStr = new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        
        el.innerHTML = `
          <span class="badge ${badgeClass}">${item.redactionCount} Redacted</span>
          <div style="margin-bottom: 6px;">
            <span class="platform-tag">[${item.platform}]</span>
            <span class="timestamp">${timeStr}</span>
          </div>
          <div style="color: #cbd5e1; font-family: monospace; font-size: 11px; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px; word-break: break-all;">
            ${item.snippet}
          </div>
        `;
        container.appendChild(el);
      });
    }
  } catch (e) {
    console.error("Popup render error:", e);
  }
});