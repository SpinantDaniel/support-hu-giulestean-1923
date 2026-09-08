# Support Hub Giuleștean 1923

Marketplace comunitar independent. Frontend static pe Vercel, backend Supabase.


## v5.15 — Footer mobile centered menu
- centered the footer navigation on mobile viewports
- preserved existing desktop/tablet footer layout
- kept legal/footer copy centered for consistency


## v5.16 — Full Terms of Use and Moderation Policy
- replaced the short placeholder Terms text with the full user-provided 20-section document
- added long-form legal modal formatting and internal scrolling
- preserved the v5.15 centered mobile footer menu


## v5.17 — Politica de Confidențialitate completă
- înlocuit textul scurt de confidențialitate cu politica completă în 15 secțiuni
- tabele responsive în popup-ul juridic
- cache-busting app.js/dynamics.css v5.17


## v5.18 — Safety / Fără Cookies
- added fourth Safety card explaining the current no-analytics/no-marketing-cookie configuration
- desktop Safety grid: 4 columns
- tablet Safety grid: 2×2
- mobile Safety grid: single column


## v5.19 — Safety cards polish
- card 03 (Raportezi rapid) now uses the same dark treatment as card 01
- all Safety card text aligned justify on desktop and mobile
- enhanced hover motion / depth for all Safety cards


## v5.20 — PWA Pull-to-Refresh
- custom pull-to-refresh active only in standalone/Home Screen mode
- browser Safari/Chrome keep their native refresh behavior
- burgundy refresh indicator with armed/reloading/offline states
- horizontal carousels, image editor and open dialogs are excluded from the gesture


## v5.21 — Mesaje + Incognito telefon
- delete/hide conversation per user via X overlay; other participant keeps their copy
- hidden conversations reappear automatically when a new message is sent
- Incognito telefon toggle in profile settings hides both phone and WhatsApp
- contact privacy is enforced by Supabase RLS, not only frontend UI
- cumulative build includes v5.20 standalone pull-to-refresh


## v5.22 — Filtru autori în Noutăți
- dropdown multi-select cu checkbox pentru toți autorii cu articole publicate
- Selectează tot / Deselectează tot în partea de sus
- filtrarea se combină cu căutarea și sortarea existente
- contor de articole per autor și etichetă dinamică Autori: X/Y
- layout responsive, full-width pe mobil


## v5.23 — Admin: ștergere utilizator
- buton `Șterge user` în tabul Utilizatori pentru conturile non-admin
- confirmare explicită prin tastarea `ȘTERGE`
- Edge Function dedicată `admin-delete-user`, JWT protected și admin-only
- propriul cont admin și celelalte conturi admin nu pot fi șterse din panou
- cleanup listing images + avatar + autorizare newsletter editor înainte de ștergerea Auth


## v5.24 — Acceptare juridică obligatorie la creare cont
- checkbox obligatoriu în modul Cont nou
- linkuri directe către Termenii de utilizare și Politica de confidențialitate
- butonul Creează cont rămâne disabled până la bifare
- frontend revalidează acceptarea la submit
- register-user v3 verifică acceptarea server-side
- Supabase profiles stochează timestamp + versiunea 1.0 a documentelor juridice
