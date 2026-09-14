# Supabase migration history baseline

Snapshot date: 2026-09-14
Project: `bhqpixyiojthpfqnyhsh`

The connected Supabase Management API exposes migration version/name history, but not the historical SQL bodies for already-applied migrations. This file records the authoritative migration history observed in production before v5.26 hardening.

- `20260903113907_init_hubgiulestean_marketplace`
- `20260903113933_marketplace_performance_indexes`
- `20260903114034_privacy_contacts_and_launch_mode`
- `20260903115724_marketplace_launch_hardening`
- `20260903115956_marketplace_advisor_cleanup`
- `20260903120431_deployment_bundle_transport`
- `20260903121524_allow_rebrand_release_read`
- `20260903123017_allow_rebrand_v2_release_read`
- `20260903131650_profile_avatars_and_public_listing_images`
- `20260903202303_admin_newsletter_and_timed_suspensions`
- `20260903212506_blog_likes_comments_and_engagement`
- `20260903213947_blog_comment_replies`
- `20260908170649_enforce_max_10_active_listings`
- `20260908181105_user_ratings_and_seller_rating_stats`
- `20260908205129_user_incognito_and_conversation_hide`
- `20260908215947_v5_24_signup_legal_acceptance`

## Rule for v5.26 onward

All new database DDL changes must be committed as SQL migration files in this repository before production application.

No production schema change was made while creating this baseline.
