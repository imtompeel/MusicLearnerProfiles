import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const fileExtension = (file: File): string => {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (/^[a-z0-9]+$/.test(fromName)) return fromName;

  const fromType = file.type.split('/')[1]?.toLowerCase() ?? '';
  if (/^[a-z0-9+.-]+$/.test(fromType)) return fromType.replace('jpeg', 'jpg');

  return 'jpg';
};

export const uploadControllerSlotImage = async (
  userId: string,
  slotId: string,
  file: File
): Promise<{ url: string; storagePath: string }> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be 5 MB or smaller');
  }

  const storagePath = `controller_images/${userId}/slots/${slotId}/${Date.now()}.${fileExtension(file)}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);

  return { url, storagePath };
};

export const deleteControllerSlotImage = async (storagePath: string): Promise<void> => {
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    console.warn('Failed to delete controller image from storage', error);
  }
};
