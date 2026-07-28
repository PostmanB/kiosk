# React Taiwind Router Template · React + TypeScript + Vite

This repository is a ready-to-go playground for new React projects. It ships with:

- Vite + TypeScript + React 19 for a fast development loop
- Tailwind CSS (class-based dark mode enabled) for styling
- React Router already wired in via `src/routes/AppRoutes.tsx`
- A responsive layout with a navbar, drawer menu, and persistent theme toggle

Clone it, rename it, and start building without recreating the same setup each time.

## Project structure

```
src/
├─ components/
│  ├─ Navbar.tsx          # Responsive header + mobile drawer
│  └─ ui/
│     └─ ThemeToggle.tsx  # Reusable class-based dark/light toggle
├─ pages/
│  ├─ Home.tsx            # Starter welcome screen for new devs
│  └─ Test.tsx            # Placeholder view (used for Docs/Components/Support routes)
├─ routes/
│  └─ AppRoutes.tsx       # Central place for your route definitions
├─ App.tsx                # Layout shell + routed content
└─ main.tsx               # Entrypoint (BrowserRouter + StrictMode)
```

Feel free to reorganise as your project grows (for example, splitting layout, feature, and shared UI folders). The current setup is intentionally lean so you can reshape it quickly.

## Getting started

1. Install dependencies (Node 18+ recommended):
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
   Vite prints a local URL you can open in the browser. Edit files under `src/` and enjoy instant HMR.
3. Build for production:
   ```bash
   npm run build
   ```
4. Preview the production build (optional):
   ```bash
   npm run preview
   ```

## Available scripts

- `npm run dev` – launch the Vite dev server
- `npm run build` – type-check and produce a production build
- `npm run preview` – serve the build output locally
- `npm run lint` – run the configured ESLint rules

## Customising the kit

- **Branding:** Update `Navbar.tsx` and `Home.tsx` with your project voice, replace the logo text, and swap CTA routes.
- **Routing:** Edit `src/routes/AppRoutes.tsx` to add new pages or nested layouts; create matching files in `src/pages/` or feature folders.
- **Styling:** Tailwind is imported in `src/style.css`. Adjust or extend the `tailwind.config.ts` as needed.
- **Theming:** `ThemeToggle` manages dark mode via the `dark` class on `<html>` and persists the preference in `localStorage`. Reuse it wherever you need theme control.

## Next steps for a new dev

1. Replace the placeholder copy with your product messaging.
2. Add real page components in `src/pages/` (or prefer feature folders).
3. Introduce state management, API clients, or testing frameworks as required.
4. Consider hooking the project into your CI/CD pipeline to automate builds and linting.

## Database environments (dev vs prod)

Keep production Supabase keys in `.env` (your current setup), and put development Supabase keys in `.env.development`.

- `npm run dev` -> uses `.env.development` (dev database)
- `npm run start` -> uses production mode with `.env` (real database)

Setup:
1. Create a second Supabase project for development.
2. Copy the same schema/policies from prod to dev.
3. Fill `.env.development` with the dev project keys.

Happy hacking! This kit exists so you can skip the boilerplate and focus on shipping features.
