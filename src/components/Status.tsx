import React from 'react';
import type { StatusType } from '../types';

interface StatusProps {
  message: string;
  type: StatusType;
}

export const Status: React.FC<StatusProps> = ({ message, type }) => {
  if (!message) return null;

  return (
    <div className={`status ${type}`} style={{ display: 'block' }}>
      {message}
    </div>
  );
};
