import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
test('ConnectedSoil controls and grid tracks can shrink on mobile',()=>{
  const css=readFileSync(new URL('../src/pages/farm-owner/ConnectedSoil.module.css',import.meta.url),'utf8');
  assert.match(css,/\.page\s*\{[^}]*min-width:\s*0/);
  assert.match(css,/\.summary\s*\{[^}]*minmax\(0,\s*1fr\)/);
  assert.match(css,/\.filters\s+select[^}]*width:\s*100%/);
  assert.match(css,/@media\s*\(max-width:\s*760px\)[\s\S]*\.filters label\s*\{[^}]*min-width:\s*0/);
});
