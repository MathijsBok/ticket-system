import { Router, Response } from 'express';
import multer from 'multer';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
const execFileAsync = promisify(execFile);

// Validate parsed database URL components to ensure they contain only safe characters
const SAFE_DB_COMPONENT = /^[a-zA-Z0-9._\-]+$/;
function validateDbComponent(value: string, name: string): string {
  if (!SAFE_DB_COMPONENT.test(value)) {
    throw new Error(`Invalid ${name} in DATABASE_URL: contains unsafe characters`);
  }
  return value;
}

// Parse DATABASE_URL into validated components
function parseDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not configured');
  }

  const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+)?(?::([^@]+))?@([^:\/]+)(?::(\d+))?\/([^?]+)/);
  if (!urlMatch) {
    throw new Error('Invalid DATABASE_URL format');
  }

  const [, user, password, host, port, database] = urlMatch;

  // Validate components (password is passed via env var, not validated for shell safety)
  const validatedHost = validateDbComponent(host, 'host');
  const validatedPort = validateDbComponent(port || '5432', 'port');
  const validatedUser = validateDbComponent(user || 'postgres', 'user');
  const validatedDatabase = validateDbComponent(database, 'database');

  // Build environment with password if provided
  const env = { ...process.env };
  if (password) {
    env.PGPASSWORD = password;
  }

  return { host: validatedHost, port: validatedPort, user: validatedUser, database: validatedDatabase, env };
}

// Configure multer for database dump file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.dump', '.sql', '.backup'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .dump, .sql, or .backup files are allowed'));
    }
  }
});

// Import database from dump file
// WARNING: This will replace all data in the database!
router.post('/import', requireAuth, requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const tempFilePath = path.join(os.tmpdir(), `db_import_${crypto.randomBytes(16).toString('hex')}.dump`);

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { confirmImport } = req.body;
    if (confirmImport !== 'CONFIRM_DATABASE_IMPORT') {
      return res.status(400).json({
        error: 'Import not confirmed. Send confirmImport: "CONFIRM_DATABASE_IMPORT" to proceed.',
        warning: 'This operation will REPLACE ALL DATA in the database!'
      });
    }

    console.log(`[Database Import] Starting import from file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Write the uploaded file to a temp location
    fs.writeFileSync(tempFilePath, req.file.buffer);

    const { host, port, user: psqlUser, database, env } = parseDatabaseUrl();

    // Step 1: Terminate all other connections to the database
    console.log('[Database Import] Terminating existing connections...');
    const terminateSQL = `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();`;

    try {
      await execFileAsync('psql', ['-h', host, '-p', port, '-U', psqlUser, '-d', 'postgres', '-c', terminateSQL], { env });
      console.log('[Database Import] Connections terminated');
    } catch (termError: any) {
      console.log('[Database Import] Warning terminating connections:', termError.message);
    }

    // Step 2: Drop all tables, sequences, and types in public schema
    console.log('[Database Import] Dropping all existing objects...');
    const dropAllSQL = `DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
        FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequencename) || ' CASCADE';
        END LOOP;
        FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
          EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;`;

    try {
      await execFileAsync('psql', ['-h', host, '-p', port, '-U', psqlUser, '-d', database, '-c', dropAllSQL], { env });
      console.log('[Database Import] All objects dropped successfully');
    } catch (dropError: any) {
      console.log('[Database Import] Warning during drop:', dropError.message);
      // Continue anyway - objects might not exist
    }

    // Step 3: Import the database
    const ext = path.extname(req.file.originalname).toLowerCase();
    let importArgs: string[];
    let importCmd: string;

    if (ext === '.sql') {
      // Plain SQL file - use psql
      importCmd = 'psql';
      importArgs = ['-h', host, '-p', port, '-U', psqlUser, '-d', database, '-f', tempFilePath];
    } else {
      // Custom format dump - use pg_restore
      // --no-owner and --no-acl ignore ownership and permissions
      importCmd = 'pg_restore';
      importArgs = ['-h', host, '-p', port, '-U', psqlUser, '-d', database, '--no-owner', '--no-acl', tempFilePath];
    }

    console.log(`[Database Import] Executing: ${importCmd}...`);

    try {
      const { stdout, stderr } = await execFileAsync(importCmd, importArgs, {
        env,
        maxBuffer: 50 * 1024 * 1024 // 50MB output buffer
      });

      if (stdout) console.log(`[Database Import] stdout: ${stdout.substring(0, 1000)}`);
      if (stderr) console.log(`[Database Import] stderr: ${stderr.substring(0, 1000)}`);

      console.log('[Database Import] Import completed successfully');

      return res.json({
        success: true,
        message: 'Database imported successfully',
        filename: req.file.originalname,
        size: req.file.size
      });
    } catch (execError: any) {
      // pg_restore may return non-zero exit code even on success (e.g., if some objects already exist)
      // Check if it's a real error or just warnings
      const stderr = execError.stderr || '';
      const isRealError = stderr.includes('FATAL:') || stderr.includes('could not connect') || stderr.includes('authentication failed');

      if (isRealError) {
        throw execError;
      }

      console.log('[Database Import] Import completed with warnings');
      return res.json({
        success: true,
        message: 'Database imported with some warnings (this is usually normal)',
        filename: req.file.originalname,
        size: req.file.size,
        warnings: stderr.substring(0, 500)
      });
    }
  } catch (error: any) {
    console.error('[Database Import] Error:', error);
    return res.status(500).json({
      error: 'Failed to import database'
    });
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

// Export database to dump file
// Supports ?format=sql for plain SQL format (better cross-version compatibility)
// Default format is custom dump format
router.get('/export', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const format = (req.query.format as string)?.toLowerCase() === 'sql' ? 'sql' : 'dump';
  const extension = format === 'sql' ? '.sql' : '.dump';
  const tempFilePath = path.join(os.tmpdir(), `db_export_${crypto.randomBytes(16).toString('hex')}${extension}`);

  try {
    console.log(`[Database Export] Starting export (format: ${format})...`);

    const { host, port, user: pgUser, database, env } = parseDatabaseUrl();

    // Use pg_dump - format flag: 'c' for custom, 'p' for plain SQL
    const formatFlag = format === 'sql' ? 'p' : 'c';

    console.log('[Database Export] Running pg_dump...');
    await execFileAsync('pg_dump', ['-h', host, '-p', port, '-U', pgUser, '-d', database, '-F', formatFlag, '-f', tempFilePath], { env });

    // Get file stats
    const stats = fs.statSync(tempFilePath);
    console.log(`[Database Export] Export completed, size: ${stats.size} bytes`);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${database}_${timestamp}${extension}`;

    // Send the file
    res.setHeader('Content-Type', format === 'sql' ? 'text/plain' : 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);

    const fileStream = fs.createReadStream(tempFilePath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

    fileStream.on('error', (err) => {
      console.error('[Database Export] Stream error:', err);
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });
  } catch (error: any) {
    console.error('[Database Export] Error:', error);
    // Clean up temp file on error
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    res.status(500).json({
      error: 'Failed to export database'
    });
  }
});

export default router;
