const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {configured,createApplicationMailer}=require('../lib/application-email');
const {createSheetsClient,columns}=require('../lib/google-sheets');

test('confirmation email uses applicant email, promised timeline, and a stable idempotency key',async()=>{
 let call;
 const send=createApplicationMailer({env:{RESEND_API_KEY:'test-only',APPLICATION_EMAIL_FROM:'Trusted Cash Loans <apply@example.com>'},fetchImpl:async(url,options)=>{call={url,options};return {ok:true,json:async()=>({id:'email-id'})};}});
 assert.equal(await send('application-id',{email:'applicant@example.com',sin:'sensitive',bankName:'private'}),'sent');
 const body=JSON.parse(call.options.body);
 assert.deepEqual(body.to,['applicant@example.com']);
 assert.match(body.text,/within 24 hours/);assert.match(body.text,/whether we have found a lender/);assert.match(body.text,/information you provided/);
 assert.ok(!call.options.body.includes('sensitive'));assert.ok(!call.options.body.includes('private'));
 assert.equal(call.options.headers['Idempotency-Key'],'application-confirmation/application-id');
});
test('missing config and provider failures never pretend an email was sent',async()=>{
 assert.equal(configured({}),false);
 assert.equal(await createApplicationMailer({env:{},fetchImpl:()=>{throw Error('Unexpected request');}})('id',{email:'test@example.com'}),'not_configured');
 for(const response of [{ok:false},{ok:true,json:async()=>({})}]) {
  const send=createApplicationMailer({env:{RESEND_API_KEY:'test',APPLICATION_EMAIL_FROM:'test@example.com'},fetchImpl:async()=>response});
  await assert.rejects(send('id',{email:'test@example.com'}));
 }
});
function setup({appendFails=false,statusWriteFails=false,old=false,legacyHeader=false}={}) {
 const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 let rows=legacyHeader?[columns.slice(0,-1)]:[],appends=0;
 if(old)rows=[columns,['existing-id','2020-01-01T00:00:00Z']];
 const client=createSheetsClient({env:{GOOGLE_SERVICE_ACCOUNT_EMAIL:'test@example.com',GOOGLE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GOOGLE_SHEETS_SPREADSHEET_ID:'test'},fetchImpl:async(url,options)=>{
  if(url.includes('oauth2'))return {ok:true,json:async()=>({access_token:'test',expires_in:3600})};
  const range=decodeURIComponent(url.split('/values/')[1].split('?')[0].replace(/:append$/, ''));
  let result={};
  if(options.method==='GET') {
   result={values:range.endsWith('!A:A')?rows.map(r=>[r[0]]):range.endsWith('!1:1')?[rows[0]]:[rows[1]]};
  }else if(options.method==='POST') {
   if(appendFails)return {ok:false,status:403};
   rows.push(JSON.parse(options.body).values[0]);appends++;result={updates:{updatedRows:1,updatedRange:"'Applications'!A2:ZZ2"}};
  }else if(range.endsWith('!A1'))rows[0]=JSON.parse(options.body).values[0];
  else {
   if(statusWriteFails)return {ok:false,status:503};
   rows[1][columns.length-1]=JSON.parse(options.body).values[0][0];
  }
  return {ok:true,json:async()=>result};
 }});
 return {client,getRows:()=>rows,getAppends:()=>appends};
}
test('email sends after append, is recorded, and duplicate application retries do not send twice',async()=>{
 const state=setup();let sends=0;
 const notify=async(id,app)=>{sends++;assert.equal(state.getAppends(),1);assert.equal(app.email,'original@example.com');return 'sent';};
 await state.client.append('id',{email:'original@example.com'},notify);
 await state.client.append('id',{email:'different@example.com'},notify);
 assert.equal(sends,1);assert.equal(state.getAppends(),1);assert.equal(state.getRows()[1].at(-1),'sent');
});
test('email failure preserves the accepted application and retries against original recipient',async()=>{
 const state=setup({legacyHeader:true});
 assert.equal((await state.client.append('id',{email:'original@example.com'},async()=>{throw Error('offline');})).emailStatus,'failed');
 assert.equal(state.getRows()[1].at(-1),'failed');
 assert.equal((await state.client.append('id',{email:'different@example.com'},async(id,app)=>{assert.equal(app.email,'original@example.com');return 'sent';})).emailStatus,'sent');
 assert.equal(state.getAppends(),1);assert.deepEqual(state.getRows()[0],columns);
});
test('unreceived applications never send; old ambiguous confirmations need review; failed status write preserves success',async()=>{
 const failing=setup({appendFails:true});await assert.rejects(failing.client.append('id',{},()=>{throw Error('Must not send');}));
 const old=setup({old:true});assert.equal((await old.client.append('existing-id',{},()=>{throw Error('Must not send');})).emailStatus,'needs_review');
 const uncertain=setup({statusWriteFails:true});assert.equal((await uncertain.client.append('id',{},async()=>'sent')).emailStatus,'sent');
});
