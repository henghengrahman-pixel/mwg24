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

/* =========================
   DIR
========================= */
const DATA_DIR =
  process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
    ? process.env.DATA_DIR
    : path.join(__dirname, "data");

const PUBLIC_DIR = path.join(__dirname, "public");
const VIEWS_DIR = path.join(__dirname, "views");
const DB_PATH = path.join(DATA_DIR, "database.sqlite");
const SESSION_DB_PATH = path.join(DATA_DIR, "sessions.sqlite");

const REQUIRED_DIRS = [
  DATA_DIR,
  PUBLIC_DIR,
  VIEWS_DIR,
  path.join(PUBLIC_DIR, "css"),
  path.join(PUBLIC_DIR, "js"),
  path.join(PUBLIC_DIR, "images"),
  path.join(PUBLIC_DIR, "favicon")
];

for (const dir of REQUIRED_DIRS) {
  fs.mkdirSync(dir, { recursive: true });
}

initDb(DB_PATH);

/* =========================
   CONFIG
========================= */
app.set("view engine", "ejs");
app.set("views", VIEWS_DIR);
app.set("trust proxy", 1);
app.disable("x-powered-by");

/* =========================
   HELPER
========================= */
function normalizeUrlPath(urlPath = "/") {
  if (!urlPath || urlPath === "/") return "/";
  return urlPath.replace(/\/+$/, "") || "/";
}

function getRequestBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"]?.split(",")[0] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function shouldRedirectToBase(req) {
  if (!IS_PROD) return false;
  return getRequestBaseUrl(req) !== BASE_URL;
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

function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function lastmod(value) {
  try {
    return new Date(value).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/* =========================
   SECURITY
========================= */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

/* =========================
   REDIRECT
========================= */
app.use((req, res, next) => {
  if (shouldRedirectToBase(req)) {
    return res.redirect(301, `${BASE_URL}${req.originalUrl}`);
  }

  if (req.path.length > 1 && req.path.endsWith("/") && !req.path.startsWith("/admin")) {
    const query = req.originalUrl.includes("?")
      ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
      : "";
    return res.redirect(301, `${req.path.replace(/\/+$/, "")}${query}`);
  }

  next();
});

/* =========================
   BODY
========================= */
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.json({ limit: "20mb" }));

/* =========================
   STATIC (NO UPLOADS)
========================= */
app.use(express.static(PUBLIC_DIR));

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
app.locals.baseUrl = BASE_URL;
app.locals.site = siteSeoDefaults();
app.locals.currentYear = new Date().getFullYear();

app.use((req, res, next) => {
  const normalizedPath = normalizeUrlPath(req.path);
  const canonical = cleanCanonical(BASE_URL, req);

  res.locals.baseUrl = BASE_URL;
  res.locals.path = normalizedPath;
  res.locals.query = req.query;
  res.locals.session = req.session;
  res.locals.canonical = canonical;

  next();
});

/* =========================
   ROBOTS
========================= */
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${BASE_URL}/sitemap.xml`);
});

/* =========================
   SITEMAP (FULL)
========================= */
app.get("/sitemap.xml", (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();

  const wisata = db.prepare("SELECT slug FROM wisata").all();
  const villa = db.prepare("SELECT slug FROM villa").all();
  const kuliner = db.prepare("SELECT slug FROM kuliner").all();
  const berita = db.prepare("SELECT slug FROM articles").all();

  let urls = "";

  const push = (url) => {
    urls += `<url><loc>${xmlEscape(url)}</loc><lastmod>${now}</lastmod></url>`;
  };

  push(`${BASE_URL}/`);
  push(`${BASE_URL}/wisata`);
  push(`${BASE_URL}/villa`);
  push(`${BASE_URL}/kuliner`);
  push(`${BASE_URL}/berita`);

  wisata.forEach(i => push(`${BASE_URL}/wisata/${i.slug}`));
  villa.forEach(i => push(`${BASE_URL}/villa/${i.slug}`));
  kuliner.forEach(i => push(`${BASE_URL}/kuliner/${i.slug}`));
  berita.forEach(i => push(`${BASE_URL}/berita/${i.slug}`));

  res.type("application/xml").send(`<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

/* =========================
   ROUTES
========================= */
app.use("/", publicRoutes);
app.use("/admin", adminRoutes);

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).render("about", {
    settings: defaultSettingsFallback(),
    path: normalizeUrlPath(req.path),
    pageTitle: "404",
    pageContent: "Halaman tidak ditemukan",
    seo: { title: "404", noindex: true }
  });
});

/* =========================
   ERROR
========================= */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("about", {
    settings: defaultSettingsFallback(),
    path: normalizeUrlPath(req.path),
    pageTitle: "500",
    pageContent: "Server error",
    seo: { title: "500", noindex: true }
  });
});

/* =========================
   RUN
========================= */
app.listen(PORT, () => {
  console.log(`RUNNING: ${BASE_URL}`);
});
