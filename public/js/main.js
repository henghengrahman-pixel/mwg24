// =========================
// MOBILE MENU
// =========================

function toggleMenu() {
  const nav = document.getElementById("mainNav");
  if (!nav) return;

  nav.classList.toggle("open");
}

// tutup menu saat klik link
document.addEventListener("click", function (e) {
  const nav = document.getElementById("mainNav");
  const toggle = document.querySelector(".menu-toggle");

  if (!nav) return;

  if (
    nav.classList.contains("open") &&
    !nav.contains(e.target) &&
    !toggle.contains(e.target)
  ) {
    nav.classList.remove("open");
  }
});

// =========================
// REVEAL ANIMATION
// =========================

document.addEventListener("DOMContentLoaded", function () {

  const reveals = document.querySelectorAll(".reveal");

  if (!reveals.length) return;

  if ("IntersectionObserver" in window) {

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {

          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }

        });
      },
      {
        threshold: 0.14
      }
    );

    reveals.forEach((el) => observer.observe(el));

  } else {

    // fallback browser lama
    reveals.forEach((el) => el.classList.add("in-view"));

  }

});
