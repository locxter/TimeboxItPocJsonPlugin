import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendarJson } from '../src/parse.ts';

const event = { id:'team-1', title:'Planning', start:'2026-11-02T09:00:00+01:00', end:'2026-11-02T10:30:00+01:00' };
test('imports arrays or event collections and preserves explicit calendar values',()=>{
  const expected=[{externalId:'team-1',title:'Planning',start:event.start,end:event.end,allDay:false}];
  assert.deepEqual(parseCalendarJson(JSON.stringify([event])),expected);
  assert.deepEqual(parseCalendarJson(JSON.stringify({events:[event]})),expected);
  assert.equal(parseCalendarJson(JSON.stringify([{...event,allDay:true}]))[0].allDay,true);
});
test('rejects invalid JSON, missing IDs, duplicates and ambiguous dates',()=>{
  assert.throws(()=>parseCalendarJson('{'),/valid JSON/i);
  assert.throws(()=>parseCalendarJson(JSON.stringify([{...event,id:''}])),/id/i);
  assert.throws(()=>parseCalendarJson(JSON.stringify([event,event])),/duplicate/i);
  assert.throws(()=>parseCalendarJson(JSON.stringify([{...event,start:'2026-11-02T09:00:00'}])),/timezone|offset/i);
  assert.throws(()=>parseCalendarJson(JSON.stringify([{...event,start:'2026-02-30T09:00:00Z'}])),/date/i);
});
test('rejects reversed events and limits excessive inputs',()=>{
  assert.throws(()=>parseCalendarJson(JSON.stringify([{...event,end:'2026-11-02T08:00:00+01:00'}])),/after/i);
  assert.throws(()=>parseCalendarJson(JSON.stringify(Array.from({length:1001},(_,i)=>({...event,id:String(i)})))),/1,000/);
  assert.throws(()=>parseCalendarJson('x'.repeat(1_000_001)),/large/i);
});
