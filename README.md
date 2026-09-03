# Match Probability AI

Backend indipendente da MyMachE per analisi e simulazione di partite di calcio.

Stack: Cloudflare Workers + D1 + TypeScript.

API:
- GET /api/health
- GET /api/leagues
- GET /api/teams?league=Serie%20A
- POST /api/predict
- POST /api/simulate

Il motore usa medie statistiche storiche e distribuzione di Poisson per le stime; le simulazioni sono probabilistiche e non garantiscono risultati.