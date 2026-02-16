#!/usr/bin/env python3
"""
Add missing i18n keys to all 22 locale files.
English values used for all non-fr locales (daemon will translate tonight).
"""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n', 'locales')

# Keys to add: { "namespace.key": {"en": "...", "fr": "..."} }
# For nested keys use dot notation: "calculator.inVial" -> calculator: { inVial: "..." }
NEW_KEYS = {
    # Calculator sub-keys (extend existing calculator section)
    "calculator.inVial": {"en": "in the vial", "fr": "dans le vial"},
    "calculator.bacteriostaticWater": {"en": "bacteriostatic water", "fr": "eau bactériostatique"},
    "calculator.perInjection": {"en": "per injection", "fr": "par injection"},
    "calculator.result": {"en": "Result", "fr": "Résultat"},
    "calculator.concentration": {"en": "Concentration:", "fr": "Concentration :"},
    "calculator.volumeToInject": {"en": "Volume to inject:", "fr": "Volume à injecter :"},
    "calculator.unitsToInject": {"en": "Units to inject", "fr": "Unités à injecter"},
    "calculator.unitsU100": {"en": "units (U-100)", "fr": "unités (U-100)"},
    "calculator.syringe3mlRequired": {"en": "3 mL syringe required", "fr": "Seringue 3 mL requise"},
    "calculator.mlSyringe3ml": {"en": "mL (3 mL syringe)", "fr": "mL (seringue 3 mL)"},
    "calculator.unitsU100Count": {"en": "{count} units U-100", "fr": "{count} unités U-100"},

    # Format extras (extend existing formats section)
    "formats.bundle": {"en": "Bundle", "fr": "Bundle"},
    "formats.accessory": {"en": "Accessory", "fr": "Accessoire"},
    "formats.nasalSpray": {"en": "Nasal Spray", "fr": "Spray nasal"},
    "formats.cream": {"en": "Cream", "fr": "Crème"},

    # Shop extras
    "shop.stockLeft": {"en": "{count} left", "fr": "{count} restant(s)"},
    "shop.savePercent": {"en": "Save {percent}%", "fr": "Économisez {percent}%"},
    "shop.productsIncluded": {"en": "{count} products included", "fr": "{count} produits inclus"},
    "shop.productIncluded": {"en": "{count} product included", "fr": "{count} produit inclus"},
    "shop.youSave": {"en": "You save {amount}", "fr": "Vous économisez {amount}"},
    "shop.failedToLoadProduct": {"en": "Failed to load product", "fr": "Échec du chargement du produit"},

    # Search section (new)
    "search.placeholder": {"en": "Search for a peptide...", "fr": "Rechercher un peptide..."},
    "search.purityPercent": {"en": "{purity}% purity", "fr": "{purity}% pureté"},
    "search.viewAllResults": {"en": "View all {count} results", "fr": "Voir les {count} résultats"},
    "search.noResultsFor": {"en": "No results for \"{query}\"", "fr": "Aucun résultat pour « {query} »"},
    "search.tryAdvancedSearch": {"en": "Try advanced search", "fr": "Essayer la recherche avancée"},
    "search.popularSearches": {"en": "Popular searches", "fr": "Recherches populaires"},

    # Gift card section (new)
    "giftCard.title": {"en": "Gift Card", "fr": "Carte cadeau"},
    "giftCard.enterCode": {"en": "Please enter a gift card code", "fr": "Veuillez entrer un code de carte cadeau"},
    "giftCard.linkedSuccess": {"en": "Gift card linked to your account!", "fr": "Carte cadeau liée à votre compte !"},
    "giftCard.balance": {"en": "Balance: {amount}", "fr": "Solde : {amount}"},
    "giftCard.checkBalance": {"en": "Check Balance", "fr": "Vérifier le solde"},
    "giftCard.redeem": {"en": "Redeem", "fr": "Utiliser"},
    "giftCard.note": {"en": "Gift cards can be used for any product on our site", "fr": "Les cartes cadeaux peuvent être utilisées pour tout produit sur notre site"},

    # Errors section (extend existing)
    "errors.pageNotFound": {"en": "Page Not Found", "fr": "Page non trouvée"},
    "errors.pageNotFoundDesc": {"en": "The page you are looking for doesn't exist or has been moved.", "fr": "La page que vous recherchez n'existe pas ou a été déplacée."},
    "errors.goToHomepage": {"en": "Go to Homepage", "fr": "Aller à l'accueil"},
    "errors.browseProducts": {"en": "Browse Products", "fr": "Parcourir les produits"},
    "errors.somethingWentWrong": {"en": "Something went wrong!", "fr": "Une erreur est survenue !"},
    "errors.errorDescription": {"en": "We apologize for the inconvenience. Please try again.", "fr": "Nous nous excusons pour le désagrément. Veuillez réessayer."},
    "errors.errorId": {"en": "Error ID: {id}", "fr": "ID de l'erreur : {id}"},

    # Reviews (extend existing)
    "reviews.pointsEarned": {"en": "You earned {points} loyalty points!", "fr": "Vous avez gagné {points} points de fidélité !"},
    "reviews.submitSuccess": {"en": "Review submitted successfully! It will be published after admin approval.", "fr": "Avis soumis avec succès ! Il sera publié après approbation."},
    "reviews.showingFiltered": {"en": "Showing {rating}-star reviews", "fr": "Avis {rating} étoiles"},
    "reviews.showingAll": {"en": "Showing all reviews", "fr": "Tous les avis"},
    "reviews.clearFilters": {"en": "Clear filters", "fr": "Effacer les filtres"},
    "reviews.withPhotos": {"en": "With Photos ({count})", "fr": "Avec photos ({count})"},
    "reviews.loading": {"en": "Loading reviews...", "fr": "Chargement des avis..."},
    "reviews.noMatchingReviews": {"en": "No reviews match your filters", "fr": "Aucun avis ne correspond à vos filtres"},
    "reviews.noReviewsYet": {"en": "No reviews yet. Be the first to review!", "fr": "Aucun avis. Soyez le premier à donner votre avis !"},
    "reviews.verifiedPurchase": {"en": "Verified Purchase", "fr": "Achat vérifié"},
    "reviews.storeResponse": {"en": "Response from BioCycle Peptides+", "fr": "Réponse de BioCycle Peptides+"},
    "reviews.helpful": {"en": "Helpful ({count})", "fr": "Utile ({count})"},
    "reviews.titlePlaceholder": {"en": "Summarize your experience", "fr": "Résumez votre expérience"},
    "reviews.contentPlaceholder": {"en": "Tell us about your experience...", "fr": "Parlez-nous de votre expérience..."},
    "reviews.minCharacters": {"en": "Minimum 20 characters", "fr": "Minimum 20 caractères"},

    # Common
    "common.scrollLeft": {"en": "Scroll left", "fr": "Défiler vers la gauche"},
    "common.scrollRight": {"en": "Scroll right", "fr": "Défiler vers la droite"},
    "common.genericError": {"en": "An error occurred", "fr": "Une erreur est survenue"},
    "common.connectionError": {"en": "Connection error", "fr": "Erreur de connexion"},

    # Footer/Trust
    "footer.location": {"en": "Montreal, Quebec, Canada", "fr": "Montréal, Québec, Canada"},
    "trust.purity": {"en": "99%+ Purity", "fr": "Pureté 99%+"},
    "trust.labTested": {"en": "Lab Tested", "fr": "Testé en laboratoire"},
    "trust.madeInCanada": {"en": "Made in Canada", "fr": "Fabriqué au Canada"},

    # Nav
    "nav.adminPanel": {"en": "Admin Panel", "fr": "Panneau d'administration"},
    "nav.closeMenu": {"en": "Close menu", "fr": "Fermer le menu"},
    "nav.openMenu": {"en": "Open menu", "fr": "Ouvrir le menu"},
    "nav.security": {"en": "Security", "fr": "Sécurité"},

    # Checkout extras
    "checkout.namePlaceholder": {"en": "John Doe", "fr": "Jean Dupont"},
    "checkout.cityPlaceholder": {"en": "Montreal", "fr": "Montréal"},

    # Provinces (new section)
    "provinces.AB": {"en": "Alberta", "fr": "Alberta"},
    "provinces.BC": {"en": "British Columbia", "fr": "Colombie-Britannique"},
    "provinces.MB": {"en": "Manitoba", "fr": "Manitoba"},
    "provinces.NB": {"en": "New Brunswick", "fr": "Nouveau-Brunswick"},
    "provinces.NL": {"en": "Newfoundland and Labrador", "fr": "Terre-Neuve-et-Labrador"},
    "provinces.NS": {"en": "Nova Scotia", "fr": "Nouvelle-Écosse"},
    "provinces.NT": {"en": "Northwest Territories", "fr": "Territoires du Nord-Ouest"},
    "provinces.NU": {"en": "Nunavut", "fr": "Nunavut"},
    "provinces.ON": {"en": "Ontario", "fr": "Ontario"},
    "provinces.PE": {"en": "Prince Edward Island", "fr": "Île-du-Prince-Édouard"},
    "provinces.QC": {"en": "Quebec", "fr": "Québec"},
    "provinces.SK": {"en": "Saskatchewan", "fr": "Saskatchewan"},
    "provinces.YT": {"en": "Yukon", "fr": "Yukon"},

    # Account
    "account.connectedAs": {"en": "Connected as {email}", "fr": "Connecté en tant que {email}"},

    # Video
    "video.loadPlayer": {"en": "Load video player", "fr": "Charger le lecteur vidéo"},
    "video.thumbnail": {"en": "Video thumbnail", "fr": "Miniature de la vidéo"},
    "video.productVideo": {"en": "Product video", "fr": "Vidéo du produit"},

    # Share
    "share.copyLink": {"en": "Copy link", "fr": "Copier le lien"},

    # Owner Dashboard
    "ownerDashboard.title": {"en": "Owner Dashboard", "fr": "Tableau de bord Propriétaire"},
    "ownerDashboard.subtitle": {"en": "Complete overview", "fr": "Vue d'ensemble complète"},
    "ownerDashboard.students": {"en": "{count} students", "fr": "{count} étudiants"},
    "ownerDashboard.employees": {"en": "Employees", "fr": "Employés"},
    "ownerDashboard.recentTransactions": {"en": "Recent Transactions", "fr": "Transactions récentes"},
    "orderStatus.completed": {"en": "Paid", "fr": "Payé"},
    "orderStatus.pending": {"en": "Pending", "fr": "En attente"},
    "orderStatus.failed": {"en": "Failed", "fr": "Échoué"},
}


def set_nested(data, dotpath, value):
    """Set a nested key in a dict using dot notation."""
    keys = dotpath.split('.')
    current = data
    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        elif not isinstance(current[key], dict):
            # Key exists but is a string, need to restructure
            return False
        current = current[key]

    final_key = keys[-1]
    if final_key in current:
        return False  # Key already exists, skip
    current[final_key] = value
    return True


def get_nested(data, dotpath):
    """Check if a nested key exists."""
    keys = dotpath.split('.')
    current = data
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return None
        current = current[key]
    return current


def process_locale(filepath, locale):
    """Add missing keys to a locale file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    added = 0
    skipped = 0

    for dotpath, translations in NEW_KEYS.items():
        # Determine value: use locale-specific if available, else English
        if locale == 'fr':
            value = translations.get('fr', translations['en'])
        else:
            value = translations['en']

        if get_nested(data, dotpath) is not None:
            skipped += 1
            continue

        if set_nested(data, dotpath, value):
            added += 1
        else:
            print(f"  WARNING: Could not set {dotpath} in {locale} (parent is not a dict)")

    if added > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')

    return added, skipped


def main():
    locales_path = os.path.abspath(LOCALES_DIR)
    print(f"Adding {len(NEW_KEYS)} keys to locale files in {locales_path}")
    print()

    total_added = 0
    total_skipped = 0

    for filename in sorted(os.listdir(locales_path)):
        if not filename.endswith('.json'):
            continue
        locale = filename.replace('.json', '')
        filepath = os.path.join(locales_path, filename)

        added, skipped = process_locale(filepath, locale)
        total_added += added
        total_skipped += skipped

        status = f"+{added}" if added > 0 else "no change"
        print(f"  {locale:8s}: {status} ({skipped} already existed)")

    print()
    print(f"TOTAL: {total_added} keys added, {total_skipped} already existed")
    print(f"Keys per locale: {len(NEW_KEYS)}")


if __name__ == '__main__':
    main()
