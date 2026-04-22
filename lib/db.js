const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { makeSlug, excerpt } = require("./helpers");

let db;

function initDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wisata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT,
      image TEXT,
      location TEXT,
      ticket_price TEXT,
      open_hours TEXT,
      maps_url TEXT,
      meta_title TEXT,
      meta_description TEXT,
      is_featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS villa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT,
      image TEXT,
      images TEXT,
      price TEXT,
      location TEXT,
      facilities TEXT,
      booking_url TEXT,
      contact_phone TEXT,
      maps_url TEXT,
      meta_title TEXT,
      meta_description TEXT,
      is_featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kuliner (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT,
      image TEXT,
      location TEXT,
      price_range TEXT,
      open_hours TEXT,
      contact_phone TEXT,
      maps_url TEXT,
      meta_title TEXT,
      meta_description TEXT,
      is_featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT,
      image TEXT,
      category TEXT DEFAULT 'berita',
      status TEXT DEFAULT 'publish',
      meta_title TEXT,
      meta_description TEXT,
      published_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      comment TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      name TEXT,
      rating INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      site_name TEXT DEFAULT 'Wisata Berastagi',
      site_tagline TEXT DEFAULT 'Panduan wisata Berastagi terlengkap',
      contact_phone TEXT DEFAULT '0812-0000-0000',
      contact_email TEXT DEFAULT 'info@wisataberastagi.com',
      address TEXT DEFAULT 'Berastagi, Kabupaten Karo, Sumatera Utara',
      footer_text TEXT DEFAULT 'Portal panduan wisata Berastagi yang informatif, rapi, dan mudah dipahami.',
      homepage_title TEXT DEFAULT 'Wisata Berastagi Terlengkap | Tempat Wisata, Villa, Hotel & Kuliner Terbaik',
      homepage_meta_description TEXT DEFAULT 'Temukan tempat wisata di Berastagi, villa dan hotel nyaman, kuliner favorit, berita terbaru, serta panduan liburan lengkap di Kabupaten Karo, Sumatera Utara.',
      hero_title TEXT DEFAULT 'Wisata Berastagi Terlengkap untuk Liburan Keluarga, Healing, dan Jelajah Alam',
      hero_subtitle TEXT DEFAULT 'Cari tempat wisata Berastagi populer, villa dan hotel nyaman, kuliner khas Karo, serta panduan liburan lengkap dalam satu website yang rapi dan mudah digunakan.',
      hero_background TEXT DEFAULT '/images/wisata-berastagi-cover.jpg',
      logo TEXT DEFAULT '/favicon/favicon-512x512.png'
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      slug TEXT,
      image TEXT NOT NULL,
      alt_text TEXT,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  runMigrations();

  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "123456";

  const userExists = db.prepare("SELECT id FROM users WHERE username = ?").get(adminUser);
  if (!userExists) {
    db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(adminUser, adminPass);
  }

  db.prepare(`
    INSERT OR IGNORE INTO settings (
      id, site_name, site_tagline, contact_phone, contact_email, address, footer_text,
      homepage_title, homepage_meta_description, hero_title, hero_subtitle, hero_background, logo
    ) VALUES (
      1,
      'Wisata Berastagi',
      'Panduan wisata Berastagi terlengkap',
      '0812-0000-0000',
      'info@wisataberastagi.com',
      'Berastagi, Kabupaten Karo, Sumatera Utara',
      'Portal panduan wisata Berastagi yang informatif, rapi, dan mudah dipahami.',
      'Wisata Berastagi Terlengkap | Tempat Wisata, Villa, Hotel & Kuliner Terbaik',
      'Temukan tempat wisata di Berastagi, villa dan hotel nyaman, kuliner favorit, berita terbaru, serta panduan liburan lengkap di Kabupaten Karo, Sumatera Utara.',
      'Wisata Berastagi Terlengkap untuk Liburan Keluarga, Healing, dan Jelajah Alam',
      'Cari tempat wisata Berastagi populer, villa dan hotel nyaman, kuliner khas Karo, serta panduan liburan lengkap dalam satu website yang rapi dan mudah digunakan.',
      '/images/wisata-berastagi-cover.jpg',
      '/favicon/favicon-512x512.png'
    )
  `).run();

  seedData();
  return db;
}

function getDb() {
  if (!db) throw new Error("Database belum diinisialisasi.");
  return db;
}

function hasColumn(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((col) => col.name === columnName);
}

function addColumnIfNotExists(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function runSafeUpdate(sql) {
  try {
    db.exec(sql);
  } catch (error) {
    console.error("Migration warning:", error.message);
  }
}

function runMigrations() {
  addColumnIfNotExists("settings", "logo", "TEXT DEFAULT '/favicon/favicon-512x512.png'");
  addColumnIfNotExists("settings", "hero_background", "TEXT DEFAULT '/images/wisata-berastagi-cover.jpg'");
  addColumnIfNotExists("villa", "images", "TEXT");
  addColumnIfNotExists("gallery", "alt_text", "TEXT");
  addColumnIfNotExists("gallery", "caption", "TEXT");
  addColumnIfNotExists("gallery", "sort_order", "INTEGER DEFAULT 0");
  addColumnIfNotExists("gallery", "is_active", "INTEGER DEFAULT 1");

  runSafeUpdate(`UPDATE villa SET images = '[]' WHERE images IS NULL OR TRIM(images) = ''`);
  runSafeUpdate(`UPDATE articles SET category = 'berita' WHERE category IS NULL OR TRIM(category) = ''`);
  runSafeUpdate(`UPDATE articles SET status = 'publish' WHERE status IS NULL OR TRIM(status) = ''`);
  runSafeUpdate(`UPDATE articles SET published_at = created_at WHERE (published_at IS NULL OR TRIM(published_at) = '') AND created_at IS NOT NULL`);
  runSafeUpdate(`UPDATE articles SET updated_at = created_at WHERE (updated_at IS NULL OR TRIM(updated_at) = '') AND created_at IS NOT NULL`);
  runSafeUpdate(`UPDATE settings SET logo = '/favicon/favicon-512x512.png' WHERE logo IS NULL OR TRIM(logo) = ''`);
}

function seedData() {
  const _db = getDb();
  const defaultImage = "/images/wisata-berastagi-cover.jpg";

  const wisataCount = _db.prepare("SELECT COUNT(*) as total FROM wisata").get().total;
  if (!wisataCount) {
    const insert = _db.prepare(`
      INSERT INTO wisata (
        title, slug, excerpt, content, image, location, ticket_price, open_hours, maps_url,
        meta_title, meta_description, is_featured
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @location, @ticket_price, @open_hours, @maps_url,
        @meta_title, @meta_description, @is_featured
      )
    `);

    [
      {
        title: "Gunung Sibayak",
        content: "Gunung Sibayak adalah salah satu tempat wisata Berastagi paling populer untuk pendaki pemula, pemburu sunrise, dan wisatawan yang ingin menikmati panorama pegunungan dataran tinggi Karo.",
        image: defaultImage,
        location: "Berastagi, Kabupaten Karo",
        ticket_price: "25000",
        open_hours: "24 jam",
        maps_url: "https://maps.google.com",
        is_featured: 1
      },
      {
        title: "Bukit Gundaling",
        content: "Bukit Gundaling menjadi destinasi wisata Berastagi favorit untuk menikmati udara sejuk, panorama pegunungan, dan suasana santai yang cocok untuk keluarga maupun pasangan.",
        image: defaultImage,
        location: "Berastagi, Kabupaten Karo",
        ticket_price: "15000",
        open_hours: "08.00 - 18.00",
        maps_url: "https://maps.google.com",
        is_featured: 1
      }
    ].forEach((item) => {
      const slug = makeSlug(item.title);
      insert.run({
        ...item,
        slug,
        excerpt: excerpt(item.content, 150),
        meta_title: `${item.title} | Tempat Wisata Berastagi`,
        meta_description: excerpt(item.content, 155)
      });
    });
  }

  const villaCount = _db.prepare("SELECT COUNT(*) as total FROM villa").get().total;
  if (!villaCount) {
    const insert = _db.prepare(`
      INSERT INTO villa (
        title, slug, excerpt, content, image, images, price, location, facilities, booking_url, contact_phone, maps_url,
        meta_title, meta_description, is_featured
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @images, @price, @location, @facilities, @booking_url, @contact_phone, @maps_url,
        @meta_title, @meta_description, @is_featured
      )
    `);

    [
      {
        title: "Villa Keluarga Berastagi Indah",
        content: "Villa keluarga di Berastagi dengan udara sejuk, taman luas, dan suasana nyaman yang cocok untuk rombongan, keluarga, maupun wisatawan yang ingin menikmati liburan tenang di dataran tinggi Karo.",
        image: defaultImage,
        images: JSON.stringify([defaultImage]),
        price: "650000",
        location: "Jl. Jamin Ginting, Berastagi",
        facilities: "2 kamar, wifi, parkir, dapur",
        booking_url: "https://example.com/booking",
        contact_phone: "0812-0000-0000",
        maps_url: "https://maps.google.com",
        is_featured: 1
      }
    ].forEach((item) => {
      const slug = makeSlug(item.title);
      insert.run({
        ...item,
        slug,
        excerpt: excerpt(item.content, 150),
        meta_title: `${item.title} | Villa dan Hotel di Berastagi`,
        meta_description: excerpt(item.content, 155)
      });
    });
  }

  const kulinerCount = _db.prepare("SELECT COUNT(*) as total FROM kuliner").get().total;
  if (!kulinerCount) {
    const insert = _db.prepare(`
      INSERT INTO kuliner (
        title, slug, excerpt, content, image, location, price_range, open_hours, contact_phone, maps_url,
        meta_title, meta_description, is_featured
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @location, @price_range, @open_hours, @contact_phone, @maps_url,
        @meta_title, @meta_description, @is_featured
      )
    `);

    [
      {
        title: "Jagung Bakar Berastagi",
        content: "Jagung bakar Berastagi menjadi salah satu kuliner favorit wisatawan yang ingin menikmati udara dingin sambil menikmati makanan hangat dengan cita rasa khas di pusat kota Berastagi.",
        image: defaultImage,
        location: "Pusat Kota Berastagi",
        price_range: "15000 - 30000",
        open_hours: "16.00 - 23.00",
        contact_phone: "0812-0000-0000",
        maps_url: "https://maps.google.com",
        is_featured: 1
      }
    ].forEach((item) => {
      const slug = makeSlug(item.title);
      insert.run({
        ...item,
        slug,
        excerpt: excerpt(item.content, 150),
        meta_title: `${item.title} | Kuliner Berastagi`,
        meta_description: excerpt(item.content, 155)
      });
    });
  }

  const beritaCount = _db.prepare("SELECT COUNT(*) as total FROM articles").get().total;
  if (!beritaCount) {
    const insert = _db.prepare(`
      INSERT INTO articles (
        title, slug, excerpt, content, image, category, status, meta_title, meta_description, published_at
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @category, @status, @meta_title, @meta_description, CURRENT_TIMESTAMP
      )
    `);

    [
      {
        title: "10 Tempat Wisata Berastagi yang Wajib Dikunjungi",
        content: "Berastagi memiliki banyak tempat wisata menarik yang cocok untuk keluarga, pasangan, dan liburan singkat, mulai dari panorama pegunungan, udara sejuk, hingga spot foto dan destinasi alam yang populer.",
        image: defaultImage,
        category: "berita",
        status: "publish"
      }
    ].forEach((item) => {
      const slug = makeSlug(item.title);
      insert.run({
        ...item,
        slug,
        excerpt: excerpt(item.content, 150),
        meta_title: `${item.title} | Berita Wisata Berastagi`,
        meta_description: excerpt(item.content, 155)
      });
    });
  }
}

module.exports = { initDb, getDb };
