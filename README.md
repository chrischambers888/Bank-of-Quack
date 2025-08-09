# Bank of Quack — two-person finance tracker

A lightweight money tracker for couples built with **React + Vite** on a **Supabase** backend and styled with **shadcn/ui**.  
Track shared expenses, reimbursements and income, see live balances, and keep everything fair-and-square.

---

## ✨ Features

|                          |                                                                                |
| ------------------------ | ------------------------------------------------------------------------------ |
| **Secure auth**          | Supabase email + password (RLS everywhere)                                     |
| **Dashboard**            | Live balances, pie & bar spending charts                                       |
| **Transactions**         | Add / edit expenses, income, settlements, reimbursements; flexible split logic |
| **Categories & Sectors** | Nest categories under sectors for tidy reports                                 |
| **CSV import / export**  | Own your data                                                                  |
| **User avatars & names** | Personalise each half of the household                                         |
| **Responsive UI**        | Works great on phone, tablet, desktop                                          |

---

## 🛠 Tech stack

- **Frontend** – React 18, Vite, shadcn/ui (Radix UI + Tailwind), Recharts, React-Table v8, React-Hook-Form + Zod, Lucide icons
- **Backend** – Supabase (Postgres + Auth + Storage) with **declarative SQL migrations**
- **TypeScript** everywhere

---

## 🚀 Deployment

**Before you start:**

1. **Create a GitHub account** (if you don't have one already).
2. **Sign up for Vercel** and **Supabase** using your GitHub account.
3. **Create a new Supabase project** in your Supabase dashboard.
4. In your Supabase project, go to **Settings → Data API** and copy:
   - `Project URL` (for `VITE_SUPABASE_URL`)
   - `Then in the left section go to "API Keys" and find:`
   - --> `anon/public API key` (for `VITE_SUPABASE_ANON_KEY`)
5. **Fork this repo** to your own GitHub account (click the Fork button at the top right).

> The Deploy button will prompt you for your Supabase project URL and anon/public key.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new>)

6. Click the **Deploy with Vercel** button above.
7. Choose "Bank of Quack"
8. Before deploying **\*you must**, enter your Supabase project URL and anon/public key (from step 4) in the "Enviornment Settings" section.

## ⚙️ Automated database migrations (GitHub Actions)

Set this up once so your database schema is applied automatically on first deploy and on every push that adds new migrations.

1. Enable Actions on your repository

- Go to your GitHub repo → "Actions" tab → enable workflows for this repository if prompted.

2. Add repository secrets (Settings → Secrets and variables → Actions → New repository secret)

- SUPABASE_ACCESS_TOKEN: In Supabase, click your avatar → "Access Tokens" → "New token". Copy the token value.
- SUPABASE_PROJECT_ID: Your project reference ID. In Supabase → Project → "Settings" → "General" → copy the "Reference ID" (looks like `abcdefghijklmno`).
- SUPABASE_DB_PASSWORD: Your database password. In Supabase → "Settings" → "Database" → find or set the password for the default `postgres` user, then copy it.

3. The workflow file `.github/workflows/deploy-supabase.yml` is already included in this repo.

4. Run it the first time

- After your first Vercel deploy finishes, go to the "Actions" tab → select "Apply Supabase migrations" → "Run workflow". This applies the initial schema from `supabase/migrations/**` to your project.

From now on, any push to `main` that changes files under `supabase/migrations/` will automatically apply those migrations to your Supabase database.

### 👤 Create your first user and log in

After the migration workflow completes successfully, create your first user account in Supabase so you can log in to the app.

1. **Go to your Supabase dashboard.**
2. In the left sidebar, click **Auth**.
3. Click **Users**.
4. Click **Add User**.
5. Enter an email and password for your first user (this will be your login for the app).
6. Click **Create User**.

Now, go to your deployed app URL and log in with the email and password you just created. You're ready to go!

---

## 🔄 Keeping your copy up-to-date

### Easiest: GitHub's **Sync fork** button

Open your repo on GitHub → click **Sync fork → Update branch**.  
Vercel sees the push and deploys the new version automatically.

### IMPORTANT: database stays up-to-date automatically

The GitHub Actions workflow applies any new SQL files in `supabase/migrations/**` to your Supabase project on every push to `main` (and you can run it manually anytime from the Actions tab).

## 📝 Customisation pointers

- **Rename users / upload avatars** – Settings → _Profile_
- **Add categories & sectors** – Settings → _Categories_
- **Change split defaults or add more reports** – edit the React components in `src/features/**`

---

## 📸 Screenshots

_(drop some dashboard / mobile screenshots here)_

---

## License

MIT © _you_
