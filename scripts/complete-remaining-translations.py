#!/usr/bin/env python3
"""
Script to complete missing translations in remaining locale files
"""
import json
import os

# Translations for all missing keys by language
TRANSLATIONS = {
    # Polish translations
    "pl": {
        "subscriptions": {
            "faqTitle": "FAQ subskrypcji",
            "faq1Q": "Czy mogę anulować w dowolnym momencie?",
            "faq1A": "Tak! Możesz anulować, wstrzymać lub zmodyfikować subskrypcję w dowolnym momencie bez kar.",
            "faq2Q": "Jak działa zniżka?",
            "faq2A": "Im częściej zamawiasz, tym więcej oszczędzasz. Dostawy tygodniowe oszczędzają 20%, miesięczne 10%.",
            "faq3Q": "Czy mogę pominąć dostawę?",
            "faq3A": "Absolutnie. Możesz pominąć pojedyncze dostawy lub tymczasowo wstrzymać subskrypcję.",
            "faq4Q": "Czy zdobędę punkty lojalnościowe?",
            "faq4A": "Tak! Zdobywasz pełne punkty lojalnościowe za zamówienia subskrypcyjne, plus 200 punktów bonusowych za dostawę."
        },
        "videos": {"calculator": "Kalkulator", "labResults": "Wyniki laboratoryjne"},
        "community": {
            "questionPlaceholder": "Jakie jest twoje pytanie lub temat?",
            "contentPlaceholder": "Podziel się swoimi przemyśleniami, pytaniami lub doświadczeniami...",
            "tagsPlaceholder": "np: bpc-157, rekonstytucja, początkujący"
        },
        "webinars": {
            "recordings": "Nagrania", "always": "Zawsze", "enterEmail": "Wprowadź swój email",
            "registerWebinar": "Zarejestruj się na webinar",
            "receiveConfirmation": "Otrzymasz email potwierdzający na",
            "withWebinarLink": "z linkiem do webinaru.",
            "confirmRegistration": "Potwierdź rejestrację",
            "signInToRegister": "Zaloguj się, aby się zarejestrować",
            "signInRequired": "Zaloguj się, aby zarejestrować się na ten webinar.",
            "education": "Edukacja", "tutorial": "Tutorial", "bestPractices": "Najlepsze praktyki"
        },
        "ambassador": {
            "applyDesc": "Wypełnij nasz prosty formularz aplikacyjny",
            "approveDesc": "Rozpatrujemy aplikacje w ciągu 48 godzin",
            "shareDesc": "Użyj swojego unikalnego linku do promowania produktów",
            "earnDesc": "Otrzymuj miesięczne płatności za każdą sprzedaż",
            "commission": "prowizja", "referrals": "polecenia", "mostPopular": "Najpopularniejszy",
            "nextTier": "Następny poziom", "moreReferralsNeeded": "więcej poleceń potrzebnych",
            "yourReferralLink": "Twój link polecający", "backToOverview": "Wróć do przeglądu",
            "applyToBecome": "Aplikuj, aby zostać ambasadorem",
            "websiteUrl": "URL strony lub bloga", "socialProfiles": "Profile w mediach społecznościowych",
            "estimatedFollowers": "Szacowana liczba obserwujących/odbiorców",
            "whyJoin": "Dlaczego chcesz dołączyć do naszego programu?",
            "promotionPlan": "Jak planujesz promować nasze produkty?",
            "termsNote": "Aplikując, zgadzasz się z naszymi Warunkami Ambasadora. Rozpatrujemy wszystkie aplikacje ręcznie i odpowiemy w ciągu 48 godzin.",
            "upTo20Commission": "Do 20% prowizji", "freeProducts": "Darmowe produkty",
            "passiveIncome": "Pasywny dochód", "exclusivePerks": "Ekskluzywne korzyści",
            "faq1Q": "Jak otrzymuję płatności?", "faq1A": "Płatności są dokonywane miesięcznie przez PayPal lub przelew bankowy dla zarobków powyżej $50.",
            "faq2Q": "Czy jest minimalna wielkość odbiorców?", "faq2A": "Nie ma minimum! Witamy ambasadorów wszystkich rozmiarów pasjonujących się badaniami peptydów.",
            "faq3Q": "Czy mogę promować na dowolnej platformie?", "faq3A": "Tak! Blog, YouTube, Instagram, TikTok, listy emailowe - gdziekolwiek są twoi odbiorcy.",
            "faq4Q": "Jak długo trwa cookie?", "faq4A": "Nasze cookie śledzące trwa 30 dni, więc otrzymujesz kredyt za sprzedaże w tym oknie.",
            "faq5Q": "Czy muszę najpierw być klientem?", "faq5A": "Chociaż nie jest to wymagane, pomaga! Autentyczne rekomendacje użytkowników działają najlepiej.",
            "faq6Q": "Jakie materiały marketingowe dostarczacie?", "faq6A": "Dostarczamy banery, zdjęcia produktów, szablony emaili i treści do mediów społecznościowych."
        },
        "account": {
            "emailReadOnly": "Email nie może być zmieniony",
            "oauthPassword": "Twoje hasło jest zarządzane przez dostawcę logowania społecznościowego",
            "streetAddress": "Adres", "city": "Miasto", "province": "Województwo",
            "postalCode": "Kod pocztowy", "country": "Kraj", "saveAddress": "Zapisz adres",
            "dangerZone": "Strefa niebezpieczna", "deleteAccount": "Usuń konto",
            "deleteAccountDesc": "Po usunięciu wszystkie twoje dane zostaną trwale usunięte. Tej akcji nie można cofnąć.",
            "requestDeletion": "Poproś o usunięcie konta", "reordering": "Ponowne zamawianie...",
            "orderNumber": "Zamówienie #", "orderDate": "Data zamówienia", "orderStatus": "Status",
            "orderTotal": "Suma", "viewDetails": "Pokaż szczegóły", "hideDetails": "Ukryj szczegóły",
            "shippingAddress": "Adres wysyłki", "trackingNumber": "Numer śledzenia",
            "orderItems": "Produkty zamówienia", "subtotal": "Suma częściowa", "tax": "Podatek",
            "shipping": "Wysyłka", "statusPending": "Oczekujące", "statusProcessing": "Przetwarzanie",
            "statusShipped": "Wysłane", "statusDelivered": "Dostarczone", "statusCancelled": "Anulowane",
            "profileUpdated": "Profil zaktualizowany pomyślnie", "passwordUpdated": "Hasło zaktualizowane pomyślnie",
            "addressSaved": "Adres zapisany pomyślnie",
            "deleteConfirm": "Czy na pewno chcesz usunąć swoje konto? Tej akcji nie można cofnąć.",
            "deletionRequested": "Prośba o usunięcie konta wysłana. Nasz zespół przetworzy to w ciągu 24 godzin."
        },
        "reviews": {
            "writeReviewFor": "Napisz recenzję dla", "signIn": "Zaloguj się",
            "reviewTitlePlaceholder": "Podsumuj swoje doświadczenie",
            "yourReviewPlaceholder": "Opowiedz nam o swoim doświadczeniu z tym produktem...",
            "minCharacters": "Minimum 20 znaków", "clickToUpload": "Kliknij, aby przesłać zdjęcia",
            "earnPointsDesc": "Prześlij zweryfikowaną recenzję i zdobądź punkty bonusowe",
            "showingStarReviews": "Wyświetlanie recenzji {rating}-gwiazdkowych",
            "showingAllReviews": "Wyświetlanie wszystkich {count} recenzji",
            "clearFilter": "Wyczyść filtr"
        },
        "qa": {
            "questionsAbout": "pytań o", "askAbout": "Zapytaj o", "signIn": "Zaloguj się",
            "questionPlaceholder": "Co chciałbyś wiedzieć o tym produkcie?",
            "tipDesc": "Pytania o rekonstytucję, przechowywanie i wysyłkę otrzymują najszybsze odpowiedzi.",
            "submitting": "Wysyłanie...", "official": "Oficjalny", "answer": "odpowiedź", "answers": "odpowiedzi"
        },
        "learn": {
            "calculator": "Kalkulator peptydów", "labResults": "Wyniki laboratoryjne",
            "stayUpdatedDesc": "Otrzymuj najnowsze spostrzeżenia badawcze i ekskluzywne oferty.",
            "viewFaq": "Zobacz FAQ", "guideTitle": "Kompletny przewodnik po badaniach peptydów",
            "guideDesc": "Pobierz nasz darmowy kompleksowy przewodnik obejmujący podstawy peptydów, przechowywanie, rekonstytucję i protokoły badawcze.",
            "continueLearning": "Kontynuuj naukę",
            "browseCollection": "Przeglądaj naszą kolekcję peptydów badawczych o wysokiej czystości.",
            "readTime": "min czytania"
        },
        "contact": {
            "info": "Informacje kontaktowe", "hours": "Godziny pracy",
            "hoursDetail": "Poniedziałek - Piątek: 9:00 - 17:00 EST",
            "response": "Czas odpowiedzi", "responseDetail": "Zazwyczaj odpowiadamy w ciągu 24 godzin"
        },
        "trackOrder": {
            "orderNumberPlaceholder": "np: PP-2026-12345", "emailPlaceholder": "email@przykład.com",
            "notFoundDesc": "Nie mogliśmy znaleźć zamówienia z tymi danymi. Sprawdź numer zamówienia i email.",
            "contactSupport": "Skontaktuj się ze wsparciem", "needHelp": "Potrzebujesz pomocy?",
            "faqTitle": "FAQ", "faqDesc": "Częste pytania o wysyłkę",
            "contactTitle": "Skontaktuj się", "contactDesc": "Uzyskaj wsparcie od naszego zespołu",
            "shippingProgress": "Postęp wysyłki", "trackOn": "Śledź na", "website": "stronie"
        },
        "cart": {
            "invalidPromoCode": "Nieprawidłowy kod promo", "promoDiscount": "Zniżka promo",
            "estimateProvince": "Oszacuj podatki (wybierz prowincję)"
        },
        "checkout": {
            "emptyCartMessage": "Dodaj produkty do koszyka przed realizacją zamówienia.",
            "newsletter": "Informuj mnie o nowych produktach i promocjach",
            "continueToShipping": "Kontynuuj do wysyłki", "state": "Stan", "zipCode": "Kod pocztowy",
            "backToInfo": "Wróć do informacji", "continueToPayment": "Kontynuuj do płatności",
            "shippingTo": "Wysyłka do", "backToShipping": "Wróć do wysyłki",
            "confirmationEmail": "Email potwierdzający został wysłany na",
            "exportNotice": "Wysyłka międzynarodowa - bez podatków kanadyjskich",
            "exportNoticeDetail": "Cały eksport międzynarodowy jest zwolniony z podatków. GST/HST ani podatki prowincyjne nie mają zastosowania. Cła importowe i lokalne podatki mogą być pobierane przez urząd celny kraju docelowego.",
            "exportZeroRated": "Eksport zwolniony", "noCanadianTax": "Bez podatku kanadyjskiego (eksport)",
            "currencyNote": "Ceny w CAD. Kwoty USD są szacunkami na podstawie aktualnego kursu wymiany.",
            "ftaCountry": "Umowa o wolnym handlu z Kanadą - zmniejszone lub zerowe cła importowe",
            "cersNotice": "Uwaga: deklaracja CERS wymagana dla zamówień powyżej $2000 CAD.",
            "account": "Konto", "welcomeBack": "Witamy",
            "signInBenefits": "Zaloguj się dla szybszej realizacji zamówienia i dostępu do historii zamówień",
            "expressCheckout": "Szybka realizacja", "orSignInWith": "lub zaloguj się przez", "or": "lub",
            "continueWithGoogle": "Kontynuuj z Google", "continueWithApple": "Kontynuuj z Apple",
            "continueWithFacebook": "Kontynuuj z Facebook", "continueWithX": "Kontynuuj z X",
            "continueAsGuest": "Kontynuuj jako gość", "whyCreateAccount": "Dlaczego utworzyć konto?",
            "benefit1": "Szybsza realizacja z zapisanymi informacjami", "benefit2": "Śledzenie zamówień w czasie rzeczywistym",
            "benefit3": "Historia zamówień i rekomendacje", "benefit4": "Ekskluzywne oferty i punkty lojalnościowe",
            "backToSignIn": "← Wróć do logowania", "loggedIn": "Zalogowano",
            "saveAddress": "Zapisz ten adres dla przyszłych zamówień", "expressPayment": "Szybka płatność",
            "orPayWithCard": "lub zapłać kartą", "creditCard": "Karta kredytowa",
            "savePayment": "Zapisz tę kartę dla przyszłych zakupów", "estimatedDelivery": "Szacowana dostawa",
            "whatHappensNext": "Co dalej?", "emailConfirmation": "Wkrótce otrzymasz email z potwierdzeniem",
            "orderProcessed": "Twoje zamówienie zostanie przetworzone i wysłane w ciągu 24-48 godzin",
            "trackingNumber": "Otrzymasz numer śledzenia emailem po wysyłce",
            "researchNotice": "TYLKO DO BADAŃ: Wszystkie produkty są przeznaczone wyłącznie do celów laboratoryjnych i badawczych. Nie do spożycia przez ludzi lub zwierzęta.",
            "questionsContact": "Pytania o zamówienie? Skontaktuj się z nami:",
            "postcode": "Kod pocztowy", "cap": "CAP", "plz": "PLZ", "postnummer": "Postnummer",
            "region": "Region", "department": "Departament", "county": "Hrabstwo", "canton": "Kanton",
            "prefecture": "Prefektura", "voivodeship": "Województwo", "stateTerritory": "Stan/Terytorium",
            "postalCodeExample": "np."
        },
        "shipping": {
            "packagingHandling": "Pakowanie i obsługa", "orderTracking": "Śledzenie zamówienia",
            "customsDuties": "Cła i opłaty importowe", "lostDamaged": "Zgubione lub uszkodzone paczki",
            "questionsShipping": "Pytania o wysyłkę?", "viewFaq": "Zobacz FAQ", "region": "Region",
            "freeOver": "DARMOWA powyżej {amount}", "under": "poniżej {amount}",
            "priority": "Priorytet", "nextBusinessDay": "Następny dzień roboczy",
            "standardInternational": "Standardowa międzynarodowa", "expressInternational": "Ekspresowa międzynarodowa",
            "europe": "Europa (UE, UK)", "australia": "Australia / Nowa Zelandia", "asia": "Azja",
            "restOfWorld": "Reszta świata", "calculatedAtCheckout": "Obliczane przy realizacji"
        },
        "refund": {
            "eligibleReturn": "Kwalifikuje się do zwrotu/refundacji", "howToRequest": "Jak poprosić o zwrot",
            "refundTimeline": "Harmonogram zwrotów", "damagedDefective": "Uszkodzone lub wadliwe produkty",
            "orderCancellations": "Anulowanie zamówień", "exchanges": "Wymiany",
            "paymentMethod": "Metoda płatności", "processingTime": "Czas przetwarzania",
            "creditDebit": "Karta kredytowa/debetowa", "paypal": "PayPal", "applePay": "Apple Pay / Google Pay",
            "timesVary": "Czasy mogą się różnić w zależności od banku lub instytucji finansowej."
        }
    },
    # Swedish translations
    "sv": {
        "subscriptions": {
            "faqTitle": "Prenumerations-FAQ",
            "faq1Q": "Kan jag avbryta när som helst?",
            "faq1A": "Ja! Du kan avbryta, pausa eller ändra din prenumeration när som helst utan straffavgifter.",
            "faq2Q": "Hur fungerar rabatten?",
            "faq2A": "Ju oftare du beställer, desto mer sparar du. Veckoleveranser sparar 20%, månatliga 10%.",
            "faq3Q": "Kan jag hoppa över en leverans?",
            "faq3A": "Absolut. Du kan hoppa över enskilda leveranser eller tillfälligt pausa din prenumeration.",
            "faq4Q": "Får jag lojalitetspoäng?",
            "faq4A": "Ja! Du får fulla lojalitetspoäng på prenumerationsbeställningar, plus 200 bonuspoäng per leverans."
        },
        "videos": {"calculator": "Kalkylator", "labResults": "Labbresultat"},
        "community": {
            "questionPlaceholder": "Vad är din fråga eller ditt ämne?",
            "contentPlaceholder": "Dela dina tankar, frågor eller erfarenheter...",
            "tagsPlaceholder": "t.ex: bpc-157, rekonstitution, nybörjare"
        },
        "webinars": {
            "recordings": "Inspelningar", "always": "Alltid", "enterEmail": "Ange din e-post",
            "registerWebinar": "Registrera för webinar",
            "receiveConfirmation": "Du kommer att få ett bekräftelsemail till",
            "withWebinarLink": "med webinarlänken.",
            "confirmRegistration": "Bekräfta registrering",
            "signInToRegister": "Logga in för att registrera",
            "signInRequired": "Logga in för att registrera dig för detta webinar.",
            "education": "Utbildning", "tutorial": "Tutorial", "bestPractices": "Bästa praxis"
        },
        "ambassador": {
            "applyDesc": "Fyll i vårt enkla ansökningsformulär",
            "approveDesc": "Vi granskar ansökningar inom 48 timmar",
            "shareDesc": "Använd din unika länk för att marknadsföra produkter",
            "earnDesc": "Få månatliga betalningar för varje försäljning",
            "commission": "provision", "referrals": "hänvisningar", "mostPopular": "Mest populär",
            "nextTier": "Nästa nivå", "moreReferralsNeeded": "fler hänvisningar behövs",
            "yourReferralLink": "Din hänvisningslänk", "backToOverview": "Tillbaka till översikt",
            "applyToBecome": "Ansök för att bli ambassadör",
            "websiteUrl": "Webbplats- eller blogg-URL", "socialProfiles": "Sociala medieprofiler",
            "estimatedFollowers": "Uppskattat antal följare/publik",
            "whyJoin": "Varför vill du gå med i vårt program?",
            "promotionPlan": "Hur planerar du att marknadsföra våra produkter?",
            "termsNote": "Genom att ansöka godkänner du våra ambassadörsvillkor. Vi granskar alla ansökningar manuellt och svarar inom 48 timmar.",
            "upTo20Commission": "Upp till 20% provision", "freeProducts": "Gratis produkter",
            "passiveIncome": "Passiv inkomst", "exclusivePerks": "Exklusiva förmåner",
            "faq1Q": "Hur får jag betalt?", "faq1A": "Betalningar görs månadsvis via PayPal eller banköverföring för intäkter över $50.",
            "faq2Q": "Finns det en minsta publikstorlek?", "faq2A": "Inget minimum krävs! Vi välkomnar ambassadörer i alla storlekar som brinner för peptidforskning.",
            "faq3Q": "Kan jag marknadsföra på vilken plattform som helst?", "faq3A": "Ja! Blogg, YouTube, Instagram, TikTok, e-postlistor - var din publik än finns.",
            "faq4Q": "Hur länge varar cookien?", "faq4A": "Vår spårningscookie varar i 30 dagar, så du får kredit för försäljningar inom det fönstret.",
            "faq5Q": "Måste jag vara kund först?", "faq5A": "Även om det inte krävs, hjälper det! Autentiska rekommendationer från användare fungerar bäst.",
            "faq6Q": "Vilka marknadsföringsmaterial tillhandahåller ni?", "faq6A": "Vi tillhandahåller banners, produktbilder, e-postmallar och innehåll för sociala medier."
        },
        "account": {
            "emailReadOnly": "E-post kan inte ändras",
            "oauthPassword": "Ditt lösenord hanteras av din sociala inloggningsleverantör",
            "streetAddress": "Gatuadress", "city": "Stad", "province": "Län",
            "postalCode": "Postnummer", "country": "Land", "saveAddress": "Spara adress",
            "dangerZone": "Farozon", "deleteAccount": "Radera konto",
            "deleteAccountDesc": "När kontot raderas kommer all din data att tas bort permanent. Denna åtgärd kan inte ångras.",
            "requestDeletion": "Begär kontoborttagning", "reordering": "Beställer om...",
            "orderNumber": "Order #", "orderDate": "Orderdatum", "orderStatus": "Status",
            "orderTotal": "Totalt", "viewDetails": "Visa detaljer", "hideDetails": "Dölj detaljer",
            "shippingAddress": "Leveransadress", "trackingNumber": "Spårningsnummer",
            "orderItems": "Orderartiklar", "subtotal": "Delsumma", "tax": "Skatt",
            "shipping": "Frakt", "statusPending": "Väntande", "statusProcessing": "Bearbetas",
            "statusShipped": "Skickad", "statusDelivered": "Levererad", "statusCancelled": "Avbruten",
            "profileUpdated": "Profil uppdaterad framgångsrikt", "passwordUpdated": "Lösenord uppdaterat framgångsrikt",
            "addressSaved": "Adress sparad framgångsrikt",
            "deleteConfirm": "Är du säker på att du vill radera ditt konto? Denna åtgärd kan inte ångras.",
            "deletionRequested": "Begäran om kontoborttagning skickad. Vårt team kommer att behandla detta inom 24 timmar."
        },
        "reviews": {
            "writeReviewFor": "Skriv en recension för", "signIn": "Logga in",
            "reviewTitlePlaceholder": "Sammanfatta din upplevelse",
            "yourReviewPlaceholder": "Berätta om din upplevelse med denna produkt...",
            "minCharacters": "Minst 20 tecken", "clickToUpload": "Klicka för att ladda upp bilder",
            "earnPointsDesc": "Skicka in en verifierad recension och tjäna bonuspoäng",
            "showingStarReviews": "Visar {rating}-stjärniga recensioner",
            "showingAllReviews": "Visar alla {count} recensioner",
            "clearFilter": "Rensa filter"
        },
        "qa": {
            "questionsAbout": "frågor om", "askAbout": "Fråga om", "signIn": "Logga in",
            "questionPlaceholder": "Vad vill du veta om denna produkt?",
            "tipDesc": "Frågor om rekonstitution, lagring och frakt besvaras snabbast.",
            "submitting": "Skickar...", "official": "Officiell", "answer": "svar", "answers": "svar"
        },
        "learn": {
            "calculator": "Peptidkalkylator", "labResults": "Labbresultat",
            "stayUpdatedDesc": "Få de senaste forskningsinsikterna och exklusiva erbjudanden.",
            "viewFaq": "Se FAQ", "guideTitle": "Den kompletta guiden till peptidforskning",
            "guideDesc": "Ladda ner vår kostnadsfria omfattande guide som täcker peptidfundament, lagring, rekonstitution och forskningsprotokoll.",
            "continueLearning": "Fortsätt lära",
            "browseCollection": "Bläddra i vår kollektion av forskningspeptider med hög renhet.",
            "readTime": "min läsning"
        },
        "contact": {
            "info": "Kontaktinformation", "hours": "Öppettider",
            "hoursDetail": "Måndag - Fredag: 09:00 - 17:00 EST",
            "response": "Svarstid", "responseDetail": "Vi svarar vanligtvis inom 24 timmar"
        },
        "trackOrder": {
            "orderNumberPlaceholder": "t.ex: PP-2026-12345", "emailPlaceholder": "email@exempel.se",
            "notFoundDesc": "Vi kunde inte hitta en order med dessa uppgifter. Kontrollera ordernumret och e-posten.",
            "contactSupport": "Kontakta support för hjälp", "needHelp": "Behöver du hjälp?",
            "faqTitle": "FAQ", "faqDesc": "Vanliga fraktfrågor",
            "contactTitle": "Kontakta oss", "contactDesc": "Få support från vårt team",
            "shippingProgress": "Fraktförlopp", "trackOn": "Spåra på", "website": "webbplats"
        },
        "cart": {
            "invalidPromoCode": "Ogiltig kampanjkod", "promoDiscount": "Kampanjrabatt",
            "estimateProvince": "Uppskatta skatter (välj provins)"
        },
        "checkout": {
            "emptyCartMessage": "Lägg till produkter i varukorgen innan kassan.",
            "newsletter": "Håll mig uppdaterad om nya produkter och kampanjer",
            "continueToShipping": "Fortsätt till frakt", "state": "Stat", "zipCode": "Postnummer",
            "backToInfo": "Tillbaka till information", "continueToPayment": "Fortsätt till betalning",
            "shippingTo": "Skickas till", "backToShipping": "Tillbaka till frakt",
            "confirmationEmail": "Ett bekräftelsemail har skickats till",
            "exportNotice": "Internationell frakt - inga kanadensiska skatter",
            "exportNoticeDetail": "All internationell export är nollskattad. Ingen GST/HST eller provinsiella skatter tillämpas. Importtullar och lokala skatter kan tas ut av destinationslandets tull.",
            "exportZeroRated": "Nollskattad export", "noCanadianTax": "Ingen kanadensisk skatt (export)",
            "currencyNote": "Priser visas i CAD. USD-belopp är uppskattningar baserade på aktuell växelkurs.",
            "ftaCountry": "Frihandelsavtal med Kanada - reducerade eller inga importtullar",
            "cersNotice": "Obs: CERS-deklaration krävs för beställningar över $2 000 CAD.",
            "account": "Konto", "welcomeBack": "Välkommen",
            "signInBenefits": "Logga in för snabbare kassa och tillgång till din orderhistorik",
            "expressCheckout": "Expresskassa", "orSignInWith": "eller logga in med", "or": "eller",
            "continueWithGoogle": "Fortsätt med Google", "continueWithApple": "Fortsätt med Apple",
            "continueWithFacebook": "Fortsätt med Facebook", "continueWithX": "Fortsätt med X",
            "continueAsGuest": "Fortsätt som gäst", "whyCreateAccount": "Varför skapa ett konto?",
            "benefit1": "Snabbare kassa med sparad information", "benefit2": "Realtidsspårning av beställningar",
            "benefit3": "Orderhistorik och rekommendationer", "benefit4": "Exklusiva erbjudanden och lojalitetspoäng",
            "backToSignIn": "← Tillbaka till inloggning", "loggedIn": "Inloggad",
            "saveAddress": "Spara denna adress för framtida beställningar", "expressPayment": "Expressbetalning",
            "orPayWithCard": "eller betala med kort", "creditCard": "Kreditkort",
            "savePayment": "Spara detta kort för framtida köp", "estimatedDelivery": "Beräknad leverans",
            "whatHappensNext": "Vad händer sedan?", "emailConfirmation": "Du får snart ett bekräftelsemail",
            "orderProcessed": "Din beställning behandlas och skickas inom 24-48 timmar",
            "trackingNumber": "Du får ett spårningsnummer via e-post när den skickas",
            "researchNotice": "ENDAST FÖR FORSKNING: Alla produkter är avsedda för laboratorie- och forskningsändamål endast. Inte för human eller djurförbrukning.",
            "questionsContact": "Frågor om din beställning? Kontakta oss på",
            "postcode": "Postnummer", "cap": "CAP", "plz": "PLZ", "postnummer": "Postnummer",
            "region": "Region", "department": "Avdelning", "county": "Län", "canton": "Kanton",
            "prefecture": "Prefektur", "voivodeship": "Vojvodskap", "stateTerritory": "Stat/Territorium",
            "postalCodeExample": "t.ex."
        },
        "shipping": {
            "packagingHandling": "Förpackning och hantering", "orderTracking": "Orderspårning",
            "customsDuties": "Tull och importavgifter", "lostDamaged": "Förlorade eller skadade paket",
            "questionsShipping": "Frågor om frakt?", "viewFaq": "Se FAQ", "region": "Region",
            "freeOver": "GRATIS över {amount}", "under": "under {amount}",
            "priority": "Prioritet", "nextBusinessDay": "Nästa arbetsdag",
            "standardInternational": "Standard internationell", "expressInternational": "Express internationell",
            "europe": "Europa (EU, UK)", "australia": "Australien / Nya Zeeland", "asia": "Asien",
            "restOfWorld": "Resten av världen", "calculatedAtCheckout": "Beräknas i kassan"
        },
        "refund": {
            "eligibleReturn": "Berättigad till retur/återbetalning", "howToRequest": "Hur man begär återbetalning",
            "refundTimeline": "Återbetalningstidslinje", "damagedDefective": "Skadade eller defekta produkter",
            "orderCancellations": "Orderavbokningar", "exchanges": "Byten",
            "paymentMethod": "Betalningsmetod", "processingTime": "Behandlingstid",
            "creditDebit": "Kredit-/betalkort", "paypal": "PayPal", "applePay": "Apple Pay / Google Pay",
            "timesVary": "Tiderna kan variera beroende på din bank eller finansinstitut."
        }
    },
    # Korean translations
    "ko": {
        "subscriptions": {
            "faqTitle": "구독 FAQ",
            "faq1Q": "언제든지 취소할 수 있나요?",
            "faq1A": "네! 언제든지 페널티 없이 구독을 취소, 일시 중지 또는 수정할 수 있습니다.",
            "faq2Q": "할인은 어떻게 적용되나요?",
            "faq2A": "주문 빈도가 높을수록 더 많이 절약합니다. 주간 배송은 20%, 월간은 10% 절약됩니다.",
            "faq3Q": "배송을 건너뛸 수 있나요?",
            "faq3A": "물론입니다. 개별 배송을 건너뛰거나 구독을 일시적으로 중지할 수 있습니다.",
            "faq4Q": "로열티 포인트를 받을 수 있나요?",
            "faq4A": "네! 구독 주문에서 전체 로열티 포인트를 얻고, 배송당 200 보너스 포인트도 받습니다."
        },
        "videos": {"calculator": "계산기", "labResults": "실험실 결과"},
        "community": {
            "questionPlaceholder": "질문이나 주제가 무엇인가요?",
            "contentPlaceholder": "생각, 질문 또는 경험을 공유하세요...",
            "tagsPlaceholder": "예: bpc-157, 재구성, 초보자"
        },
        "webinars": {
            "recordings": "녹화", "always": "항상", "enterEmail": "이메일을 입력하세요",
            "registerWebinar": "웨비나 등록", "receiveConfirmation": "확인 이메일을 받게 됩니다",
            "withWebinarLink": "웨비나 링크와 함께.", "confirmRegistration": "등록 확인",
            "signInToRegister": "등록하려면 로그인하세요",
            "signInRequired": "이 웨비나에 등록하려면 로그인하세요.",
            "education": "교육", "tutorial": "튜토리얼", "bestPractices": "모범 사례"
        },
        "ambassador": {
            "applyDesc": "간단한 신청서를 작성하세요", "approveDesc": "48시간 내에 신청서를 검토합니다",
            "shareDesc": "고유 링크를 사용하여 제품을 홍보하세요", "earnDesc": "매월 판매에 대한 지불을 받으세요",
            "commission": "수수료", "referrals": "추천", "mostPopular": "가장 인기 있는",
            "nextTier": "다음 등급", "moreReferralsNeeded": "추가 추천 필요",
            "yourReferralLink": "귀하의 추천 링크", "backToOverview": "개요로 돌아가기",
            "applyToBecome": "앰버서더 신청", "websiteUrl": "웹사이트 또는 블로그 URL",
            "socialProfiles": "소셜 미디어 프로필", "estimatedFollowers": "예상 팔로워/청중 수",
            "whyJoin": "왜 우리 프로그램에 참여하고 싶으신가요?",
            "promotionPlan": "우리 제품을 어떻게 홍보할 계획인가요?",
            "termsNote": "신청함으로써 앰버서더 약관에 동의합니다. 모든 신청서를 수동으로 검토하고 48시간 내에 응답합니다.",
            "upTo20Commission": "최대 20% 수수료", "freeProducts": "무료 제품",
            "passiveIncome": "수동 소득", "exclusivePerks": "독점 혜택",
            "faq1Q": "어떻게 지불받나요?", "faq1A": "$50 이상의 수익에 대해 PayPal 또는 은행 송금을 통해 매월 지불됩니다.",
            "faq2Q": "최소 청중 규모가 있나요?", "faq2A": "최소 요건 없음! 펩타이드 연구에 열정적인 모든 규모의 앰버서더를 환영합니다.",
            "faq3Q": "어떤 플랫폼에서든 홍보할 수 있나요?", "faq3A": "네! 블로그, YouTube, Instagram, TikTok, 이메일 목록 - 청중이 있는 곳 어디서든.",
            "faq4Q": "쿠키는 얼마나 지속되나요?", "faq4A": "추적 쿠키는 30일 동안 지속되므로 해당 기간 내 판매에 대한 크레딧을 받습니다.",
            "faq5Q": "먼저 고객이 되어야 하나요?", "faq5A": "필수는 아니지만 도움이 됩니다! 사용자의 진정한 추천이 가장 효과적입니다.",
            "faq6Q": "어떤 마케팅 자료를 제공하나요?", "faq6A": "배너, 제품 이미지, 이메일 템플릿 및 소셜 미디어 콘텐츠를 제공합니다."
        },
        "account": {
            "emailReadOnly": "이메일은 변경할 수 없습니다",
            "oauthPassword": "비밀번호는 소셜 로그인 제공업체에서 관리됩니다",
            "streetAddress": "주소", "city": "도시", "province": "도/주", "postalCode": "우편번호",
            "country": "국가", "saveAddress": "주소 저장", "dangerZone": "위험 구역",
            "deleteAccount": "계정 삭제",
            "deleteAccountDesc": "삭제 후 모든 데이터가 영구적으로 제거됩니다. 이 작업은 취소할 수 없습니다.",
            "requestDeletion": "계정 삭제 요청", "reordering": "재주문 중...",
            "orderNumber": "주문 #", "orderDate": "주문 날짜", "orderStatus": "상태",
            "orderTotal": "총계", "viewDetails": "상세 보기", "hideDetails": "상세 숨기기",
            "shippingAddress": "배송 주소", "trackingNumber": "추적 번호",
            "orderItems": "주문 상품", "subtotal": "소계", "tax": "세금", "shipping": "배송",
            "statusPending": "대기 중", "statusProcessing": "처리 중", "statusShipped": "발송됨",
            "statusDelivered": "배송됨", "statusCancelled": "취소됨",
            "profileUpdated": "프로필이 성공적으로 업데이트되었습니다",
            "passwordUpdated": "비밀번호가 성공적으로 업데이트되었습니다",
            "addressSaved": "주소가 성공적으로 저장되었습니다",
            "deleteConfirm": "정말로 계정을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.",
            "deletionRequested": "계정 삭제 요청이 전송되었습니다. 24시간 내에 처리됩니다."
        },
        "reviews": {
            "writeReviewFor": "리뷰 작성:", "signIn": "로그인",
            "reviewTitlePlaceholder": "경험을 요약하세요",
            "yourReviewPlaceholder": "이 제품에 대한 경험을 알려주세요...",
            "minCharacters": "최소 20자", "clickToUpload": "이미지를 업로드하려면 클릭",
            "earnPointsDesc": "검증된 리뷰를 제출하고 보너스 포인트를 받으세요",
            "showingStarReviews": "{rating}별 리뷰 표시", "showingAllReviews": "모든 {count}개 리뷰 표시",
            "clearFilter": "필터 지우기"
        },
        "qa": {
            "questionsAbout": "에 대한 질문", "askAbout": "에 대해 질문하기", "signIn": "로그인",
            "questionPlaceholder": "이 제품에 대해 무엇을 알고 싶으신가요?",
            "tipDesc": "재구성, 보관 및 배송에 대한 질문이 가장 빨리 답변됩니다.",
            "submitting": "제출 중...", "official": "공식", "answer": "답변", "answers": "답변"
        },
        "learn": {
            "calculator": "펩타이드 계산기", "labResults": "실험실 결과",
            "stayUpdatedDesc": "최신 연구 인사이트와 독점 제안을 받으세요.",
            "viewFaq": "FAQ 보기", "guideTitle": "펩타이드 연구 완전 가이드",
            "guideDesc": "펩타이드 기초, 보관, 재구성 및 연구 프로토콜을 다루는 무료 종합 가이드를 다운로드하세요.",
            "continueLearning": "학습 계속하기",
            "browseCollection": "고순도 연구용 펩타이드 컬렉션을 둘러보세요.",
            "readTime": "분 읽기"
        },
        "contact": {
            "info": "연락처 정보", "hours": "영업 시간",
            "hoursDetail": "월요일 - 금요일: 오전 9시 - 오후 5시 EST",
            "response": "응답 시간", "responseDetail": "일반적으로 24시간 내에 응답합니다"
        },
        "trackOrder": {
            "orderNumberPlaceholder": "예: PP-2026-12345", "emailPlaceholder": "email@example.com",
            "notFoundDesc": "해당 세부 정보로 주문을 찾을 수 없습니다. 주문 번호와 이메일을 확인하세요.",
            "contactSupport": "도움이 필요하면 지원팀에 문의하세요", "needHelp": "도움이 필요하신가요?",
            "faqTitle": "FAQ", "faqDesc": "일반적인 배송 질문", "contactTitle": "문의하기",
            "contactDesc": "팀의 지원을 받으세요", "shippingProgress": "배송 진행", "trackOn": "추적:",
            "website": "웹사이트"
        },
        "cart": {
            "invalidPromoCode": "유효하지 않은 프로모션 코드", "promoDiscount": "프로모션 할인",
            "estimateProvince": "세금 추정(주 선택)"
        },
        "checkout": {
            "emptyCartMessage": "결제 전에 장바구니에 제품을 추가하세요.",
            "newsletter": "새 제품과 프로모션 정보를 받겠습니다",
            "continueToShipping": "배송으로 계속", "state": "주", "zipCode": "우편번호",
            "backToInfo": "정보로 돌아가기", "continueToPayment": "결제로 계속",
            "shippingTo": "배송지:", "backToShipping": "배송으로 돌아가기",
            "confirmationEmail": "확인 이메일이 발송되었습니다:",
            "exportNotice": "국제 배송 - 캐나다 세금 없음",
            "exportNoticeDetail": "모든 국제 수출은 면세입니다. GST/HST 또는 주 세금이 적용되지 않습니다. 수입 관세와 현지 세금은 목적지 국가의 세관에서 부과될 수 있습니다.",
            "exportZeroRated": "면세 수출", "noCanadianTax": "캐나다 세금 없음(수출)",
            "currencyNote": "가격은 CAD로 표시됩니다. USD 금액은 현재 환율을 기준으로 한 추정치입니다.",
            "ftaCountry": "캐나다와 자유무역협정 - 수입 관세 감면 또는 면제",
            "cersNotice": "참고: $2,000 CAD 이상 주문에는 CERS 신고가 필요합니다.",
            "account": "계정", "welcomeBack": "환영합니다",
            "signInBenefits": "빠른 결제와 주문 기록 접근을 위해 로그인하세요",
            "expressCheckout": "빠른 결제", "orSignInWith": "또는 로그인:", "or": "또는",
            "continueWithGoogle": "Google로 계속", "continueWithApple": "Apple로 계속",
            "continueWithFacebook": "Facebook으로 계속", "continueWithX": "X로 계속",
            "continueAsGuest": "게스트로 계속", "whyCreateAccount": "왜 계정을 만들어야 하나요?",
            "benefit1": "저장된 정보로 빠른 결제", "benefit2": "실시간 주문 추적",
            "benefit3": "주문 기록 및 추천", "benefit4": "독점 제안 및 로열티 포인트",
            "backToSignIn": "← 로그인으로 돌아가기", "loggedIn": "로그인됨",
            "saveAddress": "향후 주문을 위해 이 주소 저장", "expressPayment": "빠른 결제",
            "orPayWithCard": "또는 카드로 결제", "creditCard": "신용카드",
            "savePayment": "향후 구매를 위해 이 카드 저장", "estimatedDelivery": "예상 배송",
            "whatHappensNext": "다음에 무슨 일이 일어나나요?",
            "emailConfirmation": "곧 확인 이메일을 받게 됩니다",
            "orderProcessed": "주문은 24-48시간 내에 처리되어 발송됩니다",
            "trackingNumber": "발송 후 이메일로 추적 번호를 받게 됩니다",
            "researchNotice": "연구 목적 전용: 모든 제품은 실험실 및 연구 목적으로만 사용됩니다. 인간이나 동물 소비용이 아닙니다.",
            "questionsContact": "주문에 대한 질문이 있으시면 연락주세요:",
            "postcode": "우편번호", "cap": "CAP", "plz": "PLZ", "postnummer": "Postnummer",
            "region": "지역", "department": "부서", "county": "군", "canton": "주",
            "prefecture": "현", "voivodeship": "주", "stateTerritory": "주/영토",
            "postalCodeExample": "예"
        },
        "shipping": {
            "packagingHandling": "포장 및 취급", "orderTracking": "주문 추적",
            "customsDuties": "세관 및 수입 관세", "lostDamaged": "분실 또는 손상된 패키지",
            "questionsShipping": "배송에 대한 질문?", "viewFaq": "FAQ 보기", "region": "지역",
            "freeOver": "{amount} 이상 무료", "under": "{amount} 미만",
            "priority": "우선", "nextBusinessDay": "다음 영업일",
            "standardInternational": "표준 국제", "expressInternational": "익스프레스 국제",
            "europe": "유럽(EU, 영국)", "australia": "호주/뉴질랜드", "asia": "아시아",
            "restOfWorld": "기타 지역", "calculatedAtCheckout": "결제 시 계산"
        },
        "refund": {
            "eligibleReturn": "반품/환불 자격", "howToRequest": "환불 요청 방법",
            "refundTimeline": "환불 일정", "damagedDefective": "손상되거나 결함이 있는 제품",
            "orderCancellations": "주문 취소", "exchanges": "교환",
            "paymentMethod": "결제 방법", "processingTime": "처리 시간",
            "creditDebit": "신용/직불 카드", "paypal": "PayPal", "applePay": "Apple Pay / Google Pay",
            "timesVary": "시간은 은행이나 금융 기관에 따라 다를 수 있습니다."
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

    print("\nRemaining translations completed!")

if __name__ == "__main__":
    main()
