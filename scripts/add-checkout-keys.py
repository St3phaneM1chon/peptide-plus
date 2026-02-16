#!/usr/bin/env python3
"""Add new i18n keys for checkout improvements:
- Billing vs shipping address
- Credit card / Interac payment
- Payment error messages
- SMS notifications
"""
import json
import os
import glob

LOCALES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src', 'i18n', 'locales')

# New keys to add (en + fr)
NEW_KEYS = {
    "checkout.billingAddress": {
        "en": "Billing Address",
        "fr": "Adresse de facturation"
    },
    "checkout.billingAddressSameAsShipping": {
        "en": "Billing address is the same as shipping address",
        "fr": "L'adresse de facturation est la même que l'adresse de livraison"
    },
    "checkout.creditCard": {
        "en": "Credit Card",
        "fr": "Carte de crédit"
    },
    "checkout.interac": {
        "en": "Interac e-Transfer",
        "fr": "Virement Interac"
    },
    "checkout.interacDescription": {
        "en": "Pay securely with your bank account",
        "fr": "Payez de façon sécurisée avec votre compte bancaire"
    },
    "checkout.creditCardDescription": {
        "en": "Visa, Mastercard, American Express",
        "fr": "Visa, Mastercard, American Express"
    },
    "checkout.paypalDescription": {
        "en": "Pay with your PayPal account",
        "fr": "Payez avec votre compte PayPal"
    },
    "checkout.applePayDescription": {
        "en": "Quick and secure payment",
        "fr": "Paiement rapide et sécurisé"
    },
    "checkout.googlePayDescription": {
        "en": "Quick and secure payment",
        "fr": "Paiement rapide et sécurisé"
    },
    "checkout.paymentDeclined": {
        "en": "Payment declined by your bank. Please try another card or contact your bank.",
        "fr": "Paiement refusé par votre institution bancaire. Essayez une autre carte ou contactez votre banque."
    },
    "checkout.paymentExpiredCard": {
        "en": "Your card has expired. Please use a different card.",
        "fr": "Votre carte est expirée. Veuillez utiliser une autre carte."
    },
    "checkout.paymentInsufficientFunds": {
        "en": "Insufficient funds. Please try another payment method.",
        "fr": "Fonds insuffisants. Veuillez essayer un autre mode de paiement."
    },
    "checkout.paymentSystemError": {
        "en": "A system error occurred. Please try again. If the problem persists, contact us.",
        "fr": "Une erreur système est survenue. Veuillez réessayer. Si le problème persiste, contactez-nous."
    },
    "checkout.paymentNetworkError": {
        "en": "Connection error. Please check your internet connection and try again.",
        "fr": "Erreur de connexion. Vérifiez votre connexion internet et réessayez."
    },
    "checkout.paymentInvalidCard": {
        "en": "Invalid card number. Please check and try again.",
        "fr": "Numéro de carte invalide. Vérifiez et réessayez."
    },
    "checkout.paymentGenericError": {
        "en": "Payment could not be processed. Please try again or use a different payment method.",
        "fr": "Le paiement n'a pas pu être traité. Veuillez réessayer ou utiliser un autre mode de paiement."
    },
    "checkout.needHelp": {
        "en": "Need help? Contact us",
        "fr": "Besoin d'aide? Contactez-nous"
    },
    "checkout.billingFirstName": {
        "en": "First name",
        "fr": "Prénom"
    },
    "checkout.billingLastName": {
        "en": "Last name",
        "fr": "Nom de famille"
    },
}

def set_nested(d, key_path, value):
    """Set a value in a nested dict using dot notation."""
    keys = key_path.split('.')
    for k in keys[:-1]:
        if k not in d:
            d[k] = {}
        d = d[k]
    if keys[-1] not in d:
        d[keys[-1]] = value
        return True
    return False

def main():
    locale_files = sorted(glob.glob(os.path.join(LOCALES_DIR, '*.json')))
    total_added = 0

    for filepath in locale_files:
        locale = os.path.splitext(os.path.basename(filepath))[0]

        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        added = 0
        for key, translations in NEW_KEYS.items():
            if locale == 'fr':
                value = translations['fr']
            elif locale == 'en':
                value = translations['en']
            else:
                value = translations['en']  # English fallback, daemon translates

            if set_nested(data, key, value):
                added += 1

        if added > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write('\n')
            print(f"  {locale}: +{added} keys")
            total_added += added

    print(f"\nTotal: {total_added} keys added across {len(locale_files)} locales")

if __name__ == '__main__':
    main()
