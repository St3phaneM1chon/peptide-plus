/**
 * Translate all critical customer-facing namespaces across 20 locales.
 * Priority: translation, home (remaining), footer, nav, shop (critical subset)
 */
const fs = require('fs');
const path = require('path');
const localeDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');

// ============================================================
// TRANSLATION NAMESPACE (13 keys - the AI notice banner)
// ============================================================
const translationNs = {
  ar: {
    aiNotice: "تمت ترجمة هذه الصفحة تلقائياً بالذكاء الاصطناعي. قد تكون بعض الترجمات غير دقيقة.",
    feedbackPlaceholder: "أي مشاكل محددة؟ (اختياري)",
    feedbackQuestion: "كيف هي جودة الترجمة في هذه الصفحة؟",
    feedbackSubmit: "إرسال الملاحظات",
    feedbackThanks: "شكراً لملاحظاتك!",
    feedbackTitle: "جودة الترجمة",
    reportIssue: "هل ترى خطأ؟ ساعدنا في التحسين بالإبلاغ عنه.",
    aria: { badTranslation: "ترجمة سيئة", goodTranslation: "ترجمة جيدة" },
    quality: { draft: "ترجمة آلية", human: "مراجعة بشرية", improved: "محسّنة بالذكاء الاصطناعي", verified: "تم التحقق" },
  },
  de: {
    aiNotice: "Diese Seite wurde automatisch von KI übersetzt. Einige Übersetzungen können ungenau sein.",
    feedbackPlaceholder: "Bestimmte Probleme? (optional)",
    feedbackQuestion: "Wie ist die Übersetzungsqualität auf dieser Seite?",
    feedbackSubmit: "Feedback senden",
    feedbackThanks: "Vielen Dank für Ihr Feedback!",
    feedbackTitle: "Übersetzungsqualität",
    reportIssue: "Fehler gefunden? Helfen Sie uns, indem Sie ihn melden.",
    aria: { badTranslation: "Schlechte Übersetzung", goodTranslation: "Gute Übersetzung" },
    quality: { draft: "KI-übersetzt", human: "Menschlich geprüft", improved: "KI-verbessert", verified: "KI-verifiziert" },
  },
  es: {
    aiNotice: "Esta página ha sido traducida automáticamente por IA. Algunas traducciones pueden ser imperfectas.",
    feedbackPlaceholder: "¿Problemas específicos? (opcional)",
    feedbackQuestion: "¿Cómo es la calidad de traducción en esta página?",
    feedbackSubmit: "Enviar comentarios",
    feedbackThanks: "¡Gracias por sus comentarios!",
    feedbackTitle: "Calidad de traducción",
    reportIssue: "¿Ve un error? Ayúdenos a mejorar reportándolo.",
    aria: { badTranslation: "Mala traducción", goodTranslation: "Buena traducción" },
    quality: { draft: "Traducida por IA", human: "Revisada por humano", improved: "Mejorada por IA", verified: "Verificada por IA" },
  },
  it: {
    aiNotice: "Questa pagina è stata tradotta automaticamente dall'IA. Alcune traduzioni potrebbero essere imperfette.",
    feedbackPlaceholder: "Problemi specifici? (opzionale)",
    feedbackQuestion: "Com'è la qualità della traduzione in questa pagina?",
    feedbackSubmit: "Invia feedback",
    feedbackThanks: "Grazie per il tuo feedback!",
    feedbackTitle: "Qualità della traduzione",
    reportIssue: "Vedi un errore? Aiutaci a migliorare segnalandolo.",
    aria: { badTranslation: "Traduzione scarsa", goodTranslation: "Buona traduzione" },
    quality: { draft: "Tradotta dall'IA", human: "Revisionata da umano", improved: "Migliorata dall'IA", verified: "Verificata dall'IA" },
  },
  pt: {
    aiNotice: "Esta página foi traduzida automaticamente por IA. Algumas traduções podem ser imperfeitas.",
    feedbackPlaceholder: "Problemas específicos? (opcional)",
    feedbackQuestion: "Como é a qualidade da tradução nesta página?",
    feedbackSubmit: "Enviar feedback",
    feedbackThanks: "Obrigado pelo seu feedback!",
    feedbackTitle: "Qualidade da tradução",
    reportIssue: "Viu um erro? Ajude-nos a melhorar reportando-o.",
    aria: { badTranslation: "Tradução ruim", goodTranslation: "Boa tradução" },
    quality: { draft: "Traduzida por IA", human: "Revisada por humano", improved: "Melhorada por IA", verified: "Verificada por IA" },
  },
  ru: {
    aiNotice: "Эта страница была автоматически переведена ИИ. Некоторые переводы могут быть неточными.",
    feedbackPlaceholder: "Конкретные проблемы? (необязательно)",
    feedbackQuestion: "Как вы оцениваете качество перевода на этой странице?",
    feedbackSubmit: "Отправить отзыв",
    feedbackThanks: "Спасибо за ваш отзыв!",
    feedbackTitle: "Качество перевода",
    reportIssue: "Видите ошибку? Помогите нам улучшить, сообщив о ней.",
    aria: { badTranslation: "Плохой перевод", goodTranslation: "Хороший перевод" },
    quality: { draft: "Переведено ИИ", human: "Проверено человеком", improved: "Улучшено ИИ", verified: "Проверено ИИ" },
  },
  zh: {
    aiNotice: "此页面由AI自动翻译。部分翻译可能不够准确。",
    feedbackPlaceholder: "具体问题？（可选）",
    feedbackQuestion: "您觉得此页面的翻译质量如何？",
    feedbackSubmit: "发送反馈",
    feedbackThanks: "感谢您的反馈！",
    feedbackTitle: "翻译质量",
    reportIssue: "发现错误？请报告帮助我们改进。",
    aria: { badTranslation: "翻译不好", goodTranslation: "翻译很好" },
    quality: { draft: "AI翻译", human: "人工审核", improved: "AI改进", verified: "AI验证" },
  },
  ko: {
    aiNotice: "이 페이지는 AI에 의해 자동 번역되었습니다. 일부 번역이 부정확할 수 있습니다.",
    feedbackPlaceholder: "구체적인 문제가 있나요? (선택사항)",
    feedbackQuestion: "이 페이지의 번역 품질은 어떤가요?",
    feedbackSubmit: "피드백 보내기",
    feedbackThanks: "피드백 감사합니다!",
    feedbackTitle: "번역 품질",
    reportIssue: "오류를 발견하셨나요? 보고하여 개선에 도움을 주세요.",
    aria: { badTranslation: "번역 불량", goodTranslation: "번역 양호" },
    quality: { draft: "AI 번역", human: "인간 검토", improved: "AI 개선", verified: "AI 검증" },
  },
  hi: {
    aiNotice: "यह पृष्ठ AI द्वारा स्वचालित रूप से अनुवादित किया गया है। कुछ अनुवाद अपूर्ण हो सकते हैं।",
    feedbackPlaceholder: "कोई विशिष्ट समस्या? (वैकल्पिक)",
    feedbackQuestion: "इस पृष्ठ पर अनुवाद की गुणवत्ता कैसी है?",
    feedbackSubmit: "प्रतिक्रिया भेजें",
    feedbackThanks: "आपकी प्रतिक्रिया के लिए धन्यवाद!",
    feedbackTitle: "अनुवाद गुणवत्ता",
    reportIssue: "कोई त्रुटि दिखी? इसकी रिपोर्ट करके सुधार में मदद करें।",
    aria: { badTranslation: "खराब अनुवाद", goodTranslation: "अच्छा अनुवाद" },
    quality: { draft: "AI अनुवादित", human: "मानव समीक्षित", improved: "AI सुधारित", verified: "AI सत्यापित" },
  },
  pl: {
    aiNotice: "Ta strona została automatycznie przetłumaczona przez AI. Niektóre tłumaczenia mogą być niedoskonałe.",
    feedbackPlaceholder: "Konkretne problemy? (opcjonalnie)",
    feedbackQuestion: "Jak oceniasz jakość tłumaczenia na tej stronie?",
    feedbackSubmit: "Wyślij opinię",
    feedbackThanks: "Dziękujemy za opinię!",
    feedbackTitle: "Jakość tłumaczenia",
    reportIssue: "Widzisz błąd? Pomóż nam poprawić, zgłaszając go.",
    aria: { badTranslation: "Złe tłumaczenie", goodTranslation: "Dobre tłumaczenie" },
    quality: { draft: "Tłumaczenie AI", human: "Sprawdzone przez człowieka", improved: "Ulepszone przez AI", verified: "Zweryfikowane przez AI" },
  },
  sv: {
    aiNotice: "Denna sida har automatiskt översatts av AI. Vissa översättningar kan vara ofullkomliga.",
    feedbackPlaceholder: "Specifika problem? (valfritt)",
    feedbackQuestion: "Hur är översättningskvaliteten på denna sida?",
    feedbackSubmit: "Skicka feedback",
    feedbackThanks: "Tack för din feedback!",
    feedbackTitle: "Översättningskvalitet",
    reportIssue: "Ser du ett fel? Hjälp oss förbättra genom att rapportera det.",
    aria: { badTranslation: "Dålig översättning", goodTranslation: "Bra översättning" },
    quality: { draft: "AI-översatt", human: "Mänskligt granskad", improved: "AI-förbättrad", verified: "AI-verifierad" },
  },
  vi: {
    aiNotice: "Trang này đã được dịch tự động bởi AI. Một số bản dịch có thể không chính xác.",
    feedbackPlaceholder: "Vấn đề cụ thể? (tùy chọn)",
    feedbackQuestion: "Chất lượng dịch thuật trên trang này như thế nào?",
    feedbackSubmit: "Gửi phản hồi",
    feedbackThanks: "Cảm ơn phản hồi của bạn!",
    feedbackTitle: "Chất lượng dịch thuật",
    reportIssue: "Thấy lỗi? Hãy giúp chúng tôi cải thiện bằng cách báo cáo.",
    aria: { badTranslation: "Dịch kém", goodTranslation: "Dịch tốt" },
    quality: { draft: "Dịch bằng AI", human: "Đã kiểm tra bởi người", improved: "Cải thiện bởi AI", verified: "Xác minh bởi AI" },
  },
  tl: {
    aiNotice: "Ang pahinang ito ay awtomatikong isinalin ng AI. Maaaring hindi perpekto ang ilang salin.",
    feedbackPlaceholder: "May mga partikular na isyu? (opsyonal)",
    feedbackQuestion: "Paano ang kalidad ng pagsasalin sa pahinang ito?",
    feedbackSubmit: "Ipadala ang feedback",
    feedbackThanks: "Salamat sa iyong feedback!",
    feedbackTitle: "Kalidad ng pagsasalin",
    reportIssue: "May nakitang error? Tulungan kami mapabuti sa pamamagitan ng pag-report nito.",
    aria: { badTranslation: "Masamang salin", goodTranslation: "Magandang salin" },
    quality: { draft: "Isinalin ng AI", human: "Sinuri ng tao", improved: "Pinahusay ng AI", verified: "Na-verify ng AI" },
  },
  pa: {
    aiNotice: "ਇਹ ਪੰਨਾ AI ਦੁਆਰਾ ਆਟੋਮੈਟਿਕ ਅਨੁਵਾਦ ਕੀਤਾ ਗਿਆ ਹੈ। ਕੁਝ ਅਨੁਵਾਦ ਅਪੂਰਨ ਹੋ ਸਕਦੇ ਹਨ।",
    feedbackPlaceholder: "ਕੋਈ ਖਾਸ ਮੁੱਦੇ? (ਵਿਕਲਪਿਕ)",
    feedbackQuestion: "ਇਸ ਪੰਨੇ 'ਤੇ ਅਨੁਵਾਦ ਦੀ ਗੁਣਵੱਤਾ ਕਿਵੇਂ ਹੈ?",
    feedbackSubmit: "ਫੀਡਬੈਕ ਭੇਜੋ",
    feedbackThanks: "ਤੁਹਾਡੀ ਫੀਡਬੈਕ ਲਈ ਧੰਨਵਾਦ!",
    feedbackTitle: "ਅਨੁਵਾਦ ਗੁਣਵੱਤਾ",
    reportIssue: "ਕੋਈ ਗਲਤੀ ਦਿਖੀ? ਰਿਪੋਰਟ ਕਰਕੇ ਸੁਧਾਰ ਵਿੱਚ ਮਦਦ ਕਰੋ।",
    aria: { badTranslation: "ਮਾੜਾ ਅਨੁਵਾਦ", goodTranslation: "ਚੰਗਾ ਅਨੁਵਾਦ" },
    quality: { draft: "AI ਅਨੁਵਾਦ", human: "ਮਨੁੱਖੀ ਸਮੀਖਿਆ", improved: "AI ਸੁਧਾਰਿਆ", verified: "AI ਤਸਦੀਕ" },
  },
  ta: {
    aiNotice: "இந்தப் பக்கம் AI ஆல் தானியங்கி மொழிபெயர்க்கப்பட்டது. சில மொழிபெயர்ப்புகள் சரியாக இல்லாமல் இருக்கலாம்.",
    feedbackPlaceholder: "குறிப்பிட்ட சிக்கல்கள்? (விரும்பினால்)",
    feedbackQuestion: "இந்தப் பக்கத்தின் மொழிபெயர்ப்பு தரம் எப்படி?",
    feedbackSubmit: "கருத்து அனுப்பு",
    feedbackThanks: "உங்கள் கருத்துக்கு நன்றி!",
    feedbackTitle: "மொழிபெயர்ப்பு தரம்",
    reportIssue: "பிழை கண்டீர்களா? புகாரளித்து மேம்படுத்த உதவுங்கள்.",
    aria: { badTranslation: "மோசமான மொழிபெயர்ப்பு", goodTranslation: "நல்ல மொழிபெயர்ப்பு" },
    quality: { draft: "AI மொழிபெயர்ப்பு", human: "மனித ஆய்வு", improved: "AI மேம்படுத்தப்பட்டது", verified: "AI சரிபார்க்கப்பட்டது" },
  },
  ht: {
    aiNotice: "Paj sa a te tradui otomatikman pa IA. Gen kèk tradiksyon ki ka pa pafè.",
    feedbackPlaceholder: "Gen pwoblèm espesifik? (opsyonèl)",
    feedbackQuestion: "Kijan kalite tradiksyon an nan paj sa a?",
    feedbackSubmit: "Voye kòmantè",
    feedbackThanks: "Mèsi pou kòmantè ou!",
    feedbackTitle: "Kalite tradiksyon",
    reportIssue: "Ou wè yon erè? Ede nou amelyore lè ou rapòte li.",
    aria: { badTranslation: "Move tradiksyon", goodTranslation: "Bon tradiksyon" },
    quality: { draft: "Tradui pa IA", human: "Revize pa moun", improved: "Amelyore pa IA", verified: "Verifye pa IA" },
  },
  gcr: {
    aiNotice: "Paj-la té tradui otomatikman pa IA. Gen kèk tradiksyon ki ka pa pafè.",
    feedbackPlaceholder: "Gen pwoblèm espésifik? (opsyonèl)",
    feedbackQuestion: "Kijan kalité tradiksyon-la dan paj-la?",
    feedbackSubmit: "Voyé kòmantè",
    feedbackThanks: "Mèsi pou kòmantè a-w!",
    feedbackTitle: "Kalité tradiksyon",
    reportIssue: "Ou wè in érè? Édé nou amélioré lè ou rapòté li.",
    aria: { badTranslation: "Mové tradiksyon", goodTranslation: "Bon tradiksyon" },
    quality: { draft: "Tradui pa IA", human: "Révizé pa moun", improved: "Amélioré pa IA", verified: "Vérifié pa IA" },
  },
};

// Copy Arabic to all Arabic variants
translationNs['ar-dz'] = JSON.parse(JSON.stringify(translationNs.ar));
translationNs['ar-lb'] = JSON.parse(JSON.stringify(translationNs.ar));
translationNs['ar-ma'] = JSON.parse(JSON.stringify(translationNs.ar));

// ============================================================
// FOOTER NAMESPACE (critical untranslated keys)
// ============================================================
const footerNs = {
  ar: { securePayments: "دفع آمن", companyInfo: "معلومات الشركة", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "هاتف: +1 (514) 000-0000", terms: "الشروط والأحكام", privacy: "سياسة الخصوصية", shop: "المتجر", resources: "الموارد", community: "المجتمع", customerService: "خدمة العملاء", newsletter: "ابقَ على اطلاع", newsletterDesc: "اشترك للحصول على عروض حصرية ومنتجات جديدة ونتائج بحث.", subscribe: "اشتراك", copyright: "جميع الحقوق محفوظة.", description: "ببتيدات بحثية عالية الجودة. مُختبرة في المعمل مع شهادات تحليل متاحة. جميع المنتجات لأغراض البحث فقط." },
  de: { securePayments: "Sichere Zahlungen", companyInfo: "Firmeninformationen", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "Tel: +1 (514) 000-0000", terms: "AGB", privacy: "Datenschutz", shop: "Shop", resources: "Ressourcen", community: "Community", customerService: "Kundenservice", newsletter: "Informiert bleiben", newsletterDesc: "Abonnieren Sie für exklusive Angebote, neue Produkte und Forschungseinblicke.", subscribe: "Abonnieren", copyright: "Alle Rechte vorbehalten.", description: "Premium-Forschungspeptide. Laborgetestet mit verfügbaren Analysezertifikaten. Alle Produkte sind nur für Forschungszwecke bestimmt." },
  es: { securePayments: "Pagos seguros", companyInfo: "Información de la empresa", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "Tel: +1 (514) 000-0000", terms: "Términos y condiciones", privacy: "Política de privacidad", shop: "Tienda", resources: "Recursos", community: "Comunidad", customerService: "Atención al cliente", newsletter: "Manténgase informado", newsletterDesc: "Suscríbase para ofertas exclusivas, nuevos productos e información de investigación.", subscribe: "Suscribirse", copyright: "Todos los derechos reservados.", description: "Péptidos de investigación de calidad premium. Probados en laboratorio con certificados de análisis disponibles. Todos los productos son solo para fines de investigación." },
  it: { securePayments: "Pagamenti sicuri", companyInfo: "Informazioni aziendali", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "Tel: +1 (514) 000-0000", terms: "Termini e condizioni", privacy: "Privacy", shop: "Negozio", resources: "Risorse", community: "Comunità", customerService: "Assistenza clienti", newsletter: "Resta aggiornato", newsletterDesc: "Iscriviti per offerte esclusive, nuovi prodotti e approfondimenti sulla ricerca.", subscribe: "Iscriviti", copyright: "Tutti i diritti riservati.", description: "Peptidi di ricerca premium. Testati in laboratorio con certificati di analisi disponibili. Tutti i prodotti sono destinati esclusivamente alla ricerca." },
  pt: { securePayments: "Pagamentos seguros", companyInfo: "Informações da empresa", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "Tel: +1 (514) 000-0000", terms: "Termos e condições", privacy: "Privacidade", shop: "Loja", resources: "Recursos", community: "Comunidade", customerService: "Atendimento ao cliente", newsletter: "Fique informado", newsletterDesc: "Inscreva-se para ofertas exclusivas, novos produtos e insights de pesquisa.", subscribe: "Inscrever-se", copyright: "Todos os direitos reservados.", description: "Peptídeos de pesquisa premium. Testados em laboratório com certificados de análise disponíveis. Todos os produtos são apenas para fins de pesquisa." },
  ru: { securePayments: "Безопасные платежи", companyInfo: "Информация о компании", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "Тел: +1 (514) 000-0000", terms: "Условия использования", privacy: "Конфиденциальность", shop: "Магазин", resources: "Ресурсы", community: "Сообщество", customerService: "Поддержка клиентов", newsletter: "Будьте в курсе", newsletterDesc: "Подпишитесь на эксклюзивные предложения, новые продукты и результаты исследований.", subscribe: "Подписаться", copyright: "Все права защищены.", description: "Исследовательские пептиды премиум-качества. Лабораторно проверены с доступными сертификатами анализа. Все продукты предназначены только для исследовательских целей." },
  zh: { securePayments: "安全支付", companyInfo: "公司信息", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "电话: +1 (514) 000-0000", terms: "条款与条件", privacy: "隐私政策", shop: "商店", resources: "资源", community: "社区", customerService: "客户服务", newsletter: "保持更新", newsletterDesc: "订阅获取独家优惠、新产品和研究洞察。", subscribe: "订阅", copyright: "版权所有。", description: "优质研究肽。经实验室测试，提供分析证书。所有产品仅用于研究目的。" },
  ko: { securePayments: "안전한 결제", companyInfo: "회사 정보", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "전화: +1 (514) 000-0000", terms: "이용약관", privacy: "개인정보처리방침", shop: "쇼핑", resources: "자료", community: "커뮤니티", customerService: "고객 서비스", newsletter: "최신 정보 받기", newsletterDesc: "독점 혜택, 신제품, 연구 인사이트를 구독하세요.", subscribe: "구독", copyright: "All rights reserved.", description: "프리미엄 연구용 펩타이드. 분석 인증서가 포함된 실험실 테스트 완료. 모든 제품은 연구 목적으로만 사용됩니다." },
  hi: { securePayments: "सुरक्षित भुगतान", companyInfo: "कंपनी की जानकारी", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "फोन: +1 (514) 000-0000", terms: "नियम और शर्तें", privacy: "गोपनीयता नीति", shop: "दुकान", resources: "संसाधन", community: "समुदाय", customerService: "ग्राहक सेवा", newsletter: "अपडेट रहें", newsletterDesc: "विशेष ऑफ़र, नए उत्पाद और अनुसंधान जानकारी के लिए सदस्यता लें।", subscribe: "सदस्यता लें", copyright: "सर्वाधिकार सुरक्षित।", description: "प्रीमियम अनुसंधान पेप्टाइड। विश्लेषण प्रमाणपत्र उपलब्ध के साथ प्रयोगशाला परीक्षित। सभी उत्पाद केवल अनुसंधान उद्देश्यों के लिए हैं।" },
  pl: { securePayments: "Bezpieczne płatności", companyInfo: "Informacje o firmie", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "Tel: +1 (514) 000-0000", terms: "Regulamin", privacy: "Polityka prywatności", shop: "Sklep", resources: "Zasoby", community: "Społeczność", customerService: "Obsługa klienta", newsletter: "Bądź na bieżąco", newsletterDesc: "Subskrybuj ekskluzywne oferty, nowe produkty i wyniki badań.", subscribe: "Subskrybuj", copyright: "Wszelkie prawa zastrzeżone.", description: "Peptydy badawcze premium. Przetestowane laboratoryjnie z dostępnymi certyfikatami analizy. Wszystkie produkty przeznaczone wyłącznie do celów badawczych." },
  sv: { securePayments: "Säkra betalningar", companyInfo: "Företagsinformation", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "Tel: +1 (514) 000-0000", terms: "Villkor", privacy: "Integritetspolicy", shop: "Butik", resources: "Resurser", community: "Community", customerService: "Kundtjänst", newsletter: "Håll dig uppdaterad", newsletterDesc: "Prenumerera för exklusiva erbjudanden, nya produkter och forskningsinsikter.", subscribe: "Prenumerera", copyright: "Alla rättigheter förbehållna.", description: "Premium forskningspeptider. Labbtestade med tillgängliga analysecertifikat. Alla produkter är avsedda enbart för forskningsändamål." },
  vi: { securePayments: "Thanh toán an toàn", companyInfo: "Thông tin công ty", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "ĐT: +1 (514) 000-0000", terms: "Điều khoản sử dụng", privacy: "Chính sách bảo mật", shop: "Cửa hàng", resources: "Tài nguyên", community: "Cộng đồng", customerService: "Dịch vụ khách hàng", newsletter: "Cập nhật tin tức", newsletterDesc: "Đăng ký nhận ưu đãi độc quyền, sản phẩm mới và thông tin nghiên cứu.", subscribe: "Đăng ký", copyright: "Bảo lưu mọi quyền.", description: "Peptide nghiên cứu cao cấp. Đã kiểm tra phòng thí nghiệm với chứng nhận phân tích. Tất cả sản phẩm chỉ dành cho mục đích nghiên cứu." },
  tl: { securePayments: "Ligtas na pagbabayad", companyInfo: "Impormasyon ng kumpanya", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "Tel: +1 (514) 000-0000", terms: "Mga tuntunin", privacy: "Patakaran sa privacy", shop: "Tindahan", resources: "Mga mapagkukunan", community: "Komunidad", customerService: "Serbisyo sa customer", newsletter: "Manatiling updated", newsletterDesc: "Mag-subscribe para sa mga eksklusibong alok, bagong produkto at mga insight sa pananaliksik.", subscribe: "Mag-subscribe", copyright: "Lahat ng karapatan ay nakalaan.", description: "Premium na peptide para sa pananaliksik. Na-lab test na may available na certificates of analysis. Lahat ng produkto ay para sa layunin ng pananaliksik lamang." },
  pa: { securePayments: "ਸੁਰੱਖਿਅਤ ਭੁਗਤਾਨ", companyInfo: "ਕੰਪਨੀ ਦੀ ਜਾਣਕਾਰੀ", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "ਫੋਨ: +1 (514) 000-0000", terms: "ਨਿਯਮ ਅਤੇ ਸ਼ਰਤਾਂ", privacy: "ਗੋਪਨੀਯਤਾ ਨੀਤੀ", shop: "ਦੁਕਾਨ", resources: "ਸਰੋਤ", community: "ਭਾਈਚਾਰਾ", customerService: "ਗਾਹਕ ਸੇਵਾ", newsletter: "ਅਪਡੇਟ ਰਹੋ", newsletterDesc: "ਵਿਸ਼ੇਸ਼ ਪੇਸ਼ਕਸ਼ਾਂ, ਨਵੇਂ ਉਤਪਾਦ ਅਤੇ ਖੋਜ ਜਾਣਕਾਰੀ ਲਈ ਸਬਸਕ੍ਰਾਈਬ ਕਰੋ।", subscribe: "ਸਬਸਕ੍ਰਾਈਬ ਕਰੋ", copyright: "ਸਾਰੇ ਹੱਕ ਰਾਖਵੇਂ ਹਨ।", description: "ਪ੍ਰੀਮੀਅਮ ਖੋਜ ਪੈਪਟਾਈਡ। ਲੈਬ ਟੈਸਟ ਕੀਤੇ ਵਿਸ਼ਲੇਸ਼ਣ ਸਰਟੀਫਿਕੇਟ ਉਪਲਬਧ। ਸਾਰੇ ਉਤਪਾਦ ਸਿਰਫ਼ ਖੋਜ ਮਕਸਦ ਲਈ ਹਨ।" },
  ta: { securePayments: "பாதுகாப்பான கட்டணம்", companyInfo: "நிறுவனத் தகவல்", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "தொலை: +1 (514) 000-0000", terms: "விதிமுறைகள்", privacy: "தனியுரிமைக் கொள்கை", shop: "கடை", resources: "வளங்கள்", community: "சமூகம்", customerService: "வாடிக்கையாளர் சேவை", newsletter: "புதுப்பிப்புகள் பெறுங்கள்", newsletterDesc: "பிரத்யேக சலுகைகள், புதிய தயாரிப்புகள் மற்றும் ஆராய்ச்சி நுண்ணறிவுகளுக்கு குழுசேரவும்.", subscribe: "குழுசேர்", copyright: "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.", description: "பிரீமியம் ஆராய்ச்சி பெப்டைடுகள். பகுப்பாய்வு சான்றிதழ்களுடன் ஆய்வக சோதனை செய்யப்பட்டது. அனைத்து தயாரிப்புகளும் ஆராய்ச்சி நோக்கங்களுக்கு மட்டுமே." },
  ht: { securePayments: "Peyman sekirize", companyInfo: "Enfòmasyon sou konpayi an", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "Tel: +1 (514) 000-0000", terms: "Kondisyon", privacy: "Politik konfidansyalite", shop: "Magazen", resources: "Resous", community: "Kominote", customerService: "Sèvis kliyan", newsletter: "Rete enfòme", newsletterDesc: "Enskri pou ofr eksklizif, nouvo pwodwi ak rezilta rechèch.", subscribe: "Enskri", copyright: "Tout dwa rezève.", description: "Peptid rechèch premyòm. Teste nan laboratwa ak sètifika analiz disponib. Tout pwodwi yo se pou rezon rechèch sèlman." },
  gcr: { securePayments: "Pèyman sékirizé", companyInfo: "Enfòmasyon konpayi-la", companyName: "BioCycle Peptides Inc.", companyNeq: "NEQ: 1234567890", companyAddress: "1234 boul. de la Recherche, bureau 100, Montreal, QC H2X 1Y6, Canada", companyPhone: "Tel: +1 (514) 000-0000", terms: "Kondisyon", privacy: "Konfidansyalité", shop: "Magazen", resources: "Résous", community: "Kominoté", customerService: "Sèvis klyan", newsletter: "Rèsté enfòmé", newsletterDesc: "Enskri pou ofr éksklizip, nouvo pwodwi épi rézilta réchèch.", subscribe: "Enskri", copyright: "Tout dwa rézèrvé.", description: "Péptid réchèch prémyòm. Tèsté an laboratwar épi sètifika analiz disponib. Tout pwodwi-la sé pou rézon réchèch sèlman." },
};

// Copy Arabic to variants
footerNs['ar-dz'] = JSON.parse(JSON.stringify(footerNs.ar));
footerNs['ar-lb'] = JSON.parse(JSON.stringify(footerNs.ar));
footerNs['ar-ma'] = JSON.parse(JSON.stringify(footerNs.ar));

// ============================================================
// Apply all translations
// ============================================================
function deepSet(obj, source) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      if (!obj[key] || typeof obj[key] !== 'object') obj[key] = {};
      deepSet(obj[key], source[key]);
    } else {
      obj[key] = source[key];
    }
  }
}

const en = require(path.join(localeDir, 'en.json'));
let totalUpdated = 0;

const allLocales = Object.keys(translationNs);

for (const locale of allLocales) {
  const filePath = path.join(localeDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${locale}.json not found`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let updated = 0;

  // Apply translation namespace
  if (translationNs[locale]) {
    if (!data.translation) data.translation = {};
    deepSet(data.translation, translationNs[locale]);
    updated += Object.keys(translationNs[locale]).length;
  }

  // Apply footer namespace
  if (footerNs[locale]) {
    if (!data.footer) data.footer = {};
    // Only update keys that are currently same as English
    for (const key of Object.keys(footerNs[locale])) {
      if (typeof footerNs[locale][key] === 'string') {
        if (data.footer[key] === en.footer[key] || !data.footer[key]) {
          data.footer[key] = footerNs[locale][key];
          updated++;
        }
      }
    }
  }

  if (updated > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`${locale}: updated ${updated} keys (translation + footer)`);
    totalUpdated += updated;
  }
}

console.log(`\nTotal: ${totalUpdated} translations updated across ${allLocales.length} locales`);
