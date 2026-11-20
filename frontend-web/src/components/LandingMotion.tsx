import type { ReactNode } from 'react';
import { LazyMotion, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';

type LandingMotionProviderProps = {
  children: ReactNode;
};

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  mode?: 'load' | 'view';
};

const ease = [0.22, 1, 0.36, 1] as const;
const loadFeatures = () => import('../lib/motionFeatures.ts').then((module) => module.default);

export function LandingMotionProvider({ children }: LandingMotionProviderProps) {
  return (
    <LazyMotion features={loadFeatures} strict>{children}</LazyMotion>
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
  distance = 16,
  mode = 'view',
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const finalState = { opacity: 1, y: 0 };
  const initialState = reduceMotion ? false : { opacity: 0, y: distance };
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.48, delay, ease };

  return (
    <m.div
      className={className}
      initial={initialState}
      animate={mode === 'load' ? finalState : undefined}
      whileInView={mode === 'view' ? finalState : undefined}
      viewport={mode === 'view' ? { once: true, amount: 0.14, margin: '0px 0px -8% 0px' } : undefined}
      transition={transition}
    >
      {children}
    </m.div>
  );
}
