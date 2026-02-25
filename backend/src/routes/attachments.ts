import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Allowed file types (images and videos only)
const ALLOWED_MIME_TYPES = [
  // Images
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo'
];

const ALLOWED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp',
  '.mp4', '.webm', '.mov', '.avi'
];

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880') // 5MB default
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`File type not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return cb(new Error(`File type not allowed. Only images and videos are permitted.`));
    }

    cb(null, true);
  }
});

// Upload attachment to ticket
router.post('/upload',
  requireAuth,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { ticketId, commentId } = req.body;
      const userId = req.userId!;
      const userRole = req.userRole!;

      if (!ticketId) {
        return res.status(400).json({ error: 'ticketId is required' });
      }

      // Verify ticket exists and user has access
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, requesterId: true }
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      // Users can only upload attachments to their own tickets
      if (userRole === 'USER' && ticket.requesterId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const attachment = await prisma.attachment.create({
        data: {
          ticketId,
          commentId: commentId || null,
          uploaderId: userId,
          filename: req.file.originalname,
          filePath: req.file.path,
          fileSize: BigInt(req.file.size),
          mimeType: req.file.mimetype
        }
      });

      return res.status(201).json({
        ...attachment,
        fileSize: attachment.fileSize.toString() // Convert BigInt to string for JSON
      });
    } catch (error) {
      console.error('Error uploading attachment:', error);
      return res.status(500).json({ error: 'Failed to upload attachment' });
    }
  }
);

// Download attachment
router.get('/:id/download', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const userRole = req.userRole!;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        ticket: {
          select: { requesterId: true }
        }
      }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Users can only download attachments from their own tickets
    if (userRole === 'USER' && attachment.ticket.requesterId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    return res.download(attachment.filePath, attachment.filename);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    return res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// View attachment inline (for preview)
router.get('/:id/view', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const userRole = req.userRole!;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        ticket: {
          select: { requesterId: true }
        }
      }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Users can only view attachments from their own tickets
    if (userRole === 'USER' && attachment.ticket.requesterId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Send file inline for preview
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.filename}"`);

    // Add restrictive CSP for SVG files to prevent script execution
    if (attachment.mimeType === 'image/svg+xml') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    }

    return res.sendFile(path.resolve(attachment.filePath));
  } catch (error) {
    console.error('Error viewing attachment:', error);
    return res.status(500).json({ error: 'Failed to view attachment' });
  }
});

export default router;
