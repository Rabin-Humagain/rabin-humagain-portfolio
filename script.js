
let is24Hour = true; // default format

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
    hours = hours % 12 || 12; // converts 0 → 12 for midnight
    clock.textContent = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
  }
}

function toggleClockFormat() {
  is24Hour = !is24Hour;
}

updateClock();
setInterval(updateClock, 1000);

//form submission handling using standard fetch API to send data to Formspree without page reload and providing user feedback on success or failure of the submission using the status element to display messages and disabling the submit button while the request is in progress to prevent multiple submissions using formspree.io for handling form submissions without needing a backend server and providing a simple way to receive messages via email.

const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');

if (form) {
  form.addEventListener('submit', async function (e) {
    e.preventDefault(); // stop normal page redirect

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const data = new FormData(form);

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        status.textContent = 'Message sent! I\'ll get back to you soon.';
        status.style.color = 'green';
        form.reset();
      } else {
        status.textContent = 'Something went wrong. Please try again.';
        status.style.color = 'red';
      }
    } catch (error) {
      status.textContent = 'Network error. Check your connection.';
      status.style.color = 'red';
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
  });
}