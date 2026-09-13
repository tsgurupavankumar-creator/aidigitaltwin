'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  duration?: number;
}

export function AnimatedNumber({ value, className, duration = 1000 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (current: number) => {
      const elapsed = current - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * value));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <motion.span className={className}>{displayValue}</motion.span>;
}
