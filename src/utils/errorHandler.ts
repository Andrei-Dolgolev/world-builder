import { v4 as uuidv4 } from 'uuid';

export type ErrorSource = 'editor' | 'preview' | 'deployment' | 'system';
export type ErrorSeverity = 'warning' | 'error';

export interface AppError {
    id: string;
    message: string;
    source: ErrorSource;
    severity: ErrorSeverity;
    timestamp: number;
    details?: string;
    code?: string;
    line?: number;
    column?: number;
}

// Helper to create errors
export function createError(
    message: string,
    source: ErrorSource,
    severity: ErrorSeverity = 'error',
    details?: any
): AppError {
    return {
        id: uuidv4(),
        message,
        source,
        severity,
        timestamp: Date.now(),
        details: details ? JSON.stringify(details) : undefined,
        ...(details?.line && { line: details.line }),
        ...(details?.column && { column: details.column }),
        ...(details?.code && { code: details.code })
    };
}

// Format error for display
export function formatError(error: AppError): string {
    let formatted = `[${error.severity.toUpperCase()}] ${error.message}`;

    if (error.line) {
        formatted += ` (line ${error.line}`;
        if (error.column) {
            formatted += `, column ${error.column}`;
        }
        formatted += ')';
    }

    return formatted;
}

// Format game errors from the iframe
export function parseGameError(error: any): AppError {
    return createError(
        error.message || 'Unknown game error',
        'preview',
        'error',
        {
            line: error.lineno,
            column: error.colno,
            code: error.source,
            stack: error.stack
        }
    );
} 