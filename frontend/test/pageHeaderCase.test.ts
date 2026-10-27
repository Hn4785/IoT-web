import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

test('PageHeader.tsx imports CSS module matching exact on-disk filename case', () => {
  const pageHeaderPath = path.resolve('src/components/layout/PageHeader.tsx');
  const content = fs.readFileSync(pageHeaderPath, 'utf8');
  const match = content.match(/import\s+styles\s+from\s+['"](.+?\.module\.css)['"]/);
  assert.ok(match, 'PageHeader.tsx should import a .module.css file');
  const resolvedImport = path.resolve(path.dirname(pageHeaderPath), match[1]);
  assert.ok(fs.readdirSync(path.dirname(resolvedImport)).includes(path.basename(resolvedImport)), 'CSS module import must match exact directory entry case');
});
