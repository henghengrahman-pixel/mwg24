const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const path = require("path");
const fs = require("fs");

const { initDb, getDb } = require("./lib/db");
const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const { siteSeoDefaults } = require("./lib/seo");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const RAW_BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const BASE_URL = String(RAW_BASE_URL).replace(/\/+$/, "");
const SESSION_SECRET = process.env.SESSION_SECRET || "wisata-berastagi-secret";
const IS_PROD = process.env.NODE_ENV === "production";

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
  path.join(PUBLIC_DIR, "favicon"),
  path.join(UPLOADS_DIR, "wisata"),
  path.join(UPLOADS_DIR, "villa"),
  path.join(UPLOADS_DIR, "kuliner"),
  path.join(UPLOADS_DIR, "berita"),
  path.join(UPLOADS_DIR, "gallery"),
  path.join(UPLOADS_DIR, "general")
];

for (const dir of REQUIRED_DIRS) {
  fs.mkdirSync(dir, { recursive: true });
}

initDb(DB_PATH);

app.set("view engine", "ejs");
app.set("views", VIEWS_DIR);
app.set("trust proxy", 1);
app.disable("x-powered-by");

/* =========================
   HELPERS
========================= */
function normalizeUrlPath(urlPath = "/") {
  if (!urlPath || urlPath === "/") return "/";
  return urlPath.replace(/\/+$/, "") || "/";
}

function getRequestBaseUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = forwardedProto ? String(forwardedProto).split(",")[0].trim() : req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function shouldRedirectToBase(req) {
  if (!IS_PROD) return false;
  const requestBase = getRequestBaseUrl(req);
  return requestBase !== BASE_URL;
}

function cleanCanonical(baseUrl, req) {
  const pathname = normalizeUrlPath(req.path);
  return `${baseUrl}${pathname === "/" ? "/" : pathname}`;
}

function defaultSettingsFallback() {
  return {
    site_name: "Wisata Berastagi",
    site_tagline: "Panduan wisata Berastagi terlengkap"
  };
}

/* =========================
   BASIC HEADERS
========================= */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

/* =========================
   CANONICAL HOST + TRAILING SLASH
========================= */
app.use((req, res, next) => {
  if (shouldRedirectToBase(req)) {
    const target = `${BASE_URL}${req.originalUrl}`;
    return res.redirect(301, target);
  }

  if (
    req.path.length > 1 &&
    req.path.endsWith("/") &&
    !req.path.startsWith("/admin")
  ) {
    const query = req.originalUrl.includes("?")
      ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
      : "";
    const normalizedPath = req.path.replace(/\/+$/, "");
    return res.redirect(301, `${normalizedPath}${query}`);
  }

  next();
});

/* =========================
   BODY PARSER
========================= */
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.json({ limit: "20mb" }));

/* =========================
   STATIC
========================= */
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

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
    rolling: true,
    proxy: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD
    }
  })
);

/* =========================
   GLOBAL LOCALS
========================= */
app.use((req, res, next) => {
  const normalizedPath = normalizeUrlPath(req.path);

  res.locals.baseUrl = BASE_URL;
  res.locals.path = normalizedPath;
  res.locals.query = req.query;
  res.locals.session = req.session;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.requestUrl = `${BASE_URL}${req.originalUrl}`;
  res.locals.canonicalUrl = cleanCanonical(BASE_URL, req);

  next();
});

/* =========================
   ROUTES
========================= */
app.use("/", publicRoutes);
app.use("/admin", adminRoutes);

/* =========================
   ROBOTS
========================= */
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
`User-agent: *
Allow: /
Disallow: /admin
Disallow: /cari

Sitemap: ${BASE_URL}/sitemap.xml`
  );
});

/* =========================
   SITEMAP (SEO PENTING)
========================= */
app.get("/sitemap.xml", (req, res) => {
  const db = getDb();

  const wisata = db.prepare("SELECT slug FROM wisata").all();
  const villa = db.prepare("SELECT slug FROM villa").all();
  const kuliner = db.prepare("SELECT slug FROM kuliner").all();
  const berita = db.prepare("SELECT slug FROM articles").all();

  let urls = `
  <url><loc>${BASE_URL}/</loc></url>
  <url><loc>${BASE_URL}/wisata</loc></url>
  <url><loc>${BASE_URL}/villa</loc></url>
  <url><loc>${BASE_URL}/kuliner</loc></url>
  <url><loc>${BASE_URL}/berita</loc></url>
  `;

  wisata.forEach(i => {
    urls += `<url><loc>${BASE_URL}/wisata/${i.slug}</loc></url>`;
  });

  villa.forEach(i => {
    urls += `<url><loc>${BASE_URL}/villa/${i.slug}</loc></url>`;
  });

  kuliner.forEach(i => {
    urls += `<url><loc>${BASE_URL}/kuliner/${i.slug}</loc></url>`;
  });

  berita.forEach(i => {
    urls += `<url><loc>${BASE_URL}/berita/${i.slug}</loc></url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
  </urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

/* =========================
   HEALTH
========================= */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    site: "Wisata Berastagi",
    baseUrl: BASE_URL
  });
});

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).render("about", {
    settings: defaultSettingsFallback(),
    seo: {
      title: "Halaman Tidak Ditemukan | Wisata Berastagi",
      description: "Halaman tidak ditemukan.",
      canonical: `${BASE_URL}${normalizeUrlPath(req.path)}`,
      noindex: true
    }
  });
});

/* =========================
   ERROR
========================= */
app.use((err, req, res, next) => {
  console.error("APP ERROR:", err);

  res.status(500).render("about", {
    settings: defaultSettingsFallback(),
    seo: {
      title: "Terjadi Kesalahan | Wisata Berastagi",
      description: "Terjadi kesalahan pada server.",
      canonical: `${BASE_URL}${normalizeUrlPath(req.path)}`,
      noindex: true
    }
  });
});

app.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
