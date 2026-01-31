import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

interface EmailListSkeletonProps {
  count?: number;
}

export function EmailListSkeleton({ count = 5 }: EmailListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div 
          key={index}
          className="p-4 border rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.2, 
            delay: index * 0.05,
            ease: "easeOut"
          }}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          
          <div className="mt-2 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </motion.div>
      ))}
    </div>
  );
} 