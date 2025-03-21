type EventType =
    | 'code:updated'
    | 'preview:refresh'
    | 'template:loaded'
    | 'error:occurred'
    | 'preview:loading'
    | 'preview:ready';

type Callback = (data?: any) => void;

class EventBus {
    private listeners: Map<EventType, Callback[]>;

    constructor() {
        this.listeners = new Map<EventType, Callback[]>();
    }

    on(event: EventType, callback: Callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    off(event: EventType, callback: Callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event)!;
        this.listeners.set(
            event,
            callbacks.filter(cb => cb !== callback)
        );
    }

    emit(event: EventType, data?: any) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event)!;
        callbacks.forEach(callback => callback(data));

        // Log events in development for debugging
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Event] ${event}`, data);
        }
    }

    // For debugging - lists all registered events and listener counts
    debug() {
        if (process.env.NODE_ENV !== 'development') return;

        console.log('EventBus listeners:');
        this.listeners.forEach((callbacks, event) => {
            console.log(`- ${event}: ${callbacks.length} listeners`);
        });
    }
}

// Singleton instance
const eventBus = new EventBus();
export default eventBus; 