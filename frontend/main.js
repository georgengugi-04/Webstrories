// Shared across every page: mobile nav toggle + scroll-reveal animation.
// Page-specific behaviour (e.g. stories.html's category filters) stays inline.

const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('nav.links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    links.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', links.classList.contains('nav-open'));
  });
}

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.journal .reveal').forEach((el) => io.observe(el));

// Runtime config (GREENTRACK_API_BASE / GREENTRACK_WHATSAPP_NUMBER) is set by
// env.js, loaded before this file on every page. Do not hardcode it here —
// env.js is what Docker regenerates from environment variables at container
// startup (see frontend/docker-entrypoint.sh). widget.js falls back to a
// sane default if env.js somehow failed to load.

// Edition picker pills (index.html newsletter section) — multi-select toggle.
document.querySelectorAll('.edition-pill').forEach((pill) => {
  pill.addEventListener('click', () => pill.classList.toggle('selected'));
});

// Cinematic hero background slideshow (index.html) — crossfades through bg-slide elements.
const heroSlides = document.querySelectorAll('.cinema-hero .bg-slide');
const heroDots = document.querySelectorAll('.cinema-hero .slide-dots span');
if (heroSlides.length) {
  let heroIdx = 0;
  heroSlides[0].classList.add('active');
  if (heroDots.length) heroDots[0].classList.add('active');
  setInterval(() => {
    heroSlides[heroIdx].classList.remove('active');
    if (heroDots.length) heroDots[heroIdx].classList.remove('active');
    heroIdx = (heroIdx + 1) % heroSlides.length;
    heroSlides[heroIdx].classList.add('active');
    if (heroDots.length) heroDots[heroIdx].classList.add('active');
  }, 4500);
}
