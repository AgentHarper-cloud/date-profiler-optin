export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firstName, email } = req.body;

  if (!firstName || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

  try {
    // Create or update contact in GHL
    const contactRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        firstName,
        email,
        tags: ['free-quiz-optin'],
        source: 'Red Flag or Overthinking Quiz Opt-in',
      }),
    });

    if (!contactRes.ok) {
      const errText = await contactRes.text();
      console.error('GHL contact error:', errText);
      // Don't fail — still redirect to thank you
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
