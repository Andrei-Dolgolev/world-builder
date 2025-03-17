import React from 'react';
import {
    PanelGroup as RPanelGroup,
    Panel as RPanel,
    PanelResizeHandle as RPanelResizeHandle
} from 'react-resizable-panels';
import styles from './ResizablePanels.module.css';

interface ResizablePanelGroupProps {
    children: React.ReactNode;
    direction: 'horizontal' | 'vertical';
    className?: string;
}

export const ResizablePanelGroup: React.FC<ResizablePanelGroupProps> = ({
    children,
    direction,
    className = '',
}) => {
    return (
        <RPanelGroup
            direction={direction}
            className={`${styles.panelGroup} ${styles[direction]} ${className}`}
        >
            {React.Children.map(children, (child, index) => {
                if (index === React.Children.count(children) - 1) {
                    return child;
                }
                return (
                    <>
                        {child}
                        <ResizablePanelHandle />
                    </>
                );
            })}
        </RPanelGroup>
    );
};

interface ResizablePanelProps {
    children: React.ReactNode;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
    children,
    defaultSize = 50,
    minSize = 10,
    maxSize = 100,
    className = '',
}) => {
    return (
        <RPanel
            defaultSize={defaultSize}
            minSize={minSize}
            maxSize={maxSize}
            className={`${styles.panel} ${className}`}
        >
            {children}
        </RPanel>
    );
};

export const ResizablePanelHandle: React.FC = () => {
    return (
        <RPanelResizeHandle className={styles.resizeHandle}>
            <div className={styles.resizeHandleBar} />
        </RPanelResizeHandle>
    );
}; 