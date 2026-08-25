import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configure ffmpeg static binary path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export class ThumbnailService {
  /**
   * Check if a MIME type or filename represents a video
   */
  static isVideo(mimeType: string, filename: string): boolean {
    if (mimeType && mimeType.startsWith('video/')) {
      return true;
    }
    return /\.(mp4|webm|ogg|ogv|mov|avi|mkv|flv|wmv|m4v)$/i.test(filename);
  }

  /**
   * Generate a JPEG thumbnail buffer from a video buffer using FFmpeg
   * @param videoBuffer - The raw buffer of the video file
   * @param originalFilename - Original filename to preserve file extension in temp file
   * @returns Buffer of the generated JPEG thumbnail or null if generation fails
   */
  static async generateThumbnailFromBuffer(
    videoBuffer: Buffer,
    originalFilename: string
  ): Promise<Buffer | null> {
    const tempDir = os.tmpdir();
    const ext = path.extname(originalFilename) || '.mp4';
    const tempVideoName = `video_thumb_in_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const tempThumbName = `video_thumb_out_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
    
    const tempVideoPath = path.join(tempDir, tempVideoName);
    const tempThumbPath = path.join(tempDir, tempThumbName);

    try {
      // Write video buffer to temporary file
      await fs.promises.writeFile(tempVideoPath, videoBuffer);

      // Generate screenshot at 00:00:01 (fallback to 00:00:00.200 if needed)
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .seekInput('00:00:01')
          .output(tempThumbPath)
          .outputOptions([
            '-vframes 1',          // Extract single frame
            '-vf scale=480:-1',    // Scale width to 480px preserving aspect ratio
            '-q:v 2',              // High quality JPEG
          ])
          .on('end', () => resolve())
          .on('error', (err) => {
            // Fallback: try taking frame at 0.2s in case video is very short (< 1s)
            ffmpeg(tempVideoPath)
              .seekInput('00:00:00.200')
              .output(tempThumbPath)
              .outputOptions([
                '-vframes 1',
                '-vf scale=480:-1',
                '-q:v 2',
              ])
              .on('end', () => resolve())
              .on('error', (fallbackErr) => reject(fallbackErr))
              .run();
          })
          .run();
      });

      // Check if thumbnail file was generated and read it
      if (fs.existsSync(tempThumbPath)) {
        const thumbBuffer = await fs.promises.readFile(tempThumbPath);
        return thumbBuffer;
      }
      return null;
    } catch (err: any) {
      console.warn(`[ThumbnailService] Could not generate thumbnail for ${originalFilename}:`, err.message || err);
      return null;
    } finally {
      // Clean up temp files
      try {
        if (fs.existsSync(tempVideoPath)) await fs.promises.unlink(tempVideoPath);
      } catch {}
      try {
        if (fs.existsSync(tempThumbPath)) await fs.promises.unlink(tempThumbPath);
      } catch {}
    }
  }
}
