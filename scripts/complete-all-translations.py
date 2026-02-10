#!/usr/bin/env python3
"""
Script to complete missing translations in all remaining locale files
"""
import json
import os

# Translations for all missing keys by language
TRANSLATIONS = {
    # Arabic translations
    "ar": {
        "subscriptions": {
            "faqTitle": "الأسئلة الشائعة للاشتراكات",
            "faq1Q": "هل يمكنني الإلغاء في أي وقت؟",
            "faq1A": "نعم! يمكنك إلغاء أو إيقاف أو تعديل اشتراكك في أي وقت دون عقوبات.",
            "faq2Q": "كيف يعمل الخصم؟",
            "faq2A": "كلما طلبت أكثر، كلما وفرت أكثر. التوصيل الأسبوعي يوفر 20%، الشهري 10%.",
            "faq3Q": "هل يمكنني تخطي توصيلة؟",
            "faq3A": "بالتأكيد. يمكنك تخطي التوصيلات الفردية أو إيقاف اشتراكك مؤقتاً.",
            "faq4Q": "هل سأكسب نقاط الولاء؟",
            "faq4A": "نعم! تكسب كامل نقاط الولاء على طلبات الاشتراك، بالإضافة إلى 200 نقطة مكافأة لكل توصيل."
        },
        "videos": {
            "calculator": "الحاسبة",
            "labResults": "نتائج المختبر"
        },
        "community": {
            "questionPlaceholder": "ما هو سؤالك أو موضوعك؟",
            "contentPlaceholder": "شارك أفكارك أو أسئلتك أو تجاربك...",
            "tagsPlaceholder": "مثال: bpc-157, إعادة التكوين, مبتدئ"
        },
        "webinars": {
            "recordings": "التسجيلات",
            "always": "دائماً",
            "enterEmail": "أدخل بريدك الإلكتروني",
            "registerWebinar": "التسجيل للندوة",
            "receiveConfirmation": "ستتلقى بريد تأكيد على",
            "withWebinarLink": "مع رابط الندوة.",
            "confirmRegistration": "تأكيد التسجيل",
            "signInToRegister": "سجل الدخول للتسجيل",
            "signInRequired": "يرجى تسجيل الدخول للتسجيل في هذه الندوة.",
            "education": "تعليم",
            "tutorial": "دروس",
            "bestPractices": "أفضل الممارسات"
        },
        "ambassador": {
            "applyDesc": "املأ نموذج التقديم البسيط",
            "approveDesc": "نراجع الطلبات خلال 48 ساعة",
            "shareDesc": "استخدم رابطك الفريد للترويج للمنتجات",
            "earnDesc": "احصل على مدفوعات شهرية لكل عملية بيع",
            "commission": "عمولة",
            "referrals": "إحالات",
            "mostPopular": "الأكثر شعبية",
            "nextTier": "المستوى التالي",
            "moreReferralsNeeded": "إحالات أخرى مطلوبة",
            "yourReferralLink": "رابط الإحالة الخاص بك",
            "backToOverview": "العودة للنظرة العامة",
            "applyToBecome": "تقدم لتصبح سفيراً",
            "websiteUrl": "رابط الموقع أو المدونة",
            "socialProfiles": "حسابات وسائل التواصل الاجتماعي",
            "estimatedFollowers": "العدد التقديري للمتابعين/الجمهور",
            "whyJoin": "لماذا تريد الانضمام لبرنامجنا؟",
            "promotionPlan": "كيف تخطط للترويج لمنتجاتنا؟",
            "termsNote": "بالتقديم، توافق على شروط وأحكام السفير. نراجع جميع الطلبات يدوياً وسنرد خلال 48 ساعة.",
            "upTo20Commission": "حتى 20% عمولة",
            "freeProducts": "منتجات مجانية",
            "passiveIncome": "دخل سلبي",
            "exclusivePerks": "مزايا حصرية",
            "faq1Q": "كيف أحصل على المدفوعات؟",
            "faq1A": "تتم المدفوعات شهرياً عبر PayPal أو التحويل البنكي للأرباح فوق $50.",
            "faq2Q": "هل هناك حد أدنى لحجم الجمهور؟",
            "faq2A": "لا يوجد حد أدنى! نرحب بالسفراء من جميع الأحجام المتحمسين لأبحاث الببتيدات.",
            "faq3Q": "هل يمكنني الترويج على أي منصة؟",
            "faq3A": "نعم! المدونة، يوتيوب، إنستغرام، تيك توك، قوائم البريد - أينما كان جمهورك.",
            "faq4Q": "كم تدوم ملفات تعريف الارتباط؟",
            "faq4A": "ملفات تعريف الارتباط للتتبع تدوم 30 يوماً، لذا تحصل على رصيد للمبيعات ضمن هذه الفترة.",
            "faq5Q": "هل أحتاج أن أكون عميلاً أولاً؟",
            "faq5A": "على الرغم من أنه ليس مطلوباً، إلا أنه يساعد! التوصيات الأصيلة من المستخدمين تعمل بشكل أفضل.",
            "faq6Q": "ما مواد التسويق التي تقدمونها؟",
            "faq6A": "نقدم لافتات وصور منتجات وقوالب بريد إلكتروني ومحتوى وسائل التواصل الاجتماعي."
        },
        "account": {
            "emailReadOnly": "لا يمكن تغيير البريد الإلكتروني",
            "oauthPassword": "كلمة مرورك تُدار من قبل مزود تسجيل الدخول الاجتماعي",
            "streetAddress": "العنوان",
            "city": "المدينة",
            "province": "المحافظة/الولاية",
            "postalCode": "الرمز البريدي",
            "country": "البلد",
            "saveAddress": "حفظ العنوان",
            "dangerZone": "منطقة الخطر",
            "deleteAccount": "حذف الحساب",
            "deleteAccountDesc": "بمجرد الحذف، ستتم إزالة جميع بياناتك بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
            "requestDeletion": "طلب حذف الحساب",
            "reordering": "جارٍ إعادة الطلب...",
            "orderNumber": "طلب #",
            "orderDate": "تاريخ الطلب",
            "orderStatus": "الحالة",
            "orderTotal": "الإجمالي",
            "viewDetails": "عرض التفاصيل",
            "hideDetails": "إخفاء التفاصيل",
            "shippingAddress": "عنوان الشحن",
            "trackingNumber": "رقم التتبع",
            "orderItems": "عناصر الطلب",
            "subtotal": "المجموع الفرعي",
            "tax": "الضريبة",
            "shipping": "الشحن",
            "statusPending": "قيد الانتظار",
            "statusProcessing": "قيد المعالجة",
            "statusShipped": "تم الشحن",
            "statusDelivered": "تم التوصيل",
            "statusCancelled": "ملغي",
            "profileUpdated": "تم تحديث الملف الشخصي بنجاح",
            "passwordUpdated": "تم تحديث كلمة المرور بنجاح",
            "addressSaved": "تم حفظ العنوان بنجاح",
            "deleteConfirm": "هل أنت متأكد من رغبتك في حذف حسابك؟ لا يمكن التراجع عن هذا الإجراء.",
            "deletionRequested": "تم طلب حذف الحساب. سيقوم فريقنا بمعالجة ذلك خلال 24 ساعة."
        },
        "reviews": {
            "writeReviewFor": "كتابة مراجعة لـ",
            "signIn": "تسجيل الدخول",
            "reviewTitlePlaceholder": "لخص تجربتك",
            "yourReviewPlaceholder": "أخبرنا عن تجربتك مع هذا المنتج...",
            "minCharacters": "20 حرف كحد أدنى",
            "clickToUpload": "انقر لرفع الصور",
            "earnPointsDesc": "أرسل مراجعة موثقة واكسب نقاط إضافية",
            "showingStarReviews": "عرض مراجعات {rating} نجوم",
            "showingAllReviews": "عرض جميع المراجعات البالغة {count}",
            "clearFilter": "مسح الفلتر"
        },
        "qa": {
            "questionsAbout": "أسئلة حول",
            "askAbout": "اسأل عن",
            "signIn": "تسجيل الدخول",
            "questionPlaceholder": "ماذا تود أن تعرف عن هذا المنتج؟",
            "tipDesc": "الأسئلة حول إعادة التكوين والتخزين والشحن تحصل على أسرع الإجابات.",
            "submitting": "جارٍ الإرسال...",
            "official": "رسمي",
            "answer": "إجابة",
            "answers": "إجابات"
        },
        "learn": {
            "calculator": "حاسبة الببتيدات",
            "labResults": "نتائج المختبر",
            "stayUpdatedDesc": "احصل على أحدث رؤى البحث والعروض الحصرية.",
            "viewFaq": "عرض الأسئلة الشائعة",
            "guideTitle": "الدليل الشامل لأبحاث الببتيدات",
            "guideDesc": "حمّل دليلنا المجاني الشامل الذي يغطي أساسيات الببتيدات والتخزين وإعادة التكوين وبروتوكولات البحث.",
            "continueLearning": "استمر في التعلم",
            "browseCollection": "تصفح مجموعتنا من ببتيدات البحث عالية النقاء.",
            "readTime": "دقيقة قراءة"
        },
        "contact": {
            "info": "معلومات الاتصال",
            "hours": "ساعات العمل",
            "hoursDetail": "الاثنين - الجمعة: 9 ص - 5 م بتوقيت شرق أمريكا",
            "response": "وقت الاستجابة",
            "responseDetail": "نرد عادة خلال 24 ساعة"
        },
        "trackOrder": {
            "orderNumberPlaceholder": "مثال: PP-2026-12345",
            "emailPlaceholder": "email@example.com",
            "notFoundDesc": "لم نتمكن من العثور على طلب بهذه التفاصيل. يرجى التحقق من رقم الطلب والبريد الإلكتروني.",
            "contactSupport": "اتصل بالدعم للمساعدة",
            "needHelp": "هل تحتاج مساعدة؟",
            "faqTitle": "الأسئلة الشائعة",
            "faqDesc": "أسئلة الشحن الشائعة",
            "contactTitle": "اتصل بنا",
            "contactDesc": "احصل على دعم من فريقنا",
            "shippingProgress": "تقدم الشحن",
            "trackOn": "تتبع على",
            "website": "الموقع"
        },
        "cart": {
            "invalidPromoCode": "رمز ترويجي غير صالح",
            "promoDiscount": "خصم ترويجي",
            "estimateProvince": "تقدير الضرائب (اختر المقاطعة)"
        },
        "checkout": {
            "emptyCartMessage": "أضف منتجات إلى سلتك قبل الدفع.",
            "newsletter": "أبقني على اطلاع بالمنتجات والعروض الجديدة",
            "continueToShipping": "المتابعة للشحن",
            "state": "الولاية",
            "zipCode": "الرمز البريدي",
            "backToInfo": "العودة للمعلومات",
            "continueToPayment": "المتابعة للدفع",
            "shippingTo": "الشحن إلى",
            "backToShipping": "العودة للشحن",
            "confirmationEmail": "تم إرسال بريد تأكيد إلى",
            "exportNotice": "شحن دولي - بدون ضرائب كندية",
            "exportNoticeDetail": "جميع الصادرات الدولية معفاة من الضرائب. لا تنطبق ضرائب GST/HST أو الضرائب الإقليمية. قد يتم فرض رسوم الاستيراد والضرائب المحلية من قبل جمارك بلد الوجهة.",
            "exportZeroRated": "تصدير معفى",
            "noCanadianTax": "بدون ضريبة كندية (تصدير)",
            "currencyNote": "الأسعار بالدولار الكندي. مبالغ الدولار الأمريكي تقديرية بناءً على سعر الصرف الحالي.",
            "ftaCountry": "اتفاقية التجارة الحرة مع كندا - رسوم استيراد مخفضة أو معدومة",
            "cersNotice": "ملاحظة: يتطلب إعلان CERS للطلبات التي تزيد عن 2000 دولار كندي.",
            "account": "الحساب",
            "welcomeBack": "مرحباً",
            "signInBenefits": "سجل الدخول لدفع أسرع والوصول لسجل طلباتك",
            "expressCheckout": "دفع سريع",
            "orSignInWith": "أو سجل الدخول بـ",
            "or": "أو",
            "continueWithGoogle": "المتابعة مع Google",
            "continueWithApple": "المتابعة مع Apple",
            "continueWithFacebook": "المتابعة مع Facebook",
            "continueWithX": "المتابعة مع X",
            "continueAsGuest": "المتابعة كضيف",
            "whyCreateAccount": "لماذا تنشئ حساباً؟",
            "benefit1": "دفع أسرع بمعلومات محفوظة",
            "benefit2": "تتبع الطلبات في الوقت الفعلي",
            "benefit3": "سجل الطلبات والتوصيات",
            "benefit4": "عروض حصرية ونقاط ولاء",
            "backToSignIn": "← العودة لتسجيل الدخول",
            "loggedIn": "تم تسجيل الدخول",
            "saveAddress": "حفظ هذا العنوان للطلبات المستقبلية",
            "expressPayment": "دفع سريع",
            "orPayWithCard": "أو ادفع بالبطاقة",
            "creditCard": "بطاقة ائتمان",
            "savePayment": "حفظ هذه البطاقة للمشتريات المستقبلية",
            "estimatedDelivery": "التوصيل المتوقع",
            "whatHappensNext": "ماذا يحدث بعد ذلك؟",
            "emailConfirmation": "ستتلقى بريد تأكيد قريباً",
            "orderProcessed": "سيتم معالجة وشحن طلبك خلال 24-48 ساعة",
            "trackingNumber": "ستتلقى رقم التتبع بالبريد بعد الشحن",
            "researchNotice": "للبحث فقط: جميع المنتجات مخصصة لأغراض المختبر والبحث فقط. ليست للاستهلاك البشري أو الحيواني.",
            "questionsContact": "أسئلة حول طلبك؟ اتصل بنا على",
            "postcode": "الرمز البريدي",
            "cap": "CAP",
            "plz": "PLZ",
            "postnummer": "Postnummer",
            "region": "المنطقة",
            "department": "القسم",
            "county": "المقاطعة",
            "canton": "الكانتون",
            "prefecture": "المحافظة",
            "voivodeship": "المقاطعة",
            "stateTerritory": "الولاية/الإقليم",
            "postalCodeExample": "مثال"
        },
        "shipping": {
            "packagingHandling": "التغليف والمناولة",
            "orderTracking": "تتبع الطلب",
            "customsDuties": "الجمارك ورسوم الاستيراد",
            "lostDamaged": "الطرود المفقودة أو التالفة",
            "questionsShipping": "أسئلة حول الشحن؟",
            "viewFaq": "عرض الأسئلة الشائعة",
            "region": "المنطقة",
            "freeOver": "مجاني فوق {amount}",
            "under": "تحت {amount}",
            "priority": "أولوية",
            "nextBusinessDay": "يوم العمل التالي",
            "standardInternational": "دولي قياسي",
            "expressInternational": "دولي سريع",
            "europe": "أوروبا (الاتحاد الأوروبي، المملكة المتحدة)",
            "australia": "أستراليا / نيوزيلندا",
            "asia": "آسيا",
            "restOfWorld": "باقي العالم",
            "calculatedAtCheckout": "يُحسب عند الدفع"
        },
        "refund": {
            "eligibleReturn": "مؤهل للإرجاع/الاسترداد",
            "howToRequest": "كيفية طلب الاسترداد",
            "refundTimeline": "جدول الاسترداد",
            "damagedDefective": "المنتجات التالفة أو المعيبة",
            "orderCancellations": "إلغاءات الطلب",
            "exchanges": "التبديلات",
            "paymentMethod": "طريقة الدفع",
            "processingTime": "وقت المعالجة",
            "creditDebit": "بطاقة ائتمان/خصم",
            "paypal": "PayPal",
            "applePay": "Apple Pay / Google Pay",
            "timesVary": "قد تختلف الأوقات حسب البنك أو المؤسسة المالية."
        }
    },
    # Russian translations
    "ru": {
        "subscriptions": {
            "faqTitle": "FAQ подписок",
            "faq1Q": "Могу ли я отменить в любое время?",
            "faq1A": "Да! Вы можете отменить, приостановить или изменить подписку в любое время без штрафов.",
            "faq2Q": "Как работает скидка?",
            "faq2A": "Чем чаще заказываете, тем больше экономите. Еженедельная доставка экономит 20%, ежемесячная 10%.",
            "faq3Q": "Могу ли я пропустить доставку?",
            "faq3A": "Безусловно. Вы можете пропустить отдельные доставки или временно приостановить подписку.",
            "faq4Q": "Буду ли я получать баллы лояльности?",
            "faq4A": "Да! Вы получаете все баллы лояльности за заказы по подписке, плюс 200 бонусных баллов за доставку."
        },
        "videos": {
            "calculator": "Калькулятор",
            "labResults": "Результаты лаборатории"
        },
        "community": {
            "questionPlaceholder": "Какой у вас вопрос или тема?",
            "contentPlaceholder": "Поделитесь своими мыслями, вопросами или опытом...",
            "tagsPlaceholder": "например: bpc-157, восстановление, начинающий"
        },
        "webinars": {
            "recordings": "Записи",
            "always": "Всегда",
            "enterEmail": "Введите ваш email",
            "registerWebinar": "Зарегистрироваться на вебинар",
            "receiveConfirmation": "Вы получите письмо с подтверждением на",
            "withWebinarLink": "со ссылкой на вебинар.",
            "confirmRegistration": "Подтвердить регистрацию",
            "signInToRegister": "Войдите для регистрации",
            "signInRequired": "Пожалуйста, войдите для регистрации на этот вебинар.",
            "education": "Образование",
            "tutorial": "Руководство",
            "bestPractices": "Лучшие практики"
        },
        "ambassador": {
            "applyDesc": "Заполните нашу простую форму заявки",
            "approveDesc": "Мы рассматриваем заявки в течение 48 часов",
            "shareDesc": "Используйте уникальную ссылку для продвижения",
            "earnDesc": "Получайте ежемесячные выплаты за каждую продажу",
            "commission": "комиссия",
            "referrals": "рефералы",
            "mostPopular": "Самый популярный",
            "nextTier": "Следующий уровень",
            "moreReferralsNeeded": "ещё рефералов нужно",
            "yourReferralLink": "Ваша реферальная ссылка",
            "backToOverview": "Вернуться к обзору",
            "applyToBecome": "Подать заявку на амбассадора",
            "websiteUrl": "URL сайта или блога",
            "socialProfiles": "Профили в соцсетях",
            "estimatedFollowers": "Примерное количество подписчиков/аудитории",
            "whyJoin": "Почему вы хотите присоединиться к нашей программе?",
            "promotionPlan": "Как вы планируете продвигать наши продукты?",
            "termsNote": "Подавая заявку, вы соглашаетесь с нашими Условиями амбассадора. Мы рассматриваем все заявки вручную и ответим в течение 48 часов.",
            "upTo20Commission": "До 20% комиссии",
            "freeProducts": "Бесплатные продукты",
            "passiveIncome": "Пассивный доход",
            "exclusivePerks": "Эксклюзивные преимущества",
            "faq1Q": "Как я получаю оплату?",
            "faq1A": "Выплаты производятся ежемесячно через PayPal или банковский перевод для заработка свыше $50.",
            "faq2Q": "Есть минимальный размер аудитории?",
            "faq2A": "Минимума нет! Мы приветствуем амбассадоров любого масштаба, увлечённых исследованием пептидов.",
            "faq3Q": "Могу ли я продвигать на любой платформе?",
            "faq3A": "Да! Блог, YouTube, Instagram, TikTok, email-рассылки - где угодно.",
            "faq4Q": "Как долго действует cookie?",
            "faq4A": "Наша cookie отслеживания действует 30 дней, поэтому вы получаете кредит за продажи в этом окне.",
            "faq5Q": "Нужно ли сначала быть клиентом?",
            "faq5A": "Хотя это не обязательно, это помогает! Подлинные рекомендации пользователей работают лучше всего.",
            "faq6Q": "Какие маркетинговые материалы вы предоставляете?",
            "faq6A": "Мы предоставляем баннеры, изображения продуктов, email-шаблоны и контент для соцсетей."
        },
        "account": {
            "emailReadOnly": "Email нельзя изменить",
            "oauthPassword": "Ваш пароль управляется провайдером социального входа",
            "streetAddress": "Адрес",
            "city": "Город",
            "province": "Область/Штат",
            "postalCode": "Почтовый индекс",
            "country": "Страна",
            "saveAddress": "Сохранить адрес",
            "dangerZone": "Опасная зона",
            "deleteAccount": "Удалить аккаунт",
            "deleteAccountDesc": "После удаления все ваши данные будут безвозвратно удалены. Это действие нельзя отменить.",
            "requestDeletion": "Запросить удаление аккаунта",
            "reordering": "Повторный заказ...",
            "orderNumber": "Заказ #",
            "orderDate": "Дата заказа",
            "orderStatus": "Статус",
            "orderTotal": "Итого",
            "viewDetails": "Показать детали",
            "hideDetails": "Скрыть детали",
            "shippingAddress": "Адрес доставки",
            "trackingNumber": "Номер отслеживания",
            "orderItems": "Товары заказа",
            "subtotal": "Подытог",
            "tax": "Налог",
            "shipping": "Доставка",
            "statusPending": "Ожидание",
            "statusProcessing": "Обработка",
            "statusShipped": "Отправлен",
            "statusDelivered": "Доставлен",
            "statusCancelled": "Отменён",
            "profileUpdated": "Профиль успешно обновлён",
            "passwordUpdated": "Пароль успешно обновлён",
            "addressSaved": "Адрес успешно сохранён",
            "deleteConfirm": "Вы уверены, что хотите удалить свой аккаунт? Это действие нельзя отменить.",
            "deletionRequested": "Запрос на удаление аккаунта отправлен. Наша команда обработает его в течение 24 часов."
        },
        "reviews": {
            "writeReviewFor": "Написать отзыв о",
            "signIn": "Войти",
            "reviewTitlePlaceholder": "Резюмируйте ваш опыт",
            "yourReviewPlaceholder": "Расскажите о вашем опыте с этим продуктом...",
            "minCharacters": "Минимум 20 символов",
            "clickToUpload": "Нажмите для загрузки изображений",
            "earnPointsDesc": "Оставьте проверенный отзыв и заработайте бонусные баллы",
            "showingStarReviews": "Показаны отзывы на {rating} звёзд",
            "showingAllReviews": "Показаны все {count} отзывов",
            "clearFilter": "Очистить фильтр"
        },
        "qa": {
            "questionsAbout": "вопросов о",
            "askAbout": "Спросить о",
            "signIn": "Войти",
            "questionPlaceholder": "Что вы хотели бы узнать об этом продукте?",
            "tipDesc": "Вопросы о восстановлении, хранении и доставке получают ответы быстрее.",
            "submitting": "Отправка...",
            "official": "Официальный",
            "answer": "ответ",
            "answers": "ответов"
        },
        "learn": {
            "calculator": "Калькулятор пептидов",
            "labResults": "Результаты лаборатории",
            "stayUpdatedDesc": "Получайте последние исследовательские идеи и эксклюзивные предложения.",
            "viewFaq": "Смотреть FAQ",
            "guideTitle": "Полное руководство по исследованию пептидов",
            "guideDesc": "Скачайте наше бесплатное руководство по основам пептидов, хранению, восстановлению и протоколам исследований.",
            "continueLearning": "Продолжить обучение",
            "browseCollection": "Просмотрите нашу коллекцию исследовательских пептидов высокой чистоты.",
            "readTime": "мин чтения"
        },
        "contact": {
            "info": "Контактная информация",
            "hours": "Рабочие часы",
            "hoursDetail": "Понедельник - Пятница: 9:00 - 17:00 EST",
            "response": "Время ответа",
            "responseDetail": "Обычно мы отвечаем в течение 24 часов"
        },
        "trackOrder": {
            "orderNumberPlaceholder": "напр: PP-2026-12345",
            "emailPlaceholder": "email@example.com",
            "notFoundDesc": "Мы не смогли найти заказ с этими данными. Проверьте номер заказа и email.",
            "contactSupport": "Обратитесь в поддержку",
            "needHelp": "Нужна помощь?",
            "faqTitle": "FAQ",
            "faqDesc": "Частые вопросы о доставке",
            "contactTitle": "Свяжитесь с нами",
            "contactDesc": "Получите поддержку от нашей команды",
            "shippingProgress": "Прогресс доставки",
            "trackOn": "Отследить на",
            "website": "сайте"
        },
        "cart": {
            "invalidPromoCode": "Неверный промокод",
            "promoDiscount": "Промо скидка",
            "estimateProvince": "Рассчитать налоги (выберите провинцию)"
        },
        "checkout": {
            "emptyCartMessage": "Добавьте товары в корзину перед оформлением.",
            "newsletter": "Информировать о новых продуктах и акциях",
            "continueToShipping": "Продолжить к доставке",
            "state": "Штат",
            "zipCode": "Почтовый индекс",
            "backToInfo": "Назад к информации",
            "continueToPayment": "Продолжить к оплате",
            "shippingTo": "Доставка в",
            "backToShipping": "Назад к доставке",
            "confirmationEmail": "Письмо с подтверждением отправлено на",
            "exportNotice": "Международная доставка - без канадских налогов",
            "exportNoticeDetail": "Весь международный экспорт освобождён от налогов. GST/HST и провинциальные налоги не применяются. Импортные пошлины и местные налоги могут взиматься таможней страны назначения.",
            "exportZeroRated": "Экспорт без налога",
            "noCanadianTax": "Без канадского налога (экспорт)",
            "currencyNote": "Цены в CAD. Суммы в USD являются оценками по текущему курсу.",
            "ftaCountry": "Соглашение о свободной торговле с Канадой - сниженные или нулевые пошлины",
            "cersNotice": "Примечание: для заказов свыше $2000 CAD требуется декларация CERS.",
            "account": "Аккаунт",
            "welcomeBack": "Добро пожаловать",
            "signInBenefits": "Войдите для быстрого оформления и доступа к истории заказов",
            "expressCheckout": "Быстрое оформление",
            "orSignInWith": "или войдите через",
            "or": "или",
            "continueWithGoogle": "Продолжить с Google",
            "continueWithApple": "Продолжить с Apple",
            "continueWithFacebook": "Продолжить с Facebook",
            "continueWithX": "Продолжить с X",
            "continueAsGuest": "Продолжить как гость",
            "whyCreateAccount": "Зачем создавать аккаунт?",
            "benefit1": "Быстрое оформление с сохранёнными данными",
            "benefit2": "Отслеживание заказов в реальном времени",
            "benefit3": "История заказов и рекомендации",
            "benefit4": "Эксклюзивные предложения и баллы лояльности",
            "backToSignIn": "← Назад к входу",
            "loggedIn": "Вы вошли",
            "saveAddress": "Сохранить адрес для будущих заказов",
            "expressPayment": "Быстрая оплата",
            "orPayWithCard": "или оплатить картой",
            "creditCard": "Кредитная карта",
            "savePayment": "Сохранить карту для будущих покупок",
            "estimatedDelivery": "Ожидаемая доставка",
            "whatHappensNext": "Что будет дальше?",
            "emailConfirmation": "Вы скоро получите письмо с подтверждением",
            "orderProcessed": "Ваш заказ будет обработан и отправлен в течение 24-48 часов",
            "trackingNumber": "Вы получите номер отслеживания по email после отправки",
            "researchNotice": "ТОЛЬКО ДЛЯ ИССЛЕДОВАНИЙ: Все продукты предназначены исключительно для лабораторных и исследовательских целей. Не для употребления людьми или животными.",
            "questionsContact": "Вопросы о заказе? Свяжитесь с нами:",
            "postcode": "Индекс",
            "cap": "CAP",
            "plz": "PLZ",
            "postnummer": "Postnummer",
            "region": "Регион",
            "department": "Департамент",
            "county": "Округ",
            "canton": "Кантон",
            "prefecture": "Префектура",
            "voivodeship": "Воеводство",
            "stateTerritory": "Штат/Территория",
            "postalCodeExample": "напр."
        },
        "shipping": {
            "packagingHandling": "Упаковка и обработка",
            "orderTracking": "Отслеживание заказа",
            "customsDuties": "Таможня и импортные пошлины",
            "lostDamaged": "Потерянные или повреждённые посылки",
            "questionsShipping": "Вопросы о доставке?",
            "viewFaq": "Смотреть FAQ",
            "region": "Регион",
            "freeOver": "БЕСПЛАТНО от {amount}",
            "under": "до {amount}",
            "priority": "Приоритет",
            "nextBusinessDay": "Следующий рабочий день",
            "standardInternational": "Стандартная международная",
            "expressInternational": "Экспресс международная",
            "europe": "Европа (ЕС, Великобритания)",
            "australia": "Австралия / Новая Зеландия",
            "asia": "Азия",
            "restOfWorld": "Остальной мир",
            "calculatedAtCheckout": "Рассчитывается при оформлении"
        },
        "refund": {
            "eligibleReturn": "Подлежит возврату/возмещению",
            "howToRequest": "Как запросить возврат",
            "refundTimeline": "Сроки возврата",
            "damagedDefective": "Повреждённые или дефектные товары",
            "orderCancellations": "Отмена заказов",
            "exchanges": "Обмен",
            "paymentMethod": "Способ оплаты",
            "processingTime": "Время обработки",
            "creditDebit": "Кредитная/Дебетовая карта",
            "paypal": "PayPal",
            "applePay": "Apple Pay / Google Pay",
            "timesVary": "Сроки могут варьироваться в зависимости от банка или финансовой организации."
        }
    }
}

def deep_merge(base: dict, updates: dict) -> dict:
    """Deep merge two dictionaries"""
    result = base.copy()
    for key, value in updates.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result

def update_locale_file(locale_code: str, translations: dict):
    """Update a locale file with missing translations"""
    locale_path = f"/Volumes/AI_Project/peptide-plus/src/i18n/locales/{locale_code}.json"
    
    if not os.path.exists(locale_path):
        print(f"File not found: {locale_path}")
        return False
    
    with open(locale_path, 'r', encoding='utf-8') as f:
        current = json.load(f)
    
    updated = deep_merge(current, translations)
    
    with open(locale_path, 'w', encoding='utf-8') as f:
        json.dump(updated, f, ensure_ascii=False, indent=2)
    
    print(f"Updated: {locale_code}.json")
    return True

def main():
    for locale_code, translations in TRANSLATIONS.items():
        update_locale_file(locale_code, translations)
    
    # Also apply Arabic translations to dialects
    if "ar" in TRANSLATIONS:
        for dialect in ["ar-dz", "ar-lb", "ar-ma"]:
            update_locale_file(dialect, TRANSLATIONS["ar"])
    
    print("\nAll translations completed!")

if __name__ == "__main__":
    main()
