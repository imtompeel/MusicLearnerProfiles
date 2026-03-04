export function generateSessionCode(length: number = 6): string {
  return Math.random()
    .toString(36)
    .substr(2, length)
    .toUpperCase();
}

