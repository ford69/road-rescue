import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env.js';

const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
const allowedImageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${allowedImageTypes.get(file.mimetype) ?? '.jpg'}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      cb(new Error('Selfie must be a JPEG, PNG, or WebP image'));
      return;
    }
    cb(null, true);
  },
});

/** Abstraction point for future Cloudinary / S3 storage. */
export function getPublicUploadPath(filename: string): string {
  return `/uploads/${filename}`;
}
