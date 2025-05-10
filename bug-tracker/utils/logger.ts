interface LogData {
    level: 'log' | 'warn' | 'error' | 'info';
    messages: any[];
    location?: string;
    timestamp: string;
  }
  
  class Logger {
    private static instance: Logger;
    private readonly serverUrl: string = 'http://localhost:9092/log';
    private readonly wsUrl: string = 'ws://localhost:9092/ws';
    private ws: WebSocket | null = null;
    private messageQueue: LogData[] = [];
    private isConnecting: boolean = false;
  
    private constructor() {
      this.connectWebSocket();
    }
  
    private connectWebSocket(): void {
      if (this.isConnecting) return;
      this.isConnecting = true;
  
      this.ws = new WebSocket(this.wsUrl);
  
      this.ws.onopen = () => {
        this.isConnecting = false;
        // Saada kõik järjekorras olevad sõnumid
        while (this.messageQueue.length > 0) {
          const data = this.messageQueue.shift();
          if (data) this.sendToServer(data);
        }
      };
  
      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        // Proovi uuesti ühenduda 5 sekundi pärast
        setTimeout(() => this.connectWebSocket(), 5000);
      };
  
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.ws?.close();
      };
    }
  
    public static getInstance(): Logger {
      if (!Logger.instance) {
        Logger.instance = new Logger();
      }
      return Logger.instance;
    }
  
    private async sendToServer(data: LogData): Promise<void> {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data));
      } else {
        // Lisa sõnum järjekorda kui WebSocket pole ühendatud
        this.messageQueue.push(data);
        // Proovi uuesti ühenduda kui pole juba ühendumas
        if (!this.isConnecting) {
          this.connectWebSocket();
        }
      }
  
      // Varundusena saada ka HTTP kaudu
      try {
        const response = await fetch(this.serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
  
        if (!response.ok) {
          console.error('Failed to send log to server:', response.statusText);
        }
      } catch (error) {
        console.error('Error sending log to server:', error);
      }
    }
  
    private formatMessages(args: any[]): any[] {
      return args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.parse(JSON.stringify(arg)) : arg;
        } catch {
          return String(arg);
        }
      });
    }
  
    private getCallerLocation(): string {
      const error = new Error();
      const stack = error.stack?.split('\n')[3];
      return stack ? stack.trim() : 'Unknown location';
    }
  
    public log(...args: any[]): void {
      const logData: LogData = {
        level: 'log',
        messages: this.formatMessages(args),
        location: this.getCallerLocation(),
        timestamp: new Date().toISOString()
      };
  
      this.sendToServer(logData);
    }
  
    public warn(...args: any[]): void {
      const logData: LogData = {
        level: 'warn',
        messages: this.formatMessages(args),
        location: this.getCallerLocation(),
        timestamp: new Date().toISOString()
      };
  
      console.warn(...args);
      this.sendToServer(logData);
    }
  
    public error(...args: any[]): void {
      const logData: LogData = {
        level: 'error',
        messages: this.formatMessages(args),
        location: this.getCallerLocation(),
        timestamp: new Date().toISOString()
      };
  
      console.error(...args);
      this.sendToServer(logData);
    }
  
    public info(...args: any[]): void {
      const logData: LogData = {
        level: 'info',
        messages: this.formatMessages(args),
        location: this.getCallerLocation(),
        timestamp: new Date().toISOString()
      };
  
      console.info(...args);
      this.sendToServer(logData);
    }
  }
  
  // Ekspordi singleton instance
  const logger = Logger.getInstance();
  
  // Ekspordi skibidi namespace
  export const skibidi = {
    log: (...args: any[]) => logger.log(...args),
    warn: (...args: any[]) => logger.warn(...args),
    error: (...args: any[]) => logger.error(...args),
    info: (...args: any[]) => logger.info(...args)
  };
  
  // Ekspordi ka üksikud funktsioonid tagasiühilduvuseks
  export const log = skibidi.log;
  export const warn = skibidi.warn;
  export const error = skibidi.error;
  export const info = skibidi.info; 