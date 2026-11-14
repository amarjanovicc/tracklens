import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="14 November 2026">
      <p>
        Tracklens turns your Spotify listening history into statistics. This page explains, in plain English, what we
        keep, why, and how to get rid of it.
      </p>

      <h2>What we store</h2>
      <ul>
        <li><strong>Your account:</strong> name, email, a hashed password, your timezone and your plan.</li>
        <li>
          <strong>Your plays:</strong> for each stream, the track, artist and album name, Spotify track URI, when it was
          played, how long, a coarse device type (e.g. &ldquo;iPhone&rdquo;, &ldquo;desktop&rdquo;), the country code,
          and the shuffle / skip / offline / private-session flags.
        </li>
        <li><strong>Playlists you track:</strong> their public metadata and daily follower counts.</li>
        <li><strong>Share links you create</strong> and how many times they were viewed.</li>
        <li>
          <strong>If you connect Spotify:</strong> the access and refresh tokens Spotify gives us, your Spotify user ID
          and display name, used only to read your recently played tracks and your own playlists.
        </li>
        <li><strong>If you subscribe:</strong> a Stripe customer and subscription ID. Card details are handled by Stripe and never reach us.</li>
      </ul>

      <h2>What we never receive</h2>
      <p>
        Your export is unpacked and parsed in your browser. The IP addresses, user-agent strings and Spotify username it
        contains are discarded on your device and are never uploaded.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To compute and show your statistics, and the share pages you choose to publish.</li>
        <li>To bill you if you subscribe.</li>
      </ul>
      <p>We do not sell your data, use it for advertising, or share it with anyone except the processors below.</p>

      <h2>Processors</h2>
      <ul>
        <li>Our hosting and database providers, which store the data above.</li>
        <li>Stripe, for payments.</li>
        <li>Spotify, when you choose to connect your account.</li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        In <strong>Settings → Your data</strong> you can delete all listening data, or delete your account. Deleting
        your account removes everything listed above and cancels any subscription. Disconnecting Spotify deletes the
        stored tokens immediately; you can also revoke access at spotify.com/account/apps.
      </p>

      <h2>Contact</h2>
      <p>Questions or requests (access, correction, deletion): contact the operator of this Tracklens instance.</p>
    </LegalPage>
  );
}
