import test from 'node:test';
import assert from 'node:assert/strict';
import { imageValidationError, TASK_IMAGE_MAX_BYTES } from '../src/lib/task-media.ts';
import { normalizeTaskRichText, taskRichTextPlain, plainTextDocument, initialTaskDocument, safeTaskLink } from '../src/lib/task-rich-text.ts';

test('3 MB image boundary is inclusive; rejects oversized, empty and unsupported files', () => {
  for (const type of ['image/jpeg','image/png','image/webp']) assert.equal(imageValidationError({size:TASK_IMAGE_MAX_BYTES,type}),null);
  assert.match(imageValidationError({size:TASK_IMAGE_MAX_BYTES+1,type:'image/png'}),/3 MB/);
  assert.ok(imageValidationError({size:0,type:'image/png'}));
  assert.ok(imageValidationError({size:12,type:'image/svg+xml'}));
});
test('legacy Thai text and literal HTML remain plain text', () => {
  const original='งานภาษาไทย\n<script>alert(1)</script>\nบรรทัดสุดท้าย';
  assert.equal(taskRichTextPlain(normalizeTaskRichText(plainTextDocument(original))),original);
  assert.equal(taskRichTextPlain(initialTaskDocument({type:'script'},original)),original);
});
test('rich text keeps formatting, lists and safe links, strips arbitrary attributes', () => {
  const doc={type:'doc',content:[{type:'heading',attrs:{level:2,onclick:'evil()'},content:[{type:'text',text:'หัวข้อ',marks:[{type:'bold'}]}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'เว็บไซต์',marks:[{type:'link',attrs:{href:'https://example.com',onclick:'evil()'}}]}]}]}]}]};
  const normalized=normalizeTaskRichText(doc);
  assert.equal(taskRichTextPlain(normalized),'หัวข้อ\nเว็บไซต์');
  assert.equal(JSON.stringify(normalized).includes('onclick'),false);
});
test('rejects executable links, injected nodes, excessive nesting and long content', () => {
  for (const href of ['javascript:alert(1)','data:text/html,evil','file:///etc/passwd','//example.com']) assert.equal(safeTaskLink(href),null);
  assert.throws(()=>normalizeTaskRichText({type:'doc',content:[{type:'image',attrs:{src:'x',onerror:'evil()'}}]}));
  assert.throws(()=>normalizeTaskRichText({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'link',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]}]}));
  let nested={type:'paragraph',content:[{type:'text',text:'deep'}]};
  for(let i=0;i<20;i++)nested={type:'blockquote',content:[nested]};
  assert.throws(()=>normalizeTaskRichText({type:'doc',content:[nested]}));
  assert.throws(()=>normalizeTaskRichText(plainTextDocument('ก'.repeat(2001))));
  assert.doesNotThrow(()=>normalizeTaskRichText(plainTextDocument('ก'.repeat(2000))));
});
