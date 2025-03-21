import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive';
    size?: 'default' | 'sm' | 'lg';
    children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'default', size = 'default', className = '', children, ...props }, ref) => {
        const variantClasses = {
            default: 'bg-primary text-white hover:bg-primary-dark',
            outline: 'border border-gray-300 bg-transparent hover:bg-gray-100',
            ghost: 'bg-transparent hover:bg-gray-100',
            link: 'bg-transparent underline-offset-4 hover:underline text-primary',
            destructive: 'bg-red-500 text-white hover:bg-red-600',
        };

        const sizeClasses = {
            default: 'h-10 py-2 px-4',
            sm: 'h-8 text-sm px-3',
            lg: 'h-12 text-lg px-6',
        };

        const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:pointer-events-none';

        const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

        return (
            <button className={classes} ref={ref} {...props}>
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export default Button; 