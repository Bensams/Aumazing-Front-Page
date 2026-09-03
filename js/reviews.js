import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import {
  CAPTCHA,
  REVIEWS_COOLDOWN_MS,
  REVIEWS_MAX_COMMENT_LENGTH,
  REVIEWS_TABLE,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL
} from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const byId = id => document.getElementById(id);
const stars = '★★★★★';

function setState(element, message, state = '') {
  if (!element) return;
  element.textContent = message;
  element.dataset.state = state;
  element.hidden = !message;
}

function makeReviewCard(review) {
  const card = document.createElement('article');
  card.className = 'review-card reveal visible';

  const header = document.createElement('div');
  header.className = 'review-card-header';
  const name = document.createElement('strong');
  name.className = 'reviewer-name';
  name.textContent = review.display_name?.trim() || 'Anonymous reviewer';
  const date = document.createElement('time');
  date.className = 'review-date';
  const parsedDate = new Date(review.created_at);
  if (!Number.isNaN(parsedDate.getTime())) {
    date.dateTime = parsedDate.toISOString();
  }
  date.textContent = Number.isNaN(parsedDate.getTime())
    ? 'Recently shared'
    : parsedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
...
  const rating = document.createElement('div');
  rating.className = 'review-rating';
  rating.setAttribute('role', 'img');
  const numericRating = Math.min(5, Math.max(1, Number(review.rating) || 1));
  rating.setAttribute('aria-label', `${numericRating} out of 5 stars`);
  rating.textContent = `${stars.slice(0, numericRating)}${'☆'.repeat(5 - numericRating)}`;

  const comment = document.createElement('p');
  comment.className = 'review-comment';
  comment.textContent = review.comment;
  card.append(header, rating, comment);
  return card;
}

function renderReviews(container, reviews) {
  container.replaceChildren();
  reviews.forEach(review => container.append(makeReviewCard(review)));
}

async function ensureAnonymousSession() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session) return sessionData.session;

  let captchaToken;
  if (CAPTCHA.provider && CAPTCHA.siteKey) {
    if (typeof CAPTCHA.verify !== 'function') throw new Error('CAPTCHA is configured but has no verifier');
    captchaToken = await CAPTCHA.verify();
    if (!captchaToken) throw new Error('CAPTCHA verification was not completed');
  }
  const signInOptions = captchaToken ? { options: { captchaToken } } : undefined;
  const { data, error } = await supabase.auth.signInAnonymously(signInOptions);
  if (error) throw error;
  return data.session;
}

const REVIEW_REQUEST_TIMEOUT_MS = 10000;

function withTimeout(promise) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Review request timed out')), REVIEW_REQUEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function loadApprovedReviews(elements) {
  setState(elements.listState, 'Loading approved reviews…', 'loading');
  try {
    const { data, error, count } = await withTimeout(supabase
      .from(REVIEWS_TABLE)
      .select('display_name, rating, comment, created_at', { count: 'exact' })
      .eq('status', 'approved')
      .order('created_at', { ascending: false }));
    if (error) throw error;

    const reviews = Array.isArray(data) ? data : [];
    renderReviews(elements.list, reviews);
    const total = count ?? reviews.length;
    const totalRating = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
    const average = reviews.length ? (totalRating / reviews.length).toFixed(1) : '0.0';
    elements.average.textContent = average;
    elements.count.textContent = String(total);
    if (elements.stars) {
      const filledStars = Math.round(Number(average));
      elements.stars.textContent = `${stars.slice(0, filledStars)}${'☆'.repeat(5 - filledStars)}`;
      elements.stars.setAttribute('aria-label', reviews.length ? `${average} out of 5 stars` : 'No approved ratings yet');
    }
    if (!reviews.length) {
      setState(elements.listState, 'No approved reviews yet. Be the first to share your experience.', 'empty');
    } else {
      setState(elements.listState, '', '');
    }
  } catch (error) {
    renderReviews(elements.list, []);
    setState(elements.listState, 'Reviews are temporarily unavailable. Please try again later.', 'error');
    console.warn('Could not load approved reviews:', error.message);
  }
}

function initReviews() {
  const form = byId('review-form');
  const list = byId('reviews-list');
  if (!form || !list) return;

  const elements = {
    form,
    list,
    listState: byId('reviews-list-state'),
    average: byId('reviews-average'),
    count: byId('reviews-count'),
    stars: byId('reviews-stars'),
    status: byId('review-form-status'),
    submit: byId('review-submit'),
    name: byId('review-name'),
    comment: byId('review-comment'),
    rating: byId('review-rating'),
    counter: byId('review-counter'),
    honeypot: byId('review-website')
  };
  const starButtons = [...form.querySelectorAll('[data-review-rating]')];
  let isSubmitting = false;

  const updateCounter = () => {
    elements.counter.textContent = `${elements.comment.value.length}/${REVIEWS_MAX_COMMENT_LENGTH}`;
  };
  const selectRating = value => {
    elements.rating.value = String(value);
    starButtons.forEach(button => {
      const selected = Number(button.dataset.reviewRating) <= value;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-checked', String(Number(button.dataset.reviewRating) === value));
    });
  };
  starButtons.forEach(button => {
    button.addEventListener('click', () => selectRating(Number(button.dataset.reviewRating)));
    button.addEventListener('keydown', event => {
      const current = Number(elements.rating.value) || 0;
      let next = current;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, current + 1);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(1, current - 1);
      if (next !== current) {
        event.preventDefault();
        selectRating(next);
        starButtons[next - 1]?.focus();
      }
    });
  });
  elements.comment.addEventListener('input', updateCounter);
  updateCounter();
  selectRating(0);

  if (!CAPTCHA.provider || !CAPTCHA.siteKey || typeof CAPTCHA.verify !== 'function') {
    setState(byId('review-captcha-note'), 'CAPTCHA is not configured; development submissions remain available and are moderated.', 'notice');
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (isSubmitting) return;
    if (elements.honeypot.value.trim()) return;

    const rating = Number(elements.rating.value);
    const comment = elements.comment.value.trim();
    if (!rating || rating < 1 || rating > 5) {
      setState(elements.status, 'Choose a rating from 1 to 5 stars.', 'error');
      starButtons[0]?.focus();
      return;
    }
    if (!comment || comment.length > REVIEWS_MAX_COMMENT_LENGTH) {
      setState(elements.status, `Write a comment from 1 to ${REVIEWS_MAX_COMMENT_LENGTH} characters.`, 'error');
      elements.comment.focus();
      return;
    }

    const lastSubmitted = Number(localStorage.getItem('aumazing-review-last-submitted') || 0);
    const remaining = REVIEWS_COOLDOWN_MS - (Date.now() - lastSubmitted);
    if (remaining > 0) {
      setState(elements.status, `Please wait ${Math.ceil(remaining / 1000)} seconds before submitting another review.`, 'error');
      return;
    }

    isSubmitting = true;
    elements.submit.disabled = true;
    setState(elements.status, 'Sending your review securely…', 'loading');
    try {
      const session = await ensureAnonymousSession();
      if (!session?.user?.id) throw new Error('Anonymous sign-in did not return a user');
      const { error } = await supabase.from(REVIEWS_TABLE).insert({
        reviewer_id: session.user.id,
        display_name: elements.name.value.trim() || null,
        rating,
        comment
      });
      if (error) throw error;
      localStorage.setItem('aumazing-review-last-submitted', String(Date.now()));
      form.reset();
      selectRating(0);
      updateCounter();
      setState(elements.status, 'Thanks for sharing! Your review is pending moderation and will appear after approval.', 'success');
      await loadApprovedReviews(elements);
    } catch (error) {
      setState(elements.status, 'We could not submit your review right now. Your form values are still here; please try again.', 'error');
      console.warn('Could not submit review:', error.message);
    } finally {
      isSubmitting = false;
      elements.submit.disabled = false;
    }
  });

  loadApprovedReviews(elements);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReviews, { once: true });
} else {
  initReviews();
}
