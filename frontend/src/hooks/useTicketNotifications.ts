import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNotification } from '../contexts/NotificationContext';
import { ticketApi } from '../lib/api';

interface UseTicketNotificationsOptions {
  enabled?: boolean;
  pollingInterval?: number; // in milliseconds
}

export const useTicketNotifications = (options: UseTicketNotificationsOptions = {}) => {
  const { enabled = false, pollingInterval = 30000 } = options; // Default: 30 seconds
  const { showNotification, permission } = useNotification();
  const previousTicketIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  // Poll for new tickets
  const { data: tickets } = useQuery({
    queryKey: ['agentTickets', 'NEW', 'OPEN', 'PENDING', 'ON_HOLD'],
    queryFn: async () => {
      const response = await ticketApi.getAll({
        status: 'NEW',
        limit: 100
      });
      const data = response.data;
      return data.tickets || data; // Handle both new and old format
    },
    enabled: enabled && permission === 'granted',
    refetchInterval: enabled ? pollingInterval : false,
    refetchIntervalInBackground: true
  });

  useEffect(() => {
    if (!enabled || !tickets || permission !== 'granted') return;

    // On first load, just store the ticket IDs without showing notifications
    if (isFirstLoad.current) {
      const currentIds = new Set<string>(tickets.map((t: any) => t.id as string));
      previousTicketIds.current = currentIds;
      isFirstLoad.current = false;
      return;
    }

    // Check for new tickets
    const currentIds = new Set<string>(tickets.map((t: any) => t.id as string));
    const newTickets = tickets.filter((t: any) => !previousTicketIds.current.has(t.id));

    if (newTickets.length > 0) {
      // Show notification for each new ticket
      newTickets.forEach((ticket: any) => {
        showNotification(
          `New Ticket #${ticket.ticketNumber}`,
          {
            body: ticket.subject,
            tag: `ticket-${ticket.id}`,
            requireInteraction: false,
            data: { ticketId: ticket.id }
          }
        );
      });

      // Play a subtle sound (optional - browser dependent)
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGi77OmfSw==');
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Ignore errors if audio playback is not allowed
        });
      } catch (error) {
        // Ignore audio errors
      }
    }

    // Update tracking
    previousTicketIds.current = currentIds;
  }, [tickets, enabled, permission, showNotification]);

  return {
    newTicketCount: tickets?.filter((t: any) => t.status === 'NEW').length || 0,
    activeTicketCount: tickets?.length || 0,
    isPolling: enabled && permission === 'granted'
  };
};
