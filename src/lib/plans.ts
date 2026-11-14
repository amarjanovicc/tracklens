export const PLANS = {
  free: {
    name: "Free",
    price: { monthly: 0, yearly: 0 },
    trackedPlaylists: 2,
    shareLinks: 1,
    liveSync: false,
    csvExport: false,
    compare: false,
    playlistChangelog: false,
  },
  pro: {
    name: "Pro",
    price: { monthly: 4, yearly: 36 },
    trackedPlaylists: 50,
    shareLinks: 100,
    liveSync: true,
    csvExport: true,
    compare: true,
    playlistChangelog: true,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function limitsFor(plan: string) {
  return PLANS[plan === "pro" ? "pro" : "free"];
}

export const billingEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);
