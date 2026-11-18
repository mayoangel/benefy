import type { ReactNode } from 'react';
import { useUI } from '../data/UIProvider';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
export default function ScreenState({ children }: { children: ReactNode }) { const { screen, setScreen } = useUI(); if (screen === 'loading') return <Skeleton />; if (screen === 'error') return <ErrorState onRetry={() => setScreen('data')} />; if (screen === 'empty') return <EmptyState message="Aún no hay información en esta vista" action="Mostrar datos de ejemplo" onAction={() => setScreen('data')} />; return <>{children}</>; }
