/* =========================
   GLOBAL LOCALS + SEO + BREADCRUMB
========================= */
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

  // Default breadcrumb
  res.locals.breadcrumbCategory = "";
  res.locals.breadcrumbCategorySlug = "";

  if (normalizedPath.startsWith("/berita")) {
    res.locals.breadcrumbCategory = "Berita";
    res.locals.breadcrumbCategorySlug = "berita";
  }

  if (normalizedPath.startsWith("/wisata")) {
    res.locals.breadcrumbCategory = "Tempat Wisata";
    res.locals.breadcrumbCategorySlug = "wisata";
  }

  if (normalizedPath.startsWith("/villa")) {
    res.locals.breadcrumbCategory = "Villa & Hotel";
    res.locals.breadcrumbCategorySlug = "villa";
  }

  if (normalizedPath.startsWith("/kuliner")) {
    res.locals.breadcrumbCategory = "Kuliner";
    res.locals.breadcrumbCategorySlug = "kuliner";
  }

  next();
});
