import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    className
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col items-center justify-center p-8 text-center glass-card border-dashed border-white/5 rounded-2xl ${className}`}
        >
            <div className="p-4 rounded-full bg-primary/10 mb-4 ring-1 ring-primary/20">
                <Icon className="h-8 w-8 text-primary/80" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-[250px] mb-6">
                {description}
            </p>
            {actionLabel && onAction && (
                <Button onClick={onAction} variant="outline" size="sm" className="bg-primary/5 hover:bg-primary/10 border-primary/20">
                    {actionLabel}
                </Button>
            )}
        </motion.div>
    );
};
