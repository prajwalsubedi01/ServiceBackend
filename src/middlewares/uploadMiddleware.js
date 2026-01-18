import multer from 'multer';
import path from 'path';
import cloudinary from '../config/cloudinary.js';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'service-booking',
    format: async (req, file) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) return 'png';
      if (['.pdf'].includes(ext)) return 'pdf';
      return 'raw';
    },
    public_id: (req, file) => {
      const timestamp = Date.now();
      const originalName = file.originalname.split('.')[0];
      return `${file.fieldname}-${originalName}-${timestamp}`;
    }
  },
});

const fileFilter = (req, file, cb) => {
  // Check file types
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only images and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Specific upload configurations
export const uploadUserProfile = upload.single('profileImage');

export const uploadProviderDocuments = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'experienceCertificate', maxCount: 1 },
  { name: 'citizenshipFront', maxCount: 1 },
  { name: 'citizenshipBack', maxCount: 1 },
  { name: 'cv', maxCount: 1 }
]);

export default upload;