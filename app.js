const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const path = require("path");
const fs = require("fs");

const { initDb } = require("./lib/db");
const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const { siteSeoDefaults } = require("./lib/seo");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const SESSION_SECRET = process.env.SESSION_SECRET || "wisata-berastagi-secret";

const DATA_DIR =
  process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
    ? process.env.DATA_DIR
    : path.join(__dirname, "data");

const UPLOADS_DIR =
  process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
    ? path.join(process.env.DATA_DIR, "uploads")
    : path.join(__dirname, "uploads");

const PUBLIC_DIR = path.join(__dirname, "public");
const VIEWS_DIR = path.join(__dirname, "views");
const DB_PATH = path.join(DATA_DIR, "database.sqlite");
const SESSION_DB_PATH = path.join(DATA_DIR, "sessions.sqlite");

const REQUIRED_DIRS = [
  DATA_DIR,
  UPLOADS_DIR,
  PUBLIC_DIR,
  VIEWS_DIR,
  path.join(PUBLIC_DIR, "css"),
  path.join(PUBLIC_DIR, "js"),
  path.join(PUBLIC_DIR, "images"),
  path.join(UPLOADS_DIR, "wisata"),
  path.join(UPLOADS_DIR, "villa"),
  path.join(UPLOADS_DIR, "kuliner"),
  path.join(UPLOADS_DIR, "berita"),
  path.join(UPLOADS_DIR, "general")
];

for (const dir of REQUIRED_DIRS) {
  fs.mkdirSync(dir, { recursive: true });
}

initDb(DB_PATH);

app.set("view engine", "ejs");
app.set("views", VIEWS_DIR);
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.json({ limit: "20mb" }));

/* =========================
   STATIC FILES
========================= */
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR, {
  maxAge: "7d",
  etag: true,
  fallthrough: true
}));

/* =========================
   SESSION
========================= */
app.use(
  session({
    store: new SQLiteStore({
      db: path.basename(SESSION_DB_PATH),
      dir: path.dirname(SESSION_DB_PATH)
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: "lax",
      secure: false
    }
  })
);

/* =========================
   APP LOCALS
========================= */
app.locals.baseUrl = BASE_URL;
app.locals.site = siteSeoDefaults();
app.locals.currentYear = new Date().getFullYear();

/* =========================
   GLOBAL LOCALS
========================= */
app.use((req, res, next) => {
  res.locals.baseUrl = BASE_URL;
  res.locals.path = req.path;
  res.locals.query = req.query;
  res.locals.session = req.session;
  res.locals.currentYear = new Date().getFullYear();

  res.locals.seoDefaults = {
    title: "Wisata Berastagi – Tempat Wisata Terbaik di Berastagi Sumatera Utara",
    description:
      "Wisata Berastagi adalah panduan lengkap tempat wisata di Berastagi Sumatera Utara, mulai dari destinasi populer, villa dan hotel, kuliner, berita, hingga tips liburan terbaik.",
    canonical: `${BASE_URL}${req.path}`
  };

  next();
});

/* =========================
   ROUTES
========================= */
app.use("/", publicRoutes);
app.use("/admin", adminRoutes);

/* =========================
   SYSTEM ROUTES
========================= */
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
`User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml`
  );
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    site: "Wisata Berastagi",
    baseUrl: BASE_URL,
    uploadsDir: UPLOADS_DIR
  });
});

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).render("about", {
    settings: {
      site_name: "Wisata Berastagi",
      site_tagline: "Panduan wisata Berastagi terlengkap"
    },
    seo: {
      title: "Halaman Tidak Ditemukan | Wisata Berastagi",
      description: "Halaman yang kamu cari tidak tersedia di website Wisata Berastagi.",
      canonical: `${BASE_URL}${req.originalUrl}`,
      noindex: true
    },
    pageTitle: "404 - Halaman Tidak Ditemukan",
    pageContent: "Maaf, halaman yang kamu cari tidak tersedia."
  });
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("APP ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).render("about", {
    settings: {
      site_name: "Wisata Berastagi",
      site_tagline: "Panduan wisata Berastagi terlengkap"
    },
    seo: {
      title: "Terjadi Kesalahan | Wisata Berastagi",
      description: "Terjadi kendala pada website Wisata Berastagi.",
      canonical: `${BASE_URL}${req.originalUrl}`,
      noindex: true
    },
    pageTitle: "500 - Terjadi Kesalahan",
    pageContent: "Maaf, sedang terjadi kendala pada sistem. Silakan coba lagi beberapa saat."
  });
});

app.listen(PORT, () => {
  console.log(`WisataBerastagi running on port ${PORT}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Data dir: ${DATA_DIR}`);
  console.log(`Uploads dir: ${UPLOADS_DIR}`);
});
