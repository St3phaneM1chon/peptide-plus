/**
 * Seed script for Hero Slides (5 slides × 22 languages = 110 translations)
 * Run: npx ts-node prisma/seed-hero-slides.ts
 *   or: npx tsx prisma/seed-hero-slides.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LOCALES = [
  'en','fr','es','de','it','pt','ru','zh','ko','ar','pl','sv',
  'hi','vi','tl','ta','pa','ht','gcr','ar-dz','ar-lb','ar-ma',
];

// ===== SLIDE 1: Research Peptides =====
const slide1 = {
  slug: 'research-peptides',
  mediaType: 'IMAGE' as const,
  backgroundUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
  overlayOpacity: 70,
  overlayGradient: 'from-black/80 via-black/70 to-black/60',
  badgeText: 'Research Grade Peptides',
  title: 'The Best Research Peptides in Canada',
  subtitle: 'Premium quality research compounds with 99%+ purity, verified by independent third-party laboratories. Fast shipping across Canada.',
  ctaText: 'View Products',
  ctaUrl: '/shop',
  ctaStyle: 'primary',
  cta2Text: 'Lab Results',
  cta2Url: '/lab-results',
  cta2Style: 'outline',
  statsJson: JSON.stringify([
    { value: '99%+', label: 'Purity' },
    { value: '500+', label: 'Products' },
    { value: '24h', label: 'Fast Shipping' },
    { value: 'COA', label: 'Lab Tested' },
  ]),
  sortOrder: 0,
  isActive: true,
};

const slide1Translations: Record<string, { badgeText: string; title: string; subtitle: string; ctaText: string; cta2Text: string; statsJson: string }> = {
  en: { badgeText: 'Research Grade Peptides', title: 'The Best Research Peptides in Canada', subtitle: 'Premium quality research compounds with 99%+ purity, verified by independent third-party laboratories. Fast shipping across Canada.', ctaText: 'View Products', cta2Text: 'Lab Results', statsJson: JSON.stringify([{ value: '99%+', label: 'Purity' }, { value: '500+', label: 'Products' }, { value: '24h', label: 'Fast Shipping' }, { value: 'COA', label: 'Lab Tested' }]) },
  fr: { badgeText: 'Peptides Grade Recherche', title: 'Les Meilleurs Peptides de Recherche au Canada', subtitle: 'Composés de recherche de qualité supérieure avec une pureté de 99%+, vérifiés par des laboratoires tiers indépendants. Livraison rapide partout au Canada.', ctaText: 'Voir les produits', cta2Text: 'Résultats labo', statsJson: JSON.stringify([{ value: '99%+', label: 'Pureté' }, { value: '500+', label: 'Produits' }, { value: '24h', label: 'Livraison rapide' }, { value: 'COA', label: 'Testé en labo' }]) },
  es: { badgeText: 'Péptidos Grado Investigación', title: 'Los Mejores Péptidos de Investigación en Canadá', subtitle: 'Compuestos de investigación de calidad premium con pureza del 99%+, verificados por laboratorios independientes.', ctaText: 'Ver productos', cta2Text: 'Resultados de laboratorio', statsJson: JSON.stringify([{ value: '99%+', label: 'Pureza' }, { value: '500+', label: 'Productos' }, { value: '24h', label: 'Envío rápido' }, { value: 'COA', label: 'Probado en laboratorio' }]) },
  de: { badgeText: 'Forschungsqualität Peptide', title: 'Die besten Forschungspeptide in Kanada', subtitle: 'Premium-Forschungsverbindungen mit 99%+ Reinheit, verifiziert durch unabhängige Drittlabore.', ctaText: 'Produkte ansehen', cta2Text: 'Laborergebnisse', statsJson: JSON.stringify([{ value: '99%+', label: 'Reinheit' }, { value: '500+', label: 'Produkte' }, { value: '24h', label: 'Schneller Versand' }, { value: 'COA', label: 'Laborgetestet' }]) },
  it: { badgeText: 'Peptidi Grado Ricerca', title: 'I Migliori Peptidi di Ricerca in Canada', subtitle: 'Composti di ricerca di qualità premium con purezza del 99%+, verificati da laboratori indipendenti.', ctaText: 'Vedi prodotti', cta2Text: 'Risultati di laboratorio', statsJson: JSON.stringify([{ value: '99%+', label: 'Purezza' }, { value: '500+', label: 'Prodotti' }, { value: '24h', label: 'Spedizione rapida' }, { value: 'COA', label: 'Testato in laboratorio' }]) },
  pt: { badgeText: 'Peptídeos Grau Pesquisa', title: 'Os Melhores Peptídeos de Pesquisa no Canadá', subtitle: 'Compostos de pesquisa de qualidade premium com pureza de 99%+, verificados por laboratórios independentes.', ctaText: 'Ver produtos', cta2Text: 'Resultados laboratoriais', statsJson: JSON.stringify([{ value: '99%+', label: 'Pureza' }, { value: '500+', label: 'Produtos' }, { value: '24h', label: 'Envio rápido' }, { value: 'COA', label: 'Testado em laboratório' }]) },
  ru: { badgeText: 'Пептиды исследовательского класса', title: 'Лучшие исследовательские пептиды в Канаде', subtitle: 'Исследовательские соединения премиум-качества с чистотой 99%+, проверенные независимыми лабораториями.', ctaText: 'Смотреть продукты', cta2Text: 'Результаты лаборатории', statsJson: JSON.stringify([{ value: '99%+', label: 'Чистота' }, { value: '500+', label: 'Продукты' }, { value: '24ч', label: 'Быстрая доставка' }, { value: 'COA', label: 'Проверено в лаборатории' }]) },
  zh: { badgeText: '研究级肽', title: '加拿大最优质的研究肽', subtitle: '优质研究化合物，纯度99%以上，经独立第三方实验室验证。加拿大全境快速配送。', ctaText: '查看产品', cta2Text: '实验室结果', statsJson: JSON.stringify([{ value: '99%+', label: '纯度' }, { value: '500+', label: '产品' }, { value: '24小时', label: '快速配送' }, { value: 'COA', label: '实验室检测' }]) },
  ko: { badgeText: '연구용 펩타이드', title: '캐나다 최고의 연구용 펩타이드', subtitle: '독립 제3자 연구소에서 검증된 99%+ 순도의 프리미엄 연구 화합물. 캐나다 전역 빠른 배송.', ctaText: '제품 보기', cta2Text: '실험실 결과', statsJson: JSON.stringify([{ value: '99%+', label: '순도' }, { value: '500+', label: '제품' }, { value: '24시간', label: '빠른 배송' }, { value: 'COA', label: '실험실 테스트' }]) },
  ar: { badgeText: 'ببتيدات بحثية', title: 'أفضل ببتيدات البحث في كندا', subtitle: 'مركبات بحثية عالية الجودة بنقاء 99%+، تم التحقق منها من قبل مختبرات مستقلة.', ctaText: 'عرض المنتجات', cta2Text: 'نتائج المختبر', statsJson: JSON.stringify([{ value: '99%+', label: 'النقاء' }, { value: '500+', label: 'المنتجات' }, { value: '24 ساعة', label: 'شحن سريع' }, { value: 'COA', label: 'مختبر معتمد' }]) },
  pl: { badgeText: 'Peptydy klasy badawczej', title: 'Najlepsze peptydy badawcze w Kanadzie', subtitle: 'Wysokiej jakości związki badawcze o czystości 99%+, zweryfikowane przez niezależne laboratoria.', ctaText: 'Zobacz produkty', cta2Text: 'Wyniki laboratorium', statsJson: JSON.stringify([{ value: '99%+', label: 'Czystość' }, { value: '500+', label: 'Produkty' }, { value: '24h', label: 'Szybka wysyłka' }, { value: 'COA', label: 'Przetestowane' }]) },
  sv: { badgeText: 'Forskningskvalitet peptider', title: 'De bästa forskningspeptiderna i Kanada', subtitle: 'Premiumkvalitetsforskningsföreningar med 99%+ renhet, verifierade av oberoende tredjepartslaboratorier.', ctaText: 'Visa produkter', cta2Text: 'Labbresultat', statsJson: JSON.stringify([{ value: '99%+', label: 'Renhet' }, { value: '500+', label: 'Produkter' }, { value: '24h', label: 'Snabb leverans' }, { value: 'COA', label: 'Labbtestad' }]) },
  hi: { badgeText: 'अनुसंधान ग्रेड पेप्टाइड्स', title: 'कनाडा में सर्वश्रेष्ठ अनुसंधान पेप्टाइड्स', subtitle: '99%+ शुद्धता के साथ प्रीमियम गुणवत्ता अनुसंधान यौगिक, स्वतंत्र प्रयोगशालाओं द्वारा सत्यापित।', ctaText: 'उत्पाद देखें', cta2Text: 'लैब परिणाम', statsJson: JSON.stringify([{ value: '99%+', label: 'शुद्धता' }, { value: '500+', label: 'उत्पाद' }, { value: '24 घंटे', label: 'तेज़ शिपिंग' }, { value: 'COA', label: 'लैब परीक्षित' }]) },
  vi: { badgeText: 'Peptide nghiên cứu', title: 'Peptide nghiên cứu tốt nhất tại Canada', subtitle: 'Hợp chất nghiên cứu chất lượng cao với độ tinh khiết 99%+, được xác minh bởi phòng thí nghiệm độc lập.', ctaText: 'Xem sản phẩm', cta2Text: 'Kết quả phòng thí nghiệm', statsJson: JSON.stringify([{ value: '99%+', label: 'Độ tinh khiết' }, { value: '500+', label: 'Sản phẩm' }, { value: '24h', label: 'Giao hàng nhanh' }, { value: 'COA', label: 'Đã kiểm tra' }]) },
  tl: { badgeText: 'Research Grade Peptides', title: 'Ang Pinakamahusay na Research Peptides sa Canada', subtitle: 'Premium na kalidad na mga compound sa pananaliksik na may 99%+ na kadalisayan, na-verify ng mga independiyenteng laboratoryo.', ctaText: 'Tingnan ang mga produkto', cta2Text: 'Mga resulta ng lab', statsJson: JSON.stringify([{ value: '99%+', label: 'Kadalisayan' }, { value: '500+', label: 'Mga Produkto' }, { value: '24h', label: 'Mabilis na pagpapadala' }, { value: 'COA', label: 'Na-test sa lab' }]) },
  ta: { badgeText: 'ஆராய்ச்சி தர பெப்டைடுகள்', title: 'கனடாவின் சிறந்த ஆராய்ச்சி பெப்டைடுகள்', subtitle: '99%+ தூய்மையுடன் உயர்தர ஆராய்ச்சி கலவைகள், சுயாதீன ஆய்வகங்களால் சரிபார்க்கப்பட்டது.', ctaText: 'பொருட்களைக் காண்க', cta2Text: 'ஆய்வக முடிவுகள்', statsJson: JSON.stringify([{ value: '99%+', label: 'தூய்மை' }, { value: '500+', label: 'பொருட்கள்' }, { value: '24 மணி', label: 'விரைவான அனுப்புதல்' }, { value: 'COA', label: 'ஆய்வகம் சோதித்தது' }]) },
  pa: { badgeText: 'ਖੋਜ ਗ੍ਰੇਡ ਪੈਪਟਾਈਡਜ਼', title: 'ਕੈਨੇਡਾ ਵਿੱਚ ਸਭ ਤੋਂ ਵਧੀਆ ਖੋਜ ਪੈਪਟਾਈਡਜ਼', subtitle: '99%+ ਸ਼ੁੱਧਤਾ ਦੇ ਨਾਲ ਪ੍ਰੀਮੀਅਮ ਗੁਣਵੱਤਾ ਖੋਜ ਮਿਸ਼ਰਣ, ਸੁਤੰਤਰ ਪ੍ਰਯੋਗਸ਼ਾਲਾਵਾਂ ਦੁਆਰਾ ਪ੍ਰਮਾਣਿਤ।', ctaText: 'ਉਤਪਾਦ ਵੇਖੋ', cta2Text: 'ਲੈਬ ਨਤੀਜੇ', statsJson: JSON.stringify([{ value: '99%+', label: 'ਸ਼ੁੱਧਤਾ' }, { value: '500+', label: 'ਉਤਪਾਦ' }, { value: '24 ਘੰਟੇ', label: 'ਤੇਜ਼ ਸ਼ਿਪਿੰਗ' }, { value: 'COA', label: 'ਲੈਬ ਟੈਸਟ' }]) },
  ht: { badgeText: 'Peptid kalite rechèch', title: 'Pi bon peptid rechèch nan Kanada', subtitle: 'Konpoze rechèch premyòm kalite ak 99%+ pirite, verifye pa laboratwa endepandan.', ctaText: 'Wè pwodwi yo', cta2Text: 'Rezilta laboratwa', statsJson: JSON.stringify([{ value: '99%+', label: 'Pirite' }, { value: '500+', label: 'Pwodwi' }, { value: '24è', label: 'Livrezon rapid' }, { value: 'COA', label: 'Teste nan laboratwa' }]) },
  gcr: { badgeText: 'Peptid kalité réchèch', title: 'Pi bon peptid réchèch an Kanada', subtitle: 'Konpozé réchèch prémyòm kalité épi 99%+ pirité, vérifié pa laboratwa endépandan.', ctaText: 'Wè pwodwi-ya', cta2Text: 'Rézilta laboratwa', statsJson: JSON.stringify([{ value: '99%+', label: 'Pirité' }, { value: '500+', label: 'Pwodwi' }, { value: '24è', label: 'Livrézon rapid' }, { value: 'COA', label: 'Tèsté nan laboratwa' }]) },
  'ar-dz': { badgeText: 'ببتيدات بحثية', title: 'أفضل ببتيدات البحث في كندا', subtitle: 'مركبات بحثية عالية الجودة بنقاء 99%+، تم التحقق منها من قبل مختبرات مستقلة.', ctaText: 'شوف المنتوجات', cta2Text: 'نتائج المخبر', statsJson: JSON.stringify([{ value: '99%+', label: 'النقاء' }, { value: '500+', label: 'المنتوجات' }, { value: '24 ساعة', label: 'شحن سريع' }, { value: 'COA', label: 'مخبر معتمد' }]) },
  'ar-lb': { badgeText: 'ببتيدات بحثية', title: 'أفضل ببتيدات البحث بكندا', subtitle: 'مركبات بحثية عالية الجودة بنقاء 99%+، تم التحقق منها من قبل مختبرات مستقلة.', ctaText: 'شوف المنتجات', cta2Text: 'نتائج المختبر', statsJson: JSON.stringify([{ value: '99%+', label: 'النقاء' }, { value: '500+', label: 'المنتجات' }, { value: '24 ساعة', label: 'شحن سريع' }, { value: 'COA', label: 'مختبر معتمد' }]) },
  'ar-ma': { badgeText: 'ببتيدات بحثية', title: 'أحسن ببتيدات البحث فكندا', subtitle: 'مركبات بحثية ديال الجودة العالية بنقاء 99%+، تم التحقق منها من قبل مختبرات مستقلة.', ctaText: 'شوف المنتوجات', cta2Text: 'نتائج المختبر', statsJson: JSON.stringify([{ value: '99%+', label: 'النقاء' }, { value: '500+', label: 'المنتوجات' }, { value: '24 ساعة', label: 'شحن سريع' }, { value: 'COA', label: 'مختبر معتمد' }]) },
};

// ===== SLIDE 2: Rewards =====
const slide2 = {
  slug: 'rewards',
  mediaType: 'IMAGE' as const,
  backgroundUrl: 'https://images.unsplash.com/photo-1553729459-afe8f2e2ed65?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
  overlayOpacity: 75,
  overlayGradient: 'from-black/85 via-black/70 to-black/55',
  badgeText: 'Loyalty Program',
  title: 'Rewards Program',
  subtitle: 'Earn points on every purchase. Redeem for discounts, free products, and exclusive perks.',
  ctaText: 'Learn More',
  ctaUrl: '/rewards',
  ctaStyle: 'primary',
  sortOrder: 1,
  isActive: true,
};

const slide2Translations: Record<string, { badgeText: string; title: string; subtitle: string; ctaText: string }> = {
  en: { badgeText: 'Loyalty Program', title: 'Rewards Program', subtitle: 'Earn points on every purchase. Redeem for discounts, free products, and exclusive perks.', ctaText: 'Learn More' },
  fr: { badgeText: 'Programme de fidélité', title: 'Programme de récompenses', subtitle: 'Gagnez des points à chaque achat. Échangez-les contre des réductions, produits gratuits et avantages exclusifs.', ctaText: 'En savoir plus' },
  es: { badgeText: 'Programa de fidelidad', title: 'Programa de recompensas', subtitle: 'Gana puntos en cada compra. Canjéalos por descuentos, productos gratis y beneficios exclusivos.', ctaText: 'Más información' },
  de: { badgeText: 'Treueprogramm', title: 'Belohnungsprogramm', subtitle: 'Sammeln Sie Punkte bei jedem Einkauf. Lösen Sie sie gegen Rabatte und exklusive Vorteile ein.', ctaText: 'Mehr erfahren' },
  it: { badgeText: 'Programma fedeltà', title: 'Programma premi', subtitle: 'Guadagna punti ad ogni acquisto. Riscattali per sconti, prodotti gratuiti e vantaggi esclusivi.', ctaText: 'Scopri di più' },
  pt: { badgeText: 'Programa de fidelidade', title: 'Programa de recompensas', subtitle: 'Ganhe pontos em cada compra. Troque por descontos, produtos grátis e vantagens exclusivas.', ctaText: 'Saiba mais' },
  ru: { badgeText: 'Программа лояльности', title: 'Программа вознаграждений', subtitle: 'Зарабатывайте баллы при каждой покупке. Обменивайте на скидки и эксклюзивные привилегии.', ctaText: 'Узнать больше' },
  zh: { badgeText: '忠诚计划', title: '奖励计划', subtitle: '每次购买都能赚取积分。兑换折扣、免费产品和专属福利。', ctaText: '了解更多' },
  ko: { badgeText: '로열티 프로그램', title: '보상 프로그램', subtitle: '모든 구매에서 포인트를 적립하세요. 할인, 무료 제품 및 독점 혜택으로 교환하세요.', ctaText: '자세히 알아보기' },
  ar: { badgeText: 'برنامج الولاء', title: 'برنامج المكافآت', subtitle: 'اكسب نقاطاً عند كل عملية شراء. استبدلها بخصومات ومنتجات مجانية ومزايا حصرية.', ctaText: 'اعرف المزيد' },
  pl: { badgeText: 'Program lojalnościowy', title: 'Program nagród', subtitle: 'Zdobywaj punkty przy każdym zakupie. Wymieniaj je na zniżki i ekskluzywne korzyści.', ctaText: 'Dowiedz się więcej' },
  sv: { badgeText: 'Lojalitetsprogram', title: 'Belöningsprogram', subtitle: 'Tjäna poäng vid varje köp. Lös in mot rabatter, gratisprodukter och exklusiva förmåner.', ctaText: 'Läs mer' },
  hi: { badgeText: 'वफादारी कार्यक्रम', title: 'पुरस्कार कार्यक्रम', subtitle: 'हर खरीदारी पर अंक अर्जित करें। छूट, मुफ्त उत्पादों और विशेष लाभों के लिए भुनाएं।', ctaText: 'और जानें' },
  vi: { badgeText: 'Chương trình khách hàng thân thiết', title: 'Chương trình phần thưởng', subtitle: 'Tích điểm mỗi lần mua hàng. Đổi lấy giảm giá, sản phẩm miễn phí và ưu đãi độc quyền.', ctaText: 'Tìm hiểu thêm' },
  tl: { badgeText: 'Programa ng katapatan', title: 'Programa ng mga gantimpala', subtitle: 'Kumita ng mga puntos sa bawat pagbili. I-redeem para sa mga diskwento at mga espesyal na benepisyo.', ctaText: 'Alamin pa' },
  ta: { badgeText: 'விசுவாச திட்டம்', title: 'வெகுமதி திட்டம்', subtitle: 'ஒவ்வொரு கொள்முதலிலும் புள்ளிகள் சம்பாதிக்கவும். தள்ளுபடிகள் மற்றும் சிறப்பு நன்மைகளுக்கு மாற்றவும்.', ctaText: 'மேலும் அறிக' },
  pa: { badgeText: 'ਵਫ਼ਾਦਾਰੀ ਪ੍ਰੋਗਰਾਮ', title: 'ਇਨਾਮ ਪ੍ਰੋਗਰਾਮ', subtitle: 'ਹਰ ਖਰੀਦ \'ਤੇ ਅੰਕ ਕਮਾਓ। ਛੋਟਾਂ ਅਤੇ ਵਿਸ਼ੇਸ਼ ਲਾਭਾਂ ਲਈ ਬਦਲੋ।', ctaText: 'ਹੋਰ ਜਾਣੋ' },
  ht: { badgeText: 'Pwogram fidelite', title: 'Pwogram rekonpans', subtitle: 'Akimile pwen ak chak acha. Echanj yo pou rediksyon, pwodwi gratis ak avantaj eksklizif.', ctaText: 'Aprann plis' },
  gcr: { badgeText: 'Pwogram fidélité', title: 'Pwogram rékonpans', subtitle: 'Akimilé pwen épi chak acha. Échanj yo pou rédisyon, pwodwi gratis ék avantaj éksklizig.', ctaText: 'Aprann plis' },
  'ar-dz': { badgeText: 'برنامج الولاء', title: 'برنامج المكافآت', subtitle: 'اكسب نقاط مع كل عملية شراء. استبدلها بتخفيضات ومزايا حصرية.', ctaText: 'اعرف أكثر' },
  'ar-lb': { badgeText: 'برنامج الولاء', title: 'برنامج المكافآت', subtitle: 'اكسب نقاط مع كل عملية شراء. استبدلها بتخفيضات ومزايا حصرية.', ctaText: 'اعرف أكتر' },
  'ar-ma': { badgeText: 'برنامج الولاء', title: 'برنامج المكافآت', subtitle: 'اكسب نقاط مع كل عملية شراء. بدلها بتخفيضات ومزايا حصرية.', ctaText: 'عرف أكثر' },
};

// ===== SLIDE 3: Subscriptions =====
const slide3 = {
  slug: 'subscriptions',
  mediaType: 'IMAGE' as const,
  backgroundUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
  overlayOpacity: 75,
  overlayGradient: 'from-black/85 via-black/70 to-black/55',
  badgeText: 'Save Up to 20%',
  title: 'Subscribe & Save',
  subtitle: 'Set up recurring deliveries and save up to 20% on your favorite research compounds. Never run out again.',
  ctaText: 'View Subscriptions',
  ctaUrl: '/subscriptions',
  ctaStyle: 'primary',
  sortOrder: 2,
  isActive: true,
};

const slide3Translations: Record<string, { badgeText: string; title: string; subtitle: string; ctaText: string }> = {
  en: { badgeText: 'Save Up to 20%', title: 'Subscribe & Save', subtitle: 'Set up recurring deliveries and save up to 20% on your favorite research compounds. Never run out again.', ctaText: 'View Subscriptions' },
  fr: { badgeText: "Économisez jusqu'à 20%", title: 'Abonnez-vous et économisez', subtitle: "Configurez des livraisons récurrentes et économisez jusqu'à 20% sur vos composés de recherche préférés.", ctaText: 'Voir les abonnements' },
  es: { badgeText: 'Ahorra hasta 20%', title: 'Suscríbete y ahorra', subtitle: 'Configura entregas recurrentes y ahorra hasta un 20% en tus compuestos de investigación favoritos.', ctaText: 'Ver suscripciones' },
  de: { badgeText: 'Sparen Sie bis zu 20%', title: 'Abonnieren & Sparen', subtitle: 'Richten Sie wiederkehrende Lieferungen ein und sparen Sie bis zu 20% bei Ihren Lieblingsverbindungen.', ctaText: 'Abonnements ansehen' },
  it: { badgeText: 'Risparmia fino al 20%', title: 'Abbonati e risparmia', subtitle: 'Configura consegne ricorrenti e risparmia fino al 20% sui tuoi composti di ricerca preferiti.', ctaText: 'Vedi abbonamenti' },
  pt: { badgeText: 'Economize até 20%', title: 'Assine e economize', subtitle: 'Configure entregas recorrentes e economize até 20% nos seus compostos de pesquisa favoritos.', ctaText: 'Ver assinaturas' },
  ru: { badgeText: 'Экономьте до 20%', title: 'Подписка и экономия', subtitle: 'Настройте регулярные доставки и экономьте до 20% на ваших любимых исследовательских соединениях.', ctaText: 'Просмотреть подписки' },
  zh: { badgeText: '节省高达20%', title: '订阅享优惠', subtitle: '设置定期配送，您最喜欢的研究化合物最多可节省20%。', ctaText: '查看订阅' },
  ko: { badgeText: '최대 20% 절약', title: '구독 & 절약', subtitle: '정기 배송을 설정하고 좋아하는 연구 화합물을 최대 20% 절약하세요.', ctaText: '구독 보기' },
  ar: { badgeText: 'وفر حتى 20%', title: 'اشترك ووفر', subtitle: 'قم بإعداد التوصيلات المتكررة ووفر حتى 20% على مركباتك البحثية المفضلة.', ctaText: 'عرض الاشتراكات' },
  pl: { badgeText: 'Oszczędź do 20%', title: 'Subskrybuj i oszczędzaj', subtitle: 'Ustaw cykliczne dostawy i oszczędź do 20% na ulubionych związkach badawczych.', ctaText: 'Zobacz subskrypcje' },
  sv: { badgeText: 'Spara upp till 20%', title: 'Prenumerera & spara', subtitle: 'Ställ in återkommande leveranser och spara upp till 20% på dina favoritforskningsföreningar.', ctaText: 'Visa prenumerationer' },
  hi: { badgeText: '20% तक बचाएं', title: 'सदस्यता लें और बचाएं', subtitle: 'आवर्ती डिलीवरी सेट करें और अपने पसंदीदा अनुसंधान यौगिकों पर 20% तक बचाएं।', ctaText: 'सदस्यताएं देखें' },
  vi: { badgeText: 'Tiết kiệm đến 20%', title: 'Đăng ký & tiết kiệm', subtitle: 'Thiết lập giao hàng định kỳ và tiết kiệm đến 20% cho các hợp chất nghiên cứu yêu thích.', ctaText: 'Xem đăng ký' },
  tl: { badgeText: 'Makatipid ng hanggang 20%', title: 'Mag-subscribe at makatipid', subtitle: 'Mag-set up ng mga paulit-ulit na pagpapadala at makatipid ng hanggang 20%.', ctaText: 'Tingnan ang mga subscription' },
  ta: { badgeText: '20% வரை சேமிக்கவும்', title: 'சந்தா செலுத்தி சேமிக்கவும்', subtitle: 'தொடர்ச்சியான டெலிவரிகளை அமைத்து உங்கள் விருப்பமான ஆராய்ச்சி கலவைகளில் 20% வரை சேமிக்கவும்.', ctaText: 'சந்தாக்களைக் காண்க' },
  pa: { badgeText: '20% ਤੱਕ ਬਚਾਓ', title: 'ਸਬਸਕ੍ਰਾਈਬ ਕਰੋ ਅਤੇ ਬਚਾਓ', subtitle: 'ਆਵਰਤੀ ਡਿਲੀਵਰੀ ਸੈੱਟ ਕਰੋ ਅਤੇ ਆਪਣੇ ਮਨਪਸੰਦ ਖੋਜ ਮਿਸ਼ਰਣਾਂ \'ਤੇ 20% ਤੱਕ ਬਚਾਓ।', ctaText: 'ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਵੇਖੋ' },
  ht: { badgeText: 'Ekonomize jiska 20%', title: 'Abòne epi ekonomize', subtitle: 'Mete livrezon rekilye epi ekonomize jiska 20% sou konpoze rechèch prefere ou yo.', ctaText: 'Wè abònman yo' },
  gcr: { badgeText: 'Ekonomizé jiska 20%', title: 'Abòné épi ekonomizé', subtitle: 'Mèt livrézon rékilyè épi ekonomizé jiska 20% si konpozé réchèch préféré-aw yo.', ctaText: 'Wè abònman-yo' },
  'ar-dz': { badgeText: 'وفر حتى 20%', title: 'اشترك ووفر', subtitle: 'ضع توصيلات متكررة ووفر حتى 20% على المركبات البحثية المفضلة.', ctaText: 'شوف الاشتراكات' },
  'ar-lb': { badgeText: 'وفر حتى 20%', title: 'اشترك ووفر', subtitle: 'ضع توصيلات متكررة ووفر حتى 20% على المركبات البحثية المفضلة.', ctaText: 'شوف الاشتراكات' },
  'ar-ma': { badgeText: 'وفر حتى 20%', title: 'اشترك ووفر', subtitle: 'دير توصيلات متكررة ووفر حتى 20% على المركبات البحثية المفضلة.', ctaText: 'شوف الاشتراكات' },
};

// ===== SLIDE 4: Videos =====
const slide4 = {
  slug: 'videos',
  mediaType: 'IMAGE' as const,
  backgroundUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
  overlayOpacity: 75,
  overlayGradient: 'from-black/85 via-black/70 to-black/55',
  badgeText: 'Educational Content',
  title: 'Educational Videos',
  subtitle: 'Watch our library of educational videos covering peptide research, proper handling techniques, and scientific insights.',
  ctaText: 'Watch Now',
  ctaUrl: '/videos',
  ctaStyle: 'primary',
  sortOrder: 3,
  isActive: true,
};

const slide4Translations: Record<string, { badgeText: string; title: string; subtitle: string; ctaText: string }> = {
  en: { badgeText: 'Educational Content', title: 'Educational Videos', subtitle: 'Watch our library of educational videos covering peptide research, proper handling techniques, and scientific insights.', ctaText: 'Watch Now' },
  fr: { badgeText: 'Contenu éducatif', title: 'Vidéos éducatives', subtitle: 'Regardez notre bibliothèque de vidéos éducatives couvrant la recherche sur les peptides, les techniques de manipulation et les perspectives scientifiques.', ctaText: 'Regarder' },
  es: { badgeText: 'Contenido educativo', title: 'Videos educativos', subtitle: 'Mira nuestra biblioteca de videos educativos sobre investigación de péptidos y técnicas de manejo.', ctaText: 'Ver ahora' },
  de: { badgeText: 'Bildungsinhalte', title: 'Lehrvideos', subtitle: 'Sehen Sie unsere Bibliothek mit Lehrvideos über Peptidforschung und Handhabungstechniken.', ctaText: 'Jetzt ansehen' },
  it: { badgeText: 'Contenuti educativi', title: 'Video educativi', subtitle: 'Guarda la nostra libreria di video educativi sulla ricerca peptidica e le tecniche di manipolazione.', ctaText: 'Guarda ora' },
  pt: { badgeText: 'Conteúdo educacional', title: 'Vídeos educacionais', subtitle: 'Assista à nossa biblioteca de vídeos educacionais sobre pesquisa de peptídeos e técnicas de manuseio.', ctaText: 'Assistir agora' },
  ru: { badgeText: 'Образовательный контент', title: 'Обучающие видео', subtitle: 'Смотрите нашу библиотеку обучающих видео об исследовании пептидов и методах обработки.', ctaText: 'Смотреть' },
  zh: { badgeText: '教育内容', title: '教育视频', subtitle: '观看我们的教育视频库，涵盖肽研究、正确处理技术和科学见解。', ctaText: '立即观看' },
  ko: { badgeText: '교육 콘텐츠', title: '교육 비디오', subtitle: '펩타이드 연구, 올바른 취급 기술 및 과학적 통찰력을 다루는 교육 비디오를 시청하세요.', ctaText: '지금 보기' },
  ar: { badgeText: 'محتوى تعليمي', title: 'فيديوهات تعليمية', subtitle: 'شاهد مكتبتنا من الفيديوهات التعليمية حول أبحاث الببتيدات وتقنيات التعامل الصحيحة.', ctaText: 'شاهد الآن' },
  pl: { badgeText: 'Treści edukacyjne', title: 'Filmy edukacyjne', subtitle: 'Obejrzyj naszą bibliotekę filmów edukacyjnych dotyczących badań peptydów i technik obsługi.', ctaText: 'Oglądaj teraz' },
  sv: { badgeText: 'Utbildningsinnehåll', title: 'Utbildningsvideor', subtitle: 'Titta på vårt bibliotek med utbildningsvideor om peptidforskning och hanteringstekniker.', ctaText: 'Titta nu' },
  hi: { badgeText: 'शैक्षिक सामग्री', title: 'शैक्षिक वीडियो', subtitle: 'पेप्टाइड अनुसंधान और उचित हैंडलिंग तकनीकों पर हमारी शैक्षिक वीडियो लाइब्रेरी देखें।', ctaText: 'अभी देखें' },
  vi: { badgeText: 'Nội dung giáo dục', title: 'Video giáo dục', subtitle: 'Xem thư viện video giáo dục của chúng tôi về nghiên cứu peptide và kỹ thuật xử lý.', ctaText: 'Xem ngay' },
  tl: { badgeText: 'Pang-edukasyong nilalaman', title: 'Mga pang-edukasyong video', subtitle: 'Panoorin ang aming library ng mga pang-edukasyong video tungkol sa pananaliksik ng peptide.', ctaText: 'Panoorin ngayon' },
  ta: { badgeText: 'கல்வி உள்ளடக்கம்', title: 'கல்வி வீடியோக்கள்', subtitle: 'பெப்டைடு ஆராய்ச்சி மற்றும் சரியான கையாளுதல் நுட்பங்கள் பற்றிய எங்கள் கல்வி வீடியோ நூலகத்தைப் பாருங்கள்.', ctaText: 'இப்போது பாருங்கள்' },
  pa: { badgeText: 'ਵਿੱਦਿਅਕ ਸਮੱਗਰੀ', title: 'ਵਿੱਦਿਅਕ ਵੀਡੀਓ', subtitle: 'ਪੈਪਟਾਈਡ ਖੋਜ ਅਤੇ ਸਹੀ ਹੈਂਡਲਿੰਗ ਤਕਨੀਕਾਂ ਬਾਰੇ ਸਾਡੀ ਵਿੱਦਿਅਕ ਵੀਡੀਓ ਲਾਇਬ੍ਰੇਰੀ ਦੇਖੋ।', ctaText: 'ਹੁਣੇ ਦੇਖੋ' },
  ht: { badgeText: 'Kontni edikasyon', title: 'Videyo edikasyon', subtitle: 'Gade bibliyotèk videyo edikasyon nou yo sou rechèch peptid ak teknik manipilasyon.', ctaText: 'Gade kounye a' },
  gcr: { badgeText: 'Kontni édikasyon', title: 'Vidéyo édikasyon', subtitle: 'Gadé bibliyotèk vidéyo édikasyon nou-an yo si réchèch peptid ék teknik manipilasyon.', ctaText: 'Gadé kounnyé-a' },
  'ar-dz': { badgeText: 'محتوى تعليمي', title: 'فيديوهات تعليمية', subtitle: 'شاهد مكتبتنا من الفيديوهات التعليمية حول أبحاث الببتيدات.', ctaText: 'شاهد دلوقتي' },
  'ar-lb': { badgeText: 'محتوى تعليمي', title: 'فيديوهات تعليمية', subtitle: 'شاهد مكتبتنا من الفيديوهات التعليمية حول أبحاث الببتيدات.', ctaText: 'شاهد هلأ' },
  'ar-ma': { badgeText: 'محتوى تعليمي', title: 'فيديوهات تعليمية', subtitle: 'شوف مكتبتنا ديال الفيديوهات التعليمية على أبحاث الببتيدات.', ctaText: 'شوف دابا' },
};

// ===== SLIDE 5: Learn =====
const slide5 = {
  slug: 'learn',
  mediaType: 'IMAGE' as const,
  backgroundUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
  overlayOpacity: 75,
  overlayGradient: 'from-black/85 via-black/70 to-black/55',
  badgeText: 'Knowledge Base',
  title: 'Learning Center',
  subtitle: 'Explore our comprehensive guides, articles, and research papers on peptide science and applications.',
  ctaText: 'Explore',
  ctaUrl: '/learn',
  ctaStyle: 'primary',
  sortOrder: 4,
  isActive: true,
};

const slide5Translations: Record<string, { badgeText: string; title: string; subtitle: string; ctaText: string }> = {
  en: { badgeText: 'Knowledge Base', title: 'Learning Center', subtitle: 'Explore our comprehensive guides, articles, and research papers on peptide science and applications.', ctaText: 'Explore' },
  fr: { badgeText: 'Base de connaissances', title: "Centre d'apprentissage", subtitle: 'Explorez nos guides complets, articles et documents de recherche sur la science des peptides.', ctaText: 'Explorer' },
  es: { badgeText: 'Base de conocimientos', title: 'Centro de aprendizaje', subtitle: 'Explora nuestras guías completas, artículos e investigaciones sobre ciencia de péptidos.', ctaText: 'Explorar' },
  de: { badgeText: 'Wissensdatenbank', title: 'Lernzentrum', subtitle: 'Erkunden Sie unsere umfassenden Leitfäden, Artikel und Forschungsarbeiten über Peptidwissenschaft.', ctaText: 'Erkunden' },
  it: { badgeText: 'Base di conoscenza', title: 'Centro di apprendimento', subtitle: 'Esplora le nostre guide complete, articoli e documenti di ricerca sulla scienza dei peptidi.', ctaText: 'Esplora' },
  pt: { badgeText: 'Base de conhecimento', title: 'Centro de aprendizagem', subtitle: 'Explore nossos guias completos, artigos e trabalhos de pesquisa sobre ciência de peptídeos.', ctaText: 'Explorar' },
  ru: { badgeText: 'База знаний', title: 'Учебный центр', subtitle: 'Исследуйте наши подробные руководства, статьи и научные работы о пептидной науке.', ctaText: 'Исследовать' },
  zh: { badgeText: '知识库', title: '学习中心', subtitle: '探索我们关于肽科学和应用的综合指南、文章和研究论文。', ctaText: '探索' },
  ko: { badgeText: '지식 기반', title: '학습 센터', subtitle: '펩타이드 과학 및 응용에 대한 종합 가이드, 기사 및 연구 논문을 탐색하세요.', ctaText: '탐색' },
  ar: { badgeText: 'قاعدة المعرفة', title: 'مركز التعلم', subtitle: 'استكشف أدلتنا الشاملة والمقالات والأوراق البحثية حول علم الببتيدات وتطبيقاته.', ctaText: 'استكشف' },
  pl: { badgeText: 'Baza wiedzy', title: 'Centrum nauki', subtitle: 'Przeglądaj nasze kompleksowe przewodniki, artykuły i prace naukowe o nauce peptydów.', ctaText: 'Eksploruj' },
  sv: { badgeText: 'Kunskapsbas', title: 'Inlärningscenter', subtitle: 'Utforska våra omfattande guider, artiklar och forskningsartiklar om peptidvetenskap.', ctaText: 'Utforska' },
  hi: { badgeText: 'ज्ञान आधार', title: 'सीखने का केंद्र', subtitle: 'पेप्टाइड विज्ञान और अनुप्रयोगों पर हमारे व्यापक गाइड, लेख और शोध पत्रों का अन्वेषण करें।', ctaText: 'अन्वेषण करें' },
  vi: { badgeText: 'Cơ sở kiến thức', title: 'Trung tâm học tập', subtitle: 'Khám phá hướng dẫn toàn diện, bài viết và tài liệu nghiên cứu về khoa học peptide.', ctaText: 'Khám phá' },
  tl: { badgeText: 'Base ng kaalaman', title: 'Learning Center', subtitle: 'I-explore ang aming mga komprehensibong gabay, artikulo at pananaliksik tungkol sa agham ng peptide.', ctaText: 'I-explore' },
  ta: { badgeText: 'அறிவுத் தளம்', title: 'கற்றல் மையம்', subtitle: 'பெப்டைடு அறிவியல் மற்றும் பயன்பாடுகள் பற்றிய எங்கள் விரிவான வழிகாட்டிகள் மற்றும் ஆராய்ச்சிக் கட்டுரைகளை ஆராயுங்கள்.', ctaText: 'ஆராயுங்கள்' },
  pa: { badgeText: 'ਗਿਆਨ ਅਧਾਰ', title: 'ਸਿੱਖਣ ਕੇਂਦਰ', subtitle: 'ਪੈਪਟਾਈਡ ਵਿਗਿਆਨ ਅਤੇ ਐਪਲੀਕੇਸ਼ਨਾਂ ਬਾਰੇ ਸਾਡੇ ਵਿਆਪਕ ਗਾਈਡ, ਲੇਖ ਅਤੇ ਖੋਜ ਪੱਤਰ ਖੋਜੋ।', ctaText: 'ਖੋਜੋ' },
  ht: { badgeText: 'Baz konesans', title: 'Sant aprantisaj', subtitle: 'Eksplore gid konplè, atik ak papye rechèch nou yo sou syans peptid.', ctaText: 'Eksplore' },
  gcr: { badgeText: 'Baz konésans', title: 'Sant aprantisaj', subtitle: 'Eksploré gid konplè, atik ék papyé réchèch nou-an yo si syans peptid.', ctaText: 'Eksploré' },
  'ar-dz': { badgeText: 'قاعدة المعرفة', title: 'مركز التعلم', subtitle: 'استكشف أدلتنا الشاملة والمقالات حول علم الببتيدات.', ctaText: 'استكشف' },
  'ar-lb': { badgeText: 'قاعدة المعرفة', title: 'مركز التعلم', subtitle: 'استكشف أدلتنا الشاملة والمقالات حول علم الببتيدات.', ctaText: 'استكشف' },
  'ar-ma': { badgeText: 'قاعدة المعرفة', title: 'مركز التعلم', subtitle: 'استكشف الأدلة الشاملة والمقالات ديالنا على علم الببتيدات.', ctaText: 'استكشف' },
};

async function main() {
  console.log('Seeding Hero Slides...');

  const slides = [
    { data: slide1, translations: slide1Translations },
    { data: slide2, translations: slide2Translations },
    { data: slide3, translations: slide3Translations },
    { data: slide4, translations: slide4Translations },
    { data: slide5, translations: slide5Translations },
  ];

  let slideCount = 0;
  let translationCount = 0;

  for (const { data, translations } of slides) {
    // Upsert slide
    const slide = await prisma.heroSlide.upsert({
      where: { slug: data.slug },
      update: { ...data },
      create: { ...data },
    });

    slideCount++;

    // Upsert translations
    for (const locale of LOCALES) {
      const tr = translations[locale];
      if (!tr) continue;

      await prisma.heroSlideTranslation.upsert({
        where: { slideId_locale: { slideId: slide.id, locale } },
        update: {
          badgeText: tr.badgeText,
          title: tr.title,
          subtitle: tr.subtitle,
          ctaText: tr.ctaText,
          cta2Text: 'cta2Text' in tr ? (tr as Record<string, unknown>).cta2Text as string | undefined : undefined,
          statsJson: 'statsJson' in tr ? (tr as Record<string, unknown>).statsJson as string | undefined : undefined,
        },
        create: {
          slideId: slide.id,
          locale,
          badgeText: tr.badgeText,
          title: tr.title,
          subtitle: tr.subtitle,
          ctaText: tr.ctaText,
          cta2Text: 'cta2Text' in tr ? (tr as Record<string, unknown>).cta2Text as string | undefined : undefined,
          statsJson: 'statsJson' in tr ? (tr as Record<string, unknown>).statsJson as string | undefined : undefined,
        },
      });

      translationCount++;
    }

    console.log(`  ✓ Slide "${data.slug}" seeded with ${LOCALES.length} translations`);
  }

  console.log(`\nDone! ${slideCount} slides + ${translationCount} translations seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
