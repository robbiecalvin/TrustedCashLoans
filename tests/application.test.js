const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const schema=require('../assets/scripts/application-schema');
const {createSheetsClient,columns}=require('../lib/google-sheets');
function fixture(){
 const data={};
 for(const f of schema.allFields){
  data[f.id]=f.type==='checkbox'?true:f.type==='select'?f.options[0]:f.type==='number'?'24':f.type==='date'?'2000-01-01':f.type==='tel'?'6045550100':f.type==='email'?'test@example.com':f.pattern?'V6B 1A1':'Example';
 }
 data.loanAmount='5000';data.sin='';data.currentLastPayday='2026-01-01';data.currentNextPayday='2026-01-15';data.hasLoans='No';return data;
}
test('valid application omits optional SIN and inactive history; ignores unknown keys',()=>{
 const data=fixture();data.secret='unexpected';const result=schema.validate(data);assert.equal(result.error,null);assert.equal(result.data.sin,'');assert.equal(result.data.previousEmployer,undefined);assert.equal(result.data.previousStreet,undefined);assert.equal(result.data.secret,undefined);
});
test('history boundaries are enforced, including all previous employer fields',()=>{
 const data=fixture();data.addressMonths='12';data.previousStreet='';assert.ok(schema.validate(data).errors.previousStreet);
 data.addressMonths='13';assert.equal(schema.validate(data).errors.previousStreet,undefined);
 data.currentMonths='2';data.previousSupervisor='';assert.ok(schema.validate(data).errors.previousSupervisor);
 data.currentMonths='3';assert.equal(schema.validate(data).errors.previousSupervisor,undefined);
});
test('rejects missing references, loans, invalid dates, pay order, consent and optional SIN format',()=>{
 for(const [key,value] of [['reference2Phone','123'],['creditConsent',false],['truthful',false],['dateOfBirth','2000-02-31'],['sin','123'],['currentNextPayday','2025-01-01'],['loanAmount','-1']]){
 const data=fixture();data[key]=value;assert.ok(schema.validate(data).errors[key],key);
 }
 const data=fixture();data.hasLoans='Yes';data.loanDetails='';assert.ok(schema.validate(data).errors.loanDetails);
});
test('Sheets appends RAW fields and deduplicates retries without keeping local applications',async()=>{
 const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const env={GOOGLE_SERVICE_ACCOUNT_EMAIL:'test@example.com',GOOGLE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GOOGLE_SHEETS_SPREADSHEET_ID:'test'};
 const rows=[],calls=[];
 const client=createSheetsClient({env,fetchImpl:async(url,options)=>{
  calls.push({url,options});let value={};
  if(url.includes('oauth2'))value={access_token:'test-token',expires_in:3600};
  else if(options.method==='GET')value={values:url.includes('1%3A1')?[columns]:rows.map(r=>[r[0]])};
  else if(options.method==='PUT')rows.push(JSON.parse(options.body).values[0]);
  else {rows.push(JSON.parse(options.body).values[0]);value={updates:{updatedRows:1}};}
  return {ok:true,json:async()=>value};
 }});
 const data=schema.validate(fixture()).data;data.firstName='=FORMULA()';
 await Promise.all([client.append('same-id',data),client.append('same-id',data)]);
 assert.equal(rows.length,2);assert.deepEqual(rows[0],columns);assert.equal(rows[1][2],'=FORMULA()');
 assert.ok(calls.filter(c=>c.options.method==='POST' && !c.url.includes('oauth2')).every(c=>c.url.includes('valueInputOption=RAW')));
});
test('Sheets failure propagates instead of confirming delivery',async()=>{
 const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const client=createSheetsClient({env:{GOOGLE_SERVICE_ACCOUNT_EMAIL:'test',GOOGLE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GOOGLE_SHEETS_SPREADSHEET_ID:'test'},fetchImpl:async()=>({ok:false,status:403})});
 await assert.rejects(client.append('id',fixture()),/authentication failed/);
});
module.exports={fixture};
