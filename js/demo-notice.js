// Intercepts the "Try in Browser" links and shows a short heads-up modal
// explaining that the in-browser app is a demo, before navigating into it.
(function () {
  const modal = document.getElementById('demo-modal');
  if (!modal) return;

  const launch = document.getElementById('demo-modal-launch');
  // Every entry point into the web app (nav pill + hero button).
  const triggers = document.querySelectorAll('a[href="app/"]:not(#demo-modal-launch)');
  let lastFocused = null;

  const open = trigger => {
    lastFocused = trigger || document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    // Focus the primary action for keyboard users.
    if (launch) launch.focus();
    document.addEventListener('keydown', onKeydown);
  };

  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  };

  const onKeydown = event => {
    if (event.key === 'Escape') close();
  };

  triggers.forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      open(link);
    });
  });

  // Any element marked data-demo-dismiss closes the modal (backdrop, X, cancel).
  modal.querySelectorAll('[data-demo-dismiss]').forEach(el => {
    el.addEventListener('click', close);
  });

  // Let the launch link navigate normally, but close first so returning via the
  // back button doesn't leave the modal stuck open.
  if (launch) launch.addEventListener('click', () => { modal.hidden = true; document.body.style.overflow = ''; });
})();
