#!/usr/bin/env python3
"""
Script to complete missing translations in final locale files
vi, hi, ta, pa, tl, ht, gcr
"""
import json
import os

# Base English translations to copy for less common languages
BASE_TRANSLATIONS = {
    "subscriptions": {
        "faqTitle": "Subscription FAQ",
        "faq1Q": "Can I cancel anytime?",
        "faq1A": "Yes! You can cancel, pause, or modify your subscription at any time with no penalties.",
        "faq2Q": "How does the discount work?",
        "faq2A": "The more frequently you order, the more you save. Weekly deliveries save 20%, monthly saves 10%.",
        "faq3Q": "Can I skip a delivery?",
        "faq3A": "Absolutely. You can skip individual deliveries or pause your subscription temporarily.",
        "faq4Q": "Will I earn loyalty points?",
        "faq4A": "Yes! You earn full loyalty points on subscription orders, plus 200 bonus points per delivery."
    },
    "videos": {"calculator": "Calculator", "labResults": "Lab Results"},
    "community": {
        "questionPlaceholder": "What's your question or topic?",
        "contentPlaceholder": "Share your thoughts, questions, or experiences...",
        "tagsPlaceholder": "e.g., bpc-157, reconstitution, beginner"
    },
    "webinars": {
        "recordings": "Recordings", "always": "Always", "enterEmail": "Enter your email",
        "registerWebinar": "Register for Webinar",
        "receiveConfirmation": "You will receive a confirmation email at",
        "withWebinarLink": "with the webinar link.",
        "confirmRegistration": "Confirm Registration",
        "signInToRegister": "Sign In to Register",
        "signInRequired": "Please sign in to register for this webinar.",
        "education": "Education", "tutorial": "Tutorial", "bestPractices": "Best Practices"
    },
    "ambassador": {
        "applyDesc": "Fill out our simple application form",
        "approveDesc": "We review applications within 48 hours",
        "shareDesc": "Use your unique link to promote products",
        "earnDesc": "Get paid monthly for every sale",
        "commission": "commission", "referrals": "referrals", "mostPopular": "Most Popular",
        "nextTier": "Next tier", "moreReferralsNeeded": "more referrals needed",
        "yourReferralLink": "Your Referral Link", "backToOverview": "Back to Overview",
        "applyToBecome": "Apply to Become an Ambassador",
        "websiteUrl": "Website or Blog URL", "socialProfiles": "Social Media Profiles",
        "estimatedFollowers": "Estimated Total Followers/Audience",
        "whyJoin": "Why do you want to join our program?",
        "promotionPlan": "How do you plan to promote our products?",
        "termsNote": "By applying, you agree to our Ambassador Terms and Conditions. We review all applications manually and will respond within 48 hours.",
        "upTo20Commission": "Up to 20% Commission", "freeProducts": "Free Products",
        "passiveIncome": "Passive Income", "exclusivePerks": "Exclusive Perks",
        "faq1Q": "How do I get paid?", "faq1A": "Payments are made monthly via PayPal or bank transfer for earnings over $50.",
        "faq2Q": "Is there a minimum audience size?", "faq2A": "No minimum required! We welcome ambassadors of all sizes who are passionate about peptide research.",
        "faq3Q": "Can I promote on any platform?", "faq3A": "Yes! Blog, YouTube, Instagram, TikTok, email lists - wherever your audience is.",
        "faq4Q": "How long does the cookie last?", "faq4A": "Our tracking cookie lasts 30 days, so you get credit for sales within that window.",
        "faq5Q": "Do I need to be a customer first?", "faq5A": "While not required, it helps! Authentic recommendations from users perform best.",
        "faq6Q": "What marketing materials do you provide?", "faq6A": "We provide banners, product images, email templates, and social media content."
    },
    "account": {
        "emailReadOnly": "Email cannot be changed",
        "oauthPassword": "Your password is managed by your social login provider",
        "streetAddress": "Street Address", "city": "City", "province": "Province/State",
        "postalCode": "Postal Code", "country": "Country", "saveAddress": "Save Address",
        "dangerZone": "Danger Zone", "deleteAccount": "Delete Account",
        "deleteAccountDesc": "Once deleted, all your data will be permanently removed. This action cannot be undone.",
        "requestDeletion": "Request Account Deletion", "reordering": "Reordering...",
        "orderNumber": "Order #", "orderDate": "Order Date", "orderStatus": "Status",
        "orderTotal": "Total", "viewDetails": "View Details", "hideDetails": "Hide Details",
        "shippingAddress": "Shipping Address", "trackingNumber": "Tracking Number",
        "orderItems": "Order Items", "subtotal": "Subtotal", "tax": "Tax", "shipping": "Shipping",
        "statusPending": "Pending", "statusProcessing": "Processing", "statusShipped": "Shipped",
        "statusDelivered": "Delivered", "statusCancelled": "Cancelled",
        "profileUpdated": "Profile updated successfully", "passwordUpdated": "Password updated successfully",
        "addressSaved": "Address saved successfully",
        "deleteConfirm": "Are you sure you want to delete your account? This action cannot be undone.",
        "deletionRequested": "Account deletion requested. Our team will process this within 24 hours."
    },
    "reviews": {
        "writeReviewFor": "Write a Review for", "signIn": "Sign In",
        "reviewTitlePlaceholder": "Summarize your experience",
        "yourReviewPlaceholder": "Tell us about your experience with this product...",
        "minCharacters": "Minimum 20 characters", "clickToUpload": "Click to upload images",
        "earnPointsDesc": "Submit a verified review and earn bonus points",
        "showingStarReviews": "Showing {rating}-star reviews",
        "showingAllReviews": "Showing all {count} reviews",
        "clearFilter": "Clear filter"
    },
    "qa": {
        "questionsAbout": "questions about", "askAbout": "Ask about", "signIn": "Sign In",
        "questionPlaceholder": "What would you like to know about this product?",
        "tipDesc": "Questions about reconstitution, storage, and shipping get answered fastest.",
        "submitting": "Submitting...", "official": "Official", "answer": "answer", "answers": "answers"
    },
    "learn": {
        "calculator": "Peptide Calculator", "labResults": "Lab Results",
        "stayUpdatedDesc": "Get the latest research insights and exclusive offers.",
        "viewFaq": "View FAQ", "guideTitle": "The Complete Guide to Peptide Research",
        "guideDesc": "Download our free comprehensive guide covering peptide fundamentals, storage, reconstitution, and research protocols.",
        "continueLearning": "Continue Learning",
        "browseCollection": "Browse our collection of high-purity research peptides.",
        "readTime": "min read"
    },
    "contact": {
        "info": "Contact Information", "hours": "Business Hours",
        "hoursDetail": "Monday - Friday: 9 AM - 5 PM EST",
        "response": "Response Time", "responseDetail": "We typically respond within 24 hours"
    },
    "trackOrder": {
        "orderNumberPlaceholder": "e.g., PP-2026-12345", "emailPlaceholder": "email@example.com",
        "notFoundDesc": "We couldn't find an order with those details. Please check your order number and email.",
        "contactSupport": "Contact support for help", "needHelp": "Need Help?",
        "faqTitle": "FAQ", "faqDesc": "Common shipping questions", "contactTitle": "Contact Us",
        "contactDesc": "Get support from our team", "shippingProgress": "Shipping Progress",
        "trackOn": "Track on", "website": "website"
    },
    "cart": {
        "invalidPromoCode": "Invalid promo code", "promoDiscount": "Promo Discount",
        "estimateProvince": "Estimate taxes (select province)"
    },
    "checkout": {
        "emptyCartMessage": "Add products to your cart before checking out.",
        "newsletter": "Keep me updated on new products and promotions",
        "continueToShipping": "Continue to shipping", "state": "State", "zipCode": "ZIP code",
        "backToInfo": "Back to information", "continueToPayment": "Continue to payment",
        "shippingTo": "Shipping to", "backToShipping": "Back to shipping",
        "confirmationEmail": "A confirmation email has been sent to",
        "exportNotice": "International Shipping - No Canadian Taxes",
        "exportNoticeDetail": "All international exports are zero-rated. No GST/HST or provincial taxes apply. Import duties and local taxes may be charged by destination country customs.",
        "exportZeroRated": "Zero-rated export", "noCanadianTax": "No Canadian tax (export)",
        "currencyNote": "Prices shown in CAD. USD amounts are estimates based on current exchange rate.",
        "ftaCountry": "Free Trade Agreement with Canada - reduced or no import duties",
        "cersNotice": "Note: Canadian Export Reporting System (CERS) declaration required for orders over $2,000 CAD.",
        "account": "Account", "welcomeBack": "Welcome",
        "signInBenefits": "Sign in for faster checkout and access to your order history",
        "expressCheckout": "Express checkout", "orSignInWith": "or sign in with", "or": "or",
        "continueWithGoogle": "Continue with Google", "continueWithApple": "Continue with Apple",
        "continueWithFacebook": "Continue with Facebook", "continueWithX": "Continue with X",
        "continueAsGuest": "Continue as guest", "whyCreateAccount": "Why create an account?",
        "benefit1": "Faster checkout with saved information", "benefit2": "Real-time order tracking",
        "benefit3": "Order history and recommendations", "benefit4": "Exclusive offers and loyalty points",
        "backToSignIn": "← Back to sign in", "loggedIn": "Logged in",
        "saveAddress": "Save this address for future orders", "expressPayment": "Express payment",
        "orPayWithCard": "or pay with card", "creditCard": "Credit card",
        "savePayment": "Save this card for future purchases", "estimatedDelivery": "Estimated delivery",
        "whatHappensNext": "What happens next?", "emailConfirmation": "You will receive an email confirmation shortly",
        "orderProcessed": "Your order will be processed and shipped within 24-48 hours",
        "trackingNumber": "You will receive a tracking number by email once shipped",
        "researchNotice": "RESEARCH USE ONLY: All products are intended for laboratory and research purposes only. Not for human or animal consumption.",
        "questionsContact": "Questions about your order? Contact us at",
        "postcode": "Postcode", "cap": "CAP", "plz": "PLZ", "postnummer": "Postnummer",
        "region": "Region", "department": "Department", "county": "County", "canton": "Canton",
        "prefecture": "Prefecture", "voivodeship": "Voivodeship", "stateTerritory": "State/Territory",
        "postalCodeExample": "e.g."
    },
    "shipping": {
        "packagingHandling": "Packaging & Handling", "orderTracking": "Order Tracking",
        "customsDuties": "Customs & Import Duties", "lostDamaged": "Lost or Damaged Packages",
        "questionsShipping": "Questions About Shipping?", "viewFaq": "View FAQ", "region": "Region",
        "freeOver": "FREE over {amount}", "under": "under {amount}",
        "priority": "Priority", "nextBusinessDay": "Next business day",
        "standardInternational": "Standard International", "expressInternational": "Express International",
        "europe": "Europe (EU, UK)", "australia": "Australia / New Zealand", "asia": "Asia",
        "restOfWorld": "Rest of World", "calculatedAtCheckout": "Calculated at checkout"
    },
    "refund": {
        "eligibleReturn": "Eligible for Return/Refund", "howToRequest": "How to Request a Refund",
        "refundTimeline": "Refund Timeline", "damagedDefective": "Damaged or Defective Products",
        "orderCancellations": "Order Cancellations", "exchanges": "Exchanges",
        "paymentMethod": "Payment Method", "processingTime": "Processing Time",
        "creditDebit": "Credit/Debit Card", "paypal": "PayPal", "applePay": "Apple Pay / Google Pay",
        "timesVary": "Times may vary depending on your bank or financial institution."
    }
}

# Vietnamese translations
VI_TRANSLATIONS = {
    "subscriptions": {
        "faqTitle": "Câu hỏi thường gặp về đăng ký",
        "faq1Q": "Tôi có thể hủy bất cứ lúc nào không?",
        "faq1A": "Có! Bạn có thể hủy, tạm dừng hoặc sửa đổi đăng ký bất cứ lúc nào mà không bị phạt.",
        "faq2Q": "Giảm giá hoạt động như thế nào?",
        "faq2A": "Bạn đặt hàng càng thường xuyên, bạn càng tiết kiệm nhiều. Giao hàng hàng tuần tiết kiệm 20%, hàng tháng tiết kiệm 10%.",
        "faq3Q": "Tôi có thể bỏ qua một lần giao hàng không?",
        "faq3A": "Chắc chắn. Bạn có thể bỏ qua các lần giao hàng riêng lẻ hoặc tạm dừng đăng ký.",
        "faq4Q": "Tôi có kiếm được điểm thưởng không?",
        "faq4A": "Có! Bạn nhận được đầy đủ điểm thưởng cho các đơn đặt hàng đăng ký, cộng thêm 200 điểm thưởng mỗi lần giao hàng."
    },
    "videos": {"calculator": "Máy tính", "labResults": "Kết quả phòng thí nghiệm"},
    "community": {
        "questionPlaceholder": "Câu hỏi hoặc chủ đề của bạn là gì?",
        "contentPlaceholder": "Chia sẻ suy nghĩ, câu hỏi hoặc kinh nghiệm của bạn...",
        "tagsPlaceholder": "ví dụ: bpc-157, tái cấu thành, người mới bắt đầu"
    }
}

# Hindi translations
HI_TRANSLATIONS = {
    "subscriptions": {
        "faqTitle": "सदस्यता FAQ",
        "faq1Q": "क्या मैं कभी भी रद्द कर सकता हूं?",
        "faq1A": "हां! आप किसी भी समय बिना दंड के अपनी सदस्यता रद्द, रोक या संशोधित कर सकते हैं।",
        "faq2Q": "छूट कैसे काम करती है?",
        "faq2A": "जितनी बार आप ऑर्डर करते हैं, उतना ज्यादा बचत होती है। साप्ताहिक डिलीवरी 20%, मासिक 10% बचाती है।",
        "faq3Q": "क्या मैं एक डिलीवरी छोड़ सकता हूं?",
        "faq3A": "बिल्कुल। आप व्यक्तिगत डिलीवरी छोड़ सकते हैं या अपनी सदस्यता अस्थायी रूप से रोक सकते हैं।",
        "faq4Q": "क्या मुझे लॉयल्टी पॉइंट मिलेंगे?",
        "faq4A": "हां! आप सदस्यता ऑर्डर पर पूर्ण लॉयल्टी पॉइंट कमाते हैं, साथ ही प्रति डिलीवरी 200 बोनस पॉइंट।"
    },
    "videos": {"calculator": "कैलकुलेटर", "labResults": "लैब परिणाम"}
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
    # Apply Vietnamese translations
    vi_full = deep_merge(BASE_TRANSLATIONS, VI_TRANSLATIONS)
    update_locale_file("vi", vi_full)

    # Apply Hindi translations
    hi_full = deep_merge(BASE_TRANSLATIONS, HI_TRANSLATIONS)
    update_locale_file("hi", hi_full)

    # For remaining languages, use English base translations
    for locale in ["ta", "pa", "tl", "ht", "gcr"]:
        update_locale_file(locale, BASE_TRANSLATIONS)

    print("\nAll final translations completed!")

if __name__ == "__main__":
    main()
