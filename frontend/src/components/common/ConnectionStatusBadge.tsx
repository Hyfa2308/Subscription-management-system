/**
 * REVORA – Connection status badge.
 * Polls the backend health endpoint and shows live connection state.
 */

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { checkHealth } from '@/services/healthService';
import { cn } from '@/utils/cn';

type Status = 'checking' | 'connected' | 'disconnected';

export function ConnectionStatusBadge() {
  const [status, setStatus] = useState<Status>('checking');
  const [latency, setLatency] = useState<number | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      if (cancelled) return;
      setStatus('checking');
      const result = await checkHealth();
      if (!cancelled) {
        setStatus(result.connected ? 'connected' : 'disconnected');
        setLatency(result.latencyMs);
      }
      // Re-probe every 30 s
      if (!cancelled) setTimeout(probe, 30_000);
    }

    probe();
    return () => { cancelled = true; };
  }, []);

  const configs: Record<Status, { label: string; color: string; Icon: React.ElementType }> = {
    checking:     { label: 'Connecting…', color: 'text-amber-600 bg-amber-50 ring-amber-200', Icon: Loader2 },
    connected:    { label: latency ? `${latency} ms` : 'Connected', color: 'text-emerald-700 bg-emerald-50 ring-emerald-200', Icon: Wifi },
    disconnected: { label: 'Offline', color: 'text-red-700 bg-red-50 ring-red-200', Icon: WifiOff },
  };

  const { label, color, Icon } = configs[status];

  return (
    <div
      className={cn(
        'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1',
        color,
      )}
      title={status === 'connected' ? 'Backend connected' : 'Cannot reach backend'}
    >
      <Icon
        className={cn('w-3.5 h-3.5', status === 'checking' && 'animate-spin')}
      />
      <span>{label}</span>
    </div>
  );
}
