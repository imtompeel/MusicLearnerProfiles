import { useCallback, useState } from 'react';

export type CameraRole = 'front' | 'back' | 'external' | 'unknown';

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  role: CameraRole;
}

function classifyCamera(device: MediaDeviceInfo): CameraRole {
  const lower = (value: string | undefined | null) => (value || '').toLowerCase();
  const label = lower(device.label);
  const facing = lower((device as any).facing);

  if (label.includes('front') || facing.includes('user')) {
    return 'front';
  }

  if (label.includes('back') || label.includes('rear') || facing.includes('environment')) {
    return 'back';
  }

  if (label.includes('usb') || label.includes('external') || label.includes('obs')) {
    return 'external';
  }

  return 'unknown';
}

export function useCameraDevices() {
  const [devices, setDevices] = useState<CameraDeviceInfo[]>([]);

  const refreshDevices = useCallback(async (): Promise<CameraDeviceInfo[]> => {
    if (!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices)) {
      return [];
    }

    const all = await navigator.mediaDevices.enumerateDevices();
    const cams = all
      .filter((d) => d.kind === 'videoinput')
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || 'Camera',
        role: classifyCamera(d)
      }));

    setDevices(cams);
    return cams;
  }, []);

  const getDefaultFrontCamera = useCallback(
    (list: CameraDeviceInfo[] = devices): CameraDeviceInfo | null => {
      return list.find((d) => d.role === 'front') ?? list[0] ?? null;
    },
    [devices]
  );

  const getDefaultBackCamera = useCallback(
    (list: CameraDeviceInfo[] = devices): CameraDeviceInfo | null => {
      return list.find((d) => d.role === 'back') ?? null;
    },
    [devices]
  );

  const getNextCamera = useCallback(
    (currentId: string | null | undefined, list: CameraDeviceInfo[] = devices): CameraDeviceInfo | null => {
      if (list.length <= 1) return null;
      const index = list.findIndex((d) => d.deviceId === currentId);
      if (index === -1) {
        return list[0];
      }
      const nextIndex = (index + 1) % list.length;
      return list[nextIndex];
    },
    [devices]
  );

  return {
    devices,
    refreshDevices,
    getDefaultFrontCamera,
    getDefaultBackCamera,
    getNextCamera
  };
}

