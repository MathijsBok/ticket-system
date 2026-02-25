import { Router, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, requireAdmin, requireAgentPermission, AuthRequest } from '../middleware/auth';

const router = Router();

// Allowed file types (images and videos only)
const ALLOWED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
];

const ALLOWED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp',
  '.mp4', '.webm', '.mov', '.avi'
];

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'bugs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    cb(null, 'bug-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
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

// Wrapper to handle multer errors
const handleUpload = (req: AuthRequest, res: Response, next: NextFunction): void => {
  upload.array('attachments', 5)(req, res, (err: any): void => {
    if (err) {
      console.error('Multer error:', err);
      if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
          return;
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          res.status(400).json({ error: 'Too many files. Maximum is 5 files.' });
          return;
        }
        res.status(400).json({ error: `Upload error: ${err.message}` });
        return;
      }
      res.status(400).json({ error: err.message || 'File upload failed' });
      return;
    }
    next();
  });
};

// Helper to serialize bug with attachments (convert BigInt to string)
const serializeBug = (bug: any) => ({
  ...bug,
  attachments: bug.attachments?.map((a: any) => ({
    ...a,
    fileSize: a.fileSize.toString()
  })) || []
});

// Get all bugs (agents and admins)
router.get('/', requireAuth, requireAgent, requireAgentPermission('agentCanAccessBugReports'), async (_req: AuthRequest, res: Response) => {
  try {
    const bugs = await prisma.bug.findMany({
      include: {
        reportedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        solvedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            fileSize: true,
            mimeType: true,
            createdAt: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // OPEN first
        { createdAt: 'desc' }
      ]
    });

    return res.json(bugs.map(serializeBug));
  } catch (error) {
    console.error('Error fetching bugs:', error);
    return res.status(500).json({ error: 'Failed to fetch bugs' });
  }
});

// Create a new bug with optional attachments (agents and admins)
router.post(
  '/',
  requireAuth,
  requireAgent,
  requireAgentPermission('agentCanAccessBugReports'),
  handleUpload,
  async (req: AuthRequest, res: Response) => {
    try {
      console.log('[Bug Create] Request body:', JSON.stringify(req.body));
      console.log('[Bug Create] Files received:', (req.files as Express.Multer.File[] | undefined)?.length || 0);

      const { title, description, type } = req.body;

      // Manual validation since we're using multer
      if (!title?.trim()) {
        console.log('[Bug Create] Validation failed: Title is required');
        return res.status(400).json({ error: 'Title is required' });
      }
      if (!description?.trim()) {
        console.log('[Bug Create] Validation failed: Description is required');
        return res.status(400).json({ error: 'Description is required' });
      }
      if (!['TECHNICAL', 'VISUAL'].includes(type)) {
        console.log('[Bug Create] Validation failed: Invalid type:', type);
        return res.status(400).json({ error: 'Type must be TECHNICAL or VISUAL' });
      }

      const reportedById = req.userId!;
      const files = req.files as Express.Multer.File[] | undefined;

      // Create the bug
      const bug = await prisma.bug.create({
        data: {
          title: title.trim(),
          description: description.trim(),
          type,
          reportedById
        },
        include: {
          reportedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          attachments: true
        }
      });

      // Create attachments if files were uploaded
      if (files && files.length > 0) {
        await prisma.bugAttachment.createMany({
          data: files.map(file => ({
            bugId: bug.id,
            uploaderId: reportedById,
            filename: file.originalname,
            filePath: file.path,
            fileSize: BigInt(file.size),
            mimeType: file.mimetype
          }))
        });

        // Refetch bug with attachments
        const bugWithAttachments = await prisma.bug.findUnique({
          where: { id: bug.id },
          include: {
            reportedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true
              }
            },
            attachments: {
              select: {
                id: true,
                filename: true,
                fileSize: true,
                mimeType: true,
                createdAt: true
              }
            }
          }
        });

        // Get all agents and admins to notify them
        const agentsAndAdmins = await prisma.user.findMany({
          where: {
            role: { in: ['AGENT', 'ADMIN'] },
            id: { not: reportedById }
          },
          select: { id: true }
        });

        if (agentsAndAdmins.length > 0) {
          await prisma.notification.createMany({
            data: agentsAndAdmins.map(user => ({
              userId: user.id,
              type: 'BUG_REPORTED',
              title: 'New Bug Reported',
              message: title,
              bugId: bug.id
            }))
          });
        }

        return res.status(201).json(serializeBug(bugWithAttachments));
      }

      // Get all agents and admins to notify them
      const agentsAndAdmins = await prisma.user.findMany({
        where: {
          role: { in: ['AGENT', 'ADMIN'] },
          id: { not: reportedById }
        },
        select: { id: true }
      });

      if (agentsAndAdmins.length > 0) {
        await prisma.notification.createMany({
          data: agentsAndAdmins.map(user => ({
            userId: user.id,
            type: 'BUG_REPORTED',
            title: 'New Bug Reported',
            message: title,
            bugId: bug.id
          }))
        });
      }

      return res.status(201).json(serializeBug(bug));
    } catch (error) {
      console.error('Error creating bug:', error);
      return res.status(500).json({ error: 'Failed to create bug' });
    }
  }
);

// View bug attachment inline (for preview)
router.get('/attachments/:id/view', requireAuth, requireAgent, requireAgentPermission('agentCanAccessBugReports'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const attachment = await prisma.bugAttachment.findUnique({
      where: { id }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.filename}"`);
    return res.sendFile(path.resolve(attachment.filePath));
  } catch (error) {
    console.error('Error viewing attachment:', error);
    return res.status(500).json({ error: 'Failed to view attachment' });
  }
});

// Download bug attachment
router.get('/attachments/:id/download', requireAuth, requireAgent, requireAgentPermission('agentCanAccessBugReports'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const attachment = await prisma.bugAttachment.findUnique({
      where: { id }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
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

// Mark bug as solved (admin only)
router.patch(
  '/:id/solve',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const solvedById = req.userId!;

      // Check if bug exists
      const existingBug = await prisma.bug.findUnique({
        where: { id }
      });

      if (!existingBug) {
        return res.status(404).json({ error: 'Bug not found' });
      }

      if (existingBug.status === 'SOLVED') {
        return res.status(400).json({ error: 'Bug is already solved' });
      }

      // Update the bug
      const bug = await prisma.bug.update({
        where: { id },
        data: {
          status: 'SOLVED',
          solvedById,
          solvedAt: new Date()
        },
        include: {
          reportedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          solvedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          attachments: {
            select: {
              id: true,
              filename: true,
              fileSize: true,
              mimeType: true,
              createdAt: true
            }
          }
        }
      });

      // Notify the reporter that their bug has been solved
      if (existingBug.reportedById !== solvedById) {
        await prisma.notification.create({
          data: {
            userId: existingBug.reportedById,
            type: 'BUG_SOLVED',
            title: 'Bug Solved',
            message: existingBug.title,
            bugId: id
          }
        });
      }

      return res.json(serializeBug(bug));
    } catch (error) {
      console.error('Error solving bug:', error);
      return res.status(500).json({ error: 'Failed to solve bug' });
    }
  }
);

// Reopen bug (admin only)
router.patch(
  '/:id/reopen',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if bug exists
      const existingBug = await prisma.bug.findUnique({
        where: { id }
      });

      if (!existingBug) {
        return res.status(404).json({ error: 'Bug not found' });
      }

      if (existingBug.status === 'OPEN') {
        return res.status(400).json({ error: 'Bug is already open' });
      }

      // Update the bug
      const bug = await prisma.bug.update({
        where: { id },
        data: {
          status: 'OPEN',
          solvedById: null,
          solvedAt: null
        },
        include: {
          reportedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          solvedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          attachments: {
            select: {
              id: true,
              filename: true,
              fileSize: true,
              mimeType: true,
              createdAt: true
            }
          }
        }
      });

      return res.json(serializeBug(bug));
    } catch (error) {
      console.error('Error reopening bug:', error);
      return res.status(500).json({ error: 'Failed to reopen bug' });
    }
  }
);

// Delete bug (admin only)
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if bug exists with attachments
      const existingBug = await prisma.bug.findUnique({
        where: { id },
        include: { attachments: true }
      });

      if (!existingBug) {
        return res.status(404).json({ error: 'Bug not found' });
      }

      // Delete attachment files from disk
      for (const attachment of existingBug.attachments) {
        if (fs.existsSync(attachment.filePath)) {
          fs.unlinkSync(attachment.filePath);
        }
      }

      // Delete the bug (cascades to attachments)
      await prisma.bug.delete({
        where: { id }
      });

      return res.json({ message: 'Bug deleted successfully' });
    } catch (error) {
      console.error('Error deleting bug:', error);
      return res.status(500).json({ error: 'Failed to delete bug' });
    }
  }
);

export default router;
