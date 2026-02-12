# Azure Services for E-Commerce: Exhaustive Feature-by-Feature Analysis
## Stack: Next.js + PostgreSQL + Stripe

---

## 1. Azure AI Services for E-Commerce

### 1.1 Azure OpenAI Service

**What it does:** Provides access to GPT-4o, GPT-4o-mini, and other LLMs via API for content generation, chatbots, and search enhancement.

**E-Commerce Use Cases:**
- **Product Description Generation:** Auto-generate SEO-optimized product descriptions, meta tags, and marketing copy at scale. GPT-4o-mini is ideal for this -- 80% cheaper than GPT-4o while still highly capable.
- **AI Shopping Assistant / Chatbot:** Build a conversational assistant that understands product catalogs, answers questions about ingredients/dosages (critical for peptides), guides purchase decisions, and handles pre-sale inquiries. Puratos (food industry) deployed "Purabot" using Azure OpenAI Service to help customers identify products -- a directly analogous use case.
- **Search Enhancement:** Use embeddings to power semantic product search (understanding intent, not just keywords). Combine with Azure AI Search for hybrid retrieval.
- **Review Summarization:** Automatically summarize customer reviews per product.
- **Email Content Generation:** Generate personalized marketing emails, abandoned cart messages.

**Pricing (Pay-as-you-go):**
| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| GPT-4o (Global) | $2.50 | $10.00 |
| GPT-4o-mini | $0.15 | $0.60 |
| Batch API (GPT-4o) | $1.25 | $5.00 |

**Recommendation for your stack:** Use GPT-4o-mini for high-volume tasks (product descriptions, email generation) and GPT-4o for the customer-facing chatbot. Batch API for bulk product description generation at 50% discount. Provisioned Throughput Units (PTU) become cost-effective above ~$1,800/month in pay-as-you-go spend.

**Relevance: HIGH** -- Direct ROI through conversion rate improvement and operational efficiency.

Sources:
- [Puratos Azure OpenAI Case Study](https://www.microsoft.com/en/customers/story/23065-puratos-azure-open-ai-service)
- [Azure OpenAI Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/)
- [Azure OpenAI Pricing Calculator 2026](https://azure-noob.com/blog/azure-openai-pricing-real-costs/)
- [Azure AI Foundry](https://azure.microsoft.com/en-us/products/ai-services/openai-service)

---

### 1.2 Azure AI Search (formerly Cognitive Search)

**What it does:** Fully managed search-as-a-service with full-text search, vector search, semantic ranking, faceted navigation, and AI enrichment pipelines.

**E-Commerce Use Cases:**
- **Product Search:** Full-text search across product names, descriptions, ingredients, categories with typo tolerance and synonym support.
- **Faceted Navigation:** Configure fields (category, price range, brand, peptide type, dosage form) as "facetable" for drill-down filtering -- standard e-commerce pattern.
- **AI Enrichment:** Automatically extract text from product images, translate content, detect language, extract key phrases from descriptions.
- **Semantic Ranking:** Uses deep learning models (adapted from Bing) to re-rank results by meaning, not just keyword match. Returns captions and extracted answers.
- **Vector Search + Hybrid:** Combine traditional BM25 ranking with vector embeddings for "understands what you mean" search. Microsoft's own benchmarks show hybrid retrieval + semantic ranking outperforms pure vector search.
- **Autocomplete & Suggestions:** Built-in autocomplete with 1 transaction per 10 autocomplete requests.

**Pricing:**
| Tier | Monthly Cost/SU | Storage/Partition | Max Partitions | Best For |
|------|----------------|-------------------|----------------|----------|
| Free | $0 | 50 MB | 1 | Development/testing |
| Basic | ~$73.73 | 2 GB | 3 | Small catalog (<15K products) |
| S1 | ~$245.28 | 25 GB | 12 | Medium catalog, production |
| S2 | ~$980 | 100 GB | 12 | Large catalog with AI enrichment |

Semantic ranking is available on Basic and above. Vector search is available on all paid tiers.

**Recommendation for your stack:** Start with Basic (~$74/month) for a peptide e-commerce catalog. S1 ($245/month) if you need semantic ranking at scale with 7-language support. The hybrid search (keyword + vector + semantic reranking) architecture is the gold standard for e-commerce search in 2025-2026.

**Relevance: VERY HIGH** -- Search is the #1 conversion driver in e-commerce.

Sources:
- [Azure AI Search Pricing](https://azure.microsoft.com/en-us/pricing/details/search/)
- [Choose a Service Tier](https://learn.microsoft.com/en-us/azure/search/search-sku-tier)
- [Azure AI Search Features & Pricing Explained](https://www.itmagination.com/technologies/azure-ai-search)
- [Hybrid Retrieval and Reranking](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/azure-ai-search-outperforming-vector-search-with-hybrid-retrieval-and-reranking/3929167)
- [Vector Search Overview](https://learn.microsoft.com/en-us/azure/search/vector-search-overview)

---

### 1.3 Azure AI Personalizer

**CRITICAL WARNING: Being retired October 1, 2026.** New resources can no longer be created (blocked since September 2023).

**What it did:** Reinforcement learning-based recommendations -- rank items, personalize layouts, optimize offers with 2 API calls.

**E-Commerce Use Cases (historically):**
- Product recommendations based on browsing history and purchase behavior
- Personalized homepage layouts
- Dynamic offer optimization

**Recommended Alternatives:**
1. **Azure Machine Learning Studio** -- Build custom recommendation models using reinforcement learning (Microsoft's official migration path)
2. **Azure OpenAI + custom embeddings** -- Use GPT-4o with product embeddings for contextual recommendations
3. **Third-party options:** Dynamic Yield, Bloomreach, BytePlus Recommend

**Relevance: DO NOT USE** -- Plan for alternatives from the start.

Sources:
- [Azure AI Personalizer Retirement](https://azure.microsoft.com/en-us/products/ai-services/ai-personalizer)
- [Alternative to Azure Personalizer](https://learn.microsoft.com/en-us/answers/questions/1810681/alternative-to-azure-personalizer-ai-service)
- [Microsoft Retiring AI Services](https://mspoweruser.com/microsoft-is-retiring-several-azure-ai-services/)

---

### 1.4 Azure Translator

**What it does:** Real-time and batch translation across 100+ languages via REST API. Supports text, document, and custom translation models.

**E-Commerce Use Cases (7 languages):**
- **Product catalog translation:** Translate product names, descriptions, ingredients, usage instructions
- **User reviews translation:** Real-time translation of customer reviews
- **Customer support:** Translate chat messages and support tickets in real-time
- **Dynamic UI translation:** Supplement static i18n with API-driven translation for dynamic content
- **Custom Translator:** Train domain-specific models with peptide/supplement terminology for accuracy

**Pricing:**
| Feature | Cost |
|---------|------|
| Text Translation (Standard) | $10 per 1M characters |
| Document Translation | $15 per 1M characters |
| Custom Translation (Training) | $10/hour |
| Free Tier | 2M characters/month |

**Cost estimate for 7 languages:** If your catalog has 1,000 products with ~2,000 characters each = 2M characters base. Translating to 6 additional languages = 12M characters = ~$120 one-time. Ongoing dynamic content (reviews, support) would add incremental cost.

**Relevance: HIGH** -- Essential for your 7-language requirement. Very cost-effective for e-commerce.

Sources:
- [Azure Translator Pricing](https://azure.microsoft.com/en-us/pricing/details/translator/)
- [Azure Translator Overview](https://azure.microsoft.com/en-us/products/ai-foundry/tools/translator)
- [Azure AI Translator Technology Overview](https://www.itmagination.com/technologies/azure-ai-translator)

---

### 1.5 Azure Content Safety

**What it does:** Detects and classifies harmful content (hate, violence, sexual, self-harm) in text, images, and multimodal inputs. Returns severity levels (Safe, Low, Medium, High).

**E-Commerce Use Cases:**
- **Product Review Moderation:** Automatically flag or reject reviews containing hate speech, spam, or inappropriate content
- **User-Generated Content:** Moderate Q&A sections, community forums, product photos
- **Product Image Screening:** Ensure uploaded product images meet guidelines
- **AI Content Guardrails:** If using Azure OpenAI for chatbot, add Content Safety as a guardrail layer

**Pricing:**
| Tier | Text API | Image API | Limits |
|------|----------|-----------|--------|
| F0 (Free) | Free | Free | 5,000 text records + 5,000 images/month |
| S0 (Production) | Per 1,000 text records | Per 1,000 images | Pay-as-you-go |

Note: A text record = up to 1,000 Unicode characters. Exact S0 per-unit pricing requires checking the Azure portal for your region, as Microsoft dynamically prices this based on agreement type.

**Relevance: MEDIUM-HIGH** -- Important if you accept user reviews or user-uploaded content. The free tier (5K records/month) may suffice for moderate volumes.

Sources:
- [Azure Content Safety Overview](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview)
- [Azure Content Safety Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/content-safety/)
- [Content Safety Features](https://www.itmagination.com/technologies/azure-ai-content-safety)

---

## 2. Azure Communication Services

### 2.1 Transactional Email

**What it does:** Fully managed email delivery service (SMTP + REST API). High-volume transactional, bulk, and marketing emails with custom domain support.

**E-Commerce Use Cases:**
- Order confirmation emails
- Shipping notifications / tracking updates
- Password reset / account verification
- Abandoned cart reminders
- Invoice / receipt delivery
- Subscription renewal notices

**Pricing:**
| Component | Cost |
|-----------|------|
| Per email sent | $0.00025 |
| Per MB data transferred | $0.00012 |

**Cost example (from Microsoft docs):** 500,000 purchases/month with 2 emails each (confirmation + shipping) = 1M emails = **$250/month** + data transfer.

**Comparison vs SendGrid/Postmark:** Azure Communication Services email is significantly cheaper than SendGrid Pro ($89.95 for 100K emails). At 1M emails/month, SendGrid would cost ~$500+ while ACS costs ~$250.

**Relevance: HIGH** -- Essential for any e-commerce. Very competitive pricing. Replaces need for SendGrid/Mailgun.

### 2.2 SMS Notifications

**E-Commerce Use Cases:**
- Order confirmation via SMS
- Delivery/shipping status alerts
- Two-factor authentication
- Flash sale / promotion alerts
- Subscription renewal reminders

**Pricing (US):**
| Type | Send Cost/Segment | Receive Cost/Segment | Carrier Surcharge |
|------|-------------------|---------------------|-------------------|
| Toll-Free | ~$0.0075 | ~$0.0075 | ~$0.0010 |
| Short Code | Higher rate | Higher rate | Varies |
| 10DLC | Varies | Varies | Varies |

Plus number provisioning fees (toll-free: ~$2/month).

### 2.3 Push Notifications (Azure Notification Hubs)

Note: Push notifications are handled by **Azure Notification Hubs** (separate service), not ACS directly.

**E-Commerce Use Cases:**
- Order status updates (placed, shipped, delivered)
- Flash sale alerts
- Price drop notifications
- Back-in-stock alerts
- Abandoned cart reminders

**Pricing:**
| Tier | Monthly Base | Included Pushes | Devices |
|------|-------------|-----------------|---------|
| Free | $0 | 1M pushes/subscription | 500 |
| Basic | $10/namespace | 10M pushes | 200K |
| Standard | $200/namespace | 10M pushes | 10M |

**Relevance: HIGH** -- SMS for critical transactional messages; Push for engagement and marketing.

Sources:
- [Azure Communication Services Pricing](https://azure.microsoft.com/en-us/pricing/details/communication-services/)
- [Email Pricing Documentation](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email-pricing)
- [SMS Pricing Documentation](https://learn.microsoft.com/en-us/azure/communication-services/concepts/sms-pricing)
- [Notification Hubs Pricing](https://azure.microsoft.com/en-us/pricing/details/notification-hubs/)
- [ACS vs Exchange Online for Email](https://www.schneider.im/microsoft-azure-communication-services-handling-high-volume-email-traffic/)

---

## 3. Azure Functions (Serverless)

### 3.1 Webhook Processing (Stripe, PayPal)

**Implementation pattern:**
- **HTTPTrigger** function bound to Stripe's webhook endpoint
- Receives charge objects, payment intents, subscription events
- Validates webhook signatures using Stripe's SDK
- Processes the event and pushes to a Storage Queue for downstream processing

Microsoft has an official sample: [Order Fulfillment with Azure Functions and Stripe](https://www.duncanmackenzie.net/blog/order-fulfillment/).

### 3.2 Background Jobs

- **QueueTrigger:** Process order fulfillment, send notification emails, update inventory
- **BlobTrigger:** Process uploaded product images (resize, optimize, generate thumbnails)
- **Event Grid Trigger:** React to database changes, storage events

### 3.3 Timer Triggers

- **Subscription renewal checks:** Run every hour to check for expiring subscriptions
- **Inventory alerts:** Daily check for low-stock items
- **Scheduled reports:** Weekly/monthly revenue and analytics reports
- **Email campaign dispatch:** Scheduled promotional email sends
- **Cart abandonment:** Check for abandoned carts every 30 minutes

### 3.4 Durable Functions for Order Fulfillment

Microsoft provides an [official Order Processing sample](https://learn.microsoft.com/en-us/samples/azure-samples/durable-functions-order-processing/durable-func-order-processing/) deployed to Azure Functions Flex Consumption.

**Workflow pattern (Function Chaining + Fan-out/Fan-in):**
1. Validate order data
2. Calculate taxes and shipping costs (external services)
3. Process payment (Stripe)
4. **Fan-out:** parallel execution of:
   - Update inventory
   - Generate invoice
   - Send confirmation email
   - Notify shipping provider
5. **Fan-in:** Wait for all to complete
6. Update order status
7. **Human interaction pattern:** Wait for external events (shipping confirmation, delivery)

**Key benefits:** Automatic retry on failure, checkpointing (survives VM restarts), timeout handling, and the orchestration state is durable.

**Pricing:**
| Plan | Execution Cost | Memory Cost | Free Grant/Month |
|------|---------------|-------------|------------------|
| Consumption | $0.20/million executions | $0.000016/GB-s | 1M executions + 400K GB-s |
| Flex Consumption (On-Demand) | $0.40/million executions | $0.000026/GB-s | 250K executions + 100K GB-s |
| Flex Consumption (Always Ready) | $0.40/million executions | $0.000016/GB-s (active) + $0.000004/GB-s (idle) | -- |

**Cost estimate:** A medium e-commerce site processing 10,000 orders/month with 50 function invocations per order = 500K executions/month. On Consumption plan, this falls entirely within the free tier.

**Relevance: VERY HIGH** -- Essential for Stripe webhooks, background jobs, and order orchestration.

Sources:
- [Azure Functions Pricing](https://azure.microsoft.com/en-us/pricing/details/functions/)
- [Durable Functions Order Processing Sample](https://learn.microsoft.com/en-us/samples/azure-samples/durable-functions-order-processing/durable-func-order-processing/)
- [Durable Functions Overview](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview)
- [Azure Functions Pricing Guide (Consumption vs Flex)](https://modal.com/blog/azure-function-pricing-guide)
- [Stripe Webhook on Azure Functions](https://learn.microsoft.com/en-us/answers/questions/2180211/azure-function-app-stripe-webhook-api-error)
- [E-Commerce Shipping Saga with Durable Functions](https://gmanvel.medium.com/implementing-e-commerce-shipping-saga-using-azure-durable-functions-36b64a94ae72)

---

## 4. Azure Logic Apps

**What it does:** Low-code/no-code workflow automation platform with 1,400+ pre-built connectors. Now includes MCP (Model Context Protocol) support for AI agent integration.

### 4.1 Order Processing Automation

**Workflow example:**
1. Trigger: New order webhook from your Next.js app
2. Validate order against inventory (ERP/database connector)
3. Process payment via Stripe connector
4. Generate shipping label via carrier API (FedEx, UPS, DHL connectors)
5. Send confirmation email via ACS connector
6. Update order status in PostgreSQL

### 4.2 Inventory Sync with Suppliers

- **Scheduled sync:** Timer trigger polls supplier API for stock levels
- **Real-time sync:** HTTP webhook from supplier systems
- **File-based sync:** Monitor Azure Blob Storage for supplier CSV/XML feeds
- **ERP integration:** Direct connectors for SAP, Dynamics 365, Shopify

### 4.3 Customer Notification Workflows

- Multi-channel notification orchestration (email + SMS + push)
- Conditional routing based on customer preferences
- Escalation workflows for failed deliveries
- Return/refund processing automation

**Pricing:**
| Plan | Cost Model | Per Action | Standard Connector | Enterprise Connector |
|------|-----------|------------|-------------------|---------------------|
| Consumption | Pay-per-execution | $0.000025 | $0.000125/call | $0.001/call |
| Standard | Hosting-based | ~$0.192/vCPU/hour (~$140/month) | Included | Included |

**Built-in operations (HTTP, loops, conditions) are FREE** in both plans.

**Cost estimate:** An order workflow with 20 actions (5 connector calls) = ~$0.000625 per order. At 10,000 orders/month = ~$6.25/month on Consumption plan.

**Relevance: MEDIUM-HIGH** -- Excellent for supplier integrations and multi-step workflows. Consider vs Azure Functions: Logic Apps for connector-heavy, visual workflows; Functions for code-heavy, performance-critical tasks.

Sources:
- [Azure Logic Apps Overview](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview)
- [Logic Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/logic-apps/)
- [Logic Apps 7 Use Cases](https://research.aimultiple.com/azure-logic-apps/)
- [Logic Apps Pricing Explained](https://www.pump.co/blog/azure-logic-apps-pricing)
- [E-Commerce Order Processing on Azure](https://medium.com/@sarathkumar1201/build-an-end-to-end-e-commerce-order-processing-system-on-azure-df4095befcc4)
- [Logic Apps with MCP Support](https://4sysops.com/archives/what-is-microsoft-azure-logic-apps-now-with-mcp-support/)

---

## 5. Azure SignalR Service

**What it does:** Fully managed real-time messaging service supporting WebSockets, Server-Sent Events, and HTTP Long Polling. Automatically negotiates the best transport per client.

### 5.1 Real-Time Features

**Live Chat / Customer Support:**
- Real-time chat between customer and support agent
- AI chatbot with live-agent handoff
- Typing indicators, read receipts
- Chat history persistence

**Order Status Updates:**
- Push order status changes to customer's browser in real-time (placed -> processing -> shipped -> delivered)
- No polling needed -- instant updates
- Integrates with Azure Functions for event-driven updates

### 5.2 Admin Notifications

- Real-time dashboard for new orders, low stock alerts, payment failures
- Multi-admin broadcast for urgent issues
- Role-based notification channels

### 5.3 Stock Alerts / Live Inventory

- Real-time stock level updates on product pages ("Only 3 left!")
- Back-in-stock notifications
- Live auction/bidding updates (if applicable)
- Real-time personalized push ads

**Pricing:**
| Tier | Cost/Unit/Day | Connections/Unit | Free Messages/Day | Features |
|------|--------------|-----------------|-------------------|----------|
| Free | $0 | 20 | 20,000 | Dev/test only |
| Standard | ~$1.61/unit/day (~$49/month) | 1,000 | 1,000,000 | Production |
| Premium | Higher | 1,000 | 1,000,000 | Auto-scaling, AZ support, rate limiting, higher SLA |

**Relevance: MEDIUM** -- Valuable for live chat, real-time order tracking, and admin dashboards. Not critical at launch but becomes important as you scale.

Sources:
- [Azure SignalR Service Overview](https://learn.microsoft.com/en-us/azure/azure-signalr/signalr-overview)
- [Azure SignalR Pricing](https://azure.microsoft.com/en-us/pricing/details/signalr-service/)
- [SignalR Pricing Breakdown](https://plavos.com/blog/azure-signalr-service-pricing-unit-instance-messages/)
- [Azure SignalR Pricing 2025](https://ably.com/topic/azure-signalr-pricing)
- [Real-Time Web Apps with SignalR](https://www.cisin.com/coffee-break/building-real-time-web-applications-with-azure-signalr-service.html)

---

## 6. Azure Maps

**What it does:** Suite of geospatial APIs: geocoding, routing, search, rendering, traffic, geofencing, and spatial operations.

### 6.1 Shipping Zone Calculation

- **Geocoding:** Convert customer addresses to coordinates
- **Routing:** Calculate distances between warehouse and customer for zone-based shipping rates
- **Geofencing:** Define shipping zones and automatically assign rates
- **Spatial math:** Great-circle distance, buffer zones, closest-point calculations

### 6.2 Store Locator

- **Search API:** Find nearest retail locations by customer position
- **Routing:** Directions from customer to store with travel time
- **Map rendering:** Interactive maps with store pins, clustering for multiple locations
- **Traffic data:** Real-time traffic for accurate ETAs

### 6.3 Delivery Tracking Visualization

- **Real-time location on map** for logistics tracking
- **Route visualization:** Display delivery driver route
- **Geofencing alerts:** Notify when package enters delivery area
- **ETA updates:** Traffic-aware estimated delivery times

**Pricing:**
| Service | Free/Month | Cost per 1,000 (up to 500K) |
|---------|-----------|------------------------------|
| Search / Geocoding | 5,000 | $4.50 |
| Routing | 5,000 | $4.50 |
| Map Tiles (Render) | 1,000 | $4.50 |
| Geofencing | 5,000 | $4.50 (per 5 API calls = 1 tx) |
| Autocomplete | Free (10 requests = 1 tx) | $4.50 |

Volume discounts apply above 500K transactions.

**Relevance: MEDIUM** -- Important if you have physical store locations or offer local delivery. Less critical for a purely online peptide e-commerce if shipping is handled by third-party carriers. The shipping zone calculation is the most valuable feature for your use case.

Sources:
- [Azure Maps Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-maps/)
- [Azure Maps Product Page](https://azure.microsoft.com/en-us/products/azure-maps/)
- [Canvas Apps and Azure Maps for E-Commerce Logistics](https://www.crmsoftwareblog.com/2025/04/how-canvas-apps-and-azure-maps-are-powering-next-gen-e-commerce-logistics/)
- [Understanding Azure Maps Transactions](https://learn.microsoft.com/en-us/azure/azure-maps/understanding-azure-maps-transactions)
- [Azure Maps Features and Pricing](https://www.epcgroup.net/azure-maps-pricing-and-feature-geospatial-services-for-real-time-mapping-data)

---

## 7. Azure Cosmos DB

**What it does:** Globally distributed, multi-model NoSQL database with guaranteed single-digit millisecond latency, 99.999% SLA with multi-region writes, and automatic failover.

### 7.1 Session Storage & Shopping Cart

**Why Cosmos DB for carts (not PostgreSQL):**
- **Sub-millisecond reads:** Cart operations are latency-sensitive
- **Flexible schema:** Cart items can have varying attributes (peptide + accessories + bundles)
- **TTL (Time-to-live):** Automatic cart expiration without cron jobs
- **Session consistency:** "Session" consistency level means a user always sees their own writes immediately

**Implementation pattern:**
```
Container: "carts"
Partition key: /userId
TTL: 86400 (24 hours auto-expire)
```

### 7.2 Global Distribution for Multi-Region

- **Turnkey multi-region:** Replicate data to any Azure region with one click
- **Multi-region writes:** Customers in Europe write to EU, customers in US write to US -- both get local latency
- **Automatic failover:** If one region goes down, traffic routes to the nearest available region
- **Conflict resolution:** Built-in policies for multi-region write conflicts

**Pricing:**

| Mode | Compute | Storage | Free Tier |
|------|---------|---------|-----------|
| Serverless | $0.25 per million RUs consumed | $0.25/GB/month | N/A |
| Provisioned (Manual) | ~$5.84/month per 100 RU/s | $0.25/GB/month | 1,000 RU/s + 25 GB (lifetime) |
| Provisioned (Autoscale) | ~$8.76/month per 100 RU/s max | $0.25/GB/month | 1,000 RU/s + 25 GB (lifetime) |

**Note:** Free tier does NOT apply to serverless mode. Multi-region replication multiplies storage costs by the number of regions.

**Recommendation for your stack:** 
- **Serverless** for shopping carts and session storage if traffic is spiky/unpredictable. No minimum charge -- perfect for a growing e-commerce site.
- **Provisioned with Free Tier** if you want predictable costs: 1,000 RU/s + 25 GB free for the lifetime of the account handles a surprising amount of cart/session traffic.
- Keep your main product catalog and orders in **PostgreSQL** (your existing database). Use Cosmos DB specifically for: shopping carts, session state, real-time inventory counters, and any data requiring global distribution.

**Relevance: MEDIUM-HIGH** -- Valuable for cart/session performance and multi-region scenarios. Not strictly necessary at launch if you are single-region with PostgreSQL, but becomes important as you scale globally.

Sources:
- [Azure Cosmos DB Pricing (Serverless)](https://azure.microsoft.com/en-us/pricing/details/cosmos-db/serverless/)
- [Azure Cosmos DB Pricing (Provisioned)](https://azure.microsoft.com/en-us/pricing/details/cosmos-db/autoscale-provisioned/)
- [Cosmos DB Pricing Guide 2025](https://turbo360.com/blog/azure-cosmos-db-cost-pricing)
- [Serverless vs Provisioned](https://learn.microsoft.com/en-us/azure/cosmos-db/throughput-serverless)
- [Cosmos DB Free Tier](https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier)
- [Cosmos DB Pricing Model](https://learn.microsoft.com/en-us/azure/cosmos-db/how-pricing-works)

---

## Summary: Priority Ranking for Your E-Commerce Stack

| Priority | Service | Monthly Cost Estimate (10K orders/mo) | Impact |
|----------|---------|---------------------------------------|--------|
| 1 (Critical) | Azure Functions | ~$0 (free tier) | Stripe webhooks, background jobs |
| 2 (Critical) | Azure Communication Services (Email) | ~$5 (20K emails) | Order confirmations, shipping |
| 3 (High) | Azure AI Search | ~$74-$245 | Product search + faceted nav |
| 4 (High) | Azure OpenAI Service | ~$20-100 (varies) | Chatbot, descriptions, search |
| 5 (High) | Azure Translator | ~$10-50 | 7-language support |
| 6 (High) | Notification Hubs | $0-10 | Push notifications |
| 7 (Medium-High) | Azure Logic Apps | ~$6 | Order workflow automation |
| 8 (Medium-High) | Azure Content Safety | ~$0 (free tier) | Review moderation |
| 9 (Medium-High) | Cosmos DB (Serverless) | ~$5-25 | Cart + session storage |
| 10 (Medium) | Azure SignalR | ~$49 | Real-time features |
| 11 (Medium) | Azure Maps | ~$5-20 | Shipping zones, tracking |
| 12 (DO NOT USE) | Azure Personalizer | N/A | Retiring Oct 2026 |

**Estimated total monthly cost for a medium e-commerce site: $175 - $600/month** depending on configuration, with many services starting at free tier.
