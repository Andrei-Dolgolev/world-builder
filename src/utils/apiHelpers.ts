// Add a utility function to clean API responses
export const cleanApiResponse = (response: any) => {
    // Handle code property specifically
    if (response.code && typeof response.code === 'object') {
        response.code = JSON.stringify(response.code, null, 2);
    }

    // Recursively process all properties
    return Object.entries(response).reduce((cleaned, [key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            cleaned[key] = cleanApiResponse(value);
        } else if (key === 'code' || key === 'content') {
            // Ensure these fields are always strings
            cleaned[key] = String(value);
        } else {
            cleaned[key] = value;
        }
        return cleaned;
    }, {} as Record<string, any>);
}; 