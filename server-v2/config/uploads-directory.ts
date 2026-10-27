import path from 'path';
import './environment.js';

export function uploadsDirectory() {
  const configured = String(process.env.UPLOADS_DIR || '').trim();

  return path.resolve(
    configured || path.join(process.cwd(), 'public', 'uploads'),
  );
}
