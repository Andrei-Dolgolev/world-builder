export const debugLog = (location: string, value: any) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[${location}]`, {
            type: typeof value,
            preview: typeof value === 'string' ? value.substring(0, 30) : value,
            value
        });
    }
}; 