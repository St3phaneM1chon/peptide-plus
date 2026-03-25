# Audit: xp-service.ts — 12 Findings

## awardXp() (line 27-68)

### P1: Race condition sur le calcul du balance — line 38-45
**Description**: Deux appels simultanes a awardXp() pour le meme user lisent le meme `lastTransaction.balance`, puis les deux ecrivent `currentBalance + amount`. Le deuxieme ecrase le premier → perte de XP.
**Code**:
```typescript
const lastTransaction = await prisma.lmsXpTransaction.findFirst({...});
const currentBalance = lastTransaction?.balance ?? 0;
const newBalance = currentBalance + amount;
await prisma.lmsXpTransaction.create({data: {..., balance: newBalance}});
```
**Fix**: Utiliser `$transaction` avec isolation serializable, ou utiliser un compteur atomique:
```typescript
const result = await prisma.$transaction(async (tx) => {
  const last = await tx.lmsXpTransaction.findFirst({
    where: { tenantId, userId }, orderBy: { createdAt: 'desc' }, select: { balance: true }
  });
  const newBalance = (last?.balance ?? 0) + amount;
  await tx.lmsXpTransaction.create({ data: { tenantId, userId, amount, reason, sourceId: sourceId ?? null, balance: newBalance } });
  return newBalance;
});
```

### P2: Pas de deduplication — line 47
**Description**: Si awardXp est appele 2x pour le meme evenement (ex: webhook retry), l'XP est double.
**Fix**: Ajouter un check d'unicite `sourceId` avant de creer la transaction:
```typescript
if (sourceId) {
  const existing = await prisma.lmsXpTransaction.findFirst({ where: { tenantId, userId, sourceId } });
  if (existing) return { amount: 0, newBalance: existing.balance };
}
```

### P2: leaderboard.updateMany silencieux — line 59-62
**Description**: Si le user n'a pas d'entree leaderboard, updateMany ne fait rien (0 rows affected) sans erreur. Le leaderboard est desyncronise.
**Fix**: Utiliser upsert au lieu de updateMany.

### P3: XP_VALUES hardcode — line 15-21
**Description**: Les valeurs XP sont hardcodees. Pas configurable par tenant.
**Fix**: Charger depuis SiteSetting ou un modele LmsXpConfig par tenant.

## getXpSummary() (line 73-103)

### P2: 3 queries paralleles sans transaction — line 74-90
**Description**: Balance, transactions et total sont lus en parallele. Si un awardXp() arrive entre les reads, les donnees sont inconsistantes (balance != totalEarned).
**Fix**: Wrapper dans $transaction pour snapshot consistency.

### P3: Level 1 quand balance = 0 — line 93
**Description**: `Math.floor(0/500) + 1 = 1`. Un user sans XP est au niveau 1. Devrait etre 0.
**Fix**: `const level = balance > 0 ? Math.floor(balance / 500) + 1 : 0;`

## updateChallengeProgress() (line 108-158)

### P1: N+1 — loop fait des updates individuelles — line 129-136
**Description**: Pour chaque challenge participant (potentiellement 10+), on fait un UPDATE individuel. Si l'user participe a 5 challenges, c'est 5 queries en boucle.
**Fix**: Collecter les updates et utiliser $transaction batch.

### P1: Recursive awardXp() → infinite loop risk — line 140
**Description**: `awardXp()` appelle `updateChallengeProgress()` qui appelle `awardXp()`. Si un challenge a comme critere "challenge" complete, c'est une boucle infinie.
**Fix**: Ajouter un guard `if (reason === 'challenge') return;` au debut de updateChallengeProgress.

### P2: criteria casting unsafe — line 123
**Description**: `participant.challenge.criteria as { action?: string; count?: number } | null` — le JSON pourrait avoir n'importe quelle structure. Si `criteria.count` est une string, la comparaison echoue silencieusement.
**Fix**: Valider avec Zod avant de caster.

### P2: completedAt set a null quand pas complete — line 134
**Description**: `completedAt: isCompleted ? now : null` — si le participant avait un completedAt d'une tentative precedente, il est ecrase par null.
**Fix**: Ne pas toucher completedAt si pas complete: `...(isCompleted ? { completedAt: now } : {})`

### P3: notification.catch(() => {}) — line 156
**Description**: Erreur de notification avalee silencieusement. Au minimum logger.
**Fix**: `.catch((e) => logger.warn('[XP] Notification failed', { userId, error: e.message }))`

### P3: Pas de pagination sur les challenges — line 112-120
**Description**: findMany sans limit pourrait retourner des centaines de participants si l'user est inscrit a beaucoup de challenges.
**Fix**: Ajouter `take: 20`.
