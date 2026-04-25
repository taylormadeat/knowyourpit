export default function Privacy() {
  return (
    <div className="container max-w-3xl mx-auto px-4 py-16">
      <div className="prose prose-invert prose-primary mx-auto">
        <h1>Privacy Policy</h1>
        <p className="!text-muted-foreground !text-sm">
          Effective date: April 23, 2026
        </p>

        <div className="not-prose my-6 rounded-lg border-l-4 border-primary bg-card/60 px-5 py-4 text-[15px] text-foreground/90">
          KnowYourPit is a BBQ planning and cook-session management app. We
          only collect the data we need to make the app work well for you. We
          never sell your personal information.
        </div>

        <h2>1. Who We Are</h2>
        <p>
          KnowYourPit ("we," "our," or "us") is operated by the KnowYourPit
          team. If you have questions about this policy, contact us at{" "}
          <a href="mailto:privacy@knowyourpit.com">privacy@knowyourpit.com</a>.
        </p>

        <h2>2. Information We Collect</h2>

        <p><strong>Account information</strong></p>
        <p>
          When you create an account, we collect your name and email address
          through Clerk, our authentication provider. We may also receive
          profile details (such as a profile photo) if you sign in via a
          third-party identity provider (Google, Apple).
        </p>

        <p><strong>Cook session data</strong></p>
        <p>
          When you log a cook, we store information you provide: food type,
          weight, target temperatures, actual temperatures, cook notes, timer
          events, and optional ratings (tenderness, flavor, bark). This data
          is used to surface insights and improve AI predictions for your
          future cooks.
        </p>

        <p><strong>Temperature readings</strong></p>
        <p>
          We store probe temperature readings uploaded from your thermometer
          devices (MEATER, ThermoWorks, Inkbird, Govee) or entered manually.
          These readings are always linked to your account and are never
          visible to other users.
        </p>

        <p><strong>Photos and images</strong></p>
        <p>
          If you use the image-scanning feature, photos you capture or select
          are sent to our server for AI analysis and are not stored
          permanently — they are processed in memory and discarded after the
          analysis result is returned.
        </p>

        <p><strong>MEATER thermometer data</strong></p>
        <p>
          If you link your MEATER account, we store your MEATER token
          (encrypted) and retrieve live probe readings during cook sessions.
          We do not store MEATER data beyond what is needed to display live
          readings and log completed sessions.
        </p>

        <p><strong>Location</strong></p>
        <p>
          With your permission, the app reads your device location to fetch
          the current outdoor temperature from a public weather API. Location
          data is used in real time and is not stored on our servers.
        </p>

        <p><strong>Grill profiles</strong></p>
        <p>
          We store the grill profiles you create (name, type, size, fuel
          type) to personalize AI predictions and cook planning.
        </p>

        <p><strong>Usage and diagnostics</strong></p>
        <p>
          We collect basic server-side logs (HTTP method, URL path, response
          code) to monitor uptime and diagnose errors. These logs do not
          contain personal data beyond your IP address, which is retained
          for up to 30 days.
        </p>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To operate the app and serve your cook sessions, grills, recipes, and history.</li>
          <li>To generate AI-powered cook time predictions and PitMaster coaching responses.</li>
          <li>To send in-app notifications and local alerts you configure (e.g. temperature thresholds).</li>
          <li>To improve the accuracy of AI suggestions over time using anonymized patterns from your cook history.</li>
          <li>To diagnose technical issues and maintain service reliability.</li>
        </ul>

        <h2>4. Third-Party Services</h2>
        <ul>
          <li>
            <strong>Clerk</strong> — authentication and account management.
            See <a href="https://clerk.com/privacy" target="_blank" rel="noreferrer">clerk.com/privacy</a>.
          </li>
          <li>
            <strong>OpenAI</strong> — powers AI cook predictions and PitMaster
            coaching via Replit's AI integration proxy. Text prompts (never
            photos) are sent to OpenAI's API. See{" "}
            <a href="https://openai.com/privacy" target="_blank" rel="noreferrer">openai.com/privacy</a>.
          </li>
          <li>
            <strong>Open-Meteo</strong> — an open-source weather API used to
            fetch outdoor temperature by location. No personally identifiable
            information is shared beyond your approximate coordinates.
          </li>
          <li>
            <strong>MEATER</strong> — if you link your MEATER account, data is
            exchanged with MEATER's cloud API under your MEATER account's
            terms.
          </li>
        </ul>

        <h2>5. Data Sharing</h2>
        <p>
          We do not sell, rent, or trade your personal information. We share
          data only as described in Section 4 (to operate the service with
          third-party providers), or if required by law.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          Your account data, cook sessions, temperature readings, and grill
          profiles are retained for as long as your account is active. You may
          delete your account and associated data at any time by contacting us
          at <a href="mailto:privacy@knowyourpit.com">privacy@knowyourpit.com</a>.
          Server logs are retained for 30 days and then purged automatically.
        </p>

        <h2>7. Your Rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct,
          or delete the personal data we hold about you, or to restrict or
          object to certain uses. To exercise any of these rights, email us at{" "}
          <a href="mailto:privacy@knowyourpit.com">privacy@knowyourpit.com</a>.
        </p>

        <h2>8. Children's Privacy</h2>
        <p>
          KnowYourPit is not directed to children under the age of 13 (or 16
          in the EU/UK). We do not knowingly collect personal information
          from children. If you believe a child has provided us with personal
          data, please contact us and we will delete it promptly.
        </p>

        <h2>9. Security</h2>
        <p>
          We use industry-standard practices to protect your data, including
          encrypted transport (HTTPS/TLS), encrypted credential storage, and
          access controls. No system is perfectly secure, and we cannot
          guarantee absolute security, but we take the protection of your
          data seriously.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. When we do, we
          will update the effective date at the top of this page. Continued
          use of the app after changes take effect constitutes your
          acceptance of the updated policy.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions or requests regarding this Privacy Policy:<br />
          <a href="mailto:privacy@knowyourpit.com">privacy@knowyourpit.com</a>
        </p>
      </div>
    </div>
  );
}
