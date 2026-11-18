# Meridian — Dashboard Crypto Multi-Chain & Analyse Quantitative

**Meridian** est un terminal de suivi de portefeuille Web3 **100 % gratuit**, **lecture seule** (aucune clé privée requise) et **sans données simulées**, conçu pour suivre vos adresses **Base (EVM)**, **Robinhood Chain (EVM)** et **Solana** avec une architecture modulaire prête pour Ethereum, Arbitrum et Sui.

---

## Sommaire

1. [Fonctionnalités principales](#1-fonctionnalités-principales)
2. [Variables d'environnement gratuites & Liens officiels](#2-variables-denvironnement-gratuites--liens-officiels)
3. [Installation en local](#3-installation-en-local)
4. [Déploiement gratuit sur Vercel](#4-déploiement-gratuit-sur-vercel)
5. [Architecture & Extensibilité (`services/`)](#5-architecture--extensibilité-services)
6. [Sécurité & Confidentialité](#6-sécurité--confidentialité)

---

## 1. Fonctionnalités principales

- **Portefeuille Multi-Chain (Lecture seule)** :
  - Suivi simultané de plusieurs adresses publiques **Base (`0x...`)**, **Robinhood Chain (`0x...`)** et **Solana**.
  - Filtrage automatique du dust (`< 0,01 $`) et des soldes nuls, historique local dans **IndexedDB**, préférences en **LocalStorage**.
  - Mode sombre par défaut avec bascule vers le mode clair.
- **PnL & Prix Moyen d'Achat (`src/services/pnl/`)** :
  - Saisie manuelle du PMA ou import automatique depuis l'historique on-chain (BaseScan / Alchemy Robinhood / Helius).
  - Calcul en temps réel du PnL ($), ROI (%), PnL journalier, hebdomadaire et mensuel.
- **Métriques On-Chain & Analyse Technique (`src/services/onchain/`, `src/utils/indicators.ts`)** :
  - Données temps réel **DexScreener** & **GeckoTerminal** (liquidité, volume 24h, FDV, pression acheteuse/vendeuse, âge de pool).
  - Graphiques chandeliers **TradingView `lightweight-charts`** + indicateurs mathématiques purs côté client : **RSI (14)**, **MACD (12, 26, 9)**, **EMA 20 / 50 / 200**, **SMA 20**, **Bandes de Bollinger**, **ATR (14)** et **Supports / Résistances**.
- **Pouls Communautaire & Actualités sans clé (`src/services/social/`)** :
  - Agrégation serveur 100 % gratuite et sans clé : **CryptoCompare Public News**, flux **RSS** (CoinDesk, CoinTelegraph, Decrypt), **Reddit Public JSON**, **CoinGecko Free API** et **DexScreener**.
- **Moteur d'Analyse IA Quantitative (`server/analyzeRoute.ts`)** :
  - Synthèse structurée en JSON strict via **Groq (`llama-3.3-70b-versatile`)** ou **Google Gemini (`gemini-2.5-flash`)** : décision (`CONSERVER`, `RENFORCER`, `VENDRE`, `PRENDRE PROFITS`, `ATTENDRE`, `ÉVITER`), scores sur 100, niveaux cibles / TP / SL / zone d'achat / danger, et historique local des décisions.
- **Alertes Intelligentes, Favoris, Notes & Exports (`src/services/alerts/`, `src/services/notes/`, `src/services/export/`)** :
  - Alertes locales avec notifications navigateur (`Notification` API) + bannière in-app : **Prix cible**, **Take Profit**, **Stop Loss**, **Seuil RSI (< 30 / > 70)**, **Variation brutale de volume** et **Chute de liquidité (alerte Rug Pull)**.
  - Favoris, tags personnalisés, notes privées locales par token, et export **CSV / JSON** de l'historique des décisions IA et du journal PMA / trades.

---

## 2. Variables d'environnement gratuites & Liens officiels

Aucune clé payante n'est requise. Copiez `.env.example` vers `.env` et renseignez les clés gratuites souhaitées :

| Variable | Service & Usage | Tier Gratuit | Lien officiel pour obtenir la clé gratuitement |
| :--- | :--- | :--- | :--- |
| `GROQ_API_KEY` | **Groq Cloud** (`llama-3.3-70b-versatile`) — Moteur IA quantitatif ultra-rapide | Tier gratuit généreux (sans carte bancaire) | https://console.groq.com/keys |
| `GEMINI_API_KEY` | **Google AI Studio** (`gemini-2.5-flash`) — Moteur IA quantitatif (alternatif / fallback) | Tier gratuit inclus via Google AI Studio | https://aistudio.google.com/apikey |
| `HELIUS_API_KEY` | **Helius** (Solana) — Découverte complète des tokens SPL / Token-2022 et historique de swaps *(également lisible via `NEXT_PUBLIC_HELIUS_API_KEY`)* | 1 000 000 crédits/mois gratuits | https://www.helius.dev/ |
| `ALCHEMY_API_KEY` | **Alchemy** (Base EVM) — Découverte étendue des tokens ERC-20 *(également lisible via `NEXT_PUBLIC_ALCHEMY_API_KEY`)* | 300M Compute Units/mois gratuits | https://www.alchemy.com/ |
| `ROBINHOOD_ALCHEMY_API_KEY` | **Alchemy** (Robinhood Chain) — Soldes natifs ETH, ERC-20 et historique des transferts via `/api/chains/robinhood/*` *(optionnel au démarrage ; également lisible via `NEXT_PUBLIC_ROBINHOOD_ALCHEMY_API_KEY`)* | 300M Compute Units/mois gratuits | https://www.alchemy.com/ |

> **Note** : Si `ALCHEMY_API_KEY` ou `HELIUS_API_KEY` sont absentes, Meridian utilise automatiquement les RPC publics (`https://mainnet.base.org` et `https://api.mainnet-beta.solana.com`). Si `ROBINHOOD_ALCHEMY_API_KEY` n'est pas encore renseignée, l'application démarre normalement sans erreur et affiche un indicateur discret invitant à configurer la clé Robinhood Alchemy.

---

## 3. Installation en local

### Prérequis
- **Node.js ≥ 20** et **npm ≥ 10**

### Étapes
1. **Installer les dépendances** :
   ```bash
   npm install
   ```
2. **Configurer les variables d'environnement** :
   ```bash
   cp .env.example .env
   ```
   Éditez `.env` et ajoutez au moins `GROQ_API_KEY` ou `GEMINI_API_KEY` (et optionnellement `ALCHEMY_API_KEY` / `HELIUS_API_KEY`).
3. **Lancer le serveur de développement (Express + Vite sur le port 3000)** :
   ```bash
   npm run dev
   ```
   Ouvrez ensuite [http://localhost:3000](http://localhost:3000).
4. **Vérifier les types TypeScript et le build de production** :
   ```bash
   npm run lint
   npm run build
   ```

---

## 4. Déploiement gratuit sur Vercel

Meridian est composé d'un frontend React/Vite (`dist/`) et de routes API Express (`/api/config/status`, `/api/chains/*`, `/api/prices/*`, `/api/news`, `/api/social/token-pulse`, `/api/analyze`) définies dans `server.ts`.

### Option A — Déploiement Vercel (Frontend statique + Serverless Functions)
1. **Créer un compte Vercel gratuit** sur [https://vercel.com](https://vercel.com) et importer votre dépôt Git.
2. **Exporter l'application Express vers Vercel Functions** (si vous ne déployez pas sur un runtime Node persistant) :
   - Exposez les routes `/api/*` de `server.ts` via un point d'entrée `api/index.ts` compatible Vercel (`export default app;`), ou configurez `vercel.json` avec des `rewrites` vers `api/index.ts`.
   - Build Command : `npm run build`
   - Output Directory : `dist`
3. **Ajouter vos variables d'environnement** dans **Vercel Dashboard → Project Settings → Environment Variables** :
   - `GROQ_API_KEY`
   - `GEMINI_API_KEY`
   - `ALCHEMY_API_KEY`
   - `ROBINHOOD_ALCHEMY_API_KEY`
   - `HELIUS_API_KEY`
   *(Aucune clé privée ou secret client n'est jamais exposé au navigateur : toutes les clés IA et RPC sensibles sont consommées côté serveur via `/api/*`, y compris `/api/chains/robinhood/balances` et `/api/chains/robinhood/transactions`.)*
4. **Déployer** : cliquez sur **Deploy** (ou poussez sur `main`). Chaque déploiement obtient une URL HTTPS gratuite (nécessaire pour les notifications navigateur `Notification` API).

### Option B — Hébergement Node.js classique (Cloud Run, Railway, Render Free)
Exécutez simplement :
```bash
npm run build
npm run start
```
(`server.ts` sert automatiquement les fichiers statiques compilés dans `dist/` en production lorsque `NODE_ENV=production`.)

---

## 5. Architecture & Extensibilité (`services/`)

### Structure clé du projet
```text
├── server.ts                        # Serveur Express (API proxy RPC, prix, news, social, IA)
├── server/
│   └── analyzeRoute.ts              # Moteur quantitatif IA (Groq / Gemini JSON strict)
└── src/
    ├── app/                         # Pages (DashboardPage, TokenDetailPage, AlertsPage, WalletsPage, ChainsPage, SettingsPage)
    ├── components/                  # Composants UI (TokenPriceChart, TokenPnlPanel, CommunityPulsePanel, AiQuantPanel, TokenAlertsAndNotesPanel…)
    ├── services/
    │   ├── alerts/                  # Stockage LocalStorage & évaluateur Prix / RSI / Volume / Rug Pull
    │   ├── chains/                  # Adaptateurs blockchains modulaires (baseAdapter.ts, robinhoodAdapter.ts, solanaAdapter.ts, registry.ts)
    │   ├── export/                  # Export CSV (BOM UTF-8) & JSON (décisions IA + trades/PMA)
    │   ├── notes/                   # Favoris, tags personnalisés & notes privées (LocalStorage)
    │   ├── onchain/                 # DexScreener & GeckoTerminal (métriques pool + bougies OHLCV)
    │   ├── pnl/                     # Import coût d'acquisition & moteur de calcul PnL/ROI
    │   ├── portfolio/               # Agrégateur multi-chain + filtrage dust
    │   └── social/                  # Client du Pouls Communautaire & actualités
    ├── types/                       # Contrats TypeScript stricts
    └── utils/                       # Indicateurs techniques purs (indicators.ts), stockage IndexedDB/LS, validateurs
```

### Ajouter une nouvelle blockchain (ex. Ethereum, Arbitrum, Sui)
1. **Déclarer la chaîne** dans `src/types/chain.ts` en ajoutant son identifiant dans `ActiveChainId` (actuellement `'base' | 'solana' | 'robinhood'`).
2. **Créer un adaptateur** dans `src/services/chains/<chain>Adapter.ts` implémentant l'interface `ChainAdapter` (`meta`, `validateAddress`, `fetchBalances`).
3. **Ajouter la route proxy serveur** correspondante dans `server.ts` (ex. `GET /api/chains/arbitrum/balances`) pour protéger toute éventuelle clé RPC.
4. **Enregistrer l'adaptateur** dans `ACTIVE_ADAPTERS` et `ALL_CHAINS` dans `src/services/chains/registry.ts` (les métadonnées pour `ethereum`, `arbitrum` et `sui` y sont déjà pré-configurées dans `PLANNED_CHAINS`).

### Ajouter une nouvelle API ou source de données dans `src/services/`
1. **Proxy serveur si CORS ou clé API** : ajoutez un endpoint `/api/<domaine>` dans `server.ts` avec mise en cache en mémoire (`Map` avec TTL) afin de respecter les rate-limits des tiers gratuits.
2. **Service client typé** : créez un module dans `src/services/<domaine>/<nom>Service.ts` appelant `/api/<domaine>` (ou l'API publique CORS-friendly telle que DexScreener/GeckoTerminal) et retournant un type strict défini dans `src/types/`.
3. **Intégration UI** : consommez le service depuis `TokenDetailPage.tsx` ou `DashboardPage.tsx` en gérant explicitement l'état de chargement, l'erreur réseau et l'absence de données sans jamais recourir à des mocks.

---

## 6. Sécurité & Confidentialité

- **Lecture seule stricte** : Meridian n'accepte et ne stocke jamais de clé privée ni de phrase mnémonique. Seules des adresses publiques (`0x...` ou Base58 Solana) sont validées.
- **Clés API isolées côté serveur** : `GROQ_API_KEY`, `GEMINI_API_KEY`, `ALCHEMY_API_KEY`, `ROBINHOOD_ALCHEMY_API_KEY` et `HELIUS_API_KEY` restent dans l'environnement Node.js ; `/api/config/status` ne renvoie au client que des drapeaux booléens (`true`/`false`).
- **Données personnelles locales** : vos adresses suivies, prix moyens d'achat, alertes, tags, notes privées et historique IA sont stockés exclusivement dans le **LocalStorage** et l'**IndexedDB** de votre navigateur.
