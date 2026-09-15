begin;

revoke all on table public.blog_post_like_counts from service_role;
revoke all on table public.blog_post_comment_counts from service_role;
revoke all on table public.seller_rating_stats from service_role;

grant select on table public.blog_post_like_counts to service_role;
grant select on table public.blog_post_comment_counts to service_role;
grant select on table public.seller_rating_stats to service_role;

commit;
