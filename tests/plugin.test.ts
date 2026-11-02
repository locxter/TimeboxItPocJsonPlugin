import { test } from 'node:test';
import assert from 'node:assert/strict';
import plugin, { importCalendarFile } from '../src/index.ts';

const event={id:'a',title:'Review',start:'2026-11-02T09:00:00Z',end:'2026-11-02T10:00:00Z'};
test('upload validates the complete file before replacing saved data',async()=>{
  let state:unknown={events:[{externalId:'old'}]};
  const save=async(value:unknown)=>{state=value;};
  await assert.rejects(importCalendarFile(new File(['invalid'],'events.json'),save),/valid JSON/);
  assert.deepEqual(state,{events:[{externalId:'old'}]});
  const count=await importCalendarFile(new File([JSON.stringify([event])],'events.json'),save);
  assert.equal(count,1);
  assert.deepEqual(await plugin.listEvents({state}),[{externalId:'a',title:'Review',start:event.start,end:event.end,allDay:false}]);
});
test('the stored result is bounded and events respect the requested range',async()=>{
  let state:unknown;
  const large=Array.from({length:300},(_,i)=>({...event,id:String(i),title:'Long title '.repeat(30)}));
  await assert.rejects(importCalendarFile(new File([JSON.stringify(large)],'large.json'),async value=>{state=value;}),/64 KB/);
  assert.equal(state,undefined);
  await importCalendarFile(new File([JSON.stringify([event])],'events.json'),async value=>{state=value;});
  assert.equal((await plugin.listEvents({state,from:'2026-11-03T00:00:00Z'})).length,0);
  assert.equal((await plugin.listEvents({state,from:'2026-11-02T09:30:00Z',to:'2026-11-03T00:00:00Z'})).length,1);
});
