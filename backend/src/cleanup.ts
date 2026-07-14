import { readdir, stat, unlink, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || './data/uploads');
// Через сколько часов после загрузки фото удаляется (по умолчанию сутки)
const RETENTION_HOURS = Number(process.env.UPLOAD_RETENTION_HOURS || 24);
// Час ночи (по времени сервера), когда запускается очистка
const CLEANUP_HOUR = Number(process.env.CLEANUP_HOUR || 3);

async function cleanupUploads(logger: { info: (o: unknown, m?: string) => void; error: (o: unknown) => void }) {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const files = await readdir(UPLOAD_DIR);
    const cutoff = Date.now() - RETENTION_HOURS * 3600_000;
    let removed = 0;
    for (const name of files) {
      const p = join(UPLOAD_DIR, name);
      try {
        const s = await stat(p);
        if (s.isFile() && s.mtimeMs < cutoff) {
          await unlink(p);
          removed++;
        }
      } catch {
        /* файл мог исчезнуть между readdir и stat — игнорируем */
      }
    }
    logger.info({ removed, retentionHours: RETENTION_HOURS }, 'Очистка папки с чеками');
  } catch (e) {
    logger.error(e);
  }
}

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(CLEANUP_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

// Планирует ежедневную очистку в CLEANUP_HOUR:00 по времени сервера.
export function scheduleUploadCleanup(logger: {
  info: (o: unknown, m?: string) => void;
  error: (o: unknown) => void;
}) {
  const schedule = () => {
    setTimeout(async () => {
      await cleanupUploads(logger);
      setInterval(() => cleanupUploads(logger), 24 * 3600_000);
    }, msUntilNextRun());
  };
  schedule();
  logger.info(
    { hour: CLEANUP_HOUR, retentionHours: RETENTION_HOURS },
    'Ночная очистка чеков запланирована'
  );
}
