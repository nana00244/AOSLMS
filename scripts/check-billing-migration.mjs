// Read-only checks around the one-time conversion. Only aggregate counts/totals are stored.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const command='npx --yes supabase projects api-keys --project-ref itqfnzqksuacbeemrqok --output json --agent no';
const keys=JSON.parse(execFileSync(process.platform==='win32'?'cmd.exe':'sh',process.platform==='win32'?['/d','/s','/c',command]:['-c',command],{encoding:'utf8'}));
const key=(Array.isArray(keys)?keys:keys.api_keys).find(k=>k.name==='service_role').api_key;
const project=JSON.parse(readFileSync('src/supabase-project.json','utf8'));
const client=createClient(project.url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.from('school_workspace').select('document').eq('id',true).single();if(error)throw error;
const state=data.document;
const round=n=>Math.round(n*100)/100;
const metrics={students:state.students.length,payments:state.payments.length,collected:round(state.payments.reduce((n,p)=>n+p.amount,0)),billed:round(state.students.reduce((n,s)=>{
  const bill=state.studentBills?.[`${s.id}|${state.settings.year}|${state.settings.term}`];
  const items=state.studentBills?bill?.items:state.fees[s.classId];const concession=state.studentBills?bill?.concession:state.studentConcessions?.[s.id];
  return n+round(Object.values(items||{}).reduce((a,b)=>a+b,0)*(1-(concession||0)/100));
},0))};
const path='.temp/billing-migration-totals.json';
if(process.argv.includes('--before'))writeFileSync(path,JSON.stringify(metrics));
else {assert(state.studentBills,'Explicit bills must be present');assert.deepEqual(metrics,JSON.parse(readFileSync(path,'utf8')));}
console.log(process.argv.includes('--before')?'Pre-migration aggregate counts and balances recorded.':'PASS: student count, payment count, collected totals and current billed balances preserved.');
