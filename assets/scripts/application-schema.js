(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.LoanApplication = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const provinces = ['BC','AB','SK','MB','ON','QC','NB','NS','PE','NL','YT','NT','NU'];
    const field = (id, label, type = 'text', extra = {}) => ({ id, label, type, ...extra });
    const select = (id, label, options) => field(id, label, 'select', { options });
    const money = (id, label) => field(id, label, 'number', { min: 0, max: 1000000, step: '0.01' });
    const months = (id, label) => field(id, label, 'number', { min: 0, max: 1200, step: '1' });
    function address(prefix) {
        return [field(prefix+'Street', 'Street address'),field(prefix+'City', 'City'),select(prefix+'Province','Province or territory',provinces),field(prefix+'PostalCode','Postal code','text',{pattern:'[A-Za-z][0-9][A-Za-z][ -]?[0-9][A-Za-z][0-9]'})];
    }
    function employment(prefix) {
        return [field(prefix+'Employer','Employer name'),field(prefix+'Position','Position'),money(prefix+'Pay','Take-home pay per pay period (CAD)'),select(prefix+'PayMethod','How are you paid?',['Direct deposit','Cheque','Cash','Other']),select(prefix+'PayFrequency','How often are you paid?',['Weekly','Every two weeks','Twice a month','Monthly','Other']),field(prefix+'LastPayday','Last payday','date'),field(prefix+'NextPayday','Next payday','date'),field(prefix+'Phone','Work phone number','tel'),field(prefix+'Supervisor','Supervisor name'),...address(prefix+'Work'),months(prefix+'Months','Months worked here')];
    }
    const groups = [
        { title: 'Personal details', fields: [field('firstName','First name','text',{autocomplete:'given-name'}),field('lastName','Last name','text',{autocomplete:'family-name'}),field('email','Email','email',{autocomplete:'email'}),field('phone','Phone number','tel',{autocomplete:'tel'}),field('dateOfBirth','Birthday','date',{autocomplete:'bday'})] },
        { title: 'Your address', fields: [...address('current'),months('addressMonths','Months at this address')], conditional: { title:'Previous address', when: d => d.addressMonths !== '' && Number(d.addressMonths) <= 12, fields:address('previous') } },
        { title: 'Employment and pay', fields: employment('current'), conditional:{title:'Previous employment',when:d=>d.currentMonths !== '' && Number(d.currentMonths)<3,fields:employment('previous')} },
        { title: 'Banking', fields:[field('bankName','Bank name'),select('directDeposit','Do you receive your pay by direct deposit?',['Yes','No']),field('payrollBank','Which bank receives your pay?')] },
        { title: 'Loan and housing', fields:[select('loanType','Type of loan',['Personal','Debt consolidation','Auto','Emergency','Business']),field('loanAmount','Requested amount (CAD)','number',{min:500,max:500000,step:'0.01'}),select('housing','Do you rent or own?',['Rent','Own','Other']),money('housingPayment','Monthly rent or mortgage (CAD)'),select('hasLoans','Do you have outstanding loans?',['Yes','No'])], conditional:{title:'Outstanding loans',when:d=>d.hasLoans==='Yes',fields:[field('loanDetails','List each lender and the amount owing (CAD)','textarea')]} },
        { title: 'Two references', fields: [1,2].flatMap(n=>[field('reference'+n+'FirstName','Reference '+n+': first name'),field('reference'+n+'LastName','Reference '+n+': last name'),field('reference'+n+'Relationship','Reference '+n+': relationship'),field('reference'+n+'Phone','Reference '+n+': phone number','tel')]) },
        { title: 'Review and submit', fields:[field('truthful','I confirm that everything in this form is true and complete.','checkbox'),field('sin','Social insurance number (optional)','text',{optional:true,pattern:'[0-9]{9}',maxLength:9,help:'Providing your SIN is optional. Enter nine digits without spaces.'}),field('creditConsent','I consent to a credit check for this loan application.','checkbox')] }
    ];
    const allFields = groups.flatMap(g=>[...g.fields,...(g.conditional?g.conditional.fields:[])]);
    const activeFields = data => groups.flatMap(g=>[...g.fields,...(g.conditional && g.conditional.when(data)?g.conditional.fields:[])]);
    function validate(input) {
        if (!input || typeof input!=='object' || Array.isArray(input)) return {error:'Invalid application.'};
        const data={};
        for(const f of allFields) data[f.id]=typeof input[f.id]==='string'?input[f.id].trim():input[f.id]===true?true:'';
        const errors={};
        for(const f of activeFields(data)) {
            const v=data[f.id];
            if(f.optional && v==='') continue;
            let valid=typeof v==='string' && v.length>0 && v.length<=(f.maxLength|| (f.type==='textarea'?3000:200));
            if(f.type==='checkbox') valid=v===true;
            if(f.type==='number') valid=valid && Number.isFinite(Number(v)) && Number(v)>=f.min && Number(v)<=f.max && (f.step!=='1'||Number.isInteger(Number(v)));
            if(f.type==='select') valid=valid && f.options.includes(v);
            if(f.type==='email') valid=valid && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            if(f.type==='tel') valid=valid && /^[+\d(). -]+$/.test(v) && v.replace(/\D/g,'').length>=10 && v.replace(/\D/g,'').length<=15;
            if(f.pattern) valid=valid && new RegExp('^(?:'+f.pattern+')$').test(v);
            if(f.type==='date') valid=valid && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
            if(!valid) errors[f.id]='Check '+f.label.toLowerCase()+'.';
        }
        const today=new Date().toISOString().slice(0,10);
        if(data.dateOfBirth>=today) errors.dateOfBirth='Enter a birthday in the past.';
        for(const prefix of ['current',...(Number(data.currentMonths)<3?['previous']:[])]) {
            if(data[prefix+'LastPayday'] && data[prefix+'NextPayday'] && data[prefix+'LastPayday']>=data[prefix+'NextPayday']) errors[prefix+'NextPayday']='Next payday must be after last payday.';
        }
        const clean={};
        for(const f of activeFields(data)) clean[f.id]=data[f.id];
        return {data:clean, errors, error:Object.keys(errors).length?'Please check the highlighted answers.':null};
    }
    return {groups,allFields,activeFields,validate};
});
