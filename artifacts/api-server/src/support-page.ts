export const SUPPORT_PAGE_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Support — KnowYourPit</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #131316;
      color: #e8e0d0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      padding: 0 16px 64px;
    }
    header {
      border-bottom: 1px solid #2c2c32;
      padding: 32px 0 24px;
      margin-bottom: 40px;
    }
    .logo {
      color: #E84820;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    h1 {
      font-size: clamp(24px, 5vw, 36px);
      font-weight: 700;
      color: #f4ece0;
      margin-top: 10px;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 14px;
      color: #8a8480;
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
    }
    h2 {
      font-size: 20px;
      font-weight: 600;
      color: #f4ece0;
      margin: 40px 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #2c2c32;
    }
    p { margin-bottom: 14px; }
    ul {
      margin: 0 0 14px 20px;
    }
    li { margin-bottom: 6px; }
    a { color: #E84820; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .callout {
      background: #1e1e23;
      border-left: 3px solid #E84820;
      border-radius: 4px;
      padding: 16px 20px;
      margin: 24px 0;
      font-size: 15px;
    }
    .faq-item {
      margin-bottom: 28px;
    }
    .faq-item .question {
      font-weight: 600;
      color: #f4ece0;
      margin-bottom: 6px;
    }
    footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid #2c2c32;
      font-size: 13px;
      color: #8a8480;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">KnowYourPit</div>
      <h1>Support</h1>
      <p class="subtitle">We're here to help you get the most out of every cook.</p>
    </header>

    <div class="callout">
      Need help? Email us at <a href="mailto:support@knowyourpit.com">support@knowyourpit.com</a> and we'll get back to you within one business day.
    </div>

    <h2>Contact Us</h2>
    <p>For any questions, bug reports, or feedback, reach out to our support team:</p>
    <p><a href="mailto:support@knowyourpit.com">support@knowyourpit.com</a></p>

    <h2>Frequently Asked Questions</h2>

    <div class="faq-item">
      <p class="question">How do I start a cook session?</p>
      <p>From the Home screen, tap <strong>Plan a Cook</strong>. Choose your meat type and weight, set your target internal temperature, and the app will calculate an estimated cook time. Tap <strong>Start Cook</strong> to begin the live session.</p>
    </div>

    <div class="faq-item">
      <p class="question">How do I connect my MEATER probe?</p>
      <p>Go to <strong>Settings → Thermometer Devices</strong> and tap <strong>Add MEATER</strong>. Enter your MEATER account email and password. Once linked, your probe readings will appear automatically on the Cook screen during an active session.</p>
    </div>

    <div class="faq-item">
      <p class="question">Why isn't my probe temperature showing up?</p>
      <p>Check that your thermometer is powered on and within Bluetooth range of the MEATER Block or Link. Also confirm your MEATER credentials are saved correctly in Settings. If the problem persists, remove the device connection and re-add it.</p>
    </div>

    <div class="faq-item">
      <p class="question">How do temperature alerts work?</p>
      <p>You can set a target temperature alert on the Cook screen. When your probe hits that temperature, the app sends a local notification — even when the app is in the background. Make sure notifications are enabled for KnowYourPit in your iPhone Settings.</p>
    </div>

    <div class="faq-item">
      <p class="question">Can I use KnowYourPit on my Apple Watch?</p>
      <p>Yes. The KnowYourPit Watch app shows your current cook temperature, elapsed time, and a fuel timer — all on your wrist. Install it from the Watch app on your iPhone after installing KnowYourPit.</p>
    </div>

    <div class="faq-item">
      <p class="question">How do I delete my account or my data?</p>
      <p>Email us at <a href="mailto:support@knowyourpit.com">support@knowyourpit.com</a> with the subject line "Delete my account" and we will permanently remove your account and all associated data within 7 days.</p>
    </div>

    <div class="faq-item">
      <p class="question">The AI cook time prediction seems off — what should I do?</p>
      <p>AI predictions improve as you log more cooks with ratings. After each session, rate your results (tenderness, flavor, bark) so the app can refine its estimates for your grill and cook style. If predictions are consistently off, check that your grill profile (type, size, fuel) is set up accurately in Settings.</p>
    </div>

    <div class="faq-item">
      <p class="question">Is my data private?</p>
      <p>Yes. Your cook sessions and temperature readings are only visible to you. We never sell personal information. See our <a href="/privacy">Privacy Policy</a> for full details.</p>
    </div>

    <footer>
      &copy; 2026 KnowYourPit &mdash; <a href="/privacy">Privacy Policy</a>
    </footer>
  </div>
</body>
</html>`;
