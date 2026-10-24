# Route Matrix — implementasi dan verifikasi

| Menu | Action | Method | Route | DB | Runtime test |
|---|---|---|---|---|---|
| Settings | Save | POST | `/admin/settings/save` | settings | NOT VERIFIED |
| Gallery | List | GET | `/admin/gallery` | gallery | NOT VERIFIED |
| Gallery | Edit | GET | `/admin/gallery/edit/:id` | gallery | NOT VERIFIED |
| Gallery | Save | POST | `/admin/gallery/save` | gallery | NOT VERIFIED |
| Gallery | Delete | POST | `/admin/gallery/delete/:id` | gallery | NOT VERIFIED |
| Affiliate products | List/Edit/Save/Archive | GET/POST | `/admin/affiliate/products[/*]` | affiliate_products | NOT VERIFIED |
| Affiliate partners | List/Edit/Save/Archive | GET/POST | `/admin/affiliate/partners[/*]` | affiliate_partners | NOT VERIFIED |
| Affiliate categories | List/Edit/Save/Delete | GET/POST | `/admin/affiliate/categories[/*]` | affiliate_categories | NOT VERIFIED |
| Affiliate placements | List/Edit/Save/Archive | GET/POST | `/admin/affiliate/placements[/*]` | affiliate_placements | NOT VERIFIED |
| Affiliate campaigns | List/Edit/Save/Archive | GET/POST | `/admin/affiliate/campaigns[/*]` | affiliate_campaigns | NOT VERIFIED |
| Affiliate reports | Clicks | GET | `/admin/affiliate/clicks` | affiliate_clicks | NOT VERIFIED |
| Affiliate reports | Conversions | GET | `/admin/affiliate/conversions` | affiliate_conversions | NOT VERIFIED |

All other existing actions retained but not exhaustively enumerated or runtime tested.
