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
insert into public.portfolio_admins (email)
values ('your-email@example.com');
```

## 2. Create Admin User

In Supabase dashboard:

- Go to **Authentication**.
- Create a user with email and password.
- Use the same email inserted into `portfolio_admins`.

Only emails in `portfolio_admins` can insert/update/delete content.
Public visitors can only read published content.

## 3. Configure Frontend

Open `config.js` and update:

```js
window.PORTFOLIO_CONFIG = {
  useSupabaseContent: true,
  supabaseUrl: "https://your-project.supabase.co",
  supabaseAnonKey: "your-anon-key",
  contentTable: "portfolio_content"
};
```

The anon key is public by design. Row Level Security protects write access.

## 4. Edit Content Online

Deploy to Vercel, then open:

```text
https://your-domain.vercel.app/admin.html
```

Sign in, choose locale/page, edit fields, and save.

## 5. Fallback Behavior

The public pages always load local JSON first:

- `api/content.en.json`
- `api/content.vi.json`

If Supabase is configured and has saved content, database values override the
local fallback. If Supabase is unavailable, the site still works.
