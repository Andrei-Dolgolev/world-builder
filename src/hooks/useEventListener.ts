import { useEffect } from 'react';
import eventBus from '@/utils/eventBus';

type EventType =
    | 'code:updated'
    | 'preview:refresh'
    | 'template:loaded'
    | 'error:occurred'
    | 'preview:loading'
    | 'preview:ready';

type Callback = (data?: any) => void;

export function useEventListener(event: EventType, callback: Callback) {
    useEffect(() => {
        // Subscribe to event when component mounts
        const unsubscribe = eventBus.on(event, callback);

        // Unsubscribe when component unmounts
        return unsubscribe;
    }, [event, callback]);
} 