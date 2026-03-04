import QRCode from 'qrcode';
import { generateStudentJoinUrl, type StudentJoinOptions } from './routing';

interface RenderQrOptions {
  elementId: string;
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

export async function renderSessionQr(
  sessionCode: string,
  joinOptions: StudentJoinOptions,
  opts: RenderQrOptions
): Promise<void> {
  if (!sessionCode) return;

  const {
    elementId,
    width = 200,
    margin = 2,
    darkColor = '#000000',
    lightColor = '#FFFFFF'
  } = opts;

  const url = generateStudentJoinUrl(sessionCode, undefined, joinOptions);
  const container = document.getElementById(elementId);
  if (!container) return;

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, url, {
    width,
    margin,
    color: {
      dark: darkColor,
      light: lightColor
    }
  });
  container.appendChild(canvas);
}

