import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="14 November 2026">
      <h2>The service</h2>
      <p>
        Tracklens analyses listening history you upload or allow us to read from Spotify. Statistics are estimates based
        on that data and may differ from numbers Spotify shows you.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Keep your password safe; you are responsible for activity on your account.</li>
        <li>Only upload exports from your own Spotify account, or ones you have permission to use.</li>
        <li>Do not use the service to scrape, overload, or abuse Spotify or Tracklens.</li>
      </ul>

      <h2>Share links</h2>
      <p>
        Share links are public to anyone with the URL. They show your display name and the statistics for the chosen
        period. You can delete a link at any time.
      </p>

      <h2>Paid plans</h2>
      <ul>
        <li>Pro is billed monthly or yearly in advance through Stripe and renews automatically.</li>
        <li>You can cancel at any time from Settings; you keep Pro until the end of the paid period.</li>
        <li>If Spotify changes or removes API access, some Pro features (like live sync) may stop working; imports keep working.</li>
      </ul>

      <h2>Not affiliated with Spotify</h2>
      <p>
        Tracklens is independent and is not affiliated with, endorsed by or sponsored by Spotify AB. Spotify is a
        trademark of Spotify AB.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for indirect losses
        or for data loss; keep your original Spotify export.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms and will note the date above. Continuing to use the service means you accept them.</p>
    </LegalPage>
  );
}
