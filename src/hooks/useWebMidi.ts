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

export const isNetworkMidiDevice = (name?: string): boolean =>
  Boolean(name && /network/i.test(name));

export const formatMidiChannel = (channel: number): string => `Channel ${channel + 1}`;

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

export function useWebMidi(onNoteOn?: (event: MidiNoteEvent) => void) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [lastEvent, setLastEvent] = useState<MidiNoteEvent | null>(null);
  const [connectedInputs, setConnectedInputs] = useState<MidiInputDevice[]>([]);
  const callbackRef = useRef(onNoteOn);
  callbackRef.current = onNoteOn;

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

      if (command === 0x90 && velocity > 0) {
        const input = event.currentTarget as MIDIInput;
        const midiEvent: MidiNoteEvent = {
          note,
          velocity,
          channel: status & 0x0f,
          deviceId: input?.id ?? 'unknown',
          deviceName: input?.name ?? undefined
        };
        setLastEvent(midiEvent);
        callbackRef.current?.(midiEvent);
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

  const simulateDevice = useCallback(
    (deviceId: string, deviceName?: string, channel = 0) => {
      const midiEvent: MidiNoteEvent = {
        note: 60,
        velocity: 100,
        channel,
        deviceId,
        deviceName
      };
      setLastEvent(midiEvent);
      callbackRef.current?.(midiEvent);
    },
    []
  );

  return { isEnabled, lastEvent, connectedInputs, simulateDevice };
};
