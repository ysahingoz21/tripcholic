import { API_BASE_URL } from '../constants/api';

export type UploadImageResult = {
  url: string;
};

export async function uploadImage(
  token: string,
  imageUri: string,
  mimeType: string = 'image/jpeg',
): Promise<UploadImageResult> {
  const filename = imageUri.split('/').pop() ?? 'upload.jpg';

  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    name: filename,
    type: mimeType,
  } as any);

  const response = await fetch(`${API_BASE_URL}/uploads/image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error?.message;
    throw new Error(
      typeof message === 'string'
        ? message
        : Array.isArray(message)
          ? message.join(', ')
          : 'Image upload failed',
    );
  }

  if (!payload?.success || !payload?.data?.url) {
    throw new Error('Image upload failed');
  }

  return { url: payload.data.url };
}
