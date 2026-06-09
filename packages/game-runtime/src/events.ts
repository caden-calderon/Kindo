export type Unsubscribe = () => void;

export class TypedEventBus<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents, Set<(payload: TEvents[keyof TEvents]) => void>>();

  on<TKey extends keyof TEvents>(type: TKey, listener: (payload: TEvents[TKey]) => void): Unsubscribe {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as (payload: TEvents[keyof TEvents]) => void);
    this.listeners.set(type, listeners);

    return () => {
      listeners.delete(listener as (payload: TEvents[keyof TEvents]) => void);
    };
  }

  emit<TKey extends keyof TEvents>(type: TKey, payload: TEvents[TKey]): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(payload);
    }
  }
}
