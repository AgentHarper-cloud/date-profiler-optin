// Quiz Subscriber Sales Maximizer Sequence
// Runs daily via Vercel cron (0 14 * * * = 7am PDT)
// Sends emails 2-6 to quiz opt-in subscribers based on next_send_at timestamp

const https = require('https');

const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_TOKEN;
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const SALES_URL = 'https://go.thedateprofiler.com/sales-page';
const SKOOL_URL = 'https://www.skool.com/date-like-a-profiler-skool-2923/about';
const UNSUB_BASE = 'https://date-profiler-optin.vercel.app/api/unsubscribe?email=';

// Delays after each email (ms) before sending the next
const NEXT_SEND_DELAYS = {
  3: 24 * 3600 * 1000,   // after Email 2 → Email 3 in 24h
  4: 48 * 3600 * 1000,   // after Email 3 → Email 4 in 48h
  5: 24 * 3600 * 1000,   // after Email 4 → Email 5 in 24h
  6: 12 * 3600 * 1000,   // after Email 5 → Email 6 in 12h (caught next morning)
  7: null,               // Email 6 is last — mark complete after sending
};

function post(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getGmailToken() {
  const r = await post('https://oauth2.googleapis.com/token', {
    client_id: GMAIL_CLIENT_ID, client_secret: GMAIL_CLIENT_SECRET,
    refresh_token: GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token'
  }, {});
  return r.access_token;
}

async function tursoQuery(sql) {
  const r = await post(TURSO_URL + '/v2/pipeline', {
    requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }]
  }, { Authorization: `Bearer ${TURSO_TOKEN}` });
  return r.results[0];
}

async function sendEmail(to, subject, html, token) {
  const msg = `From: Stephanie | The Date Profiler <AgentHarper@thedateprofiler.com>\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}`;
  const raw = Buffer.from(msg).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { raw },
    { Authorization: `Bearer ${token}` });
}

function wrap(body, unsub) {
  return `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px;color:#222;">${body}<hr style="margin-top:40px;border:none;border-top:1px solid #eee;"><p style="font-size:12px;color:#999;"><a href="${unsub}">Unsubscribe</a></p></div>`;
}

function link(text, url) {
  return `<a href="${url}" style="color:#7B5EA7;">${text}</a>`;
}

function getEmailContent(nextEmail, first, unsub) {
  // nextEmail is what's CURRENTLY stored — the email we need to send now
  // (next_email=3 means Email 2 is due, next_email=4 means Email 3 is due, etc.)
  const emailNum = nextEmail - 1; // convert to sequence number

  const emails = {
    2: {
      subject: 'The thing nobody told you about reading people',
      body: `<p>Hey ${first},</p>
<p>Yesterday I mentioned that the real problem isn't trust, it's tools.</p>
<p>Here's what I mean.</p>
<p>Most women go into dating looking for chemistry. That's what the movies trained us to want. The butterflies, the spark, the feeling of being chosen.</p>
<p>The problem is that manipulators are very good at creating exactly that feeling. On purpose.</p>
<p>What they can't fake is their pattern.</p>
<p>Behavior over time is the only thing that tells the truth. Not what he says on the first date. Not how he makes you feel in week two. What he actually does, consistently, over time, especially when things get a little uncomfortable.</p>
<p>I call this profiling the pattern instead of the person.</p>
<p>Here's the three-part framework I use:</p>
<p><strong>Step 1: Observe without explaining.</strong> When something feels off, notice it before you explain it away. Write it down if you have to. "He said he'd call at 7 and didn't call until 10" is data. "He was probably just busy" is a story. Keep the data.</p>
<p><strong>Step 2: Look for repetition.</strong> One instance is an incident. Two might be a coincidence. Three is a pattern. The pattern is what you're assessing, not the individual moment.</p>
<p><strong>Step 3: Watch how he handles friction.</strong> How someone behaves when things don't go their way tells you more about their character than anything they say when they're trying to impress you. Conflict is the reveal.</p>
<p>That's the foundation. Everything else I teach builds on this.</p>
<p>Tomorrow I'll share a bit more about how I got here and two specific resources I want to put in your hands.</p>
<p>Stephanie<br>The Date Profiler</p>`
    },
    3: {
      subject: 'Two things I want you to have (one is free)',
      body: `<p>Hey ${first},</p>
<p>It's been a few days since you took the quiz. I want to check in.</p>
<p>Have you had a chance to sit with your results? Did anything land for you, something you recognized, or something that surprised you?</p>
<p>I ask because the quiz is designed to start a conversation, not end one. The real work happens when you start applying the framework to what's actually in front of you.</p>
<p>Which brings me to why I'm writing today.</p>
<p>I want to make sure you have two things:</p>
<p><strong>The first is free.</strong></p>
<p>I run a private community called The Date Profiler Headquarters. It's a space where women can have the real conversations about dating, the ones you can't have with your friends because they're tired of hearing about it, or because they'll just tell you what you want to hear.</p>
<p>Inside the community we talk about red flags, green flags, patterns, gut feelings, and what healthy actually looks like. No toxic positivity. No "he's just not ready." Just honest, grounded conversation.</p>
<p>If that's the kind of space you've been looking for, I'd love to have you in there. It's free.</p>
<p>Join us here: ${link('The Date Profiler Headquarters', SKOOL_URL)}</p>
<p><strong>The second is not free, but it's close.</strong></p>
<p>${link('The Date Profiler Field Manual', SALES_URL)} is the complete system I built after years of applying what I learned in law enforcement to real life. It walks you through how to assess someone's character early, how to identify the patterns that matter, and how to trust your own read of a situation, even when your feelings are complicated.</p>
<p>It's not a list of rules. It's a framework. The same kind I use personally.</p>
<p>Right now, you can get it for $17. This is an introductory offer and that price will go up, but I want the women who found me early to have access first.</p>
<p>Get it here: ${link('The Date Profiler Field Manual', SALES_URL)}</p>
<p>Hit reply and let me know how you're doing. I read every response.</p>
<p>Stephanie<br>The Date Profiler</p>`
    },
    4: {
      subject: "The thing I had to learn the hard way",
      body: `<p>Hey ${first},</p>
<p>I didn't build this framework because I was good at reading people.</p>
<p>I built it because I wasn't.</p>
<p>I was married to someone who was charming, attentive, and completely convincing. The guy I fell in love with felt real. Turned out he was the performance. What came after was something different.</p>
<p>I didn't see it clearly until a coworker made an offhand comment about domestic violence. She mentioned that threatening to harm a pet was considered abuse.</p>
<p>I drove home that night thinking about my dog.</p>
<p>I started googling. I went through every list, every sign, every pattern. And I sat there checking boxes I didn't want to check.</p>
<p>The thing that hit me hardest wasn't the anger or the fear. It was the recognition.</p>
<p>I had spent years in law enforcement studying exactly how manipulators operate. I knew the tactics. I had seen them used on other people. And I had still missed it in my own life.</p>
<p>Because love bombing works. The version of him I fell in love with felt completely real. I kept waiting for that person to come back. I kept explaining away the version that showed up instead.</p>
<p>The man I fell in love with was the tactic. The rest was who he actually was.</p>
<p>After my divorce I started applying everything I knew professionally to my personal life. Not to become cynical. To stop being someone who needed a coworker's comment to see what was right in front of me.</p>
<p>That's what the Field Manual is. It's the system I wish I'd had before any of it happened.</p>
<p>If you're ready for it: ${link('The Date Profiler Field Manual', SALES_URL)}</p>
<p>Still $17. Not forever.</p>
<p>Stephanie<br>The Date Profiler</p>`
    },
    5: {
      subject: "What's inside the Field Manual (and why $17 won't last)",
      body: `<p>Hey ${first},</p>
<p>I want to make sure you know exactly what's inside the Field Manual before you decide, because today is the day to decide.</p>
<p>Here's what it covers:</p>
<p><strong>Part 1: How to read behavior instead of words.</strong> Most people listen to what someone says. The Field Manual teaches you to watch what they do and specifically what to look for in the first few weeks of dating.</p>
<p><strong>Part 2: The patterns that matter.</strong> A breakdown of the most common manipulation tactics, explained in plain language, with the specific signs to watch for in real life situations.</p>
<p><strong>Part 3: Your internal system.</strong> How to tell the difference between anxiety and intuition, and how to trust your own read of a situation even when your feelings are complicated.</p>
<p><strong>Part 4: The green flag framework.</strong> Because this isn't about becoming cynical. It's about knowing what safe actually looks and feels like, so you can recognize it when it's in front of you.</p>
<p>It was built from 15 years of studying how people operate, a Master's in Counseling, and a lot of personal experience applying all of that to my own life after divorce.</p>
<p>And when you get it at the founding price, it also comes with the Profiler in Your Purse GPT, a custom AI tool built on the same framework as the Field Manual. You bring it a real situation you are dealing with right now, and it walks you through what the patterns suggest, what level of concern to have, and what to watch next. It is the Field Manual, but interactive and available at 2am when you actually need it.</p>
<p><strong>Here is the honest reason to get it now:</strong></p>
<p>I am adding video trainings to the Field Manual. When that update is complete, the price goes up. Everyone who buys before the update is locked in at $17 and gets the video content at no extra charge.</p>
<p>The trainings are in progress and the price increases when they are done.</p>
<p>Get it at the founding price: ${link('The Date Profiler Field Manual', SALES_URL)}</p>
<p>Stephanie<br>The Date Profiler</p>`
    },
    6: {
      subject: 'Before I stop mentioning this',
      body: `<p>Hey ${first},</p>
<p>This is the last email I'll send about the Field Manual for a while, so I want to be straightforward with you.</p>
<p>Right now it's $17. I'm adding video trainings to it, and when those are ready the price goes up. Anyone who buys before the update gets the videos included, no extra charge, no upsell.</p>
<p>I don't know exactly when the videos will be done. What I do know is that when they are, $17 goes away.</p>
<p>If you've been thinking about it all week, this is the nudge.</p>
<p>If it doesn't feel right yet, that's genuinely okay. You're always welcome here and I'll keep showing up in your inbox with useful things regardless.</p>
<p>But if you're ready: ${link('The Date Profiler Field Manual', SALES_URL)}</p>
<p>Either way, I'm glad you're here.</p>
<p>Stephanie<br>The Date Profiler</p>
<p>PS: Questions about whether it's right for you? Hit reply. I actually respond.</p>`
    }
  };

  return emails[emailNum] || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = Date.now();
    const gmailToken = await getGmailToken();

    // Get all subscribers due for their next email
    const result = await tursoQuery(
      `SELECT id, email, first_name, next_email FROM quiz_subscribers 
       WHERE next_email >= 3 AND next_email <= 7 AND completed = 0 AND next_send_at <= ${now}
       LIMIT 50`
    );

    const rows = result.response?.result?.rows || [];
    console.log(`Found ${rows.length} subscribers due for email`);

    let sent = 0;
    let errors = 0;

    for (const row of rows) {
      const id = row[0].value;
      const email = row[1].value;
      const firstName = (row[2].value || 'Friend').split(' ')[0];
      const nextEmail = parseInt(row[3].value);
      const unsub = UNSUB_BASE + encodeURIComponent(email);

      const content = getEmailContent(nextEmail, firstName, unsub);
      if (!content) continue;

      try {
        const html = wrap(content.body, unsub);
        await sendEmail(email, content.subject, html, gmailToken);
        sent++;

        // Calculate next state
        const delay = NEXT_SEND_DELAYS[nextEmail];
        if (delay !== null && nextEmail < 7) {
          const nextSendAt = now + delay;
          await tursoQuery(
            `UPDATE quiz_subscribers SET next_email=${nextEmail + 1}, next_send_at=${nextSendAt} WHERE id=${id}`
          );
        } else {
          // Email 6 sent — mark complete
          await tursoQuery(
            `UPDATE quiz_subscribers SET next_email=8, completed=1 WHERE id=${id}`
          );
        }

        // Small delay between sends
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`Error sending to ${email}:`, err.message);
        errors++;
      }
    }

    return res.status(200).json({ 
      success: true, 
      processed: rows.length, 
      sent, 
      errors,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('process-emails error:', err);
    return res.status(500).json({ error: err.message });
  }
};
