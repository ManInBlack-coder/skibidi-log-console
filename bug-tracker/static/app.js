class BugTracker {
    constructor() {
        this.createWindow();
        this.initWebSocket();
        this.initDraggable();
    }

    createWindow() {
        const window = document.createElement('div');
        window.className = 'bug-tracker-window';
        window.innerHTML = `
            <div class="bug-tracker-header">
                <div class="bug-tracker-title">Bug Tracker</div>
            </div>
            <div class="bug-tracker-content"></div>
        `;
        document.body.appendChild(window);
        
        this.content = window.querySelector('.bug-tracker-content');
        this.window = window;
    }

    initWebSocket() {
        this.ws = new WebSocket('ws://localhost:9092/ws');
        
        this.ws.onmessage = (event) => {
            const log = JSON.parse(event.data);
            this.addLogEntry(log);
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed. Retrying in 5 seconds...');
            setTimeout(() => this.initWebSocket(), 5000);
        };
    }

    initDraggable() {
        const header = this.window.querySelector('.bug-tracker-header');
        let isMouseDown = false;
        let startX, startY;
        let windowStartX, windowStartY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('window-control')) return;
            
            isMouseDown = true;
            startX = e.clientX - this.window.offsetLeft;
            startY = e.clientY - this.window.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            
            this.window.style.left = (e.clientX - startX) + 'px';
            this.window.style.top = (e.clientY - startY) + 'px';
        });

        document.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
    }

    addLogEntry(log) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${log.level}`;
        
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        
        entry.innerHTML = `
            <div class="log-timestamp">${timestamp}</div>
            <div class="log-location">${log.location}</div>
            <div class="log-message">${this.formatMessages(log.messages)}</div>
        `;
        
        this.content.appendChild(entry);
        this.content.scrollTop = this.content.scrollHeight;
    }

    formatMessages(messages) {
        return messages.map(msg => {
            if (typeof msg === 'object') {
                return JSON.stringify(msg, null, 2);
            }
            return String(msg);
        }).join(' ');
    }
}

// Initialize the bug tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.bugTracker = new BugTracker();
}); 