#!/usr/bin/env python3
"""
Script to complete missing translations in all locale files
"""
import json
import os

# Translations for all missing keys by language
TRANSLATIONS = {
    # Italian translations
    "it": {
        "subscriptions": {
            "faqTitle": "FAQ Abbonamenti",
            "faq1Q": "Posso annullare in qualsiasi momento?",
            "faq1A": "Sì! Puoi annullare, mettere in pausa o modificare il tuo abbonamento in qualsiasi momento senza penalità.",
            "faq2Q": "Come funziona lo sconto?",
            "faq2A": "Più ordini frequentemente, più risparmi. Le consegne settimanali risparmiano il 20%, quelle mensili il 10%.",
            "faq3Q": "Posso saltare una consegna?",
            "faq3A": "Assolutamente. Puoi saltare singole consegne o mettere in pausa temporaneamente il tuo abbonamento.",
            "faq4Q": "Guadagnerò punti fedeltà?",
            "faq4A": "Sì! Guadagni tutti i punti fedeltà sugli ordini in abbonamento, più 200 punti bonus per consegna."
        },
        "videos": {
            "calculator": "Calcolatrice",
            "labResults": "Risultati di laboratorio"
        },
        "community": {
            "questionPlaceholder": "Qual è la tua domanda o argomento?",
            "contentPlaceholder": "Condividi i tuoi pensieri, domande o esperienze...",
            "tagsPlaceholder": "es: bpc-157, ricostituzione, principiante"
        },
        "webinars": {
            "recordings": "Registrazioni",
            "always": "Sempre",
            "enterEmail": "Inserisci la tua email",
            "registerWebinar": "Registrati al Webinar",
            "receiveConfirmation": "Riceverai un'email di conferma a",
            "withWebinarLink": "con il link del webinar.",
            "confirmRegistration": "Conferma Registrazione",
            "signInToRegister": "Accedi per Registrarti",
            "signInRequired": "Accedi per registrarti a questo webinar.",
            "education": "Formazione",
            "tutorial": "Tutorial",
            "bestPractices": "Best Practice"
        },
        "ambassador": {
            "applyDesc": "Compila il nostro semplice modulo di candidatura",
            "approveDesc": "Esaminiamo le candidature entro 48 ore",
            "shareDesc": "Usa il tuo link unico per promuovere i prodotti",
            "earnDesc": "Ricevi pagamenti mensili per ogni vendita",
            "commission": "commissione",
            "referrals": "referral",
            "mostPopular": "Più Popolare",
            "nextTier": "Prossimo livello",
            "moreReferralsNeeded": "altri referral necessari",
            "yourReferralLink": "Il Tuo Link di Referral",
            "backToOverview": "Torna alla Panoramica",
            "applyToBecome": "Candidati per Diventare Ambasciatore",
            "websiteUrl": "URL Sito Web o Blog",
            "socialProfiles": "Profili Social Media",
            "estimatedFollowers": "Numero Stimato di Follower/Pubblico",
            "whyJoin": "Perché vuoi unirti al nostro programma?",
            "promotionPlan": "Come pensi di promuovere i nostri prodotti?",
            "termsNote": "Candidandoti, accetti i nostri Termini e Condizioni Ambasciatore. Esaminiamo tutte le candidature manualmente e risponderemo entro 48 ore.",
            "upTo20Commission": "Fino al 20% di Commissione",
            "freeProducts": "Prodotti Gratuiti",
            "passiveIncome": "Reddito Passivo",
            "exclusivePerks": "Vantaggi Esclusivi",
            "faq1Q": "Come vengo pagato?",
            "faq1A": "I pagamenti vengono effettuati mensilmente tramite PayPal o bonifico bancario per guadagni superiori a $50.",
            "faq2Q": "C'è una dimensione minima del pubblico?",
            "faq2A": "Nessun minimo richiesto! Accogliamo ambasciatori di tutte le dimensioni appassionati di ricerca sui peptidi.",
            "faq3Q": "Posso promuovere su qualsiasi piattaforma?",
            "faq3A": "Sì! Blog, YouTube, Instagram, TikTok, mailing list - ovunque sia il tuo pubblico.",
            "faq4Q": "Quanto dura il cookie?",
            "faq4A": "Il nostro cookie di tracciamento dura 30 giorni, quindi ricevi credito per le vendite entro quella finestra.",
            "faq5Q": "Devo prima essere un cliente?",
            "faq5A": "Anche se non è richiesto, aiuta! Le raccomandazioni autentiche degli utenti funzionano meglio.",
            "faq6Q": "Quali materiali di marketing fornite?",
            "faq6A": "Forniamo banner, immagini di prodotti, modelli email e contenuti per social media."
        },
        "account": {
            "emailReadOnly": "L'email non può essere modificata",
            "oauthPassword": "La tua password è gestita dal provider di accesso social",
            "streetAddress": "Indirizzo",
            "city": "Città",
            "province": "Provincia/Stato",
            "postalCode": "CAP",
            "country": "Paese",
            "saveAddress": "Salva Indirizzo",
            "dangerZone": "Zona Pericolosa",
            "deleteAccount": "Elimina Account",
            "deleteAccountDesc": "Una volta eliminato, tutti i tuoi dati saranno rimossi permanentemente. Questa azione non può essere annullata.",
            "requestDeletion": "Richiedi Eliminazione Account",
            "reordering": "Riordinando...",
            "orderNumber": "Ordine #",
            "orderDate": "Data Ordine",
            "orderStatus": "Stato",
            "orderTotal": "Totale",
            "viewDetails": "Visualizza Dettagli",
            "hideDetails": "Nascondi Dettagli",
            "shippingAddress": "Indirizzo di Spedizione",
            "trackingNumber": "Numero di Tracciamento",
            "orderItems": "Articoli Ordine",
            "subtotal": "Subtotale",
            "tax": "Tasse",
            "shipping": "Spedizione",
            "statusPending": "In Attesa",
            "statusProcessing": "In Elaborazione",
            "statusShipped": "Spedito",
            "statusDelivered": "Consegnato",
            "statusCancelled": "Annullato",
            "profileUpdated": "Profilo aggiornato con successo",
            "passwordUpdated": "Password aggiornata con successo",
            "addressSaved": "Indirizzo salvato con successo",
            "deleteConfirm": "Sei sicuro di voler eliminare il tuo account? Questa azione non può essere annullata.",
            "deletionRequested": "Richiesta eliminazione account inviata. Il nostro team la elaborerà entro 24 ore."
        },
        "reviews": {
            "writeReviewFor": "Scrivi una Recensione per",
            "signIn": "Accedi",
            "reviewTitlePlaceholder": "Riassumi la tua esperienza",
            "yourReviewPlaceholder": "Raccontaci la tua esperienza con questo prodotto...",
            "minCharacters": "Minimo 20 caratteri",
            "clickToUpload": "Clicca per caricare immagini",
            "earnPointsDesc": "Invia una recensione verificata e guadagna punti bonus",
            "showingStarReviews": "Mostrando recensioni a {rating} stelle",
            "showingAllReviews": "Mostrando tutte le {count} recensioni",
            "clearFilter": "Cancella filtro"
        },
        "qa": {
            "questionsAbout": "domande su",
            "askAbout": "Chiedi informazioni su",
            "signIn": "Accedi",
            "questionPlaceholder": "Cosa vorresti sapere su questo prodotto?",
            "tipDesc": "Le domande su ricostituzione, conservazione e spedizione ricevono risposte più veloci.",
            "submitting": "Invio...",
            "official": "Ufficiale",
            "answer": "risposta",
            "answers": "risposte"
        },
        "learn": {
            "calculator": "Calcolatore Peptidi",
            "labResults": "Risultati di Laboratorio",
            "stayUpdatedDesc": "Ricevi le ultime scoperte di ricerca e offerte esclusive.",
            "viewFaq": "Vedi FAQ",
            "guideTitle": "La Guida Completa alla Ricerca sui Peptidi",
            "guideDesc": "Scarica la nostra guida completa gratuita sui fondamenti dei peptidi, conservazione, ricostituzione e protocolli di ricerca.",
            "continueLearning": "Continua ad Apprendere",
            "browseCollection": "Sfoglia la nostra collezione di peptidi di ricerca ad alta purezza.",
            "readTime": "min di lettura"
        },
        "contact": {
            "info": "Informazioni di Contatto",
            "hours": "Orari di Lavoro",
            "hoursDetail": "Lunedì - Venerdì: 9:00 - 17:00 EST",
            "response": "Tempo di Risposta",
            "responseDetail": "Rispondiamo generalmente entro 24 ore"
        },
        "trackOrder": {
            "orderNumberPlaceholder": "es: PP-2026-12345",
            "emailPlaceholder": "email@esempio.com",
            "notFoundDesc": "Non abbiamo trovato un ordine con questi dati. Verifica il numero d'ordine e l'email.",
            "contactSupport": "Contatta il supporto per assistenza",
            "needHelp": "Hai bisogno di aiuto?",
            "faqTitle": "FAQ",
            "faqDesc": "Domande comuni sulla spedizione",
            "contactTitle": "Contattaci",
            "contactDesc": "Ottieni supporto dal nostro team",
            "shippingProgress": "Progresso Spedizione",
            "trackOn": "Traccia su",
            "website": "sito web"
        },
        "cart": {
            "invalidPromoCode": "Codice promo non valido",
            "promoDiscount": "Sconto Promo",
            "estimateProvince": "Stima tasse (seleziona provincia)"
        },
        "checkout": {
            "emptyCartMessage": "Aggiungi prodotti al carrello prima di procedere.",
            "newsletter": "Tienimi aggiornato su nuovi prodotti e promozioni",
            "continueToShipping": "Continua alla spedizione",
            "state": "Stato",
            "zipCode": "CAP",
            "backToInfo": "Torna alle informazioni",
            "continueToPayment": "Continua al pagamento",
            "shippingTo": "Spedizione a",
            "backToShipping": "Torna alla spedizione",
            "confirmationEmail": "Un'email di conferma è stata inviata a",
            "exportNotice": "Spedizione Internazionale - Nessuna Tassa Canadese",
            "exportNoticeDetail": "Tutte le esportazioni internazionali sono esenti da tasse canadesi. Non si applicano GST/HST o tasse provinciali. Dazi e tasse locali possono essere applicati dalla dogana del paese di destinazione.",
            "exportZeroRated": "Esportazione esente",
            "noCanadianTax": "Nessuna tassa canadese (export)",
            "currencyNote": "Prezzi in CAD. Gli importi in USD sono stime basate sul tasso di cambio attuale.",
            "ftaCountry": "Accordo di Libero Scambio con il Canada - dazi ridotti o nulli",
            "cersNotice": "Nota: Dichiarazione CERS richiesta per ordini superiori a $2.000 CAD.",
            "account": "Account",
            "welcomeBack": "Bentornato",
            "signInBenefits": "Accedi per un checkout più veloce e accesso alla cronologia ordini",
            "expressCheckout": "Checkout express",
            "orSignInWith": "o accedi con",
            "or": "o",
            "continueWithGoogle": "Continua con Google",
            "continueWithApple": "Continua con Apple",
            "continueWithFacebook": "Continua con Facebook",
            "continueWithX": "Continua con X",
            "continueAsGuest": "Continua come ospite",
            "whyCreateAccount": "Perché creare un account?",
            "benefit1": "Checkout più veloce con informazioni salvate",
            "benefit2": "Tracciamento ordini in tempo reale",
            "benefit3": "Cronologia ordini e raccomandazioni",
            "benefit4": "Offerte esclusive e punti fedeltà",
            "backToSignIn": "← Torna all'accesso",
            "loggedIn": "Connesso",
            "saveAddress": "Salva questo indirizzo per ordini futuri",
            "expressPayment": "Pagamento express",
            "orPayWithCard": "o paga con carta",
            "creditCard": "Carta di credito",
            "savePayment": "Salva questa carta per acquisti futuri",
            "estimatedDelivery": "Consegna stimata",
            "whatHappensNext": "Cosa succede dopo?",
            "emailConfirmation": "Riceverai un'email di conferma a breve",
            "orderProcessed": "Il tuo ordine sarà elaborato e spedito entro 24-48 ore",
            "trackingNumber": "Riceverai un numero di tracciamento via email dopo la spedizione",
            "researchNotice": "SOLO PER RICERCA: Tutti i prodotti sono destinati esclusivamente a scopi di laboratorio e ricerca. Non per consumo umano o animale.",
            "questionsContact": "Domande sul tuo ordine? Contattaci a",
            "postcode": "CAP",
            "cap": "CAP",
            "plz": "CAP",
            "postnummer": "CAP",
            "region": "Regione",
            "department": "Dipartimento",
            "county": "Contea",
            "canton": "Cantone",
            "prefecture": "Prefettura",
            "voivodeship": "Voivodato",
            "stateTerritory": "Stato/Territorio",
            "postalCodeExample": "es."
        },
        "shipping": {
            "packagingHandling": "Imballaggio e Gestione",
            "orderTracking": "Tracciamento Ordine",
            "customsDuties": "Dogana e Dazi di Importazione",
            "lostDamaged": "Pacchi Persi o Danneggiati",
            "questionsShipping": "Domande sulla Spedizione?",
            "viewFaq": "Vedi FAQ",
            "region": "Regione",
            "freeOver": "GRATIS oltre {amount}",
            "under": "sotto {amount}",
            "priority": "Priorità",
            "nextBusinessDay": "Giorno lavorativo successivo",
            "standardInternational": "Standard Internazionale",
            "expressInternational": "Express Internazionale",
            "europe": "Europa (UE, UK)",
            "australia": "Australia / Nuova Zelanda",
            "asia": "Asia",
            "restOfWorld": "Resto del Mondo",
            "calculatedAtCheckout": "Calcolato al checkout"
        },
        "refund": {
            "eligibleReturn": "Idoneo per Reso/Rimborso",
            "howToRequest": "Come Richiedere un Rimborso",
            "refundTimeline": "Tempistiche di Rimborso",
            "damagedDefective": "Prodotti Danneggiati o Difettosi",
            "orderCancellations": "Annullamenti Ordine",
            "exchanges": "Cambi",
            "paymentMethod": "Metodo di Pagamento",
            "processingTime": "Tempo di Elaborazione",
            "creditDebit": "Carta di Credito/Debito",
            "paypal": "PayPal",
            "applePay": "Apple Pay / Google Pay",
            "timesVary": "I tempi possono variare a seconda della banca o istituzione finanziaria."
        }
    },
    # Portuguese translations
    "pt": {
        "subscriptions": {
            "faqTitle": "FAQ Assinaturas",
            "faq1Q": "Posso cancelar a qualquer momento?",
            "faq1A": "Sim! Você pode cancelar, pausar ou modificar sua assinatura a qualquer momento sem penalidades.",
            "faq2Q": "Como funciona o desconto?",
            "faq2A": "Quanto mais frequentemente você pedir, mais economiza. Entregas semanais economizam 20%, mensais 10%.",
            "faq3Q": "Posso pular uma entrega?",
            "faq3A": "Absolutamente. Você pode pular entregas individuais ou pausar sua assinatura temporariamente.",
            "faq4Q": "Ganharei pontos de fidelidade?",
            "faq4A": "Sim! Você ganha todos os pontos de fidelidade em pedidos de assinatura, mais 200 pontos bônus por entrega."
        },
        "videos": {
            "calculator": "Calculadora",
            "labResults": "Resultados de Laboratório"
        },
        "community": {
            "questionPlaceholder": "Qual é sua pergunta ou tópico?",
            "contentPlaceholder": "Compartilhe seus pensamentos, perguntas ou experiências...",
            "tagsPlaceholder": "ex: bpc-157, reconstituição, iniciante"
        },
        "webinars": {
            "recordings": "Gravações",
            "always": "Sempre",
            "enterEmail": "Digite seu email",
            "registerWebinar": "Registrar para Webinar",
            "receiveConfirmation": "Você receberá um email de confirmação em",
            "withWebinarLink": "com o link do webinar.",
            "confirmRegistration": "Confirmar Registro",
            "signInToRegister": "Entre para Registrar",
            "signInRequired": "Por favor entre para se registrar neste webinar.",
            "education": "Educação",
            "tutorial": "Tutorial",
            "bestPractices": "Melhores Práticas"
        },
        "ambassador": {
            "applyDesc": "Preencha nosso simples formulário de candidatura",
            "approveDesc": "Analisamos candidaturas em 48 horas",
            "shareDesc": "Use seu link único para promover produtos",
            "earnDesc": "Receba pagamentos mensais por cada venda",
            "commission": "comissão",
            "referrals": "indicações",
            "mostPopular": "Mais Popular",
            "nextTier": "Próximo nível",
            "moreReferralsNeeded": "mais indicações necessárias",
            "yourReferralLink": "Seu Link de Indicação",
            "backToOverview": "Voltar à Visão Geral",
            "applyToBecome": "Candidate-se para ser Embaixador",
            "websiteUrl": "URL do Site ou Blog",
            "socialProfiles": "Perfis de Redes Sociais",
            "estimatedFollowers": "Número Estimado de Seguidores/Audiência",
            "whyJoin": "Por que você quer se juntar ao nosso programa?",
            "promotionPlan": "Como você planeja promover nossos produtos?",
            "termsNote": "Ao se candidatar, você concorda com nossos Termos de Embaixador. Analisamos todas as candidaturas manualmente e responderemos em 48 horas.",
            "upTo20Commission": "Até 20% de Comissão",
            "freeProducts": "Produtos Grátis",
            "passiveIncome": "Renda Passiva",
            "exclusivePerks": "Vantagens Exclusivas",
            "faq1Q": "Como sou pago?",
            "faq1A": "Os pagamentos são feitos mensalmente via PayPal ou transferência bancária para ganhos acima de $50.",
            "faq2Q": "Há um tamanho mínimo de audiência?",
            "faq2A": "Nenhum mínimo necessário! Acolhemos embaixadores de todos os tamanhos apaixonados por pesquisa de peptídeos.",
            "faq3Q": "Posso promover em qualquer plataforma?",
            "faq3A": "Sim! Blog, YouTube, Instagram, TikTok, listas de email - onde sua audiência estiver.",
            "faq4Q": "Quanto tempo dura o cookie?",
            "faq4A": "Nosso cookie de rastreamento dura 30 dias, então você recebe crédito por vendas nessa janela.",
            "faq5Q": "Preciso ser cliente primeiro?",
            "faq5A": "Embora não seja obrigatório, ajuda! Recomendações autênticas de usuários funcionam melhor.",
            "faq6Q": "Quais materiais de marketing vocês fornecem?",
            "faq6A": "Fornecemos banners, imagens de produtos, modelos de email e conteúdo para redes sociais."
        },
        "account": {
            "emailReadOnly": "O email não pode ser alterado",
            "oauthPassword": "Sua senha é gerenciada pelo seu provedor de login social",
            "streetAddress": "Endereço",
            "city": "Cidade",
            "province": "Estado/Província",
            "postalCode": "CEP",
            "country": "País",
            "saveAddress": "Salvar Endereço",
            "dangerZone": "Zona de Perigo",
            "deleteAccount": "Excluir Conta",
            "deleteAccountDesc": "Uma vez excluída, todos os seus dados serão permanentemente removidos. Esta ação não pode ser desfeita.",
            "requestDeletion": "Solicitar Exclusão de Conta",
            "reordering": "Reordenando...",
            "orderNumber": "Pedido #",
            "orderDate": "Data do Pedido",
            "orderStatus": "Status",
            "orderTotal": "Total",
            "viewDetails": "Ver Detalhes",
            "hideDetails": "Ocultar Detalhes",
            "shippingAddress": "Endereço de Entrega",
            "trackingNumber": "Número de Rastreamento",
            "orderItems": "Itens do Pedido",
            "subtotal": "Subtotal",
            "tax": "Impostos",
            "shipping": "Frete",
            "statusPending": "Pendente",
            "statusProcessing": "Processando",
            "statusShipped": "Enviado",
            "statusDelivered": "Entregue",
            "statusCancelled": "Cancelado",
            "profileUpdated": "Perfil atualizado com sucesso",
            "passwordUpdated": "Senha atualizada com sucesso",
            "addressSaved": "Endereço salvo com sucesso",
            "deleteConfirm": "Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.",
            "deletionRequested": "Solicitação de exclusão de conta enviada. Nossa equipe processará em 24 horas."
        },
        "reviews": {
            "writeReviewFor": "Escrever Avaliação para",
            "signIn": "Entrar",
            "reviewTitlePlaceholder": "Resuma sua experiência",
            "yourReviewPlaceholder": "Conte-nos sobre sua experiência com este produto...",
            "minCharacters": "Mínimo 20 caracteres",
            "clickToUpload": "Clique para enviar imagens",
            "earnPointsDesc": "Envie uma avaliação verificada e ganhe pontos bônus",
            "showingStarReviews": "Mostrando avaliações de {rating} estrelas",
            "showingAllReviews": "Mostrando todas as {count} avaliações",
            "clearFilter": "Limpar filtro"
        },
        "qa": {
            "questionsAbout": "perguntas sobre",
            "askAbout": "Perguntar sobre",
            "signIn": "Entrar",
            "questionPlaceholder": "O que você gostaria de saber sobre este produto?",
            "tipDesc": "Perguntas sobre reconstituição, armazenamento e envio são respondidas mais rápido.",
            "submitting": "Enviando...",
            "official": "Oficial",
            "answer": "resposta",
            "answers": "respostas"
        },
        "learn": {
            "calculator": "Calculadora de Peptídeos",
            "labResults": "Resultados de Laboratório",
            "stayUpdatedDesc": "Receba os últimos insights de pesquisa e ofertas exclusivas.",
            "viewFaq": "Ver FAQ",
            "guideTitle": "O Guia Completo para Pesquisa de Peptídeos",
            "guideDesc": "Baixe nosso guia gratuito completo cobrindo fundamentos de peptídeos, armazenamento, reconstituição e protocolos de pesquisa.",
            "continueLearning": "Continue Aprendendo",
            "browseCollection": "Navegue nossa coleção de peptídeos de pesquisa de alta pureza.",
            "readTime": "min de leitura"
        },
        "contact": {
            "info": "Informações de Contato",
            "hours": "Horário Comercial",
            "hoursDetail": "Segunda - Sexta: 9h - 17h EST",
            "response": "Tempo de Resposta",
            "responseDetail": "Geralmente respondemos em 24 horas"
        },
        "trackOrder": {
            "orderNumberPlaceholder": "ex: PP-2026-12345",
            "emailPlaceholder": "email@exemplo.com",
            "notFoundDesc": "Não encontramos um pedido com esses dados. Verifique o número do pedido e email.",
            "contactSupport": "Contate o suporte para ajuda",
            "needHelp": "Precisa de Ajuda?",
            "faqTitle": "FAQ",
            "faqDesc": "Perguntas comuns sobre envio",
            "contactTitle": "Fale Conosco",
            "contactDesc": "Obtenha suporte da nossa equipe",
            "shippingProgress": "Progresso do Envio",
            "trackOn": "Rastrear em",
            "website": "site"
        },
        "cart": {
            "invalidPromoCode": "Código promo inválido",
            "promoDiscount": "Desconto Promo",
            "estimateProvince": "Estimar impostos (selecionar província)"
        },
        "checkout": {
            "emptyCartMessage": "Adicione produtos ao carrinho antes de finalizar.",
            "newsletter": "Mantenha-me atualizado sobre novos produtos e promoções",
            "continueToShipping": "Continuar para envio",
            "state": "Estado",
            "zipCode": "CEP",
            "backToInfo": "Voltar às informações",
            "continueToPayment": "Continuar para pagamento",
            "shippingTo": "Enviando para",
            "backToShipping": "Voltar ao envio",
            "confirmationEmail": "Um email de confirmação foi enviado para",
            "exportNotice": "Envio Internacional - Sem Impostos Canadenses",
            "exportNoticeDetail": "Todas as exportações internacionais são isentas de impostos. Não se aplicam GST/HST ou impostos provinciais. Taxas de importação e impostos locais podem ser cobrados pela alfândega do país de destino.",
            "exportZeroRated": "Exportação isenta",
            "noCanadianTax": "Sem imposto canadense (exportação)",
            "currencyNote": "Preços em CAD. Valores em USD são estimativas baseadas na taxa de câmbio atual.",
            "ftaCountry": "Acordo de Livre Comércio com Canadá - taxas de importação reduzidas ou nulas",
            "cersNotice": "Nota: Declaração CERS necessária para pedidos acima de $2.000 CAD.",
            "account": "Conta",
            "welcomeBack": "Bem-vindo",
            "signInBenefits": "Entre para checkout mais rápido e acesso ao histórico de pedidos",
            "expressCheckout": "Checkout rápido",
            "orSignInWith": "ou entre com",
            "or": "ou",
            "continueWithGoogle": "Continuar com Google",
            "continueWithApple": "Continuar com Apple",
            "continueWithFacebook": "Continuar com Facebook",
            "continueWithX": "Continuar com X",
            "continueAsGuest": "Continuar como convidado",
            "whyCreateAccount": "Por que criar uma conta?",
            "benefit1": "Checkout mais rápido com informações salvas",
            "benefit2": "Rastreamento de pedidos em tempo real",
            "benefit3": "Histórico de pedidos e recomendações",
            "benefit4": "Ofertas exclusivas e pontos de fidelidade",
            "backToSignIn": "← Voltar ao login",
            "loggedIn": "Conectado",
            "saveAddress": "Salvar este endereço para pedidos futuros",
            "expressPayment": "Pagamento rápido",
            "orPayWithCard": "ou pague com cartão",
            "creditCard": "Cartão de crédito",
            "savePayment": "Salvar este cartão para compras futuras",
            "estimatedDelivery": "Entrega estimada",
            "whatHappensNext": "O que acontece depois?",
            "emailConfirmation": "Você receberá um email de confirmação em breve",
            "orderProcessed": "Seu pedido será processado e enviado em 24-48 horas",
            "trackingNumber": "Você receberá um número de rastreamento por email após o envio",
            "researchNotice": "SOMENTE PARA PESQUISA: Todos os produtos são destinados exclusivamente para fins de laboratório e pesquisa. Não para consumo humano ou animal.",
            "questionsContact": "Perguntas sobre seu pedido? Contate-nos em",
            "postcode": "CEP",
            "cap": "CAP",
            "plz": "PLZ",
            "postnummer": "Postnummer",
            "region": "Região",
            "department": "Departamento",
            "county": "Condado",
            "canton": "Cantão",
            "prefecture": "Prefeitura",
            "voivodeship": "Voivodia",
            "stateTerritory": "Estado/Território",
            "postalCodeExample": "ex."
        },
        "shipping": {
            "packagingHandling": "Embalagem e Manuseio",
            "orderTracking": "Rastreamento de Pedido",
            "customsDuties": "Alfândega e Taxas de Importação",
            "lostDamaged": "Pacotes Perdidos ou Danificados",
            "questionsShipping": "Perguntas sobre Envio?",
            "viewFaq": "Ver FAQ",
            "region": "Região",
            "freeOver": "GRÁTIS acima de {amount}",
            "under": "abaixo de {amount}",
            "priority": "Prioritário",
            "nextBusinessDay": "Próximo dia útil",
            "standardInternational": "Internacional Padrão",
            "expressInternational": "Internacional Expresso",
            "europe": "Europa (UE, UK)",
            "australia": "Austrália / Nova Zelândia",
            "asia": "Ásia",
            "restOfWorld": "Resto do Mundo",
            "calculatedAtCheckout": "Calculado no checkout"
        },
        "refund": {
            "eligibleReturn": "Elegível para Devolução/Reembolso",
            "howToRequest": "Como Solicitar um Reembolso",
            "refundTimeline": "Prazo de Reembolso",
            "damagedDefective": "Produtos Danificados ou Defeituosos",
            "orderCancellations": "Cancelamentos de Pedido",
            "exchanges": "Trocas",
            "paymentMethod": "Método de Pagamento",
            "processingTime": "Tempo de Processamento",
            "creditDebit": "Cartão de Crédito/Débito",
            "paypal": "PayPal",
            "applePay": "Apple Pay / Google Pay",
            "timesVary": "Os prazos podem variar dependendo do seu banco ou instituição financeira."
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

    print("\nTranslations completed!")

if __name__ == "__main__":
    main()
