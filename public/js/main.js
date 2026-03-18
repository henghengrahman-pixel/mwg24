// =========================
// HELPERS
// =========================
function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

// =========================
// MOBILE MENU (UPGRADE)
// =========================
function toggleMenu() {
  const nav = $("#mainNav");
  const toggle = $(".menu-toggle");

  if (!nav || !toggle) return;

  const isOpen = nav.classList.toggle("open");

  toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");

  document.body.style.overflow = isOpen ? "hidden" : "";
}

// close menu when click outside
document.addEventListener("click", function (e) {
  const nav = $("#mainNav");
  const toggle = $(".menu-toggle");

  if (!nav || !toggle) return;

  if (
    nav.classList.contains("open") &&
    !nav.contains(e.target) &&
    !toggle.contains(e.target)
  ) {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
});

// close when click menu link
document.addEventListener("DOMContentLoaded", function () {
  const nav = $("#mainNav");
  const toggle = $(".menu-toggle");

  if (!nav) return;

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", function () {
      nav.classList.remove("open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    });
  });
});

// debounce resize
let resizeTimer;
window.addEventListener("resize", function () {
  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(() => {
    const nav = $("#mainNav");
    const toggle = $(".menu-toggle");

    if (!nav) return;

    if (window.innerWidth > 900) {
      nav.classList.remove("open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
  }, 120);
});

// =========================
// REVEAL ANIMATION (SMOOTH)
// =========================
document.addEventListener("DOMContentLoaded", function () {
  const reveals = $$(".reveal");

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
        threshold: 0.15,
        rootMargin: "0px 0px -40px 0px"
      }
    );

    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in-view"));
  }
});

// =========================
// SLUG GENERATOR (IMPROVED)
// =========================
function slugifyText(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

document.addEventListener("DOMContentLoaded", function () {
  const titleInput = $('input[name="title"]');
  const slugInput = $('input[name="slug"]');

  if (!titleInput || !slugInput) return;

  let manual = Boolean(slugInput.value.trim());

  slugInput.addEventListener("input", () => {
    manual = Boolean(slugInput.value.trim());
  });

  titleInput.addEventListener("input", () => {
    if (!manual) {
      slugInput.value = slugifyText(titleInput.value);
    }
  });
});

// =========================
// IMAGE PREVIEW (CLEAN)
// =========================
document.addEventListener("DOMContentLoaded", function () {
  const fileInput = $('input[type="file"][name="image"]');
  if (!fileInput) return;

  fileInput.addEventListener("change", function (event) {
    const file = event.target.files?.[0];
    if (!file) return;

    let previewBox = $(".image-preview");
    let previewImg = previewBox?.querySelector("img");

    if (!previewBox) {
      previewBox = document.createElement("div");
      previewBox.className = "image-preview";

      previewImg = document.createElement("img");
      previewImg.alt = "Preview gambar";

      previewBox.appendChild(previewImg);
      fileInput.parentNode.insertBefore(previewBox, fileInput);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg) previewImg.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
});

// =========================
// TEXTAREA AUTO RESIZE
// =========================
document.addEventListener("DOMContentLoaded", function () {
  const textareas = $$("textarea");

  textareas.forEach((textarea) => {
    if (textarea.classList.contains("no-autoresize")) return;

    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    };

    textarea.addEventListener("input", resize);

    if (textarea.value.trim()) resize();
  });
});

// =========================
// PREMIUM GALLERY LIGHTBOX (UPGRADE)
// =========================
document.addEventListener("DOMContentLoaded", function () {
  const galleryItems = $$("[data-gallery-item]");
  const lightbox = $("#galleryLightbox");
  const img = $("#galleryLightboxImage");
  const title = $("#galleryLightboxTitle");
  const caption = $("#galleryLightboxCaption");
  const closes = $$("[data-lightbox-close]");

  if (!galleryItems.length || !lightbox) return;

  function open(item) {
    img.src = item.dataset.galleryImage || "";
    img.alt = item.dataset.galleryAlt || "Galeri Berastagi";
    title.textContent = item.dataset.galleryTitle || "Galeri Berastagi";
    caption.textContent = item.dataset.galleryCaption || "";

    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
  }

  function close() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");

    setTimeout(() => {
      img.src = "";
      img.alt = "";
      title.textContent = "Galeri Berastagi";
      caption.textContent = "";
    }, 150);
  }

  galleryItems.forEach((item) => {
    item.addEventListener("click", () => open(item));

    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(item);
      }
    });

    if (!item.hasAttribute("tabindex")) {
      item.setAttribute("tabindex", "0");
    }
  });

  closes.forEach((btn) => btn.addEventListener("click", close));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("open")) {
      close();
    }
  });
});
