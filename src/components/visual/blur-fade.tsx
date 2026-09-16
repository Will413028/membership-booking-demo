"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

const MAX_DELAY = 0.8;

export function BlurFade({
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
      data-testid="blur-fade-effect"
      data-visual-effect="blur-fade"
      className={cn(className)}
      initial={{ opacity: 0, filter: "blur(6px)", y: 8 }}
      whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "-50px" }}
      transition={{ duration: 0.6, delay: boundedDelay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
