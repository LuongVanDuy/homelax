import fs from 'fs';
import path from 'path';

const target =
  path.resolve('dist-server-v2');

fs.rmSync(target, {
  recursive: true,
  force: true,
});

console.log(
  'SERVER_BUILD_OUTPUT_CLEAN',
  target,
);
