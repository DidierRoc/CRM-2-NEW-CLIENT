import { useState, useEffect, useCallback } from 'react';
import { callCrmApi } from '@/lib/crmApi';

export const useTradingData = (portfolioId: string, leadId: string) => {
  const [positions, setPositions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const refreshPositions = useCallback(async () => {
    try {
      const data = await callCrmApi('client-trading', 'get-positions');
      setPositions(data?.positions || data || []);
    } catch {}
  }, [portfolioId]);

  const refreshOrders = useCallback(async () => {
    try {
      const data = await callCrmApi('client-trading', 'get-orders');
      setOrders(data?.orders || data || []);
    } catch {}
  }, [portfolioId]);

  useEffect(() => {
    refreshPositions();
    refreshOrders();
  }, [refreshPositions, refreshOrders]);

  return { positions, orders, refreshPositions, refreshOrders };
};
