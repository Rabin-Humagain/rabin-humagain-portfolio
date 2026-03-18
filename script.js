// ==============================
//  Rabin Portfolio — script.js
// ==============================
// ---------- Clock ----------
// Read saved preference, default to true (24hr) if nothing saved
let is24Hour = localStorage.getItem('clockFormat') !== 'false';

function updateClock() {
  const clock = document.getElementById('navbar-clock');
  if (!clock) return;

  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  if (is24Hour) {
    clock.textContent = `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  } else {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    clock.textContent = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
  }
}

function toggleClockFormat() {
  is24Hour = !is24Hour;
  localStorage.setItem('clockFormat', is24Hour); // save preference
}

updateClock();
setInterval(updateClock, 1000);


// ---------- Navbar shadow + active link on scroll ----------
const navbar = document.querySelector('.navbar');
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', function () {
  // Navbar shadow
  if (window.scrollY > 10) {
    navbar.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)';
  } else {
    navbar.style.boxShadow = 'none';
  }

  // Active nav link
  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 90) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) {
      link.classList.add('active');
    }
  });

  // Back to top button
  const btn = document.getElementById('back-to-top');
  if (btn) {
    if (window.scrollY > 300) {
      btn.classList.add('show');
    } else {
      btn.classList.remove('show');
    }
  }
});


// ---------- Back to Top ----------
const backToTopBtn = document.getElementById('back-to-top');
if (backToTopBtn) {
  backToTopBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}


// ---------- Fade-in on Scroll (Intersection Observer) ----------
const fadeEls = document.querySelectorAll('.fade-in');
const observer = new IntersectionObserver(function (entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target); // only animate once
    }
  });
}, { threshold: 0.15 });

fadeEls.forEach(el => observer.observe(el));


// ---------- Contact Form (Formspree) ----------
const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');

if (form) {
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Sending...';

    const data = new FormData(form);

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        status.textContent = ' Message sent! I\'ll get back to you soon.';
        status.style.color = 'green';
        form.reset();
      } else {
        status.textContent = ' Something went wrong. Please try again.';
        status.style.color = 'red';
      }
    } catch (error) {
      status.textContent = ' Network error. Check your connection.';
      status.style.color = 'red';
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>Send Message';
  });
}