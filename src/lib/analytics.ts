export const eventNames = [
  "mini_app_open", "home_view", "catalog_view", "product_view", "search",
  "filter_apply", "gallery_swipe", "image_zoom", "favorite_add", "favorite_remove",
  "add_to_cart", "booking_calendar_view", "booking_window_select", "booking_requested",
  "booking_confirmed", "booking_unavailable", "custom_request_submitted", "sketch_submitted",
  "sketch_approved", "begin_checkout", "order_created", "purchase", "production_started",
  "production_completed", "order_delivered", "content_generated", "content_approved",
  "content_published", "channel_referral",
] as const;

export type AnalyticsEvent = (typeof eventNames)[number];
type Properties = Record<string, string | boolean | number>;
export interface AnalyticsAdapter {
  track(event: AnalyticsEvent, properties: Properties): void;
}

// The demo emits a browser event. No personal data, persistent log or network.
export const localAdapter: AnalyticsAdapter = {
  track(event, properties) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("roomlet:analytics", {
        detail: { event, properties, timestamp: new Date().toISOString() },
      }));
    }
  },
};

export function track(event: AnalyticsEvent, properties: Properties = {}) {
  localAdapter.track(event, properties);
}
