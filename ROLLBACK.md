# Rollback
1. Restore previous ZIP (v2).
2. Or git revert if using version control.
3. Affiliate tables are additive; existing data untouched.

## V5 pre-release rollback
Backup production SQLite and session data independently, using SQLite online backup or consistent stopped-service copy; do not delete or reset production volume. Revert application code to the last verified artifact; retain data volume. Added columns (`gallery.slug`, `affiliate_partners.logo`) are additive and need not be removed. Verify existing app schema compatibility before traffic is restored.
