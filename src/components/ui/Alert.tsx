import React from 'react';

interface AlertProps {
    variant?: 'default' | 'destructive' | 'success';
    children: React.ReactNode;
    className?: string;
}

const Alert: React.FC<AlertProps> = ({
    variant = 'default',
    children,
    className = ''
}) => {
    const variantClasses = {
        default: 'bg-gray-100 text-gray-800',
        destructive: 'bg-red-100 text-red-800',
        success: 'bg-green-100 text-green-800',
    };

    const baseClasses = 'relative w-full rounded-lg border p-4';

    const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

    return (
        <div className={classes} role="alert">
            {children}
        </div>
    );
};

export const AlertTitle: React.FC<{ children: React.ReactNode, className?: string }> = ({
    children,
    className = ''
}) => {
    const classes = `text-lg font-medium mb-1 ${className}`;
    return <h5 className={classes}>{children}</h5>;
};

export const AlertDescription: React.FC<{ children: React.ReactNode, className?: string }> = ({
    children,
    className = ''
}) => {
    const classes = `text-sm ${className}`;
    return <div className={classes}>{children}</div>;
};

export default Alert; 