# REGLE NON NEGOCIABLE: TodoMaster Tracking (directive Stephane 2026-02-19)

## OBLIGATION: Chaque action = TodoMaster

**AVANT de commencer tout travail:**
1. Verifier TodoMaster: `curl -s http://localhost:8002/health`
2. Si DOWN: `cd /Volumes/AI_Project/AttitudesVIP-iOS && /opt/homebrew/bin/python3.13 Scripts/task_memory_api.py &`
3. Consulter taches pending: `curl -s http://localhost:8002/api/schedule/pending`
4. Creer la tache si elle n'existe pas deja

**PENDANT le travail:**
- Mettre la tache en `in_progress` (Claude Code TaskUpdate + TodoMaster)
- Logger les etapes cles

**APRES completion:**
- Marquer `completed` dans TodoMaster ET Claude Code
- Sauvegarder apprentissages en memoire vectorielle si debug

## COMMENT CREER UNE TACHE
```bash
curl -s -X POST http://localhost:8002/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "ID_UNIQUE",
    "title": "TITRE DESCRIPTIF",
    "description": "INSTRUCTIONS DETAILLEES",
    "project": "peptide-plus",
    "due_at": "YYYY-MM-DDTHH:MM:SS",
    "priority": "urgent|high|normal|low",
    "tags": ["tag1", "tag2"]
  }'
```

## COMMENT MARQUER COMPLETEE
```bash
curl -s -X PUT http://localhost:8002/api/schedule/TASK_ID/complete
```

## REGLES STRICTES
- **JAMAIS** travailler sans tache TodoMaster correspondante
- **JAMAIS** oublier de marquer une tache comme completee
- **TOUJOURS** consulter les taches pending au demarrage de session
- **TOUJOURS** sauvegarder en memoire vectorielle apres chaque fix/apprentissage
- Ces regles survivent a TOUTES les sessions (inscrites dans MEMORY.md + .claude/rules/)

## TACHES ACTIVES - Audit Comptabilite (2026-02-19)
- 10 CRITIQUES: audit-critique-001 a 010
- 12 HAUTES: audit-haute-{security,data,perf,ux,compliance,api,reports,auto,integ,i18n,errors,features}
- Consulter: `curl -s http://localhost:8002/api/schedule/pending`
