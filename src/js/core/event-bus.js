class EventBus {
  constructor() {
    this.listeners = new Map();
  }
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }
  emit(event, payload) {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(payload); } catch (e) { console.error(`[EventBus] ${event} handler failed:`, e); }
    });
  }
}

export const bus = new EventBus();
export const EVENTS = {
  RENDER_APP: "render:app",
  RENDER_CANVAS_ONLY: "render:canvas_only",
  SHOW_WORKSPACE: "view:workspace",
  SHOW_HOME: "view:home",
  SYNC_VAULT_UI: "vault:sync_ui",
  CONFIG_CHANGE: "config:change"
};
