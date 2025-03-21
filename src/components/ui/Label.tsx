import React, { LabelHTMLAttributes } from 'react';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    children: React.ReactNode;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
    ({ className = '', children, ...props }, ref) => {
        const baseClasses = 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70';

        const classes = `${baseClasses} ${className}`;

        return (
            <label className={classes} ref={ref} {...props}>
                {children}
            </label>
        );
    }
);

Label.displayName = 'Label';

export default Label; 