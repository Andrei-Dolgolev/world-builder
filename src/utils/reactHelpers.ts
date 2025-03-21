import React from 'react';

/**
 * Extracts the text content from React children nodes, handling various types
 * including strings, arrays, and React elements
 */
export function extractTextFromReactChildren(children: React.ReactNode): string {
    if (typeof children === 'string') {
        return children;
    }

    if (Array.isArray(children)) {
        return children.map(extractTextFromReactChildren).join('');
    }

    if (React.isValidElement(children)) {
        if (children.props && children.props.children) {
            return extractTextFromReactChildren(children.props.children);
        }
        return '';
    }

    if (children === null || children === undefined) {
        return '';
    }

    // Last resort, try to convert to string safely
    try {
        return String(children);
    } catch (e) {
        console.error('Error converting React children to string:', e);
        return '';
    }
} 