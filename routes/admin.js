const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();
const { getDb } = require("../lib/db");
const { requireAdmin } = require("../middleware/auth");
const { makeSlug, excerpt } = require("../lib/helpers");
const { buildSeo } = require("../lib/seo");

/* =========================
   STORAGE
========================= */
const dataDir =
  process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
    ? path.join(process.env.DATA_DIR, "uploads")
    : path.join(__dirname, "..", "uploads");

fs.mkdirSync(dataDir, { recursive: true });

function storageFor(folder) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(dataDir, folder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || ".jpg").toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  });
}

const uploadOpt = { limits: { fileSize: 5 * 1024 * 1024 } };

const wisataUpload = multer({ storage: storageFor("wisata"), ...uploadOpt });
const villaUpload = multer({ storage: storageFor("villa"), ...uploadOpt });
const kulinerUpload = multer({ storage: storageFor("kuliner"), ...uploadOpt });
const beritaUpload = multer({ storage: storageFor("berita"), ...uploadOpt });
const galleryUpload = multer({ storage: storageFor("gallery"), ...uploadOpt });
const editorUpload = multer({ storage: storageFor("berita"), ...uploadOpt });

function fileUrl(folder, file) {
  return `/uploads/${folder}/${file}`;
}

/* =========================
   FIX IMAGE (UPLOAD + LINK)
========================= */
function fallbackImage(current, file, folder, imageUrlInput) {
  const url = String(imageUrlInput || "").trim();

  if (url) {
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) return url;
    return `/${url}`;
  }

  if (file?.filename) {
    return fileUrl(folder, file.filename);
  }

  return String(current || "").trim();
}

/* =========================
   LOGIN
========================= */
router.get("/login", (req, res) => {
  if (req.session.isAdmin) return res.redirect("/admin");
  res.render("login", {
    seo: buildSeo({ title: "Login Admin", noindex: true }),
    error: null
  });
});

router.post("/login", (req, res) => {
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE username=? AND password=?")
    .get(req.body.username, req.body.password);

  if (!user) {
    return res.render("login", {
      seo: buildSeo({ title: "Login Admin", noindex: true }),
      error: "Login gagal"
    });
  }

  req.session.isAdmin = true;
  res.redirect("/admin");
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

router.use(requireAdmin);

/* =========================
   UPLOAD EDITOR
========================= */
router.post("/upload-image", editorUpload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  res.json({ location: fileUrl("berita", req.file.filename) });
});

/* =========================
   DASHBOARD
========================= */
router.get("/", (req, res) => {
  const db = getDb();
  res.render("admin-dashboard", {
    seo: buildSeo({ title: "Dashboard", noindex: true }),
    stats: {
      wisata: db.prepare("SELECT COUNT(*) as t FROM wisata").get().t,
      villa: db.prepare("SELECT COUNT(*) as t FROM villa").get().t,
      kuliner: db.prepare("SELECT COUNT(*) as t FROM kuliner").get().t,
      berita: db.prepare("SELECT COUNT(*) as t FROM articles").get().t
    }
  });
});

/* =========================
   WISATA SAVE
========================= */
router.post("/wisata/save", wisataUpload.single("image"), (req, res) => {
  const db = getDb();
  const id = req.body.id;
  const image = fallbackImage(req.body.current_image, req.file, "wisata", req.body.image_url);

  const data = {
    title: req.body.title,
    slug: makeSlug(req.body.slug || req.body.title),
    content: req.body.content,
    image
  };

  if (id) {
    db.prepare("UPDATE wisata SET title=?,slug=?,content=?,image=? WHERE id=?")
      .run(data.title, data.slug, data.content, data.image, id);
  } else {
    db.prepare("INSERT INTO wisata (title,slug,content,image) VALUES (?,?,?,?)")
      .run(data.title, data.slug, data.content, data.image);
  }

  res.redirect("/admin/wisata");
});

/* =========================
   KULINER SAVE
========================= */
router.post("/kuliner/save", kulinerUpload.single("image"), (req, res) => {
  const db = getDb();
  const id = req.body.id;
  const image = fallbackImage(req.body.current_image, req.file, "kuliner", req.body.image_url);

  if (id) {
    db.prepare("UPDATE kuliner SET title=?,image=? WHERE id=?")
      .run(req.body.title, image, id);
  } else {
    db.prepare("INSERT INTO kuliner (title,image) VALUES (?,?)")
      .run(req.body.title, image);
  }

  res.redirect("/admin/kuliner");
});

/* =========================
   VILLA SAVE
========================= */
router.post("/villa/save", villaUpload.single("image"), (req, res) => {
  const db = getDb();
  const id = req.body.id;
  const image = fallbackImage(req.body.current_image, req.file, "villa", req.body.image_url);

  if (id) {
    db.prepare("UPDATE villa SET title=?,image=? WHERE id=?")
      .run(req.body.title, image, id);
  } else {
    db.prepare("INSERT INTO villa (title,image) VALUES (?,?)")
      .run(req.body.title, image);
  }

  res.redirect("/admin/villa");
});

/* =========================
   BERITA SAVE
========================= */
router.post("/berita/save", beritaUpload.single("image"), (req, res) => {
  const db = getDb();
  const id = req.body.id;
  const image = fallbackImage(req.body.current_image, req.file, "berita", req.body.image_url);

  if (id) {
    db.prepare("UPDATE articles SET title=?,image=? WHERE id=?")
      .run(req.body.title, image, id);
  } else {
    db.prepare("INSERT INTO articles (title,image) VALUES (?,?)")
      .run(req.body.title, image);
  }

  res.redirect("/admin/berita");
});

/* =========================
   GALLERY SAVE
========================= */
router.post("/gallery/save", galleryUpload.single("image"), (req, res) => {
  const db = getDb();
  const id = req.body.id;
  const image = fallbackImage(req.body.current_image, req.file, "gallery", req.body.image_url);

  if (!image) return res.redirect("/admin/gallery");

  if (id) {
    db.prepare("UPDATE gallery SET image=? WHERE id=?")
      .run(image, id);
  } else {
    db.prepare("INSERT INTO gallery (image) VALUES (?)")
      .run(image);
  }

  res.redirect("/admin/gallery");
});

module.exports = router;
