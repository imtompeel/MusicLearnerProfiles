import { useEffect, useRef, useState, useCallback } from 'react';

export interface MidiInputDevice {
  id: string;
  name: string;
}

export interface MidiNoteEvent {
  note: number;
  velocity: number;
  channel: number;
  deviceId: string;
  deviceName?: string;
}

export interface MidiHandlers {
  onNoteOn?: (event: MidiNoteEvent) => void;
  onNoteOff?: (event: MidiNoteEvent) => void;
}

export const isNetworkMidiDevice = (name?: string): boolean =>
  Boolean(name && /network/i.test(name));

export const formatMidiChannel = (channel: number): string => `Channel ${channel + 1}`;

export const formatMidiDeviceListLabel = (
  device: MidiInputDevice,
  devices: MidiInputDevice[]
): string => {
  const sameNameDevices = devices.filter((entry) => entry.name === device.name);
  if (sameNameDevices.length <= 1) return device.name;

  const index = sameNameDevices.findIndex((entry) => entry.id === device.id) + 1;
  return `${device.name} (${index})`;
};

export const midiActivityKey = (event: MidiNoteEvent): string =>
  isNetworkMidiDevice(event.deviceName)
    ? `${event.deviceId}:${event.channel}`
    : event.deviceId;

export const isMidiDeviceActive = (
  deviceId: string,
  activeKeys: Record<string, boolean>
): boolean => {
  if (activeKeys[deviceId]) return true;
  return Object.keys(activeKeys).some((key) => key.startsWith(`${deviceId}:`));
};

export function slotMatchesMidiEvent(
  deviceId: string,
  midiChannel: number | null,
  deviceName: string | undefined,
  event: MidiNoteEvent
): boolean {
  if (!deviceId || deviceId !== event.deviceId) return false;

  if (isNetworkMidiDevice(deviceName) || isNetworkMidiDevice(event.deviceName)) {
    return midiChannel !== null && midiChannel === event.channel;
  }

  if (midiChannel === null) return true;
  return midiChannel === event.channel;
}

const buildMidiEvent = (
  input: MIDIInput | null | undefined,
  status: number,
  note: number,
  velocity: number
): MidiNoteEvent => ({
  note,
  velocity,
  channel: status & 0x0f,
  deviceId: input?.id ?? 'unknown',
  deviceName: input?.name ?? undefined
});

export function useWebMidi(handlers?: MidiHandlers) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [lastEvent, setLastEvent] = useState<MidiNoteEvent | null>(null);
  const [connectedInputs, setConnectedInputs] = useState<MidiInputDevice[]>([]);
  const onNoteOnRef = useRef(handlers?.onNoteOn);
  const onNoteOffRef = useRef(handlers?.onNoteOff);
  onNoteOnRef.current = handlers?.onNoteOn;
  onNoteOffRef.current = handlers?.onNoteOff;

  const refreshInputs = useCallback((access: MIDIAccess) => {
    const devices = Array.from(access.inputs.values())
      .filter((port) => port.state === 'connected')
      .map((port) => ({
        id: port.id,
        name: port.name || 'Unknown device'
      }));
    setConnectedInputs(devices);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setIsEnabled(false);
      return;
    }

    let access: MIDIAccess | null = null;

    const handleMessage = (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 3) return;

      const [status, note, velocity] = data;
      const command = status & 0xf0;
      const input = event.currentTarget as MIDIInput;
      const isNoteOn = command === 0x90 && velocity > 0;
      const isNoteOff = command === 0x80 || (command === 0x90 && velocity === 0);

      if (!isNoteOn && !isNoteOff) return;

      const midiEvent = buildMidiEvent(input, status, note, isNoteOn ? velocity : 0);
      setLastEvent(midiEvent);

      if (isNoteOn) {
        onNoteOnRef.current?.(midiEvent);
      } else {
        onNoteOffRef.current?.(midiEvent);
      }
    };

    const attachInput = (input: MIDIInput) => {
      input.onmidimessage = handleMessage;
    };

    navigator
      .requestMIDIAccess()
      .then((midiAccess) => {
        access = midiAccess;
        midiAccess.inputs.forEach(attachInput);
        refreshInputs(midiAccess);
        setIsEnabled(true);

        midiAccess.onstatechange = () => {
          midiAccess.inputs.forEach((input) => {
            if (!input.onmidimessage) {
              attachInput(input);
            }
          });
          refreshInputs(midiAccess);
        };
      })
      .catch(() => {
        setIsEnabled(false);
      });

    return () => {
      if (access) {
        access.inputs.forEach((input) => {
          input.onmidimessage = null;
        });
        access.onstatechange = null;
      }
    };
  }, [refreshInputs]);

  const simulateNoteOn = useCallback(
    (deviceId: string, deviceName?: string, channel = 0) => {
      const midiEvent: MidiNoteEvent = {
        note: 60,
        velocity: 100,
        channel,
        deviceId,
        deviceName
      };
      setLastEvent(midiEvent);
      onNoteOnRef.current?.(midiEvent);
      return midiEvent;
    },
    []
  );

  const simulateNoteOff = useCallback((event: MidiNoteEvent) => {
    const midiEvent: MidiNoteEvent = { ...event, velocity: 0 };
    setLastEvent(midiEvent);
    onNoteOffRef.current?.(midiEvent);
  }, []);

  const simulateDevice = useCallback(
    (deviceId: string, deviceName?: string, channel = 0, holdMs = 800) => {
      const noteOn = simulateNoteOn(deviceId, deviceName, channel);
      window.setTimeout(() => simulateNoteOff(noteOn), holdMs);
    },
    [simulateNoteOn, simulateNoteOff]
  );

  return { isEnabled, lastEvent, connectedInputs, simulateDevice, simulateNoteOn, simulateNoteOff };
};
