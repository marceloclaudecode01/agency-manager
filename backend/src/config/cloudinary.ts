import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadVideoFromUrl(
  url: string,
  folder = 'agency-videos'
): Promise<{ url: string; publicId: string; duration: number | null }> {
  try {
    const result = await cloudinary.uploader.upload(url, {
      resource_type: 'video',
      folder,
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration || null,
    };
  } catch (err: any) {
    console.error(`[Cloudinary] Video upload failed: ${err.message}. Using original URL.`);
    return { url, publicId: '', duration: null };
  }
}

export default cloudinary;
