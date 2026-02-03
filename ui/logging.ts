export function log(msg: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const logEl = document.getElementById('logContent');
    const statusEl = document.getElementById('statusMessage');
    const timestamp = new Date().toLocaleTimeString();

    if (logEl) {
        const line = document.createElement('div');
        line.className = `log-line log-${type}`;
        line.textContent = `[${timestamp}] ${msg}`;
        logEl.prepend(line);
    }
    
    console.log(`[${type.toUpperCase()}] ${msg}`);

    if (statusEl) {
        statusEl.textContent = msg;
        statusEl.className = `status-bar ${type}`;
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (statusEl.textContent === msg) {
                    statusEl.textContent = 'Ready';
                    statusEl.className = 'status-bar';
                }
            }, 3000);
        }
    }
}