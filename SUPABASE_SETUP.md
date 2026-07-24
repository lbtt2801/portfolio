# Supabase + Vercel Setup

This portfolio can run as a static Vercel site while editing content online
through Supabase Auth + Postgres.

## 1. Create Supabase Project

Create a free Supabase project, then open **SQL Editor** and run:

```sql
-- paste the contents of supabase/schema.sql here
```

After creating your Auth user, add your email to the admin allowlist:

```sql
insert into public.admins (email)
values ('your-email@example.com');
```

## 2. Create Admin User

In Supabase dashboard:

- Go to **Authentication**.
- Create a user with email and password.
- Use the same email inserted into `admins`.

Only emails in `admins` can insert/update/delete content.
Public visitors can only read published content.

## 3. Database Structure

The schema has two layers.

`content` stores page-level translation keys used by the current
frontend and by `admin.html`.

Structured CV/project tables:

- `profile`
- `profile_translations`
- `skill_categories`
- `skill_category_translations`
- `skills`
- `experiences`
- `experience_translations`
- `experience_bullets`
- `projects`
- `project_translations`
- `project_responsibilities`
- `project_modules`
- `technologies`
- `project_technologies`
- `project_links`

The SQL also seeds initial data from the CV and creates:

- `project_cards` view
- `get_projects(locale)` RPC function

You can query structured projects through Supabase RPC:

```http
POST /rest/v1/rpc/get_projects
```

Body:

```json
{ "requested_locale": "vi" }
```

## 4. Configure Frontend

Open `config.js` and update:

```js
window.PORTFOLIO_CONFIG = {
  useSupabaseContent: true,
  supabaseUrl: "https://your-project.supabase.co",
  supabaseAnonKey: "your-anon-key",
  contentTable: "content"
};
```

The anon key is public by design. Row Level Security protects write access.

## 5. Edit Content Online

Deploy to Vercel, then open:

```text
https://your-domain.vercel.app/admin.html
```

Sign in, choose locale/page, edit fields, and save.

## 6. Fallback Behavior

The public pages always load local JSON first:

- `api/content.en.json`
- `api/content.vi.json`

If Supabase is configured and has saved content, database values override the
local fallback. If Supabase is unavailable, the site still works.
