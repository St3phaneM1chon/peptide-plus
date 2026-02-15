#!/usr/bin/env python3
"""
Add final missing keys to all locale files
"""
import json
import os
import glob

# Missing translations by section
MISSING_KEYS = {
    "common": {
        "researchOnly": {
            "en": "For Research Use Only",
            "fr": "Pour usage en recherche seulement",
            "es": "Solo para uso en investigación",
            "de": "Nur für Forschungszwecke",
            "zh": "仅供研究使用",
            "it": "Solo per uso di ricerca",
            "pt": "Apenas para uso em pesquisa",
            "ar": "للاستخدام البحثي فقط",
            "ru": "Только для исследований",
            "pl": "Tylko do użytku badawczego",
            "sv": "Endast för forskningsändamål",
            "ko": "연구 목적 전용"
        },
        "researchDisclaimer": {
            "en": "All products are intended for laboratory and research purposes only. Not for human or animal consumption.",
            "fr": "Tous les produits sont destinés uniquement à des fins de laboratoire et de recherche. Pas pour la consommation humaine ou animale.",
            "es": "Todos los productos están destinados únicamente para fines de laboratorio e investigación. No para consumo humano o animal.",
            "de": "Alle Produkte sind ausschließlich für Labor- und Forschungszwecke bestimmt. Nicht für den menschlichen oder tierischen Verzehr.",
            "zh": "所有产品仅用于实验室和研究目的。不可供人类或动物食用。",
            "it": "Tutti i prodotti sono destinati esclusivamente a scopi di laboratorio e ricerca. Non per consumo umano o animale.",
            "pt": "Todos os produtos são destinados apenas para fins de laboratório e pesquisa. Não para consumo humano ou animal.",
            "ar": "جميع المنتجات مخصصة لأغراض المختبر والبحث فقط. ليست للاستهلاك البشري أو الحيواني.",
            "ru": "Все продукты предназначены исключительно для лабораторных и исследовательских целей. Не для употребления людьми или животными.",
            "pl": "Wszystkie produkty są przeznaczone wyłącznie do celów laboratoryjnych i badawczych. Nie do spożycia przez ludzi lub zwierzęta.",
            "sv": "Alla produkter är avsedda för laboratorie- och forskningsändamål endast. Inte för human eller djurförbrukning.",
            "ko": "모든 제품은 실험실 및 연구 목적으로만 사용됩니다. 인간이나 동물 소비용이 아닙니다."
        }
    },
    "checkout": {
        "whatNext": {
            "en": "What happens next?",
            "fr": "Que se passe-t-il ensuite?",
            "es": "¿Qué sigue?",
            "de": "Was passiert als nächstes?",
            "zh": "接下来会发生什么？",
            "it": "Cosa succede dopo?",
            "pt": "O que acontece depois?",
            "ar": "ماذا يحدث بعد ذلك؟",
            "ru": "Что будет дальше?",
            "pl": "Co dalej?",
            "sv": "Vad händer sedan?",
            "ko": "다음에 무슨 일이 일어나나요?"
        },
        "step1Email": {
            "en": "You will receive an email confirmation shortly",
            "fr": "Vous recevrez bientôt un courriel de confirmation",
            "es": "Recibirás un correo de confirmación en breve",
            "de": "Sie erhalten in Kürze eine Bestätigungs-E-Mail",
            "zh": "您将很快收到确认邮件",
            "it": "Riceverai un'email di conferma a breve",
            "pt": "Você receberá um email de confirmação em breve",
            "ar": "ستتلقى بريد تأكيد قريباً",
            "ru": "Вы скоро получите письмо с подтверждением",
            "pl": "Wkrótce otrzymasz email z potwierdzeniem",
            "sv": "Du får snart ett bekräftelsemail",
            "ko": "곧 확인 이메일을 받게 됩니다"
        },
        "step2Processing": {
            "en": "Your order will be processed and shipped within 24-48 hours",
            "fr": "Votre commande sera traitée et expédiée dans les 24-48 heures",
            "es": "Tu pedido será procesado y enviado en 24-48 horas",
            "de": "Ihre Bestellung wird innerhalb von 24-48 Stunden bearbeitet und versendet",
            "zh": "您的订单将在24-48小时内处理并发货",
            "it": "Il tuo ordine sarà elaborato e spedito entro 24-48 ore",
            "pt": "Seu pedido será processado e enviado em 24-48 horas",
            "ar": "سيتم معالجة وشحن طلبك خلال 24-48 ساعة",
            "ru": "Ваш заказ будет обработан и отправлен в течение 24-48 часов",
            "pl": "Twoje zamówienie zostanie przetworzone i wysłane w ciągu 24-48 godzin",
            "sv": "Din beställning behandlas och skickas inom 24-48 timmar",
            "ko": "주문은 24-48시간 내에 처리되어 발송됩니다"
        },
        "step3Tracking": {
            "en": "You will receive a tracking number by email once shipped",
            "fr": "Vous recevrez un numéro de suivi par courriel une fois expédié",
            "es": "Recibirás un número de rastreo por correo una vez enviado",
            "de": "Sie erhalten eine Sendungsnummer per E-Mail nach Versand",
            "zh": "发货后您将通过邮件收到追踪号",
            "it": "Riceverai un numero di tracciamento via email dopo la spedizione",
            "pt": "Você receberá um número de rastreamento por email após o envio",
            "ar": "ستتلقى رقم التتبع بالبريد بعد الشحن",
            "ru": "Вы получите номер отслеживания по email после отправки",
            "pl": "Otrzymasz numer śledzenia emailem po wysyłce",
            "sv": "Du får ett spårningsnummer via e-post när den skickas",
            "ko": "발송 후 이메일로 추적 번호를 받게 됩니다"
        }
    }
}

def get_translation(key_data, locale):
    """Get translation for a locale, fallback to English"""
    return key_data.get(locale, key_data.get("en", ""))

def update_locale(locale_path, locale_code):
    """Add missing keys to a locale file"""
    with open(locale_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Map locale to base language code
    base_locale = locale_code.split('-')[0]  # ar-dz -> ar

    # Add missing keys
    for section, keys in MISSING_KEYS.items():
        if section not in data:
            data[section] = {}
        for key, translations in keys.items():
            if key not in data[section]:
                data[section][key] = get_translation(translations, base_locale)

    with open(locale_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Updated: {locale_code}")

def main():
    locale_dir = "/Volumes/AI_Project/peptide-plus/src/i18n/locales"

    for locale_file in glob.glob(f"{locale_dir}/*.json"):
        locale_code = os.path.basename(locale_file).replace('.json', '')
        update_locale(locale_file, locale_code)

    print("\nAll missing keys added!")

if __name__ == "__main__":
    main()
