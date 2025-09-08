import { useState, useCallback } from 'react';
import type { StatusType } from '../types';

export function useStatus() {
  const [status, setStatus] = useState<{ message: string; type: StatusType }>({
    message: '',
    type: ''
  });

  const showStatus = useCallback((message: string, type: StatusType) => {
    setStatus({ message, type });
  }, []);

  const hideStatus = useCallback(() => {
    setStatus({ message: '', type: '' });
  }, []);

  const showSuccess = useCallback((message: string) => {
    showStatus(message, 'success');
  }, [showStatus]);

  const showError = useCallback((message: string) => {
    showStatus(message, 'error');
  }, [showStatus]);

  const showInfo = useCallback((message: string) => {
    showStatus(message, 'info');
  }, [showStatus]);

  return {
    status,
    showStatus,
    hideStatus,
    showSuccess,
    showError,
    showInfo
  };
}
