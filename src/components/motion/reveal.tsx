"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const MAX_DELAY = 0.6;

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const boundedDelay = Math.min(Math.max(delay, 0), MAX_DELAY);

  return (
    <motion.div
      data-testid="reveal-surface"
      data-reveal="true"
      className={cn(className)}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, delay: boundedDelay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
