'use strict';
function configured(env = process.env) {
    return Boolean(env.RESEND_API_KEY && env.APPLICATION_EMAIL_FROM);
}
function createApplicationMailer({env = process.env, fetchImpl = fetch} = {}) {
    return async function sendConfirmation(id, application) {
        if (!configured(env)) return 'not_configured';
        const text = [
            'Thank you for applying with Trusted Cash Loans.',
            '',
            'We have received your application. We will get back to you within 24 hours to let you know whether we have found a lender for you based on the information you provided.',
            '',
            'Application reference: ' + id,
            '',
            'Thank you,',
            'Trusted Cash Loans'
        ].join('\n');
        const response = await fetchImpl('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + env.RESEND_API_KEY,
                'Content-Type': 'application/json',
                'Idempotency-Key': 'application-confirmation/' + id
            },
            body: JSON.stringify({
                from: env.APPLICATION_EMAIL_FROM,
                to: [application.email],
                subject: 'We received your Trusted Cash Loans application',
                text
            }),
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error('Confirmation email could not be sent');
        const result = await response.json();
        if (!result.id) throw new Error('Confirmation email delivery unconfirmed');
        // Provider acceptance does not guarantee arrival in the recipient's inbox.
        return 'sent';
    };
}
module.exports = {configured, createApplicationMailer};
