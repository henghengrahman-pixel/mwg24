// =========================
// MOBILE MENU
// =========================

function toggleMenu() {
  const nav = document.getElementById("mainNav");
  if (!nav) return;

  nav.classList.toggle("open");
}

document.addEventListener("click", function (e) {
  const nav = document.getElementById("mainNav");
  const toggle = document.querySelector(".menu-toggle");

  if (!nav || !toggle) return;

  if (
    nav.classList.contains("open") &&
    !nav.contains(e.target) &&
    !toggle.contains(e.target)
  ) {
    nav.classList.remove("open");
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const nav = document.getElementById("mainNav");

  if (nav) {
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
      });
    });
  }
});

window.addEventListener("resize", function () {
  const nav = document.getElementById("mainNav");
  if (!nav) return;

  if (window.innerWidth > 900) {
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
    reveals.forEach((el) => el.classList.add("in-view"));
  }
});

// =========================
// AUTO SLUG GENERATOR
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
  const titleInput = document.querySelector('input[name="title"]');
  const slugInput = document.querySelector('input[name="slug"]');

  if (!titleInput || !slugInput) return;

  let slugEditedManually = Boolean(slugInput.value && slugInput.value.trim());

  slugInput.addEventListener("input", function () {
    slugEditedManually = Boolean(slugInput.value.trim());
  });

  titleInput.addEventListener("input", function () {
    if (!slugEditedManually) {
      slugInput.value = slugifyText(titleInput.value);
    }
  });
});

// =========================
// IMAGE PREVIEW FOR ADMIN FORM
// =========================

document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.querySelector('input[type="file"][name="image"]');
  if (!fileInput) return;

  fileInput.addEventListener("change", function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    let previewBox = document.querySelector(".image-preview");
    let previewImg = previewBox ? previewBox.querySelector("img") : null;

    if (!previewBox) {
      previewBox = document.createElement("div");
      previewBox.className = "image-preview";

      previewImg = document.createElement("img");
      previewImg.alt = "Preview gambar";

      previewBox.appendChild(previewImg);
      fileInput.parentNode.insertBefore(previewBox, fileInput);
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      if (previewImg) {
        previewImg.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  });
});

// =========================
// TEXTAREA AUTO RESIZE
// =========================

document.addEventListener("DOMContentLoaded", function () {
  const textareas = document.querySelectorAll("textarea");

  if (!textareas.length) return;

  textareas.forEach((textarea) => {
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    if (textarea.classList.contains("no-autoresize")) return;

    textarea.addEventListener("input", resize);

    if (textarea.value.trim()) {
      resize();
    }
  });
});

// =========================
// PREMIUM GALLERY LIGHTBOX
// =========================

document.addEventListener("DOMContentLoaded", function () {
  const galleryItems = document.querySelectorAll("[data-gallery-item]");
  const lightbox = document.getElementById("galleryLightbox");
  const lightboxImage = document.getElementById("galleryLightboxImage");
  const lightboxTitle = document.getElementById("galleryLightboxTitle");
  const lightboxCaption = document.getElementById("galleryLightboxCaption");
  const closeButtons = document.querySelectorAll("[data-lightbox-close]");

  if (!galleryItems.length || !lightbox || !lightboxImage || !lightboxTitle || !lightboxCaption) {
    return;
  }

  function openLightbox(item) {
    const image = item.getAttribute("data-gallery-image") || "";
    const title = item.getAttribute("data-gallery-title") || "Galeri Berastagi";
    const caption = item.getAttribute("data-gallery-caption") || "";
    const alt = item.getAttribute("data-gallery-alt") || title;

    lightboxImage.src = image;
    lightboxImage.alt = alt;
    lightboxTitle.textContent = title;
    lightboxCaption.textContent = caption;

    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");

    setTimeout(() => {
      lightboxImage.src = "";
      lightboxImage.alt = "";
      lightboxTitle.textContent = "Galeri Berastagi";
      lightboxCaption.textContent = "";
    }, 180);
  }

  galleryItems.forEach((item) => {
    item.addEventListener("click", function () {
      openLightbox(item);
    });

    item.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox(item);
      }
    });

    if (!item.hasAttribute("tabindex")) {
      item.setAttribute("tabindex", "0");
    }
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeLightbox);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && lightbox.classList.contains("open")) {
      closeLightbox();
    }
  });
});
