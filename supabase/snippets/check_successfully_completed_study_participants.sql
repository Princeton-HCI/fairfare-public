-- Created: 2025-01-15 / AS
-- Description: Find users who have successfully completed a study
--             and have all their accounts synced, and return their
--             email, phone, last name, first name, study shortcode,
--             and a boolean indicating whether their profile has synced.
--
--             A profile is considered synced if the user has at least
--             one account and all their accounts have been synced.
--
--             Note that this query was developed for the Q3 2024 - Q1 2025
--             EDL collaboration, and may need to be adapted
--             for other use cases.
--
--             If we want to incorporate this query / its resulting data into
--             an organizer view, we should create a view that is similar to
--             this query.

WITH
   profile_sync_status AS (
       SELECT
           p.user_id,
           CASE
               WHEN COUNT(*) = 0 THEN FALSE -- No accounts
               WHEN COUNT(*) = COUNT(
                   CASE
                       WHEN aa.all_gigs_last_synced_at IS NOT NULL THEN 1
                   END
               ) THEN TRUE -- All accounts synced
               ELSE FALSE -- Some accounts not synced
           END AS profile_has_synced
       FROM
           profiles p
           LEFT JOIN auth.users au ON p.user_id = au.id
           LEFT JOIN argyle_accounts aa ON au.id = aa.user_id
       GROUP BY
           p.user_id
   )
SELECT
   p.email,
   p.phone,
   p.last_name,
   p.first_name,
   sp.study_shortcode,
   pss.profile_has_synced
FROM
   study_participations sp
   JOIN auth.users au ON sp.user_id = au.id
   JOIN profiles p ON au.id = p.user_id
   LEFT JOIN profile_sync_status pss ON p.user_id = pss.user_id
   WHERE pss.profile_has_synced;
