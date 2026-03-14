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
      category TEXT,
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
      footer_text TEXT DEFAULT 'Panduan wisata Berastagi yang ramah, informatif, dan mudah digunakan.',
      homepage_title TEXT DEFAULT 'Wisata Berastagi Terlengkap 2026',
      homepage_meta_description TEXT DEFAULT 'Panduan tempat wisata, villa, kuliner, berita, dan tips liburan terbaru di Berastagi.',
      hero_title TEXT DEFAULT 'Wisata Berastagi',
      hero_subtitle TEXT DEFAULT 'Temukan tempat wisata, villa, kuliner, dan berita terbaru di Berastagi.',
      hero_background TEXT DEFAULT '/images/default-cover.jpg'
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
      homepage_title, homepage_meta_description, hero_title, hero_subtitle, hero_background
    ) VALUES (
      1,
      'Wisata Berastagi',
      'Panduan wisata Berastagi terlengkap',
      '0812-0000-0000',
      'info@wisataberastagi.com',
      'Berastagi, Kabupaten Karo, Sumatera Utara',
      'Panduan wisata Berastagi yang ramah, informatif, dan mudah digunakan.',
      'Wisata Berastagi Terlengkap 2026',
      'Panduan tempat wisata, villa, kuliner, berita, dan tips liburan terbaru di Berastagi.',
      'Wisata Berastagi',
      'Temukan tempat wisata, villa, kuliner, dan berita terbaru di Berastagi.',
      '/images/default-cover.jpg'
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

function runMigrations() {
  // wisata
  addColumnIfNotExists("wisata", "excerpt", "TEXT");
  addColumnIfNotExists("wisata", "content", "TEXT");
  addColumnIfNotExists("wisata", "image", "TEXT");
  addColumnIfNotExists("wisata", "location", "TEXT");
  addColumnIfNotExists("wisata", "ticket_price", "TEXT");
  addColumnIfNotExists("wisata", "open_hours", "TEXT");
  addColumnIfNotExists("wisata", "maps_url", "TEXT");
  addColumnIfNotExists("wisata", "meta_title", "TEXT");
  addColumnIfNotExists("wisata", "meta_description", "TEXT");
  addColumnIfNotExists("wisata", "is_featured", "INTEGER DEFAULT 0");
  addColumnIfNotExists("wisata", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  addColumnIfNotExists("wisata", "updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  // villa
  addColumnIfNotExists("villa", "excerpt", "TEXT");
  addColumnIfNotExists("villa", "content", "TEXT");
  addColumnIfNotExists("villa", "image", "TEXT");
  addColumnIfNotExists("villa", "price", "TEXT");
  addColumnIfNotExists("villa", "location", "TEXT");
  addColumnIfNotExists("villa", "facilities", "TEXT");
  addColumnIfNotExists("villa", "booking_url", "TEXT");
  addColumnIfNotExists("villa", "contact_phone", "TEXT");
  addColumnIfNotExists("villa", "maps_url", "TEXT");
  addColumnIfNotExists("villa", "meta_title", "TEXT");
  addColumnIfNotExists("villa", "meta_description", "TEXT");
  addColumnIfNotExists("villa", "is_featured", "INTEGER DEFAULT 0");
  addColumnIfNotExists("villa", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  addColumnIfNotExists("villa", "updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  // kuliner
  addColumnIfNotExists("kuliner", "excerpt", "TEXT");
  addColumnIfNotExists("kuliner", "content", "TEXT");
  addColumnIfNotExists("kuliner", "image", "TEXT");
  addColumnIfNotExists("kuliner", "location", "TEXT");
  addColumnIfNotExists("kuliner", "price_range", "TEXT");
  addColumnIfNotExists("kuliner", "open_hours", "TEXT");
  addColumnIfNotExists("kuliner", "contact_phone", "TEXT");
  addColumnIfNotExists("kuliner", "maps_url", "TEXT");
  addColumnIfNotExists("kuliner", "meta_title", "TEXT");
  addColumnIfNotExists("kuliner", "meta_description", "TEXT");
  addColumnIfNotExists("kuliner", "is_featured", "INTEGER DEFAULT 0");
  addColumnIfNotExists("kuliner", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  addColumnIfNotExists("kuliner", "updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  // articles / berita
  addColumnIfNotExists("articles", "excerpt", "TEXT");
  addColumnIfNotExists("articles", "content", "TEXT");
  addColumnIfNotExists("articles", "image", "TEXT");
  addColumnIfNotExists("articles", "category", "TEXT");
  addColumnIfNotExists("articles", "meta_title", "TEXT");
  addColumnIfNotExists("articles", "meta_description", "TEXT");
  addColumnIfNotExists("articles", "published_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  addColumnIfNotExists("articles", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  addColumnIfNotExists("articles", "updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  // comments
  addColumnIfNotExists("comments", "email", "TEXT");
  addColumnIfNotExists("comments", "status", "TEXT DEFAULT 'pending'");
  addColumnIfNotExists("comments", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  // ratings
  addColumnIfNotExists("ratings", "name", "TEXT");
  addColumnIfNotExists("ratings", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  // settings
  addColumnIfNotExists("settings", "site_tagline", "TEXT DEFAULT 'Panduan wisata Berastagi terlengkap'");
  addColumnIfNotExists("settings", "contact_phone", "TEXT DEFAULT '0812-0000-0000'");
  addColumnIfNotExists("settings", "contact_email", "TEXT DEFAULT 'info@wisataberastagi.com'");
  addColumnIfNotExists("settings", "address", "TEXT DEFAULT 'Berastagi, Kabupaten Karo, Sumatera Utara'");
  addColumnIfNotExists("settings", "footer_text", "TEXT DEFAULT 'Panduan wisata Berastagi yang ramah, informatif, dan mudah digunakan.'");
  addColumnIfNotExists("settings", "homepage_title", "TEXT DEFAULT 'Wisata Berastagi Terlengkap 2026'");
  addColumnIfNotExists("settings", "homepage_meta_description", "TEXT DEFAULT 'Panduan tempat wisata, villa, kuliner, berita, dan tips liburan terbaru di Berastagi.'");
  addColumnIfNotExists("settings", "hero_title", "TEXT DEFAULT 'Wisata Berastagi'");
  addColumnIfNotExists("settings", "hero_subtitle", "TEXT DEFAULT 'Temukan tempat wisata, villa, kuliner, dan berita terbaru di Berastagi.'");
  addColumnIfNotExists("settings", "hero_background", "TEXT DEFAULT '/images/default-cover.jpg'");
}

function seedData() {
  const _db = getDb();
  const defaultImage = "/images/default-cover.jpg";

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

    const items = [
      {
        title: "Gunung Sibayak",
        content:
          "Gunung Sibayak adalah salah satu destinasi wisata Berastagi yang paling populer untuk pecinta alam, pendaki pemula, dan pemburu sunrise.",
        image: defaultImage,
        location: "Berastagi, Kabupaten Karo",
        ticket_price: "25000",
        open_hours: "24 jam",
        maps_url: "https://maps.google.com",
        is_featured: 1
      },
      {
        title: "Bukit Gundaling",
        content:
          "Bukit Gundaling terkenal sebagai spot santai untuk melihat pemandangan pegunungan dan udara sejuk khas Berastagi.",
        image: defaultImage,
        location: "Berastagi, Kabupaten Karo",
        ticket_price: "15000",
        open_hours: "08.00 - 18.00",
        maps_url: "https://maps.google.com",
        is_featured: 1
      }
    ];

    for (const item of items) {
      const slug = makeSlug(item.title);
      insert.run({
        ...item,
        slug,
        excerpt: excerpt(item.content, 140),
        meta_title: `${item.title} | Wisata Berastagi`,
        meta_description: excerpt(item.content, 150)
      });
    }
  }

  const villaCount = _db.prepare("SELECT COUNT(*) as total FROM villa").get().total;
  if (!villaCount) {
    const insert = _db.prepare(`
      INSERT INTO villa (
        title, slug, excerpt, content, image, price, location, facilities, booking_url, contact_phone, maps_url,
        meta_title, meta_description, is_featured
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @price, @location, @facilities, @booking_url, @contact_phone, @maps_url,
        @meta_title, @meta_description, @is_featured
      )
    `);

    const items = [
      {
        title: "Villa Keluarga Berastagi Indah",
        content:
          "Villa keluarga di Berastagi dengan udara sejuk, taman luas, dan cocok untuk rombongan.",
        image: defaultImage,
        price: "650000",
        location: "Jl. Jamin Ginting, Berastagi",
        facilities: "2 kamar, wifi, parkir, dapur",
        booking_url: "https://example.com/booking",
        contact_phone: "0812-0000-0000",
        maps_url: "https://maps.google.com",
        is_featured: 1
      }
    ];

    for (const item of items) {
      const slug = makeSlug(item.title);
      insert.run({
        ...item,
        slug,
        excerpt: excerpt(item.content, 140),
        meta_title: `${item.title} | Villa Berastagi`,
        meta_description: excerpt(item.content, 150)
      });
    }
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

    const items = [
      {
        title: "Kuliner Jagung Bakar Berastagi",
        content:
          "Jagung bakar Berastagi adalah salah satu kuliner favorit wisatawan yang ingin menikmati udara dingin sambil makan hangat.",
        image: defaultImage,
        location: "Pusat Kota Berastagi",
        price_range: "15000 - 30000",
        open_hours: "16.00 - 23.00",
        contact_phone: "0812-0000-0000",
        maps_url: "https://maps.google.com",
        is_featured: 1
      },
      {
        title: "Pasar Buah Berastagi",
        content:
          "Pasar Buah Berastagi menawarkan aneka buah segar, jajanan khas, dan pengalaman kuliner lokal yang selalu dicari wisatawan.",
        image: defaultImage,
        location: "Jl. Veteran, Berastagi",
        price_range: "10000 - 50000",
        open_hours: "08.00 - 21.00",
        contact_phone: "0812-0000-0000",
        maps_url: "https://maps.google.com",
        is_featured: 1
      }
    ];

    for (const item of items) {
      const slug = makeSlug(item.title);
      insert.run({
        ...item,
        slug,
        excerpt: excerpt(item.content, 140),
        meta_title: `${item.title} | Kuliner Berastagi`,
        meta_description: excerpt(item.content, 150)
      });
    }
  }

  const beritaCount = _db.prepare("SELECT COUNT(*) as total FROM articles").get().total;
  if (!beritaCount) {
    const insert = _db.prepare(`
      INSERT INTO articles (
        title, slug, excerpt, content, image, category, meta_title, meta_description
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @category, @meta_title, @meta_description
      )
    `);

    const items = [
      {
        title: "10 Tempat Wisata Berastagi yang Wajib Dikunjungi",
        content:
          "Berastagi memiliki banyak tempat wisata menarik yang cocok untuk keluarga, pasangan, dan liburan singkat dengan udara sejuk.",
        image: defaultImage,
        category: "berita"
      },
      {
        title: "Kuliner Berastagi yang Populer di Kalangan Wisatawan",
        content:
          "Selain terkenal dengan udaranya yang sejuk, Berastagi juga punya banyak pilihan kuliner favorit yang wajib dicoba.",
        image: defaultImage,
        category: "kuliner"
      }
    ];

    for (const item of items) {
      const slug = makeSlug(item.title);
      insert.run({
        ...item,
        slug,
        excerpt: excerpt(item.content, 140),
        meta_title: `${item.title} | Berita Wisata Berastagi`,
        meta_description: excerpt(item.content, 150)
      });
    }
  }
}

module.exports = {
  initDb,
  getDb
};
