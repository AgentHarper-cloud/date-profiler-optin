// Quiz opt-in handler
// 1. Creates GHL contact with free-quiz-optin tag
// 2. Inserts into quiz_subscribers Turso table
// 3. Sends quiz delivery email immediately
// 4. Sends Sales Maximizer Email 1 immediately
// 5. Schedules Email 2 for 24h later

const https = require('https');

const SALES_URL = 'https://go.thedateprofiler.com/sales-page?utm_source=email&utm_medium=email&utm_campaign=quiz-sequence&utm_content=email1';
const QUIZ_PDF_URL = 'https://drive.google.com/uc?id=1hYvaw848NRsFsYvbErduQNqblM42-fo8&export=download';
const UNSUB_BASE = 'https://date-profiler-optin.vercel.app/api/unsubscribe?email=';

function post(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } }); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getGmailToken() {
  const r = await post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GMAIL_CLIENT_ID,
    client_secret: process.env.GMAIL_CLIENT_SECRET,
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  }, {});
  return r.access_token;
}

async function sendEmail(to, subject, html, token) {
  const msg = `From: Stephanie | The Date Profiler <AgentHarper@thedateprofiler.com>\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}`;
  const raw = Buffer.from(msg).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { raw },
    { Authorization: `Bearer ${token}` });
}

async function tursoQuery(sql) {
  const TURSO_URL = process.env.TURSO_URL;
  const TURSO_TOKEN = process.env.TURSO_TOKEN;
  const r = await post(`${TURSO_URL}/v2/pipeline`, {
    requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }]
  }, { Authorization: `Bearer ${TURSO_TOKEN}` });
  return r.results[0];
}

function deliveryEmailHtml(first, unsub) {
  return `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px;color:#222;">
<p>Hey ${first},</p>
<p>Your Red Flag or Overthinking? guide is ready.</p>
<p style="margin:24px 0;"><a href="${QUIZ_PDF_URL}" style="display:inline-block;background:#7B5EA7;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:16px;">Download Your Guide</a></p>
<p>Save this email — it's your permanent download link.</p>
<p>Over the next few days I'll be sending you my best tools for reading people clearly and dating from a place of confidence, not confusion.</p>
<p>Questions? Just hit reply.</p>
<p>Stephanie<br>The Date Profiler</p>
<hr style="margin-top:40px;border:none;border-top:1px solid #eee;"><p style="font-size:12px;color:#999;"><a href="${unsub}">Unsubscribe</a></p></div>`;
}

function email1Html(first, unsub) {
  return `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px;color:#222;">
<p>Hey ${first},</p>
<p>I'm willing to bet you didn't take the Red Flag or Overthinking quiz because you think you're bad at dating.</p>
<p>I think you took it because you're tired of second-guessing yourself.</p>
<p>Tired of the back-and-forth in your head. Tired of talking yourself out of things you already know. Tired of wondering why the same patterns keep showing up.</p>
<p>That's not a dating problem. That's a tools problem.</p>
<p>You've been told to "trust your gut" your whole life. Nobody ever told you how to tell the difference between your gut and your anxiety. Nobody gave you a framework for reading the patterns that actually matter.</p>
<p>That's what I'm here for.</p>
<p>I'm Stephanie. I have a Master's in Counseling and spent 15 years in law enforcement studying how manipulative people operate. After my own divorce, I started applying everything I'd learned professionally to my dating life and it made a huge difference.</p>
<p>I didn't become cynical... I just finally had a way to see the patterns clearly.</p>
<p>Over the next few days I'm going to share some of my best tools with you. The kind of stuff that helps you walk into a situation with your eyes open and actually enjoy it.</p>
<p>Tomorrow I'll share the single most important shift I made that changed the way I read people.</p>
<p>Until then, if you haven't gone through your guide yet, do that first. The clarity is in the details.</p>
<p>Stephanie<br>The Date Profiler</p>
<p>PS: When you're ready to go deeper, I put together a complete system called <a href="${SALES_URL}" style="color:#7B5EA7;">The Date Profiler Field Manual</a>. It's everything I use to assess someone's character early, spot the patterns that matter, and make decisions from a place of confidence instead of confusion. Right now it's available at a special introductory price of $17. I'll tell you more about it this week, but if you're curious: <a href="${SALES_URL}" style="color:#7B5EA7;">The Date Profiler Field Manual</a></p>
<hr style="margin-top:40px;border:none;border-top:1px solid #eee;"><p style="font-size:12px;color:#999;"><a href="${unsub}">Unsubscribe</a></p></div>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firstName, email } = req.body;
  if (!firstName || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const first = firstName.split(' ')[0];
  const unsub = UNSUB_BASE + encodeURIComponent(email);
  const now = Date.now();
  const next24h = now + (24 * 3600 * 1000);

  try {
    // 1. Create GHL contact
    try {
      await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId: process.env.GHL_LOCATION_ID,
          firstName,
          email,
          tags: ['free-quiz-optin'],
          source: 'Red Flag or Overthinking Quiz Opt-in',
        }),
      });
    } catch (e) {
      console.error('GHL error (non-fatal):', e.message);
    }

    // 2. Insert into Turso (ignore duplicate emails)
    try {
      const escapedEmail = email.replace(/'/g, "''");
      const escapedName = firstName.replace(/'/g, "''");
      await tursoQuery(
        `INSERT OR IGNORE INTO quiz_subscribers (email, first_name, opted_in_at, next_email, completed, next_send_at) 
         VALUES ('${escapedEmail}', '${escapedName}', ${now}, 3, 0, ${next24h})`
      );
    } catch (e) {
      console.error('Turso error (non-fatal):', e.message);
    }

    // 3. Send both emails
    try {
      const gmailToken = await getGmailToken();
      // Quiz delivery email
      await sendEmail(email, "Here's your Red Flag or Overthinking? guide", deliveryEmailHtml(first, unsub), gmailToken);
      // Short delay then Sales Maximizer Email 1
      await new Promise(r => setTimeout(r, 500));
      await sendEmail(email, "I bet you took that quiz for this reason...", email1Html(first, unsub), gmailToken);
    } catch (e) {
      console.error('Email send error (non-fatal):', e.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
