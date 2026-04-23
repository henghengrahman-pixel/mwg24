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

const DATA_DIR = process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
  ? process.env.DATA_DIR
  : path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");
const VIEWS_DIR = path.join(__dirname, "views");
const DB_PATH = path.join(DATA_DIR, "database.sqlite");
const SESSION_DB_PATH = path.join(DATA_DIR, "sessions.sqlite");

[
  DATA_DIR,
  UPLOADS_DIR,
  path.join(UPLOADS_DIR, "berita"),
  PUBLIC_DIR,
  VIEWS_DIR,
  path.join(PUBLIC_DIR, "css"),
  path.join(PUBLIC_DIR, "js"),
  path.join(PUBLIC_DIR, "images"),
  path.join(PUBLIC_DIR, "favicon")
].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

// 🔥 FIX: DB INIT SAFE
try {
  initDb(DB_PATH);
} catch (err) {
  console.error("DB INIT ERROR:", err);
}

app.set("view engine", "ejs");
app.set("views", VIEWS_DIR);
app.set("trust proxy", 1);
app.disable("x-powered-by");

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
  return getRequestBaseUrl(req) !== BASE_URL;
}

function cleanCanonical(baseUrl, req) {
  const pathname = normalizeUrlPath(req.path);
  return `${baseUrl}${pathname === "/" ? "/" : pathname}`;
}

function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
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

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

app.use((req, res, next) => {
  if (shouldRedirectToBase(req)) {
    return res.redirect(301, `${BASE_URL}${req.originalUrl}`);
  }

  if (req.path.length > 1 && req.path.endsWith("/") && !req.path.startsWith("/admin")) {
    const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    return res.redirect(301, `${req.path.replace(/\/+$/, "")}${query}`);
  }

  next();
});

app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.json({ limit: "20mb" }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

app.use(session({
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
}));

app.locals.baseUrl = BASE_URL;
app.locals.site = siteSeoDefaults();
app.locals.currentYear = new Date().getFullYear();
app.locals.helpers = require("./lib/helpers");

app.use((req, res, next) => {
  const normalizedPath = normalizeUrlPath(req.path);
  const canonical = cleanCanonical(BASE_URL, req);

  res.locals.baseUrl = BASE_URL;
  res.locals.path = normalizedPath;
  res.locals.query = req.query;
  res.locals.session = req.session;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.requestUrl = `${BASE_URL}${req.originalUrl}`;
  res.locals.canonicalUrl = canonical;
  res.locals.canonical = canonical;
  res.locals.helpers = require("./lib/helpers");

  res.locals.breadcrumbCategory = "";
  res.locals.breadcrumbCategorySlug = "";

  if (normalizedPath === "/berita" || normalizedPath.startsWith("/berita/")) {
    res.locals.breadcrumbCategory = "Berita";
    res.locals.breadcrumbCategorySlug = "berita";
  } else if (normalizedPath === "/wisata" || normalizedPath.startsWith("/wisata/")) {
    res.locals.breadcrumbCategory = "Tempat Wisata";
    res.locals.breadcrumbCategorySlug = "wisata";
  } else if (normalizedPath === "/villa" || normalizedPath.startsWith("/villa/")) {
    res.locals.breadcrumbCategory = "Villa & Hotel";
    res.locals.breadcrumbCategorySlug = "villa";
  } else if (normalizedPath === "/kuliner" || normalizedPath.startsWith("/kuliner/")) {
    res.locals.breadcrumbCategory = "Kuliner";
    res.locals.breadcrumbCategorySlug = "kuliner";
  } else if (normalizedPath === "/galeri" || normalizedPath.startsWith("/galeri/")) {
    res.locals.breadcrumbCategory = "Galeri";
    res.locals.breadcrumbCategorySlug = "galeri";
  }

  next();
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain; charset=UTF-8").send(`User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${BASE_URL}/sitemap.xml`);
});

app.get("/sitemap.xml", (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();

  const staticPages = [
    { url: `${BASE_URL}/`, updated_at: now }
  ];

  let urls = staticPages.map(p => `<url><loc>${xmlEscape(p.url)}</loc><lastmod>${lastmod(p.updated_at)}</lastmod></url>`).join("");

  res.header("Content-Type", "application/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

// 🔥 HEALTH + PING
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/ping", (req, res) => res.send("pong"));

app.use("/", publicRoutes);
app.use("/admin", adminRoutes);

app.use((err, req, res, next) => {
  console.error("APP ERROR:", err);
  res.status(500).send("Server Error");
});

// 🔥 CRASH HANDLER
process.on("uncaughtException", err => console.error("UNCAUGHT:", err));
process.on("unhandledRejection", err => console.error("REJECTION:", err));

// 🔥 FIX RAILWAY LISTEN
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Wisata Berastagi running on port ${PORT}`);
  console.log(`Base URL: ${BASE_URL}`);
});
