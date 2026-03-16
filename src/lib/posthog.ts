import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key || initialized) return;
  initialized = true;

  posthog.init(key, {
    api_host: "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
  });
}

export { posthog };
