#!/usr/bin/env python3
"""Add TTS i18n keys to all 22 locale files."""

import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n', 'locales')

TTS_KEYS = {
    'en': {
        'tts.listen': 'Listen to this page',
        'tts.pause': 'Pause',
        'tts.resume': 'Resume',
        'tts.stop': 'Stop',
        'tts.loading': 'Loading voice...',
        'tts.unsupported': 'Text-to-speech is not supported in your browser',
    },
    'fr': {
        'tts.listen': 'Écouter cette page',
        'tts.pause': 'Pause',
        'tts.resume': 'Reprendre',
        'tts.stop': 'Arrêter',
        'tts.loading': 'Chargement de la voix...',
        'tts.unsupported': 'La lecture vocale n\'est pas supportée par votre navigateur',
    },
    'ar': {
        'tts.listen': 'استمع إلى هذه الصفحة',
        'tts.pause': 'إيقاف مؤقت',
        'tts.resume': 'استئناف',
        'tts.stop': 'إيقاف',
        'tts.loading': 'جاري تحميل الصوت...',
        'tts.unsupported': 'القراءة الصوتية غير مدعومة في متصفحك',
    },
    'zh': {
        'tts.listen': '朗读此页',
        'tts.pause': '暂停',
        'tts.resume': '继续',
        'tts.stop': '停止',
        'tts.loading': '正在加载语音...',
        'tts.unsupported': '您的浏览器不支持语音朗读',
    },
    'de': {
        'tts.listen': 'Diese Seite vorlesen',
        'tts.pause': 'Pause',
        'tts.resume': 'Fortsetzen',
        'tts.stop': 'Stopp',
        'tts.loading': 'Stimme wird geladen...',
        'tts.unsupported': 'Text-to-Speech wird von Ihrem Browser nicht unterstützt',
    },
    'es': {
        'tts.listen': 'Escuchar esta página',
        'tts.pause': 'Pausar',
        'tts.resume': 'Reanudar',
        'tts.stop': 'Detener',
        'tts.loading': 'Cargando voz...',
        'tts.unsupported': 'La lectura de voz no es compatible con su navegador',
    },
    'hi': {
        'tts.listen': 'इस पेज को सुनें',
        'tts.pause': 'रोकें',
        'tts.resume': 'जारी रखें',
        'tts.stop': 'बंद करें',
        'tts.loading': 'आवाज़ लोड हो रही है...',
        'tts.unsupported': 'आपका ब्राउज़र टेक्स्ट-टू-स्पीच का समर्थन नहीं करता',
    },
    'it': {
        'tts.listen': 'Ascolta questa pagina',
        'tts.pause': 'Pausa',
        'tts.resume': 'Riprendi',
        'tts.stop': 'Ferma',
        'tts.loading': 'Caricamento voce...',
        'tts.unsupported': 'La lettura vocale non è supportata dal tuo browser',
    },
    'ko': {
        'tts.listen': '이 페이지 듣기',
        'tts.pause': '일시정지',
        'tts.resume': '계속',
        'tts.stop': '중지',
        'tts.loading': '음성 로딩 중...',
        'tts.unsupported': '브라우저에서 음성 읽기를 지원하지 않습니다',
    },
    'pl': {
        'tts.listen': 'Posłuchaj tej strony',
        'tts.pause': 'Pauza',
        'tts.resume': 'Wznów',
        'tts.stop': 'Zatrzymaj',
        'tts.loading': 'Ładowanie głosu...',
        'tts.unsupported': 'Twoja przeglądarka nie obsługuje czytania głosowego',
    },
    'pt': {
        'tts.listen': 'Ouvir esta página',
        'tts.pause': 'Pausar',
        'tts.resume': 'Retomar',
        'tts.stop': 'Parar',
        'tts.loading': 'Carregando voz...',
        'tts.unsupported': 'A leitura de voz não é suportada pelo seu navegador',
    },
    'pa': {
        'tts.listen': 'ਇਸ ਪੰਨੇ ਨੂੰ ਸੁਣੋ',
        'tts.pause': 'ਰੋਕੋ',
        'tts.resume': 'ਜਾਰੀ ਰੱਖੋ',
        'tts.stop': 'ਬੰਦ ਕਰੋ',
        'tts.loading': 'ਆਵਾਜ਼ ਲੋਡ ਹੋ ਰਹੀ ਹੈ...',
        'tts.unsupported': 'ਤੁਹਾਡਾ ਬ੍ਰਾਊਜ਼ਰ ਟੈਕਸਟ-ਟੂ-ਸਪੀਚ ਦਾ ਸਮਰਥਨ ਨਹੀਂ ਕਰਦਾ',
    },
    'ru': {
        'tts.listen': 'Прослушать эту страницу',
        'tts.pause': 'Пауза',
        'tts.resume': 'Продолжить',
        'tts.stop': 'Остановить',
        'tts.loading': 'Загрузка голоса...',
        'tts.unsupported': 'Ваш браузер не поддерживает голосовое чтение',
    },
    'sv': {
        'tts.listen': 'Lyssna på denna sida',
        'tts.pause': 'Pausa',
        'tts.resume': 'Återuppta',
        'tts.stop': 'Stoppa',
        'tts.loading': 'Laddar röst...',
        'tts.unsupported': 'Din webbläsare stöder inte text-till-tal',
    },
    'ta': {
        'tts.listen': 'இந்தப் பக்கத்தைக் கேளுங்கள்',
        'tts.pause': 'இடைநிறுத்தம்',
        'tts.resume': 'தொடர்',
        'tts.stop': 'நிறுத்து',
        'tts.loading': 'குரல் ஏற்றப்படுகிறது...',
        'tts.unsupported': 'உங்கள் உலாவி குரல் வாசிப்பை ஆதரிக்கவில்லை',
    },
    'vi': {
        'tts.listen': 'Nghe trang này',
        'tts.pause': 'Tạm dừng',
        'tts.resume': 'Tiếp tục',
        'tts.stop': 'Dừng',
        'tts.loading': 'Đang tải giọng nói...',
        'tts.unsupported': 'Trình duyệt của bạn không hỗ trợ đọc văn bản',
    },
    'tl': {
        'tts.listen': 'Pakinggan ang pahinang ito',
        'tts.pause': 'I-pause',
        'tts.resume': 'Ipagpatuloy',
        'tts.stop': 'Itigil',
        'tts.loading': 'Nag-lo-load ng boses...',
        'tts.unsupported': 'Hindi suportado ng iyong browser ang text-to-speech',
    },
    'ht': {
        'tts.listen': 'Koute paj sa a',
        'tts.pause': 'Poz',
        'tts.resume': 'Kontinye',
        'tts.stop': 'Kanpe',
        'tts.loading': 'Ap chaje vwa...',
        'tts.unsupported': 'Navigatè ou pa sipòte lekti vokal',
    },
    'gcr': {
        'tts.listen': 'Kouté paj-la',
        'tts.pause': 'Pozé',
        'tts.resume': 'Kontinié',
        'tts.stop': 'Arété',
        'tts.loading': 'Ka chajé lavwa...',
        'tts.unsupported': 'Navigatè-a pa ka li tèks pou ou',
    },
}

# Arabic dialects share the same translations as standard Arabic
for dialect in ['ar-dz', 'ar-lb', 'ar-ma']:
    TTS_KEYS[dialect] = TTS_KEYS['ar'].copy()

count = 0
for filename in os.listdir(LOCALES_DIR):
    if not filename.endswith('.json'):
        continue
    locale = filename.replace('.json', '')
    filepath = os.path.join(LOCALES_DIR, filename)

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    keys = TTS_KEYS.get(locale, TTS_KEYS['en'])
    added = 0
    for key, value in keys.items():
        if key not in data:
            data[key] = value
            added += 1

    if added > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        count += added
        print(f"  {locale}: +{added} keys")

print(f"\nTotal: {count} keys added")
