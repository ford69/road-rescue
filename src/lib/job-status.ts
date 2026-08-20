import type { RequestStatus } from '@/api/types';

export type JobNextAction = {
  status: RequestStatus;
  label: string;
  successTitle: string;
  successDescription?: string;
};

export function nextJobAction(status: RequestStatus): JobNextAction | null {
  switch (status) {
    case 'accepted':
      return {
        status: 'enroute',
        label: 'Start En Route',
        successTitle: 'En route',
        successDescription: 'Customer has been notified you are on the way.',
      };
    case 'enroute':
      return {
        status: 'arrived',
        label: 'Mark Arrived',
        successTitle: 'Arrived',
        successDescription: 'Customer knows you are on site.',
      };
    case 'arrived':
      return {
        status: 'inprogress',
        label: 'Start Service',
        successTitle: 'Service started',
        successDescription: 'Work is now in progress.',
      };
    case 'inprogress':
      return {
        status: 'completed',
        label: 'Complete Job',
        successTitle: 'Job completed',
        successDescription: 'Earnings have been updated.',
      };
    default:
      return null;
  }
}

export function canCancelJob(status: RequestStatus): boolean {
  return status === 'accepted' || status === 'enroute';
}
