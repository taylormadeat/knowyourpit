export default function Privacy() {
  return (
    <div className="container max-w-3xl mx-auto px-4 py-16">
      <div className="prose prose-invert prose-primary mx-auto">
        <h1>Privacy Policy</h1>
        <p><strong>Effective Date:</strong> January 1, 2025<br />
        <strong>Last Updated:</strong> April 25, 2026</p>

        <h2>Introduction</h2>
        <p>KnowYourPit ("we", "our", or "us") respects your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use the KnowYourPit mobile application and related services (the "Service").</p>

        <h2>Information We Collect</h2>
        <ul>
          <li><strong>Account Information:</strong> When you create an account, we collect your email address and authentication credentials via our authentication provider (Clerk).</li>
          <li><strong>Cook Data:</strong> Grill profiles, cook session logs, recipes, temperature readings, photos, and notes you create in the app.</li>
          <li><strong>Device & Sensor Data:</strong> With your permission, readings from connected thermometer hardware (MEATER, ThermoWorks Cloud), camera images you submit for AI analysis, and your approximate location (only while the app is open) to display outdoor temperature during a cook.</li>
          <li><strong>Diagnostic Data:</strong> Crash logs and basic performance metrics to help us improve the app.</li>
        </ul>

        <h2>How We Use Your Information</h2>
        <ul>
          <li>To provide and operate the Service (cook tracking, alerts, AI predictions).</li>
          <li>To synchronize your data across your devices.</li>
          <li>To send you push notifications you have opted into (probe alerts, fuel reminders).</li>
          <li>To improve the Service and debug issues.</li>
        </ul>

        <h2>Information Sharing</h2>
        <p>We do not sell your personal information. We share data only with:</p>
        <ul>
          <li>Service providers that help us run the Service (cloud hosting, authentication, AI inference, push notification delivery).</li>
          <li>Hardware integrations you explicitly link (MEATER Cloud, ThermoWorks Cloud) — only the credentials and readings required to fetch your probe data.</li>
          <li>Authorities, when required by law.</li>
        </ul>

        <h2>Data Retention</h2>
        <p>You can delete individual cooks, recipes, photos, and grills at any time. You can request full account deletion by emailing support@knowyourpit.com; we will delete your account and associated data within 30 days.</p>

        <h2>Children's Privacy</h2>
        <p>KnowYourPit is not directed to children under 13 and we do not knowingly collect data from them.</p>

        <h2>Security</h2>
        <p>We use industry-standard encryption in transit (TLS) and at rest. No system is perfectly secure; we encourage you to use a strong, unique password.</p>

        <h2>Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the right to access, correct, export, or delete your personal data. Contact support@knowyourpit.com to make a request.</p>

        <h2>Changes to This Policy</h2>
        <p>We may update this policy occasionally. Material changes will be announced in the app and reflected in the "Last Updated" date.</p>

        <h2>Contact</h2>
        <p>Questions? Email support@knowyourpit.com.</p>
      </div>
    </div>
  );
}
