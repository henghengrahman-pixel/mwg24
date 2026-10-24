const fs=require('fs'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[
 ['settings action',()=>assert(read('views/admin-settings.ejs').includes('action="/admin/settings/save"'))],
 ['gallery edit route',()=>assert(read('routes/admin.js').includes('router.get("/gallery/edit/:id"'))],
 ['gallery render locals',()=>assert(read('routes/admin.js').includes('items, item: null'))],
 ['gallery slug saving',()=>assert(read('routes/admin.js').includes('slug=@slug'))],
 ['affiliate product edit route',()=>assert(read('routes/affiliate.js').includes('router.get("/admin/affiliate/products/edit/:id"'))],
 ['affiliate partner edit route',()=>assert(read('routes/affiliate.js').includes('router.get("/admin/affiliate/partners/edit/:id"'))],
 ['no replace partner',()=>assert(!read('routes/affiliate.js').includes('INSERT OR REPLACE'))],
 ['csrf middleware',()=>assert(read('app.js').includes('timingSafeEqual'))],
 ['affiliate inside sidebar',()=>assert(read('views/partials/admin-sidebar.ejs').indexOf('AFFILIATE')<read('views/partials/admin-sidebar.ejs').indexOf('</aside>'))],
 ['affiliate module routes',()=>assert(read('routes/affiliate.js').includes('const modules ='))]
];let fail=0;for(const [name,test] of checks){try{test();console.log('PASS',name)}catch(e){fail++;console.error('FAIL',name,e.message)}}
process.exitCode=fail?1:0;
