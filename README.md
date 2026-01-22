# 🔒 Secure Web Template

Template de site transactionnel sécurisé conforme aux normes **Chubb Assurance**.

## 🚀 Créer un nouveau projet

### Méthode 1: Script "nouveau"

```bash
cd /Volumes/AI_Project/AttitudesVIP-iOS
./nouveau
```

### Méthode 2: Commande directe

```bash
/Volumes/AI_Project/AttitudesVIP-iOS/templates/secure-web-template/scripts/create-project.sh
```

### Méthode 3: Alias permanent

Ajoutez à votre `~/.zshrc` ou `~/.bashrc`:

```bash
alias nouveau='/Volumes/AI_Project/AttitudesVIP-iOS/nouveau'
```

Puis rechargez:

```bash
source ~/.zshrc
```

Maintenant tapez simplement **`nouveau`** de n'importe où!

---

## 📋 Ce que le script fait

1. **Demande le nom du site** (devient le nom du répertoire)
2. **Demande les informations** (URL, email, type de projet)
3. **Copie le template** dans un nouveau répertoire
4. **Configure automatiquement**:
   - `.env.local` avec clés générées
   - `package.json` avec le bon nom
   - `site.ts` avec les infos du site
5. **Initialise Git** avec un premier commit

---

## 🔐 Sécurité incluse

| Fonctionnalité | Status |
|----------------|--------|
| MFA obligatoire (TOTP) | ✅ |
| Chiffrement AES-256-GCM | ✅ |
| Protection brute force | ✅ |
| Session timeout 15 min | ✅ |
| Headers OWASP complets | ✅ |
| Azure Key Vault | ✅ |
| Audit logs | ✅ |
| RBAC 5 rôles | ✅ |

---

## 📁 Structure du projet

```
nouveau-projet/
├── prisma/
│   └── schema.prisma      # Modèles de données
├── src/
│   ├── app/               # Pages Next.js (App Router)
│   │   ├── (public)/      # Pages publiques
│   │   ├── admin/         # Administration
│   │   ├── dashboard/     # Dashboards par rôle
│   │   ├── api/           # API Routes
│   │   └── auth/          # Authentification
│   ├── components/        # Composants réutilisables
│   ├── config/            # Configuration
│   ├── lib/               # Utilitaires
│   │   ├── auth-config.ts # NextAuth + MFA
│   │   ├── security.ts    # Chiffrement, validation
│   │   ├── mfa.ts         # TOTP + backup codes
│   │   └── ...
│   ├── i18n/              # Internationalisation
│   └── types/             # Types TypeScript
├── docs/                  # Documentation
├── .env.local             # Variables (généré)
└── next.config.js         # Config Next.js + sécurité
```

---

## ⚙️ Configuration après création

### 1. Installer les dépendances

```bash
cd votre-projet
npm install
```

### 2. Configurer `.env.local`

Éditez le fichier et ajoutez vos clés API:
- OAuth providers (Google, Apple, etc.)
- Stripe / PayPal
- Azure Key Vault (production)

### 3. Initialiser la base de données

```bash
npx prisma generate
npx prisma db push
```

### 4. Lancer le développement

```bash
npm run dev
```

---

## 📚 Documentation

- [Exigences Sécurité Chubb](./docs/CHUBB_SECURITY_REQUIREMENTS.md)
- [Audit de Conformité](./SECURITY_AUDIT_CHUBB.md)
- [Architecture](./docs/ARCHITECTURE.md)

---

## 🔒 Conformité

Ce template est conforme aux normes:
- **NYDFS 23 NYCRR 500**
- **OWASP Top 10 (2024)**
- **PCI DSS v4.0** (via Stripe)
- **PIPEDA / GDPR**
- **SOC 2 Type II** (ready)

---

*Template créé le 21 janvier 2026*
