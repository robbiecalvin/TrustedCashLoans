'use strict';
const crypto = require('node:crypto');
const { allFields } = require('../assets/scripts/application-schema');
const columns = ['Application ID', 'Submitted at', ...allFields.map(f => f.id)];
function configured(env = process.env) {
    return ['GOOGLE_SHEETS_SPREADSHEET_ID','GOOGLE_SERVICE_ACCOUNT_EMAIL','GOOGLE_PRIVATE_KEY'].every(k => Boolean(env[k]));
}
function createSheetsClient({env = process.env, fetchImpl = fetch} = {}) {
    let token, expiresAt = 0;
    async function accessToken() {
        if (token && Date.now() < expiresAt) return token;
        const now = Math.floor(Date.now()/1000);
        const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
        const unsigned = encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:env.GOOGLE_SERVICE_ACCOUNT_EMAIL,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
        const signature = crypto.sign('RSA-SHA256',Buffer.from(unsigned),env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,'\n')).toString('base64url');
        const response = await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature}),signal:AbortSignal.timeout(10000)});
        if(!response.ok) throw new Error('Google authentication failed');
        const data = await response.json();
        if(!data.access_token)throw new Error('Google authentication failed');
        token=data.access_token;expiresAt=Date.now()+Math.max(0,(Number(data.expires_in)||3600)-60)*1000;return token;
    }
    async function request(range, method='GET', body, suffix='') {
        const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(env.GOOGLE_SHEETS_SPREADSHEET_ID)+'/values/'+encodeURIComponent(range)+suffix;
        const response=await fetchImpl(url,{method,headers:{Authorization:'Bearer '+await accessToken(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
        if(!response.ok){if(response.status===401){token=null;expiresAt=0;}throw new Error('Google Sheets request failed');}
        return response.json();
    }
    // Serialize this process's appends so duplicate retries and header creation cannot race.
    let queue=Promise.resolve();
    function append(id, application) {
        const operation=queue.then(async()=>{
            const tab="'"+(env.GOOGLE_SHEETS_TAB||'Applications').replace(/'/g,"''")+"'";
            const existing=await request(tab+'!A:A');
            const rows=existing.values||[];
            if(rows.some(row=>row[0]===id))return;
            if(rows.length===0) await request(tab+'!A1','PUT',{values:[columns]},'?valueInputOption=RAW');
            else {
                const header=await request(tab+'!1:1');
                if(JSON.stringify(header.values?.[0])!==JSON.stringify(columns))throw new Error('Google Sheet header does not match the application schema');
            }
            const row=[id,new Date().toISOString(),...allFields.map(f=>application[f.id]??'')];
            const result=await request(tab+'!A:A','POST',{values:[row]},':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS');
            if(result.updates?.updatedRows!==1)throw new Error('Google Sheets delivery unconfirmed');
        });
        queue=operation.catch(()=>{});return operation;
    }
    return {append};
}
module.exports={configured,createSheetsClient,columns};
