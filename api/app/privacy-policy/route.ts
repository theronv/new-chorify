// Privacy Policy page for Chorify — served at /privacy-policy
// Returns static HTML (no database access required)

export const runtime = 'edge'

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — Chorify</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: #1f2937;
      background: #f9fafb;
      padding: 2rem 1rem;
    }
    .container { max-width: 720px; margin: 0 auto; }
    header { margin-bottom: 2.5rem; }
    .logo { font-size: 1.75rem; font-weight: 700; color: #4F46E5; margin-bottom: 0.25rem; }
    h1 { font-size: 1.5rem; font-weight: 600; color: #111827; }
    .updated { color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem; }
    h2 { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 2rem 0 0.5rem; }
    p  { margin-bottom: 1rem; color: #374151; }
    ul { margin: 0.5rem 0 1rem 1.5rem; color: #374151; }
    li { margin-bottom: 0.25rem; }
    a  { color: #4F46E5; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">Chorify</div>
      <h1>Privacy Policy</h1>
      <p class="updated">Effective date: March 1, 2026</p>
    </header>

    <div class="card">
      <p>
        Chorify (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is a household
        chore-tracking app for families. This Privacy Policy describes what information we
        collect, how we use it, and your rights regarding that information.
      </p>

      <h2>1. Information We Collect</h2>
      <p>We collect only what is necessary to operate the app:</p>
      <ul>
        <li><strong>Account information:</strong> email address and a hashed password when you sign up.</li>
        <li><strong>Profile information:</strong> display name and an emoji avatar you choose.</li>
        <li><strong>Household data:</strong> task names, completion records, and reward definitions you create.</li>
        <li><strong>Push notification token:</strong> a device token provided by Apple/Expo so we can send you chore reminders. Stored only if you grant notification permission.</li>
      </ul>
      <p>We do <strong>not</strong> collect location data, contacts, photos, payment information, or any device identifiers beyond the notification token.</p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To authenticate you and sync your household data across devices.</li>
        <li>To send push notifications when tasks are due (only if you grant permission).</li>
        <li>To display chore history, streaks, and point totals within the app.</li>
      </ul>
      <p>We do <strong>not</strong> sell, rent, or share your personal information with third parties for marketing purposes.</p>

      <h2>3. Data Storage</h2>
      <p>
        Your data is stored in a managed SQLite database (Turso) hosted on AWS infrastructure
        in the United States. Passwords are never stored in plain text — they are hashed using
        PBKDF2 with a unique salt per account.
      </p>

      <h2>4. Data Retention</h2>
      <p>
        Your data is retained for as long as your account is active. Task completion records
        are kept for 30 days to power the streak and history features, then deleted automatically.
      </p>

      <h2>5. Children&rsquo;s Privacy</h2>
      <p>
        Chorify allows household admins to create child accounts (no email required) for family
        members under 13. Child accounts contain only a display name and emoji — no email or
        password is stored. Parents or guardians are responsible for managing child account data.
      </p>

      <h2>6. Your Rights</h2>
      <p>You may at any time:</p>
      <ul>
        <li>Access or export your data by contacting us.</li>
        <li>Delete your account and all associated data by contacting us.</li>
        <li>Revoke push notification permission in iOS Settings.</li>
      </ul>

      <h2>7. Third-Party Services</h2>
      <p>
        Chorify uses <a href="https://expo.dev/privacy" target="_blank">Expo</a> to deliver
        push notifications via Apple Push Notification service (APNs). Your push token is
        transmitted to Expo&rsquo;s servers solely to route notifications to your device.
        No other personal data is shared with Expo.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. The &ldquo;Effective date&rdquo; at the
        top of this page indicates when the policy was last revised. Continued use of the app
        after changes constitutes acceptance of the updated policy.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions or deletion requests: <a href="mailto:support@chorify.app">support@chorify.app</a>
      </p>
    </div>
  </div>
</body>
</html>`

export async function GET() {
  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
