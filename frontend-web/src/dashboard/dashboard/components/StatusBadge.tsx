import type { ReactNode } from 'react';
import Icon from '../../components/Icon';
export default function StatusBadge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode }) {
  return <span className={`bd-badge bd-badge-${tone}`}>
    <Icon name={tone === 'success' ? 'check_circle' : tone === 'danger' ? 'cancel' : 'notifications'} /> {children}</span>;
}
