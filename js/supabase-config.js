// Public browser configuration for the homepage reviews feature.
// This key is safe to expose in a browser; database access is enforced by RLS.
export const SUPABASE_URL = 'https://jwjedzfibiaxrpteprfu.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_HgcpUVTMIgAORDeNzprOBg_wAhdLarO';

// Leave empty until a CAPTCHA provider is configured. The reviews module keeps
// development submissions available and reports this state to administrators.
export const CAPTCHA = {
  provider: '',
  siteKey: '',
  verify: null
};

export const REVIEWS_TABLE = 'reviews';
export const REVIEWS_MAX_COMMENT_LENGTH = 1000;
export const REVIEWS_COOLDOWN_MS = 30 * 1000;
