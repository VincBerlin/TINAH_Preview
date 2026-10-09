import { todayISO, nextDay, validateStay, stayDescription } from './stay.js';
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const video = document.querySelector('#hero-video');
const config = window.TINAH_CONFIG || {};
root.classList.add('js');

let videoInView = true;
video.muted = true;
video.src = config.heroVideoUrl || '/assets/hero.mp4?v=original1080';
async function playVideo() {
  if (reducedMotion.matches || document.hidden || !videoInView) return;
  try { await video.play(); } catch { /* Keep the poster if autoplay is unavailable. */ }
}
video.addEventListener('playing', () => video.classList.add('playing'));
video.addEventListener('error', () => {
  video.classList.remove('playing');
  if (video.getAttribute('src') !== '/assets/hero.mp4?v=original1080') {
    video.src = '/assets/hero.mp4?v=original1080';
    playVideo();
  }
});
playVideo();

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
new IntersectionObserver(([entry]) => {
  videoInView = entry.isIntersecting;
  if (!videoInView) video.pause();
  else if (!reducedMotion.matches && !document.hidden) playVideo();
}, { threshold: .05 }).observe(document.querySelector('.hero'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) video.pause();
  else if (!reducedMotion.matches && videoInView) playVideo();
});
const media = document.querySelector('.hero-media');
const wordmark = document.querySelector('.wordmark');
const pictureMotion = [...document.querySelectorAll('.story-image')].map(element => ({element, current:0}));
let motionFrame = 0;
let heroOffset = 0;
function updateMotion() {
  motionFrame = 0;
  if (reducedMotion.matches || document.hidden) return;
  let moving = false;
  if (videoInView) {
    const target = Math.min(scrollY * .13, 140);
    heroOffset += (target - heroOffset) * .085;
    media.style.transform = `translate3d(0,${heroOffset.toFixed(2)}px,0)`;
    wordmark.style.setProperty('--logo-drift', `${(-heroOffset * .28).toFixed(2)}px`);
    moving ||= Math.abs(target - heroOffset) > .1;
  }
  for (const item of pictureMotion) {
    const rect = item.element.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) continue;
    const target = Math.max(-18,Math.min(18,(innerHeight / 2 - rect.top - rect.height / 2) * .045));
    item.current += (target - item.current) * .075;
    item.element.style.setProperty('--image-y', `${item.current.toFixed(2)}px`);
    moving ||= Math.abs(target - item.current) > .1;
  }
  if (moving) motionFrame = requestAnimationFrame(updateMotion);
}
function requestMotion() {
  if (!motionFrame && !reducedMotion.matches) motionFrame = requestAnimationFrame(updateMotion);
}
addEventListener('scroll', requestMotion, {passive:true});
addEventListener('resize', requestMotion, {passive:true});
requestMotion();
reducedMotion.addEventListener('change', event => {
  if (event.matches) {
    video.pause();
    cancelAnimationFrame(motionFrame); motionFrame = 0;
    media.style.transform = '';
    wordmark.style.removeProperty('--logo-drift');
    pictureMotion.forEach(item => item.element.style.removeProperty('--image-y'));
  } else { playVideo(); requestMotion(); }
});

const spotifyUrl = config.spotifyUrl || 'https://tr.ee/FuFQHdoNV4';
try {
  const url = new URL(spotifyUrl);
  if (url.protocol === 'https:' && ['open.spotify.com', 'spotify.link', 'tr.ee'].includes(url.hostname)) {
    document.querySelectorAll('[data-spotify-link]').forEach(link => { link.href = url.href; });
  }
} catch { /* Keep the supplied Spotify link if a configured override is invalid. */ }

// Preview enquiry: prepare an email without claiming that a message was sent.
const contactForm = document.querySelector('#contact-form');
contactForm.querySelector('[type=submit]').disabled = false;
const contactResult = document.querySelector('#contact-result');
const contactStatus = document.querySelector('#contact-status');
const mailLink = document.querySelector('#contact-mailto');
const copyFallback = document.querySelector('#copy-fallback');
let enquiryText = '';
const arrivalInput = contactForm.elements.arrival;
const departureInput = contactForm.elements.departure;
const stayError = document.querySelector('#stay-error');
function stayValues() {
  return { guests: contactForm.elements.guests.value, arrival: arrivalInput.value, departure: departureInput.value };
}
function updateStayConstraints() {
  const today = todayISO();
  arrivalInput.min = today;
  departureInput.min = nextDay(arrivalInput.value || today);
  arrivalInput.setCustomValidity('');
  departureInput.setCustomValidity('');
  contactForm.elements.guests.setCustomValidity('');
  const error = validateStay(stayValues(), today);
  const show = error && contactForm.elements[error.field].value !== '';
  stayError.hidden = !show;
  stayError.textContent = show ? error.message : '';
  if (show) contactForm.elements[error.field].setCustomValidity(error.message);
}
updateStayConstraints();
contactForm.addEventListener('focusin', updateStayConstraints);

contactForm.addEventListener('submit', event => {
  event.preventDefault();
  updateStayConstraints();
  if (!contactForm.reportValidity()) return;
  const name = contactForm.elements.name.value.trim();
  const email = contactForm.elements.email.value.trim();
  const message = contactForm.elements.message.value.trim();
  if (!name) {
    const invalidField = contactForm.elements.name;
    invalidField.setCustomValidity('Please enter your name.');
    invalidField.reportValidity();
    return;
  }
  const stay = stayValues();
  enquiryText = `Hi TINAH,\n\nI'd like to enquire about a stay.\n\n${stayDescription(stay)}${message ? `\n\n${message}` : ''}\n\n${name}\n${email}`;
  const subject = `Stay enquiry from ${name.replace(/[\r\n]/g, ' ')}`;
  mailLink.href = `mailto:bookings@thepassionfruit.co?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(enquiryText)}`;
  copyFallback.value = enquiryText;
  copyFallback.hidden = true;
  contactResult.hidden = false;
  contactStatus.textContent = 'Your enquiry is ready. Open your email app to send it, or copy it below.';
});
contactForm.addEventListener('input', event => {
  if ('setCustomValidity' in event.target) event.target.setCustomValidity('');
  contactResult.hidden = true;
  enquiryText = '';
  if (['arrival', 'departure', 'guests'].includes(event.target.name)) updateStayConstraints();
});
document.querySelector('#copy-enquiry').addEventListener('click', async () => {
  if (!enquiryText) return;
  try {
    await navigator.clipboard.writeText(enquiryText);
    contactStatus.textContent = 'Enquiry copied. Paste it into an email to bookings@thepassionfruit.co.';
  } catch {
    copyFallback.hidden = false;
    copyFallback.focus();
    copyFallback.select();
    contactStatus.textContent = 'Select and copy the enquiry below, then email it to bookings@thepassionfruit.co.';
  }
});
