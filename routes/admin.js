const express = require("express");
const router = express.Router();
const { getDb } = require("../lib/db");
const { requireAdmin } = require("../middleware/auth");
const { makeSlug, excerpt } = require("../lib/helpers");
const { buildSeo } = require("../lib/seo");

/* =========================
   HELPERS
========================= */
function clean(value) {
  return String(value || "").trim();
}

function isValidUrl(url) {
  return /^https?:\/\/.+/i.test(url);
}

function validateImage(url, res, view, title, item) {
  if (!url || !isValidUrl(url)) {
    return res.status(400).render(view, {
      seo: buildSeo({ title, noindex: true }),
      item,
      error: "Gambar wajib URL valid (http/https)"
    });
  }
}

function uniqueSlug(table, slug, id = null) {
  const db = getDb();
  let base = clean(slug) || `item-${Date.now()}`;
  let final = base;
  let i = 2;

  while (true) {
    const exist = id
      ? db.prepare(`SELECT id FROM ${table} WHERE slug=? AND id!=?`).get(final, id)
      : db.prepare(`SELECT id FROM ${table} WHERE slug=?`).get(final);

    if (!exist) return final;
    final = `${base}-${i++}`;
  }
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
  const user = db
    .prepare("SELECT * FROM users WHERE username=? AND password=?")
    .get(clean(req.body.username), clean(req.body.password));

  if (!user) {
    return res.status(401).render("login", {
      seo: buildSeo({ title: "Login Admin", noindex: true }),
      error: "Login salah"
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
   WISATA
========================= */
router.get("/wisata", (req, res) => {
  const items = getDb().prepare("SELECT * FROM wisata ORDER BY id DESC").all();

  res.render("admin-wisata", {
    seo: buildSeo({ title: "Admin Wisata", noindex: true }),
    items
  });
});

router.get("/wisata/new", (req, res) => {
  res.render("admin-wisata-form", {
    seo: buildSeo({ title: "Tambah Wisata", noindex: true }),
    item: null,
    error: null
  });
});

router.get("/wisata/edit/:id", (req, res) => {
  const item = getDb().prepare("SELECT * FROM wisata WHERE id=?").get(req.params.id);
  if (!item) return res.redirect("/admin/wisata");

  res.render("admin-wisata-form", {
    seo: buildSeo({ title: "Edit Wisata", noindex: true }),
    item,
    error: null
  });
});

router.post("/wisata/save", (req, res) => {
  const db = getDb();
  const id = req.body.id ? Number(req.body.id) : null;

  const title = clean(req.body.title);
  const content = clean(req.body.content);
  const image = clean(req.body.image);

  const error = validateImage(
    image,
    res,
    "admin-wisata-form",
    id ? "Edit Wisata" : "Tambah Wisata",
    req.body
  );
  if (error) return;

  const slug = uniqueSlug("wisata", makeSlug(req.body.slug || title), id);

  const payload = {
    id,
    title,
    slug,
    excerpt: excerpt(content, 150),
    content,
    image,
    location: clean(req.body.location),
    meta_title: clean(req.body.meta_title || title),
    meta_description: excerpt(content, 150)
  };

  if (id) {
    db.prepare(`
      UPDATE wisata SET
      title=@title, slug=@slug, excerpt=@excerpt, content=@content,
      image=@image, location=@location,
      meta_title=@meta_title, meta_description=@meta_description
      WHERE id=@id
    `).run(payload);
  } else {
    db.prepare(`
      INSERT INTO wisata
      (title, slug, excerpt, content, image, location, meta_title, meta_description)
      VALUES
      (@title,@slug,@excerpt,@content,@image,@location,@meta_title,@meta_description)
    `).run(payload);
  }

  res.redirect("/admin/wisata");
});

/* =========================
   VILLA
========================= */
router.get("/villa", (req, res) => {
  const items = getDb().prepare("SELECT * FROM villa ORDER BY id DESC").all();

  res.render("admin-villa", {
    seo: buildSeo({ title: "Admin Villa", noindex: true }),
    items
  });
});

router.post("/villa/save", (req, res) => {
  const db = getDb();
  const id = req.body.id ? Number(req.body.id) : null;

  const title = clean(req.body.title);
  const image = clean(req.body.image);

  const error = validateImage(
    image,
    res,
    "admin-villa-form",
    id ? "Edit Villa" : "Tambah Villa",
    req.body
  );
  if (error) return;

  const slug = uniqueSlug("villa", makeSlug(req.body.slug || title), id);

  const payload = {
    id,
    title,
    slug,
    image,
    price: clean(req.body.price),
    location: clean(req.body.location),
    meta_title: clean(req.body.meta_title || title),
    meta_description: excerpt(req.body.content || "", 150)
  };

  if (id) {
    db.prepare(`UPDATE villa SET title=@title,slug=@slug,image=@image WHERE id=@id`).run(payload);
  } else {
    db.prepare(`INSERT INTO villa (title,slug,image) VALUES (@title,@slug,@image)`).run(payload);
  }

  res.redirect("/admin/villa");
});

/* =========================
   KULINER
========================= */
router.post("/kuliner/save", (req, res) => {
  const db = getDb();
  const id = req.body.id ? Number(req.body.id) : null;

  const title = clean(req.body.title);
  const image = clean(req.body.image);

  const error = validateImage(
    image,
    res,
    "admin-kuliner-form",
    id ? "Edit Kuliner" : "Tambah Kuliner",
    req.body
  );
  if (error) return;

  const slug = uniqueSlug("kuliner", makeSlug(req.body.slug || title), id);

  const payload = {
    id,
    title,
    slug,
    image,
    location: clean(req.body.location)
  };

  if (id) {
    db.prepare(`UPDATE kuliner SET title=@title,slug=@slug,image=@image WHERE id=@id`).run(payload);
  } else {
    db.prepare(`INSERT INTO kuliner (title,slug,image) VALUES (@title,@slug,@image)`).run(payload);
  }

  res.redirect("/admin/kuliner");
});

/* =========================
   BERITA
========================= */
router.post("/berita/save", (req, res) => {
  const db = getDb();
  const id = req.body.id ? Number(req.body.id) : null;

  const title = clean(req.body.title);
  const image = clean(req.body.image);
  const content = clean(req.body.content);

  const error = validateImage(
    image,
    res,
    "admin-article-form",
    id ? "Edit Berita" : "Tambah Berita",
    req.body
  );
  if (error) return;

  const slug = uniqueSlug("articles", makeSlug(req.body.slug || title), id);

  const payload = {
    id,
    title,
    slug,
    content,
    image,
    meta_title: title,
    meta_description: excerpt(content, 150)
  };

  if (id) {
    db.prepare(`UPDATE articles SET title=@title,slug=@slug,image=@image WHERE id=@id`).run(payload);
  } else {
    db.prepare(`INSERT INTO articles (title,slug,image,content) VALUES (@title,@slug,@image,@content)`).run(payload);
  }

  res.redirect("/admin/berita");
});

module.exports = router;
