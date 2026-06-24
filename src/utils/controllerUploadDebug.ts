const LOG_PREFIX = '[ControllerUpload]';

export const logControllerUpload = (
  step: string,
  details?: Record<string, unknown> | string
): void => {
  if (details === undefined) {
    console.info(LOG_PREFIX, step);
    return;
  }
  console.info(LOG_PREFIX, step, details);
};

export const describeUploadFile = (file: File | undefined | null) => {
  if (!file) {
    return { present: false };
  }

  return {
    present: true,
    name: file.name,
    type: file.type || '(empty)',
    size: file.size,
    sizeMb: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    lastModified: file.lastModified
  };
};
