# Guide d'intégration - Peptide Plus+

## 🔐 1. AUTHENTIFICATION OAUTH

### Google OAuth
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Créer un projet ou sélectionner un existant
3. Configurer l'écran de consentement OAuth (External)
4. Créer des identifiants → ID client OAuth 2.0
   - Type: Application Web
   - Origines autorisées: `http://localhost:3000` (dev) + votre domaine prod
   - URI de redirection: `http://localhost:3000/api/auth/callback/google`
5. Copier Client ID et Client Secret dans `.env.local`:
```env
GOOGLE_CLIENT_ID="votre-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="votre-client-secret"
```

### Apple Sign In
1. Aller sur [Apple Developer](https://developer.apple.com/account/resources/identifiers/list/serviceId)
2. Créer un App ID (si pas déjà fait)
3. Créer un Services ID:
   - Identifier: `com.peptideplus.signin`
   - Activer "Sign In with Apple"
   - Configurer les domaines/URLs de retour
4. Créer une clé privée pour Sign In with Apple
5. Générer le Client Secret (JWT signé):
```env
APPLE_CLIENT_ID="com.peptideplus.signin"
APPLE_CLIENT_SECRET="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### Facebook Login
1. Aller sur [Facebook Developers](https://developers.facebook.com/apps)
2. Créer une application → Type: Consumer
3. Ajouter le produit "Facebook Login"
4. Paramètres → Basique → copier App ID et App Secret
5. Facebook Login → Paramètres:
   - URI de redirection OAuth: `https://votre-domaine.com/api/auth/callback/facebook`
```env
FACEBOOK_CLIENT_ID="votre-app-id"
FACEBOOK_CLIENT_SECRET="votre-app-secret"
```

### X (Twitter) OAuth 2.0
1. Aller sur [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Créer un projet et une application
3. Activer OAuth 2.0 dans les paramètres de l'app
   - Type: Web App
   - Callback URL: `http://localhost:3000/api/auth/callback/twitter`
4. Keys and tokens → OAuth 2.0 Client ID and Client Secret
```env
TWITTER_CLIENT_ID="votre-client-id"
TWITTER_CLIENT_SECRET="votre-client-secret"
```

---

## 💳 2. PAIEMENTS STRIPE (Carte + Apple Pay + Google Pay)

### Configuration Stripe
1. Créer un compte sur [Stripe Dashboard](https://dashboard.stripe.com)
2. Obtenir les clés API (mode test d'abord):
   - Dashboard → Developers → API keys
```env
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

### Apple Pay via Stripe
1. Dashboard Stripe → Settings → Payment methods → Apple Pay
2. Vérifier votre domaine:
   - Télécharger le fichier de vérification Apple
   - Le placer dans `public/.well-known/apple-developer-merchantid-domain-association`
3. Activer Apple Pay dans les paramètres Stripe

### Google Pay via Stripe
1. Dashboard Stripe → Settings → Payment methods → Google Pay
2. Activer Google Pay (automatique avec Stripe)
3. Pour la production, soumettre votre intégration à Google

### Webhook Stripe
1. Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://votre-domaine.com/api/payments/webhook`
3. Events à écouter:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copier le Signing secret:
```env
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## 🅿️ 3. PAYPAL

### Configuration PayPal
1. Créer un compte sur [PayPal Developer](https://developer.paypal.com)
2. Dashboard → Apps & Credentials → Create App
3. Copier Client ID et Secret:
```env
PAYPAL_CLIENT_ID="votre-client-id"
PAYPAL_CLIENT_SECRET="votre-client-secret"
PAYPAL_MODE="sandbox"  # ou "live" pour production
```

---

## 🛒 4. SHOP PAY (Shopify)

### Configuration Shopify
1. Créer un compte partenaire sur [Shopify Partners](https://partners.shopify.com)
2. Créer une application → Custom app
3. Configurer les permissions:
   - `read_customers`
   - `write_customers`
   - `read_orders`
4. Obtenir les identifiants API:
```env
SHOPIFY_CLIENT_ID="votre-client-id"
SHOPIFY_CLIENT_SECRET="votre-client-secret"
SHOPIFY_STORE_DOMAIN="votre-boutique.myshopify.com"
```

---

## 📋 CHECKLIST DE DÉPLOIEMENT

### Développement (localhost)
- [ ] PostgreSQL Docker démarré (`docker-compose up -d`)
- [ ] `.env.local` configuré avec au moins Google OAuth
- [ ] Stripe en mode test
- [ ] `npm run dev`

### Production
- [ ] Tous les OAuth providers configurés avec URLs de production
- [ ] Stripe en mode live avec domaine vérifié
- [ ] PayPal en mode live
- [ ] SSL/HTTPS obligatoire
- [ ] NEXTAUTH_SECRET généré avec `openssl rand -base64 32`
- [ ] Variables d'environnement configurées sur l'hébergeur

---

## 🔧 COMMANDES UTILES

```bash
# Démarrer la base de données locale
docker-compose up -d postgres

# Générer le client Prisma
npm run db:generate

# Appliquer les migrations
npm run db:migrate

# Voir la base de données
npm run db:studio

# Tester les webhooks Stripe localement
npm run stripe:webhook

# Démarrer le serveur de développement
npm run dev
```

---

## 📞 SUPPORT

Pour toute question sur l'intégration:
- Documentation Stripe: https://stripe.com/docs
- Documentation NextAuth: https://next-auth.js.org
- Documentation PayPal: https://developer.paypal.com/docs
