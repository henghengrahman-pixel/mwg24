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

/* ================= CONFIG ================= */
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const SESSION_SECRET = process.env.SESSION_SECRET || "secret";
const IS_PROD = process.env.NODE_ENV === "production";

/* ================= DIR ================= */
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");
const VIEWS_DIR = path.join(__dirname, "views");

[DATA_DIR, UPLOADS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

initDb(path.join(DATA_DIR, "database.sqlite"));

/* ================= BASIC ================= */
app.set("view engine", "ejs");
app.set("views", VIEWS_DIR);
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

/* ================= SESSION ================= */
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: DATA_DIR }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: IS_PROD,
    httpOnly: true,
    sameSite: "lax"
  }
}));

/* ================= GLOBAL ================= */
app.locals.baseUrl = BASE_URL;
app.locals.site = siteSeoDefaults();

/* ================= HEALTH ================= */
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

/* ================= ROBOTS ================= */
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${BASE_URL}/sitemap.xml`);
});

/* ================= SITEMAP ================= */
app.get("/sitemap.xml", (req, res) => {
  const db = getDb();

  let urls = `
  <url><loc>${BASE_URL}/</loc></url>
  <url><loc>${BASE_URL}/wisata</loc></url>
  <url><loc>${BASE_URL}/villa</loc></url>
  <url><loc>${BASE_URL}/kuliner</loc></url>
  <url><loc>${BASE_URL}/berita</loc></url>
  `;

  ["wisata","villa","kuliner","articles"].forEach(table => {
    const prefix = table === "articles" ? "berita" : table;
    db.prepare(`SELECT slug FROM ${table}`).all().forEach(r=>{
      urls += `<url><loc>${BASE_URL}/${prefix}/${r.slug}</loc></url>`;
    });
  });

  res.type("application/xml").send(`<?xml version="1.0"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
  </urlset>`);
});

/* ================= ROUTES ================= */
app.use("/", publicRoutes);
app.use("/admin", adminRoutes);

/* ================= ERROR ================= */
app.use((err, req, res, next) => {
  console.error("ERROR:", err);
  res.status(500).send("Server Error");
});

/* ================= CRASH FIX ================= */
process.on("uncaughtException", err => {
  console.error("UNCAUGHT:", err);
});

process.on("unhandledRejection", err => {
  console.error("REJECTION:", err);
});

/* ================= START ================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING PORT:", PORT);
  console.log("BASE URL:", BASE_URL);
});
