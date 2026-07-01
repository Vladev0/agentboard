import type { VaultChangeEvent } from "./types.js";

type Listener = (event: VaultChangeEvent) => void;

class VaultSocket {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private retryDelay = 1000;

  connect(): void {
    if (this.socket) return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    this.socket = new WebSocket(`${proto}//${location.host}/ws`);

    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as VaultChangeEvent;
        this.listeners.forEach((fn) => fn(parsed));
      } catch {
        // ignore malformed frames
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      setTimeout(() => this.connect(), this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 1.5, 10000);
    };

    this.socket.onopen = () => {
      this.retryDelay = 1000;
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const vaultSocket = new VaultSocket();
