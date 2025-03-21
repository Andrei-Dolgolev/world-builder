import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', error, ...props }, ref) => {
        const baseClasses = 'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

        const errorClasses = error ? 'border-red-500 focus:ring-red-500' : '';

        const classes = `${baseClasses} ${errorClasses} ${className}`;

        return <input className={classes} ref={ref} {...props} />;
    }
);

Input.displayName = 'Input';

export default Input; 