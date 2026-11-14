(function () {
    'use strict';
    const form=document.getElementById('loanApplicationForm');
    if(!form) return;
    const schema=window.LoanApplication;
    const host=document.getElementById('applicationSteps');
    const back=document.getElementById('applicationBack'), next=document.getElementById('applicationNext'), submit=document.getElementById('applicationSubmit');
    const message=document.getElementById('applicationMessage');
    let current=0, busy=false, moving=false, requestId=crypto.randomUUID();
    const controls=new Map();
    function makeFields(fields,parent) {
        fields.forEach(f=>{
            const wrapper=document.createElement('div'); wrapper.className='application-field';
            const label=document.createElement('label'); label.htmlFor=f.id; label.textContent=f.label;
            const input=document.createElement(f.type==='select'?'select':f.type==='textarea'?'textarea':'input');
            input.id=f.id; input.name=f.id;
            if(!['select','textarea'].includes(f.type)) input.type=f.type;
            input.required=!f.optional;
            ['min','max','step','pattern','autocomplete','maxLength'].forEach(k=>{if(f[k]!==undefined)input.setAttribute(k,String(f[k]));});
            if(!['checkbox','number','date','select','textarea'].includes(f.type) && !f.maxLength) input.maxLength=200;
            if(f.type==='textarea') input.maxLength=3000;
            if(f.type==='select') {
                input.add(new Option('Select an answer',''));
                f.options.forEach(o=>input.add(new Option(o,o)));
            }
            if(f.id==='sin') {input.autocomplete='off';input.inputMode='numeric';}
            if(f.type==='checkbox') {wrapper.classList.add('application-check');wrapper.append(input,label);}
            else wrapper.append(label,input);
            if(f.help) {const help=document.createElement('small');help.id=f.id+'Help';help.textContent=f.help;input.setAttribute('aria-describedby',help.id);wrapper.append(help);}
            parent.append(wrapper);controls.set(f.id,input);
        });
    }
    const sections=schema.groups.map((g,i)=>{
        const section=document.createElement('section');section.className='app-step';section.hidden=i!==0;
        const title=document.createElement('h2');title.tabIndex=-1;title.textContent=g.title;section.append(title);
        if(i===6) {const review=document.createElement('div');review.id='applicationReview';section.append(review);}
        makeFields(g.fields,section);
        if(g.conditional) {
            const fieldset=document.createElement('fieldset');fieldset.hidden=true;fieldset.disabled=true;
            const legend=document.createElement('legend');legend.textContent=g.conditional.title;fieldset.append(legend);
            makeFields(g.conditional.fields,fieldset);section.append(fieldset);
        }
        host.append(section);return section;
    });
    const values=()=>Object.fromEntries([...controls].filter(([,c])=>!c.disabled).map(([id,c])=>[id,c.type==='checkbox'?c.checked:c.value.trim()]));
    function conditional() {
        const data=values();
        schema.groups.forEach((g,i)=>{
            if(!g.conditional)return;
            const active=g.conditional.when(data), fieldset=sections[i].querySelector('fieldset');
            fieldset.hidden=!active;fieldset.disabled=!active;
            g.conditional.fields.forEach(f=>controls.get(f.id).disabled=!active);
        });
    }
    function review() {
        const target=document.getElementById('applicationReview');target.replaceChildren();
        const data=values();
        schema.groups.slice(0,6).forEach((g,i)=>{
            const heading=document.createElement('h3');heading.textContent=g.title;
            const edit=document.createElement('button');edit.type='button';edit.className='btn btn-secondary';edit.textContent='Edit '+g.title.toLowerCase();edit.addEventListener('click',()=>go(i));
            target.append(heading,edit);
            const list=document.createElement('dl');
            [...g.fields,...(g.conditional && g.conditional.when(data)?g.conditional.fields:[])].forEach(f=>{
                const dt=document.createElement('dt'),dd=document.createElement('dd');
                dt.textContent=(f.id.startsWith('previous')?'Previous: ':'')+f.label;dd.textContent=data[f.id]||'—';list.append(dt,dd);
            });target.append(list);
        });
    }
    function validStep(index) {
        conditional();
        const result=schema.validate(values());
        for(const [id,input] of controls)input.setCustomValidity(result.errors?.[id]||'');
        for(const c of sections[index].querySelectorAll('input,select,textarea')) {
            if(!c.disabled && !c.checkValidity()) {c.reportValidity();c.focus();return false;}
        }
        return true;
    }
    async function go(index) {
        if(busy||moving)return;
        moving=true;
        message.textContent='';
        const old=sections[current];old.classList.add('is-leaving');
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise(r=>setTimeout(r,180));
        old.hidden=true;old.classList.remove('is-leaving');current=index;
        conditional();if(current===6)review();
        sections[current].hidden=false;
        back.hidden=current===0;next.hidden=current===6;submit.hidden=current!==6;
        document.getElementById('applicationProgressBar').style.width=((current+1)/7*100)+'%';
        document.getElementById('applicationProgress').setAttribute('aria-valuenow',current+1);
        document.getElementById('applicationProgressText').textContent='Step '+(current+1)+' of 7 · '+schema.groups[current].title;
        sections[current].querySelector('h2').focus();moving=false;
    }
    form.addEventListener('input',()=>{conditional();for(const c of controls.values())c.setCustomValidity('');});
    form.addEventListener('change',conditional);
    back.addEventListener('click',()=>go(current-1));
    next.addEventListener('click',()=>{if(validStep(current))go(current+1);});
    form.addEventListener('submit',async event=>{
        event.preventDefault();if(busy||moving)return;
        if(current<6) {if(validStep(current))go(current+1);return;}
        for(let i=0;i<7;i++) {
            const result=schema.validate(values());
            const invalid=schema.groups[i].fields.concat(schema.groups[i].conditional && schema.groups[i].conditional.when(values())?schema.groups[i].conditional.fields:[]).find(f=>result.errors?.[f.id]);
            if(invalid) {await go(i);validStep(i);return;}
        }
        if(window.SITE_CONFIG?.static || /(?:^|\.)github\.io$/.test(location.hostname)) {
            message.textContent='Applications require our application server. This static site cannot submit your information.';return;
        }
        busy=true;back.disabled=next.disabled=submit.disabled=true;
        const payload=schema.validate(values()).data;
        const enabled=[...controls.values()].filter(c=>!c.disabled);
        enabled.forEach(c=>c.disabled=true);
        message.textContent='Sending your application…';submit.textContent='Submitting…';
        // No browser storage: sensitive answers remain in memory only.
        try {
            const response=await fetch('/api/loan-applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,application:payload}),signal:AbortSignal.timeout(45000)});
            const result=await response.json();
            if(!response.ok)throw new Error(result.error||'Unable to submit. Please try again.');
            form.reset();form.hidden=true;
            const success=document.getElementById('applicationSuccess');success.hidden=false;success.focus();
            document.getElementById('applicationReview').replaceChildren();
            const emailNotice=result.emailStatus==='sent'
                ? 'A confirmation email has been sent. Please check your inbox and spam folder.'
                : 'Your application was received, but we could not confirm the email was sent. You do not need to submit again.';
            message.textContent='We will get back to you within 24 hours about whether we have found a lender based on the information you provided.\n'+emailNotice+'\nApplication reference: '+result.id;
        } catch(error) {message.textContent=error.name==='TimeoutError'?'Delivery could not be confirmed. Retry to check or complete this application.':error.message;}
        finally {busy=false;back.disabled=next.disabled=submit.disabled=false;submit.textContent='Submit application';enabled.forEach(c=>c.disabled=false);conditional();}
    });
    // Freeze answers while a request is in flight, preserving the same retry identifier.
    form.addEventListener('beforeinput',e=>{if(busy)e.preventDefault();});
    form.addEventListener('click',e=>{if(busy && e.target.matches('input,select,textarea'))e.preventDefault();});
    const queryProvince=new URLSearchParams(location.search).get('province');
    if(queryProvince)controls.get('currentProvince').value=queryProvince.toUpperCase();
    controls.get('dateOfBirth').max=new Date(Date.now()-86400000).toISOString().slice(0,10);
    if(window.SITE_CONFIG?.static || /(?:^|\.)github\.io$/.test(location.hostname)) message.textContent='You can review the application questions here, but this static site cannot submit applications. Please contact us to apply.';
    conditional();document.getElementById('applicationProgressBar').style.width=(100/7)+'%';
})();
