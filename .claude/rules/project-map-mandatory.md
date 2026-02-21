# REGLE NON NEGOCIABLE: Mise a jour PROJECT_MAP.md

## OBLIGATION: Chaque modification = mise a jour du PROJECT_MAP.md

### QUAND mettre a jour (declencheurs obligatoires):

1. **Nouveau fichier page/API/component/hook/lib** cree → ajouter dans la section correspondante
2. **Suppression de fichier** → retirer de PROJECT_MAP.md + verifier les cross-references
3. **Nouveau modele Prisma** ou modification de modele → mettre a jour section 12 (Prisma Model Relationships)
4. **Nouvelle route API** → ajouter dans section 8 (API Routes by Domain)
5. **Nouveau component partage** → ajouter dans section 9 (Components & Their Consumers)
6. **Nouveau hook** → ajouter dans section 10 (Hooks & Their Consumers)
7. **Changement de dependance entre features** → mettre a jour section 1 (Feature Domains) et section 3 (Impact Analysis)
8. **Nouveau context provider** → ajouter dans section 11
9. **Feature completee** (ex: STUB → LIVE) → mettre a jour le status dans Known Gaps

### COMMENT mettre a jour:

1. Ouvrir `/Volumes/AI_Project/peptide-plus/PROJECT_MAP.md`
2. Mettre a jour la date en ligne 2: `# LAST UPDATED: YYYY-MM-DD`
3. Mettre a jour les QUICK STATS si les compteurs changent
4. Ajouter/modifier les entrees dans les sections pertinentes
5. Verifier les cross-references (si un component est utilise par une nouvelle page, l'ajouter dans Consumers)

### FORMAT des entrees:

**Feature Domain** (section 1):
```
### N. Nom du Domaine
- **Pages**: liste des pages avec chemins
- **API**: routes API associees
- **Models**: modeles Prisma utilises
- **Components**: composants partages utilises
- **Hooks**: hooks utilises
- **Contexts**: context providers requis
- **Lib**: services/utils utilises
- **Affects**: autres domaines impactes par un changement ici
```

**Page** (sections 4-7):
```
| Chemin | Components | API calls | Models |
```

**API Route** (section 8):
```
| Route | Methods | Models | Auth | Notes |
```

### REGLES STRICTES:
- **JAMAIS** ajouter un fichier sans l'inscrire dans PROJECT_MAP.md
- **JAMAIS** supprimer un fichier sans le retirer de PROJECT_MAP.md
- **JAMAIS** changer une relation entre features sans mettre a jour les cross-references
- **TOUJOURS** verifier que le compteur QUICK STATS est a jour
- **TOUJOURS** mettre a jour la date LAST UPDATED
- Si un changement impacte plus de 3 domaines: revoir la section Impact Analysis

### VERIFICATION:
Apres chaque session de travail significative, valider:
```bash
# Verifier que les fichiers listes existent encore
grep -oP 'src/[^\s|)]+' /Volumes/AI_Project/peptide-plus/PROJECT_MAP.md | head -20 | while read f; do [ ! -f "$f" ] && echo "MISSING: $f"; done

# Compter les fichiers reels vs documentes
echo "Pages reelles: $(find src/app -name 'page.tsx' | wc -l)"
echo "API routes reelles: $(find src/app/api -name 'route.ts' | wc -l)"
echo "Components reels: $(find src/components -name '*.tsx' | wc -l)"
```
