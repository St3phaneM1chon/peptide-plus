#!/usr/bin/env python3
"""
Split prisma/schema.prisma into prisma/schema/ multi-file structure.
Uses prismaSchemaFolder preview feature (Prisma 5.22+).
"""
import re
import os

SCHEMA_PATH = "/Volumes/AI_Project/peptide-plus/prisma/schema.prisma"
OUTPUT_DIR = "/Volumes/AI_Project/peptide-plus/prisma/schema"

# Domain assignment for each model
MODEL_DOMAINS = {
    # === AUTH ===
    "Account": "auth",
    "User": "auth",
    "Session": "auth",
    "VerificationToken": "auth",
    "Authenticator": "auth",
    "PasswordHistory": "auth",
    "UserAddress": "auth",
    "UserPermissionGroup": "auth",
    "UserPermissionOverride": "auth",
    "NotificationPreference": "auth",
    "SavedCard": "auth",

    # === ECOMMERCE ===
    "Product": "ecommerce",
    "ProductView": "ecommerce",
    "ProductFormat": "ecommerce",
    "ProductFormatTranslation": "ecommerce",
    "ProductImage": "ecommerce",
    "ProductQuestion": "ecommerce",
    "ProductTranslation": "ecommerce",
    "Category": "ecommerce",
    "CategoryTranslation": "ecommerce",
    "Order": "ecommerce",
    "OrderItem": "ecommerce",
    "OrderEvent": "ecommerce",
    "Cart": "ecommerce",
    "CartItem": "ecommerce",
    "Bundle": "ecommerce",
    "BundleItem": "ecommerce",
    "Discount": "ecommerce",
    "PromoCode": "ecommerce",
    "PromoCodeUsage": "ecommerce",
    "Currency": "ecommerce",
    "Purchase": "ecommerce",
    "Shipping": "ecommerce",
    "ShippingStatusHistory": "ecommerce",
    "ShippingZone": "ecommerce",
    "ReturnRequest": "ecommerce",
    "Refund": "ecommerce",
    "PaymentError": "ecommerce",
    "PaymentMethodConfig": "ecommerce",
    "Review": "ecommerce",
    "ReviewImage": "ecommerce",
    "Subscription": "ecommerce",
    "PriceWatch": "ecommerce",
    "StockAlert": "ecommerce",
    "UpsellConfig": "ecommerce",
    "QuantityDiscount": "ecommerce",
    "GiftCard": "ecommerce",
    "CourseAccess": "ecommerce",
    "Grade": "ecommerce",
    "Module": "ecommerce",
    "Wishlist": "ecommerce",
    "WishlistCollection": "ecommerce",
    "WishlistItem": "ecommerce",
    "AbandonedCart": "ecommerce",
    "CustomerMetrics": "ecommerce",
    "CustomerPreference": "ecommerce",
    "SocialProofEvent": "ecommerce",
    "CustomField": "ecommerce",
    "CustomFieldValue": "ecommerce",
    "Estimate": "ecommerce",
    "EstimateItem": "ecommerce",
    "PriceBook": "ecommerce",
    "PriceBookEntry": "ecommerce",
    "CompanyCustomer": "ecommerce",
    "Company": "ecommerce",
    "ClientReference": "ecommerce",
    "ProductTierPrice": "ecommerce",

    # === ACCOUNTING ===
    "AccountingAlert": "accounting",
    "AccountingPeriod": "accounting",
    "AccountingSettings": "accounting",
    "FiscalYear": "accounting",
    "ChartOfAccount": "accounting",
    "JournalEntry": "accounting",
    "JournalLine": "accounting",
    "BankAccount": "accounting",
    "BankTransaction": "accounting",
    "BankRule": "accounting",
    "Budget": "accounting",
    "BudgetLine": "accounting",
    "CreditNote": "accounting",
    "CustomerInvoice": "accounting",
    "CustomerInvoiceItem": "accounting",
    "SupplierInvoice": "accounting",
    "Expense": "accounting",
    "TaxReport": "accounting",
    "FixedAsset": "accounting",
    "FixedAssetDepreciation": "accounting",
    "FiscalCalendarEvent": "accounting",
    "RecurringEntryTemplate": "accounting",
    "AccountingExport": "accounting",
    "CashFlowEntry": "accounting",
    "OcrScan": "accounting",
    "CustomReport": "accounting",
    "LegalEntity": "accounting",
    "IntercompanyTransaction": "accounting",
    "CostProject": "accounting",
    "ProjectCostEntry": "accounting",
    "ProjectMilestone": "accounting",
    "ClientPortalAccess": "accounting",
    "BatchJob": "accounting",
    "RSDeProject": "accounting",
    "RSDeExpense": "accounting",
    "RSDeCalculation": "accounting",
    "Employee": "accounting",
    "PayrollRun": "accounting",
    "PayrollEntry": "accounting",
    "PayStub": "accounting",
    "TimeEntry": "accounting",
    "TimeProject": "accounting",
    "ExchangeRate": "accounting",

    # === CRM ===
    "CrmLead": "crm",
    "CrmPipeline": "crm",
    "CrmPipelineStage": "crm",
    "CrmDeal": "crm",
    "CrmDealProduct": "crm",
    "CrmDealStageHistory": "crm",
    "CrmTask": "crm",
    "CrmActivity": "crm",
    "InboxConversation": "crm",
    "InboxMessage": "crm",
    "SlaPolicy": "crm",
    "AgentDailyStats": "crm",
    "CrmWorkflow": "crm",
    "CrmWorkflowStep": "crm",
    "CrmWorkflowExecution": "crm",
    "CrmCampaign": "crm",
    "CrmCampaignActivity": "crm",
    "CrmConsentRecord": "crm",
    "CallingRule": "crm",
    "CrmQuota": "crm",
    "CrmScheduledReport": "crm",
    "CrmLeadForm": "crm",
    "CrmSnippet": "crm",
    "CrmQuote": "crm",
    "CrmQuoteItem": "crm",
    "CrmApproval": "crm",
    "AgentSchedule": "crm",
    "CrmQaForm": "crm",
    "CrmQaScore": "crm",
    "AgentBreak": "crm",
    "CrmDealTeam": "crm",
    "CrmContract": "crm",
    "CrmTicket": "crm",
    "CrmTicketComment": "crm",
    "KBArticle": "crm",
    "KBCategory": "crm",
    "CrmWorkflowVersion": "crm",
    "CrmPlaybook": "crm",
    "DataRetentionPolicy": "crm",
    "ProspectList": "crm",
    "Prospect": "crm",
    "CustomerNote": "crm",
    "WorkflowRule": "crm",
    "ApprovalRequest": "crm",

    # === COMMUNICATIONS ===
    "EmailLog": "communications",
    "EmailBounce": "communications",
    "EmailSuppression": "communications",
    "EmailTemplate": "communications",
    "InboundEmail": "communications",
    "InboundEmailAttachment": "communications",
    "EmailConversation": "communications",
    "OutboundReply": "communications",
    "ConversationNote": "communications",
    "ConversationActivity": "communications",
    "CannedResponse": "communications",
    "EmailAutomationFlow": "communications",
    "EmailCampaign": "communications",
    "ConsentRecord": "communications",
    "EmailSettings": "communications",
    "EmailAccount": "communications",
    "EmailSegment": "communications",
    "EmailFlowExecution": "communications",
    "EmailEngagement": "communications",
    "Conversation": "communications",
    "Message": "communications",
    "ChatConversation": "communications",
    "ChatMessage": "communications",
    "ChatSettings": "communications",
    "QuickReply": "communications",
    "QuickReplyTranslation": "communications",
    "MailingListSubscriber": "communications",
    "MailingListPreference": "communications",
    "SmsLog": "communications",
    "SmsCampaign": "communications",
    "SmsCampaignMessage": "communications",
    "SmsOptOut": "communications",
    "SmsTemplate": "communications",

    # === CONTENT ===
    "BlogPost": "content",
    "BlogPostTranslation": "content",
    "Article": "content",
    "ArticleTranslation": "content",
    "Faq": "content",
    "FaqTranslation": "content",
    "Guide": "content",
    "GuideTranslation": "content",
    "HeroSlide": "content",
    "HeroSlideTranslation": "content",
    "NewsArticle": "content",
    "NewsArticleTranslation": "content",
    "NewsletterSubscriber": "content",
    "Page": "content",
    "PageTranslation": "content",
    "Testimonial": "content",
    "TestimonialTranslation": "content",
    "Webinar": "content",
    "WebinarTranslation": "content",
    "ForumCategory": "content",
    "ForumPost": "content",
    "ForumReply": "content",
    "ForumVote": "content",
    "ContactMessage": "content",
    "TranslationJob": "content",
    "TranslationFeedback": "content",
    "BrandKit": "content",

    # === INVENTORY ===
    "InventoryReservation": "inventory",
    "InventoryTransaction": "inventory",
    "PurchaseOrder": "inventory",
    "PurchaseOrderItem": "inventory",
    "PurchaseOrderReceipt": "inventory",
    "PurchaseOrderReceiptItem": "inventory",
    "Warehouse": "inventory",
    "StockLevel": "inventory",
    "StockMovement": "inventory",
    "StockTransfer": "inventory",
    "StockTransferItem": "inventory",
    "Supplier": "inventory",
    "SupplierContact": "inventory",
    "SupplierLink": "inventory",

    # === LOYALTY ===
    "Ambassador": "loyalty",
    "AmbassadorCommission": "loyalty",
    "AmbassadorPayout": "loyalty",
    "Referral": "loyalty",
    "LoyaltyTransaction": "loyalty",
    "LoyaltyTierConfig": "loyalty",

    # === MEDIA ===
    "Media": "media",
    "DocumentAttachment": "media",
    "Video": "media",
    "VideoTranslation": "media",
    "VideoCategory": "media",
    "VideoCategoryTranslation": "media",
    "VideoPlacement": "media",
    "VideoProductLink": "media",
    "VideoTag": "media",
    "SiteConsent": "media",
    "ConsentFormTemplate": "media",
    "ConsentFormTranslation": "media",
    "PlatformConnection": "media",
    "RecordingImport": "media",
    "VideoSession": "media",
    "VideoRoom": "media",
    "ContentInteraction": "media",

    # === SYSTEM ===
    "AuditLog": "system",
    "AuditTrail": "system",
    "SearchLog": "system",
    "WebhookEvent": "system",
    "WebhookEndpoint": "system",
    "WebhookDelivery": "system",
    "SiteSetting": "system",
    "SiteSettings": "system",
    "PerformanceLog": "system",
    "AdminNavSection": "system",
    "AdminNavSubSection": "system",
    "AdminNavPage": "system",
    "Permission": "system",
    "PermissionGroup": "system",
    "PermissionGroupPermission": "system",
    "ApiKey": "system",
    "ApiUsageLog": "system",
    "Workflow": "system",
    "WorkflowRun": "system",
    "WorkflowStep": "system",
    "AuditFunction": "system",
    "AuditType": "system",
    "AuditRun": "system",
    "AuditFinding": "system",
    "UatTestCase": "system",
    "UatTestError": "system",
    "UatTestRun": "system",
    "IpWhitelist": "system",

    # === MARKETING ===
    "SocialPost": "marketing",
    "SocialPostTranslation": "marketing",
    "AdCampaignSnapshot": "marketing",

    # === VOIP (part of communications) ===
    "VoipConnection": "communications",
    "PhoneNumber": "communications",
    "SipExtension": "communications",
    "CallLog": "communications",
    "CallRecording": "communications",
    "CallTranscription": "communications",
    "CallSurvey": "communications",
    "Voicemail": "communications",
    "DialerCampaign": "communications",
    "DialerListEntry": "communications",
    "DialerDisposition": "communications",
    "DnclEntry": "communications",
    "DialerScript": "communications",
    "CallQueue": "communications",
    "CallQueueMember": "communications",
    "IvrMenu": "communications",
    "IvrMenuOption": "communications",
    "PresenceStatus": "communications",
    "CoachingSession": "communications",
    "CoachingScore": "communications",
}

# Enum domain assignments
ENUM_DOMAINS = {}  # All enums go to _base.prisma

def parse_schema(filepath):
    """Parse schema.prisma into blocks (generator, datasource, model, enum, comments)."""
    with open(filepath, 'r') as f:
        content = f.read()

    blocks = []
    lines = content.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Generator block
        if stripped.startswith('generator '):
            block_lines = [line]
            brace_count = 0
            if '{' in line:
                brace_count += 1
            i += 1
            while i < len(lines) and (brace_count > 0 or '{' not in ''.join(block_lines)):
                block_lines.append(lines[i])
                if '{' in lines[i]:
                    brace_count += 1
                if '}' in lines[i]:
                    brace_count -= 1
                i += 1
                if brace_count == 0:
                    break
            blocks.append(('generator', 'client', '\n'.join(block_lines)))
            continue

        # Datasource block
        if stripped.startswith('datasource '):
            block_lines = [line]
            brace_count = 0
            if '{' in line:
                brace_count += 1
            i += 1
            while i < len(lines) and (brace_count > 0 or '{' not in ''.join(block_lines)):
                block_lines.append(lines[i])
                if '{' in lines[i]:
                    brace_count += 1
                if '}' in lines[i]:
                    brace_count -= 1
                i += 1
                if brace_count == 0:
                    break
            blocks.append(('datasource', 'db', '\n'.join(block_lines)))
            continue

        # Model block
        if stripped.startswith('model '):
            model_name = stripped.split()[1]
            # Collect preceding comments
            preceding_comments = []
            j = len(blocks) - 1
            while j >= 0 and blocks[j][0] == 'comment':
                preceding_comments.insert(0, blocks.pop(j))
                j -= 1

            block_lines = [line]
            brace_count = 0
            if '{' in line:
                brace_count += 1
            i += 1
            while i < len(lines):
                block_lines.append(lines[i])
                if '{' in lines[i]:
                    brace_count += 1
                if '}' in lines[i]:
                    brace_count -= 1
                i += 1
                if brace_count == 0:
                    break

            comment_text = '\n'.join(c[2] for c in preceding_comments)
            model_text = '\n'.join(block_lines)
            if comment_text:
                full_text = comment_text + '\n' + model_text
            else:
                full_text = model_text
            blocks.append(('model', model_name, full_text))
            continue

        # Enum block
        if stripped.startswith('enum '):
            enum_name = stripped.split()[1]
            # Collect preceding comments
            preceding_comments = []
            j = len(blocks) - 1
            while j >= 0 and blocks[j][0] == 'comment':
                preceding_comments.insert(0, blocks.pop(j))
                j -= 1

            block_lines = [line]
            brace_count = 0
            if '{' in line:
                brace_count += 1
            i += 1
            while i < len(lines):
                block_lines.append(lines[i])
                if '{' in lines[i]:
                    brace_count += 1
                if '}' in lines[i]:
                    brace_count -= 1
                i += 1
                if brace_count == 0:
                    break

            comment_text = '\n'.join(c[2] for c in preceding_comments)
            enum_text = '\n'.join(block_lines)
            if comment_text:
                full_text = comment_text + '\n' + enum_text
            else:
                full_text = enum_text
            blocks.append(('enum', enum_name, full_text))
            continue

        # Section comments (// ===... or // ---...)
        if stripped.startswith('//'):
            # Accumulate consecutive comment lines
            comment_lines = [line]
            i += 1
            while i < len(lines) and lines[i].strip().startswith('//'):
                comment_lines.append(lines[i])
                i += 1
            blocks.append(('comment', '', '\n'.join(comment_lines)))
            continue

        # Empty line
        if stripped == '':
            i += 1
            continue

        # Unknown line - skip
        i += 1

    return blocks


def main():
    blocks = parse_schema(SCHEMA_PATH)

    # Organize into domain files
    domain_blocks = {
        '_base': [],
        'auth': [],
        'ecommerce': [],
        'accounting': [],
        'crm': [],
        'communications': [],
        'content': [],
        'inventory': [],
        'loyalty': [],
        'media': [],
        'system': [],
        'marketing': [],
    }

    model_count = {}
    enum_count = 0
    unassigned_models = []

    for btype, bname, btext in blocks:
        if btype in ('generator', 'datasource'):
            domain_blocks['_base'].append((btype, bname, btext))
        elif btype == 'enum':
            domain_blocks['_base'].append((btype, bname, btext))
            enum_count += 1
        elif btype == 'model':
            domain = MODEL_DOMAINS.get(bname)
            if domain:
                domain_blocks[domain].append((btype, bname, btext))
                model_count[domain] = model_count.get(domain, 0) + 1
            else:
                unassigned_models.append(bname)
                # Default to system
                domain_blocks['system'].append((btype, bname, btext))
                model_count['system'] = model_count.get('system', 0) + 1
        elif btype == 'comment':
            # Standalone section comments - skip them (they're already attached to models/enums)
            pass

    if unassigned_models:
        print(f"WARNING: Unassigned models (added to system): {unassigned_models}")

    # Write domain files
    for domain, blocks_list in domain_blocks.items():
        if not blocks_list:
            continue

        filepath = os.path.join(OUTPUT_DIR, f"{domain}.prisma")
        with open(filepath, 'w') as f:
            if domain == '_base':
                # Write generator with previewFeatures, datasource, then enums
                for btype, bname, btext in blocks_list:
                    if btype == 'generator':
                        # Add previewFeatures
                        if 'previewFeatures' not in btext:
                            btext = btext.replace(
                                '}',
                                '  previewFeatures = ["prismaSchemaFolder"]\n}',
                                1
                            )
                        f.write(btext + '\n\n')
                    elif btype == 'datasource':
                        f.write(btext + '\n\n')
                    elif btype == 'enum':
                        f.write(btext + '\n\n')
            else:
                # Domain files: just models
                for btype, bname, btext in blocks_list:
                    f.write(btext + '\n\n')

        print(f"  {domain}.prisma: {sum(1 for b in blocks_list if b[0] == 'model')} models, {sum(1 for b in blocks_list if b[0] == 'enum')} enums")

    print(f"\nTotal enums: {enum_count}")
    print(f"Model counts by domain: {model_count}")
    print(f"Total models: {sum(model_count.values())}")


if __name__ == '__main__':
    main()
