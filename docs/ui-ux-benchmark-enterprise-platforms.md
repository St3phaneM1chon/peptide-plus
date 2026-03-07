# UI/UX Benchmark -- 5 Enterprise Platforms
## March 2026 -- Comprehensive Analysis

---

## 1. SALESFORCE LIGHTNING (SLDS 2 / Cosmos)
**Scope**: Sales Cloud, Service Cloud, SLDS design system, Dynamic Forms, App Builder, Agentforce

### A. Navigation Strategy

| Aspect | Detail |
|---|---|
| **Type** | Top bar (horizontal) with app-level tab navigation. No persistent sidebar by default. |
| **Module Grouping** | Lightning Apps group tabs (objects, lists, utilities) per persona/role. Each App can expose a different combination of tabs. Users switch apps via the App Launcher (waffle icon, top-left). |
| **Context Switching** | App Launcher acts as a central hub to move between Sales, Service, Marketing, etc. Each App loads its own tab set. Within an App, tabs provide object-level navigation. |
| **Command Palette / Global Search** | Native Global Search bar (top center). No built-in command palette -- third-party extensions like Superforce add Cmd+K-style navigation (search by ID, switch apps, access Setup items instantly). |
| **Mega-Menu vs Collapsible Sidebar** | Neither in standard Lightning. The top navigation bar is a flat tab strip. The App Launcher opens as a full-page modal grid of apps and items. Utility Bar (bottom dock) provides persistent mini-panels (notes, history, phone). |
| **Mobile Adaptation** | Salesforce Mobile App (native iOS/Android). Simplified navigation with bottom tab bar, compact record layouts, mobile-optimized Lightning pages. Limited feature parity with desktop. |

### B. Dashboard Philosophy

| Aspect | Detail |
|---|---|
| **Home Paradigm** | Global "Home" page per App (customizable via App Builder). Plus dedicated Dashboard objects for analytics. |
| **Personalization Level** | High. Admins build Lightning Pages with drag-and-drop components (App Builder). Dynamic Forms let admins place individual fields/sections anywhere. Users can pin list views, reorder favorites. Dashboards support filters and drill-down. |
| **Real-Time Data** | Dashboards can auto-refresh. Streaming API supports real-time event handling for custom components. Standard dashboards refresh on-demand or on schedule. |
| **Information Density** | Medium-high (Cosmos reduces this). Record pages can show related lists, tabs, accordions, activity timeline, highlights panel. Dense for power users, configurable to simplify. |
| **AI Integration** | Agentforce (formerly Einstein Copilot) is natively embedded. Appears as a right-side conversational panel. Can answer questions, generate content, automate actions, summarize records. Einstein Analytics/Tableau CRM provides predictive scoring on dashboards. |

### C. Key UI Patterns

| Pattern | Implementation |
|---|---|
| **List + Detail** | List Views (filterable, sortable table) -> click opens full Record Page. No inline split-view; opens as new page. Related lists on Record pages show associated records in embedded tables. |
| **Split-Views / Side Panels** | Split View available in list views (list on left, record preview on right). Utility Bar provides persistent side panels docked at bottom. Console Apps (Service Cloud) offer workspace tabs with split panes. |
| **Data Tables** | List Views support sort, filter (scope + field-level), column reordering, inline editing (for applicable fields), mass actions (change owner, delete, update field). Fixed header on scroll. |
| **Multi-Step Workflows / Wizards** | Path component shows stage progression on record pages. Flow Builder creates multi-step guided screens (wizard-style). Dynamic Forms show/hide fields based on conditions. |
| **Notification System** | Bell icon (top-right) for in-app notifications. Custom notifications via Flows. Push notifications on mobile. Email alerts for workflow rules. |
| **Search and Saved Filters** | Global Search with object-scoped results and recent items. List Views are essentially saved filters -- users can create, pin, and share them. SOSL/SOQL for advanced search. |
| **Forms** | Record Edit forms with field-level validation, required fields, dependent picklists. Dynamic Forms enable conditional visibility per field. Auto-save not standard (explicit Save button). Inline editing on record detail. |

### D. Visual Design (SLDS 2 / Cosmos Theme)

| Aspect | Detail |
|---|---|
| **Density** | Medium. Cosmos introduces more spacing and breathing room compared to SLDS 1. "Adaptable spacing" is a core tenet -- intentional whitespace to reduce cognitive load. |
| **Typography** | Refined type scale with bold page headers creating natural information hierarchy. Reader-friendly sizing. Enhanced legibility with improved contrast. Salesforce Sans remains the base typeface. |
| **Color Palette** | Enriched and more saturated palette derived from the Salesforce color system. Improved brightness and contrast. Clean, modern aesthetic. Blues remain dominant with expanded accent colors. |
| **Icons** | Extensive icon library (SLDS icons). Action icons, standard object icons, utility icons, doctype icons. Consistent 1:1 ratio, rounded containers for object icons. |
| **Light / Dark Mode** | Dark Mode re-introduced with SLDS 2. Built-in theme support via styling hooks. Rolled out progressively from late 2025. |
| **Whitespace & Cards** | Greater use of whitespace in Cosmos. Cards (record components) use rounded corners -- interactive elements get rounded edges to signal clickability. Elevated card style with subtle shadows. |
| **Geometry** | Shift from angular/rectangular (SLDS 1) to rounded corners throughout (Cosmos). Circular and rounded shapes convey friendliness and approachability. |
| **Micro-Animations** | Minimal. Subtle transitions on hover, focus states, and panel expansion. Enterprise-grade restraint in animation. |
| **Loading States** | Skeleton screens (stencil placeholders) for component loading. Spinners for full-page loads. Progressive rendering for list views. |

### E. UX Strengths & Weaknesses

**Top 3 Strengths:**
1. **Extreme Configurability**: App Builder + Dynamic Forms + Flow Builder allow admins to tailor every page, form, and process without code. No other CRM offers this depth of declarative customization.
2. **Mature Design System**: SLDS 2 with 200+ components, styling hooks, Figma kits, and accessibility baked in. Cosmos provides a modern, cohesive visual identity across the entire platform.
3. **AI-Native Integration**: Agentforce is embedded directly into the workflow (not a bolted-on chatbot). Context-aware, action-capable, and grounded in org data via Data Cloud.

**Top 3 Weaknesses:**
1. **Accumulated UI Complexity**: Decades of development produced multiple parallel frameworks (Classic, Visualforce, Aura, LWC). Backward compatibility forces old patterns to persist, making the overall experience inconsistent for orgs with legacy customizations.
2. **No Native Command Palette**: Power users lack Cmd+K-style instant navigation. Global Search is decent but not keyboard-first. Third-party tools fill this gap.
3. **Mobile Feature Gap**: The Salesforce Mobile App delivers a simplified subset of desktop features. Complex layouts, dashboards, and Flow screens often don't translate well to mobile, requiring separate mobile-specific configuration.

---

## 2. SAP S/4HANA CLOUD (Fiori / Horizon)
**Scope**: Enterprise ERP, Fiori design system, Fiori Launchpad, Joule AI, Horizon theme

### A. Navigation Strategy

| Aspect | Detail |
|---|---|
| **Type** | Hybrid: Tile-based Launchpad (home) + left sidebar navigation menu (app-level). Shell Header bar provides global tools. |
| **Module Grouping** | Fiori Launchpad organizes apps into Groups and Catalogs (e.g., Finance, Procurement, HR). Users see tiles on a configurable home screen. Left-side navigation menu appears within apps for deeper drill-down. |
| **Context Switching** | Users navigate between apps via the Launchpad. Flexible Column Layout allows up to 3 columns for master-detail-detail flows without leaving context. "Intent-based navigation" connects apps semantically. |
| **Command Palette / Global Search** | Enterprise Search bar in the Shell Header. AI-assisted search (Joule-powered, 2025+) interprets natural language queries. SAP Joule copilot icon in header acts as a conversational command interface. Users can also launch apps by transaction code or Fiori ID. |
| **Mega-Menu vs Collapsible Sidebar** | Many SAP products now offer a left-side navigation menu (collapsible). The Launchpad itself is a tile grid (similar to a mega-menu concept). Shell Header provides global icons (search, notifications, Joule, user settings). |
| **Mobile Adaptation** | SAP Mobile Start app (native). Uses the Horizon visual theme for cross-device consistency. Supports offline scenarios. Users transition from desktop to mobile with the same design language. |

### B. Dashboard Philosophy

| Aspect | Detail |
|---|---|
| **Home Paradigm** | Tile-based Launchpad is the "Home." Tiles can show live counts, KPIs, or micro-charts. Moving toward "Intent-Driven" home where Joule replaces tile browsing. Per-role Spaces and Pages organize tiles by business function. |
| **Personalization Level** | Medium-high. Users can add/remove tiles, create custom groups, personalize tile placement. SAP Build Work Zone allows page composition. Analytical tiles display live KPIs. Limited drag-and-drop widget customization compared to pure dashboard tools. |
| **Real-Time Data** | Tiles can show real-time counters. Analytical apps (Smart Business) connect to live HANA data. Embedded analytics with SAP Analytics Cloud integration. |
| **Information Density** | High -- enterprise ERP demands dense data display. Fiori Elements templates structure this density into scannable patterns (Object Page headers, sections, tabs). Horizon theme adds breathing room. |
| **AI Integration** | SAP Joule copilot: conversational panel (right-side slide-out). Supports 13 languages. Capabilities include task automation, report generation, data retrieval, smart summarization, and "deep research" (beta). Joule Action Bar (early access). |

### C. Key UI Patterns

| Pattern | Implementation |
|---|---|
| **List + Detail** | List Report floorplan (filterable table with smart filters at top) -> click navigates to Object Page (detail view with header, sections, tabs). Standard Fiori Elements pattern. |
| **Split-Views / Side Panels** | Flexible Column Layout: 2-column (list + detail) or 3-column (list + detail + sub-detail). Columns resize responsively. Joule opens as a right-side panel. |
| **Data Tables** | Responsive Table (default): supports sort, filter, group, column personalization. Analytical Table for large datasets with fixed columns, totals, and hierarchical rows. Grid Table for dense data. Smart Table auto-configures from OData annotations. |
| **Multi-Step Workflows / Wizards** | Wizard floorplan: divides long tasks into sequential sections with progress indicator. Object Page creation mode also supports progressive disclosure. Approval workflows with decision steps. |
| **Notification System** | Bell icon in Shell Header. Notification Center aggregates alerts, workflow approvals, and system messages. Push notifications via Mobile Start. Notifications can trigger actions directly. |
| **Search and Saved Filters** | Smart Filter Bar on List Reports with type-ahead, value help dialogs, and saved filter variants. Users can save, name, and share filter combinations. Global Enterprise Search across all apps. |
| **Forms** | Smart Forms auto-generated from OData annotations. Inline editing with draft handling (auto-save to draft, explicit activation). Field-level validation, mandatory fields, conditional sections. |

### D. Visual Design (Horizon Theme)

| Aspect | Detail |
|---|---|
| **Density** | Medium-high. Dense by necessity (ERP data), but Horizon adds improved spacing, padding, and visual hierarchy compared to older Quartz theme. Compact and Cozy density modes available. |
| **Typography** | Bold typography on page headers for natural hierarchy. SAP 72 font family. Refined font sizes and weights for improved legibility. Clear distinction between titles, labels, and data values. |
| **Color Palette** | 9 color hues with 11 tonal values each. Bold, vibrant, and accessible. Primary/Secondary/Tertiary hierarchy. Improved brightness and contrast over previous themes. |
| **Icons** | SAP icon library (SAP-icons font). Business-oriented icon set. Consistent sizing and alignment. |
| **Light / Dark Mode** | Morning Horizon (light, default), Evening Horizon (dark), plus legacy Quartz Light/Dark. High-Contrast Black and High-Contrast White for accessibility. |
| **Whitespace & Cards** | Tiles and cards use darker shadows for depth. Increased spacing between elements. Cards used for tile-based navigation and analytical micro-charts. |
| **Geometry** | Rounded corners introduced with Horizon for a modern, friendly, approachable look. Shift from the harder edges of Quartz. |
| **Micro-Animations** | Minimal and purposeful. Transitions on column layout changes, tile flips, panel slides. Performance-conscious restraint. |
| **Loading States** | Busy indicators (full-page and inline). Skeleton patterns for Fiori Elements pages. Progress indicators for long-running processes. |

### E. UX Strengths & Weaknesses

**Top 3 Strengths:**
1. **Structured Floorplan System**: Fiori Elements provides standardized, metadata-driven page templates (List Report, Object Page, Wizard, Flexible Column Layout) that ensure consistency across 7,500+ apps. Developers write minimal UI code.
2. **Enterprise-Grade Data Handling**: Smart Tables, Smart Filter Bars, and OData-driven forms handle massive datasets with proper pagination, filtering variants, hierarchical grouping, and draft handling -- all out of the box.
3. **Cross-Product UX Convergence**: Horizon theme unifies the visual experience across S/4HANA, SuccessFactors, Ariba, and other SAP products. SAP Mobile Start mirrors desktop design language on mobile.

**Top 3 Weaknesses:**
1. **Legacy Complexity**: Transaction codes (Tcodes) remain non-intuitive. The coexistence of GUI, Web Dynpro, and Fiori apps creates an inconsistent experience during long migration periods. Some screens still surface German-language parameters.
2. **Screen Instability and Performance**: Users report screens "jumping" during data entry, freezing during operations, and slow response times in the online model. Complex pages with many controls can feel heavy.
3. **Consultant Dependency**: The extreme configurability requires specialized SAP expertise. Self-service customization is limited compared to Salesforce's admin-friendly approach. Online help is not intuitive.

---

## 3. KATANA / CIN7
**Scope**: Katana Cloud Inventory (inventory + manufacturing), Cin7 Omni/Core (inventory + omnichannel), e-commerce integrations

### A. Navigation Strategy

| Aspect | Detail |
|---|---|
| **Type** | **Katana**: Left sidebar navigation with module icons (Dashboard, Sales, Make, Stock, Buy, Contacts, Settings). Clean, minimal sidebar. **Cin7**: Left sidebar with expandable sections (Sales, Purchases, Stock, Production, Contacts, Reports, Integrations). More traditional vertical menu. |
| **Module Grouping** | **Katana**: Modules mirror the supply chain flow: Sell -> Make -> Buy -> Stock. Logical, linear grouping. **Cin7**: Grouped by business function with sub-menus. More granular categorization with deeper nesting. |
| **Context Switching** | **Katana**: Single-level sidebar click switches between modules. No workspace concept. Flat, direct. **Cin7**: Sidebar sections expand/collapse. Switching between Sales/Purchases/Stock requires navigating sub-menus. |
| **Command Palette / Global Search** | **Katana**: Basic search within modules (products, orders). No command palette. **Cin7**: Search available within modules. No global command palette. |
| **Mega-Menu vs Collapsible Sidebar** | **Katana**: Collapsible icon sidebar (icons collapse to small strip). **Cin7**: Vertical sidebar with text labels and expandable sections. |
| **Mobile Adaptation** | **Katana**: No native mobile app. Browser-based responsive design. Shop Floor App and Warehouse App are browser-based mobile-optimized tools for barcode scanning, task management. **Cin7**: Cin7 Omni offers a mobile app for basic stock checks and order management. Limited compared to desktop. |

### B. Dashboard Philosophy

| Aspect | Detail |
|---|---|
| **Home Paradigm** | **Katana**: Single Home dashboard with at-a-glance overview of orders, production status, and inventory levels. Clean, uncluttered summary cards. **Cin7**: Homepage dashboard with Sales/Operations/Insights toggle. Summary KPIs and quick-access widgets. |
| **Personalization Level** | **Katana**: Limited. Customizable views and filters within modules (2025 enhancement). No drag-and-drop dashboard widgets. **Cin7**: Drag-and-drop fields in reporting dashboard. 100+ built-in reports. More flexibility in reporting but less in main dashboard layout. |
| **Real-Time Data** | **Katana**: Core differentiator. "Live inventory" updates in real-time across all channels and locations. Stock levels reflect current state instantly. Real-time production status tracking. **Cin7**: Real-time inventory sync across channels. Consolidates orders from multiple platforms into single dashboard. |
| **Information Density** | **Katana**: Low-medium. Deliberately clean and airy. Prioritizes clarity over density. Uses color-coded status badges. **Cin7**: Medium-high. More traditional data-dense approach with tables and lists. |
| **AI Integration** | **Katana**: AI-based alerts for low stock and delayed production (2025). No conversational AI. **Cin7**: AI Forecasting for demand prediction (2025). No embedded AI assistant. |

### C. Key UI Patterns

| Pattern | Implementation |
|---|---|
| **List + Detail** | **Katana**: List views (Sales Orders, Products, BOMs) -> click opens detail page. Clean card-based detail layouts. **Cin7**: List views with column sorting -> detail page in new view. More traditional tabular approach. |
| **Split-Views / Side Panels** | **Katana**: No split view. Full-page navigation between list and detail. Side panels for quick-edit on some items. **Cin7**: No split view. Full-page detail views. EDI Dashboard uses left-side filter panel + main content area. |
| **Data Tables** | **Katana**: Sortable columns, search within lists, status filters. Limited inline editing. Drag-and-drop for production prioritization. **Cin7**: Sortable/filterable tables with column customization. Bulk actions for order processing. Inline editing on select fields. |
| **Multi-Step Workflows / Wizards** | **Katana**: Manufacturing Order flow: Create -> Assign Materials -> Schedule -> Track -> Complete. Visual Gantt-style production scheduling with drag-and-drop. **Cin7**: Order workflow stages displayed in EDI Dashboard. Purchase-to-receipt flows. Less visual, more form-driven. |
| **Notification System** | **Katana**: In-app alerts for low stock, production delays. Email notifications. Real-time inventory threshold alerts. **Cin7**: Email and in-app notifications for orders, stock alerts. Less sophisticated notification center. |
| **Search and Saved Filters** | **Katana**: Module-level search (products, orders). Location-based filters (2025). Saved filter views limited. **Cin7**: Filter by date ranges, status, warehouse. Saved report configurations. |
| **Forms** | **Katana**: Clean, structured forms for products, BOMs, orders. Required field validation. No auto-save. **Cin7**: Forms for product creation, purchase orders. Custom fields limited to text-only (no dropdowns or numbers -- a known pain point). |

### D. Visual Design

| Aspect | Detail |
|---|---|
| **Density** | **Katana**: Airy. Generous whitespace. Clean, modern SaaS aesthetic. Optimized for clarity over information density. **Cin7**: Compact-medium. More traditional enterprise density. Functional over aesthetic. |
| **Typography** | **Katana**: Modern sans-serif. Clear hierarchy with bold headings. Good contrast. **Cin7**: Standard sans-serif. Less typographic refinement. Functional text treatment. |
| **Color Palette** | **Katana**: Green primary (#00C48C-range), white backgrounds, muted grays. Color-coded status badges (green/yellow/red for order states). Fresh, clean palette. **Cin7**: Blue primary, white backgrounds. More traditional business software palette. Less distinctive. |
| **Icons** | **Katana**: Modern, minimal line icons. Consistent icon language in sidebar. **Cin7**: Mixed icon styles. Less cohesive icon system. |
| **Light / Dark Mode** | **Katana**: Light mode only. No dark mode. **Cin7**: Light mode only. No dark mode. |
| **Whitespace & Cards** | **Katana**: Generous whitespace. Card-based layouts for order summaries and production status. Subtle shadows. **Cin7**: Tighter spacing. Less use of cards. More table-driven layouts. |
| **Geometry** | **Katana**: Rounded corners on cards and buttons. Modern aesthetic. **Cin7**: Mix of rounded and angular elements. Less consistent geometry. |
| **Micro-Animations** | **Katana**: Subtle transitions. Smooth drag-and-drop on production board. **Cin7**: Minimal animations. Functional transitions. |
| **Loading States** | **Katana**: Standard spinners. Some users report occasional sluggishness. **Cin7**: Loading indicators. Users report frequent error messages requiring re-login (up to 5 minutes to clear). |

### E. UX Strengths & Weaknesses

**Katana -- Top 3 Strengths:**
1. **Visual Clarity and Intuitiveness**: The cleanest UI in the inventory management space. Drag-and-drop production scheduling, color-coded statuses, and a Gantt-style flow make complex manufacturing operations visually digestible for non-technical users.
2. **Live Inventory as Core Concept**: Real-time stock synchronization across all channels and locations is not an add-on but the foundational architecture. Every view reflects current state.
3. **E-Commerce Integration Depth**: Native, bidirectional sync with Shopify, WooCommerce, Amazon. Orders, stock levels, and product data flow automatically without middleware.

**Katana -- Top 3 Weaknesses:**
1. **No Native Mobile App**: Only browser-based mobile access. Shop Floor App and Warehouse App are web-responsive, not native. Limits offline capability and scanning ergonomics.
2. **Limited Customization and Reporting**: No drag-and-drop dashboard widgets. Saved views and filters are basic. No advanced report builder compared to Cin7's 100+ built-in reports.
3. **Scalability Ceiling**: Best suited for small-to-mid manufacturers. Complex multi-entity or heavy ERP requirements exceed its feature scope.

**Cin7 -- Top 3 Strengths:**
1. **Integration Breadth**: 350+ integrations including eCommerce, EDI, 3PL, accounting, marketplaces. The widest connector ecosystem in the mid-market inventory space.
2. **Reporting Depth**: 100+ built-in reports with drag-and-drop field customization. Up-to-the-minute cost tracking per item. Stronger analytics than Katana.
3. **Multi-Channel Order Consolidation**: Consolidates orders from all sales channels into a single fulfillment dashboard. Strong B2B and wholesale capabilities.

**Cin7 -- Top 3 Weaknesses:**
1. **Poor UX and Navigation**: Users consistently cite confusing layout, unintuitive navigation, and frequent error messages that require logging out and back in. The #1 complaint across review platforms.
2. **Steep Learning Curve with Inadequate Support**: Self-service onboarding requires watching many academy videos. Phone support removed. Email and chat support described as "nonexistent" by recent reviewers.
3. **Limited Custom Field Types**: Only text-based custom fields -- no numerical fields, dropdowns, or picklists. A significant limitation for businesses needing structured data entry.

---

## 4. FRESHWORKS SUITE
**Scope**: Freshdesk (helpdesk), Freshsales (CRM), Freshcaller (telephony), Dew design system, Freddy AI

### A. Navigation Strategy

| Aspect | Detail |
|---|---|
| **Type** | Left sidebar navigation (collapsible). Product-specific sidebar with module icons. Top header for global actions (search, notifications, user menu). |
| **Module Grouping** | **Freshdesk**: Tickets, Contacts, Solutions (knowledge base), Discussions, Reports, Admin. Each as a sidebar icon. **Freshsales**: Contacts, Accounts, Deals, Conversations, Reports, Settings. Pipeline-oriented grouping. |
| **Context Switching** | Product Switcher (top-left or app launcher) to move between Freshdesk, Freshsales, Freshcaller, etc. Within a product, sidebar provides direct module access. Cross-product data visible in sidebars (e.g., Freshsales deal info shown in Freshdesk ticket sidebar). |
| **Command Palette / Global Search** | Global search bar in top header. No native Cmd+K command palette. Search scoped to current product (tickets, contacts, articles). **2025 Update**: Freshdesk Command Center -- centralized workspace consolidating multi-channel conversations. |
| **Mega-Menu vs Collapsible Sidebar** | Collapsible left sidebar with icon + label. Collapses to icon-only mode. No mega-menu. Clean, predictable navigation pattern. |
| **Mobile Adaptation** | Native Freshdesk and Freshsales mobile apps (iOS/Android). Simplified ticket management, contact access, deal updates. Push notifications. Mobile-optimized but feature-reduced. |

### B. Dashboard Philosophy

| Aspect | Detail |
|---|---|
| **Home Paradigm** | **Freshdesk**: Agent dashboard shows open tickets, due today, overdue, unresolved. Ticket-centric home. **Freshsales**: Sales Essentials Dashboard (default on left nav). Deal pipeline, activity timeline, sales metrics. Per-product home, not global. |
| **Personalization Level** | Unified Custom Dashboard (Freshsales) allows widget composition with custom metrics, charts, and KPIs. Freshdesk dashboard is more fixed (ticket queues, SLA status). Filters for time ranges, agents, groups. |
| **Real-Time Data** | Freshdesk: Live dashboard for real-time ticket volume, agent availability, SLA compliance. Freshcaller: Live call queue monitoring. Freshsales: Real-time deal pipeline with drag-and-drop. |
| **Information Density** | Low-medium. Freshworks deliberately pursues a "clean and uncomplicated" aesthetic. Less dense than Salesforce or SAP. Prioritizes usability over power-user density. |
| **AI Integration** | Freddy AI across suite: ticket auto-categorization, suggested responses, sentiment analysis. Freddy Copilot for agents. AI-powered chatbots (Freddy Self-Service). AI writing assistant for emails and responses. No Joule/Agentforce-level autonomy yet. |

### C. Key UI Patterns

| Pattern | Implementation |
|---|---|
| **List + Detail** | **Freshdesk**: Ticket list (filterable, sortable) -> click opens ticket detail page with conversation thread, properties sidebar, and action buttons. **Freshsales**: Contact/Deal lists -> detail page with timeline, activities, related records. |
| **Split-Views / Side Panels** | Freshdesk: Ticket detail shows right-side panel for contact/company info, Freshsales deal data, and custom widgets. Freshcaller: Phone widget as bottom-left mini-panel (persistent). No formal split-view mode. |
| **Data Tables** | Sortable columns, filter by status/priority/agent/tag. Bulk actions (assign, close, merge, delete). Column customization. Freshsales: Kanban view for deals as alternative to table. |
| **Multi-Step Workflows / Wizards** | Workflow Automator: drag-and-drop builder for multi-step automation (trigger -> conditions -> actions). Not a user-facing wizard but an admin configuration tool. SLA escalation flows as multi-step processes. |
| **Notification System** | Bell icon (top-right) for in-app notifications. Email notifications for ticket updates, SLA breaches, mentions. Desktop browser notifications. Push on mobile. |
| **Search and Saved Filters** | Ticket views serve as saved filters (My Open Tickets, Due Today, custom views). Contact/Deal search with filters. Saved filter views can be shared. |
| **Forms** | Ticket forms with custom fields, mandatory validation, conditional logic. Contact/Deal forms with field configuration (up to 10 fields displayed in cross-product sidebar). CSAT survey forms embedded in ticket flows. |

### D. Visual Design (Dew Design System -- Dec 2025+)

| Aspect | Detail |
|---|---|
| **Density** | Low. Deliberately airy and "calm." Breathing room in typography and spacing. Reduced visual noise. Designed to help agents focus on customer interactions, not fight the UI. |
| **Typography** | Refined with Dew. System fonts (Apple, Windows, Chrome defaults) for consistency and performance. Clear hierarchy. Improved legibility. |
| **Color Palette** | Calm, balanced palette. Theming options: pre-built themes ("Tropical Mint," "Crimson Pulse") or custom brand color. WCAG 2.2 AA compliant. Balance of inclusivity and brand expression. |
| **Icons** | Clean line icons. Consistent icon set across Freshdesk and Freshservice. Functional, not decorative. |
| **Light / Dark Mode** | Not yet available in Dew (Phase 1). Expected in Phase 2 (2026). Current interface is light-mode only. |
| **Whitespace & Cards** | Generous whitespace. Ticket cards and contact cards use subtle elevation. Clean separation between content blocks. |
| **Geometry** | Rounded corners on cards, buttons, input fields. Modern, approachable aesthetic consistent with 2025+ design trends. |
| **Micro-Animations** | Subtle. Smooth transitions on sidebar collapse/expand, ticket status changes. No heavy animation. |
| **Loading States** | Standard loading spinners and skeleton screens. Fast perceived performance for core ticket operations. |

### E. UX Strengths & Weaknesses

**Top 3 Strengths:**
1. **Integrated Softphone (Freshcaller)**: Phone widget lives persistently in the bottom-left corner of Freshdesk. One-click calling, in-call note-taking, call-to-ticket conversion, merge calls, see recent tickets during call -- all without leaving the helpdesk. Unique competitive advantage.
2. **Approachable, Clean UX**: Freshworks consistently prioritizes simplicity. The Dew design system doubles down on this with a "calm palette," reduced clutter, and WCAG 2.2 AA compliance. Onboarding time is significantly lower than Salesforce or SAP.
3. **Cross-Product Context in Sidebars**: Freshsales deal and contact data surfaces directly in the Freshdesk ticket sidebar. Agents see customer context (deals, revenue, history) without switching products. Up to 10 configurable fields per entity.

**Top 3 Weaknesses:**
1. **Fragmented Product Suite**: Despite marketing as a "suite," each product (Freshdesk, Freshsales, Freshcaller, Freshmarketer) is a separate application with separate navigation, separate data models, and separate billing. The Dew redesign (Phase 1, Dec 2025) only covers Freshdesk and Freshservice -- Freshsales, Freshcaller, and others are excluded.
2. **Limited Advanced Reporting**: Analytics and dashboards are less powerful than Salesforce or dedicated BI tools. Custom report building is constrained. Data-driven teams outgrow Freshworks reporting quickly.
3. **Add-On Pricing Escalation**: Competitive entry-level pricing, but essential features (advanced automation, custom roles, sandbox, AI capabilities) are gated behind expensive tier upgrades. Total cost surprises users who start on lower plans.

---

## 5. MONDAY.COM WORK OS
**Scope**: Work Management, Monday CRM, automations, AI assistant (Sidekick), Vibe design system

### A. Navigation Strategy

| Aspect | Detail |
|---|---|
| **Type** | Collapsible left sidebar with workspace hierarchy. Top bar for global actions. Workspace-centric navigation model. |
| **Module Grouping** | Workspaces (top level) -> Folders (optional) -> Boards -> Groups -> Items. Hierarchy is visual and user-defined. Products (Work Management, CRM, Dev, Service) share the same structural model but with domain-specific templates. |
| **Context Switching** | Workspace dropdown (top of sidebar) with pinned, recent, and full workspace list. Quick Search (Cmd+B / Ctrl+B) for instant board/dashboard/workspace switching. Sidebar supports alphabetical sorting (2025 update). |
| **Command Palette / Global Search** | Quick Search (Cmd+B / Ctrl+B): searches across boards, dashboards, workdocs, and workspaces. Keyboard-first navigation. Also: global search for item content, updates, and people. |
| **Mega-Menu vs Collapsible Sidebar** | Collapsible left sidebar with workspace/board hierarchy. Tree-view navigation. No mega-menu. Sidebar shows boards, dashboards, and workdocs as flat or grouped items. |
| **Mobile Adaptation** | Native Monday.com mobile app (iOS/Android). Board access, item updates, notifications, basic views. Simplified but functional. Push notifications with action buttons. |

### B. Dashboard Philosophy

| Aspect | Detail |
|---|---|
| **Home Paradigm** | "My Work" view aggregates items assigned to the user across all boards/workspaces. Not a traditional dashboard but a personal task hub. Custom dashboards are built from board data with widget composition. Per-workspace, not per-role. |
| **Personalization Level** | High. Dashboards use drag-and-drop widgets (charts, numbers, batteries, timelines, workload). Boards support custom column types (50+ column types). Multiple views per board (Table, Kanban, Calendar, Gantt, Timeline, Workload, Chart, Files, Forms). |
| **Real-Time Data** | Real-time collaborative editing. Board updates appear instantly for all team members. Live status changes, comment threads, and activity logs. Dashboard widgets update in real-time. |
| **Information Density** | Medium. Boards can become dense with many columns, but the default is relatively spacious. Users control density through column selection and view switching. Color coding adds information without text density. |
| **AI Integration** | **Monday AI**: AI Blocks (column-level AI for summarize, categorize, generate). AI Workflows (natural language automation creation). **Monday Sidekick**: context-aware AI assistant. **Monday Magic**: instant workflow generation from description. **Monday Vibe**: AI-powered app building. Agent Factory for custom AI agents. |

### C. Key UI Patterns

| Pattern | Implementation |
|---|---|
| **List + Detail** | Board table view is the primary list. Click item -> opens Item Card (modal or side panel) with conversation thread, updates, files, activity log. Not a full page navigation; stays in context. |
| **Split-Views / Side Panels** | Item Card opens as a right-side panel overlaying the board. Conversations and details in panel; board visible behind. Workload view splits into team member rows with capacity bars. |
| **Data Tables** | Board is a data table. Supports: sort, filter, search, column resize, column reorder, color-coded status/label columns, formula columns, mirror columns (cross-board references). Group-by functionality. Sub-items. No traditional fixed-column freeze. Bulk actions: select multiple items for status change, move, delete, duplicate, archive. |
| **Multi-Step Workflows / Wizards** | Automation center: "When [trigger], do [action]" recipes. No traditional multi-step wizard for end users. Onboarding uses step-by-step board templates. Forms view creates external/internal form submissions that create items. |
| **Notification System** | Bell icon + Inbox. Notification center with mentions, assignments, due dates, automation triggers. Customizable notification preferences per board/item. Email digests. Slack/Teams integration for push notifications. |
| **Search and Saved Filters** | Board-level filters (by person, status, date, text). "Save as New View" to persist filter/sort/group combinations. Quick Search (Cmd+B) for navigation. Cross-board search for item content. |
| **Forms** | Monday Forms: customizable intake forms that create board items. Conditional fields, required validation, cover images, custom thank-you pages. Shareable via link. No auto-save (submit-based). |

### D. Visual Design (Vibe Design System)

| Aspect | Detail |
|---|---|
| **Density** | Medium. Boards are grid-based and can feel dense with many columns. But generous row height and color-coded cells maintain scannability. Views like Kanban and Timeline are airier. |
| **Typography** | Figtree font (proprietary choice). Clean, modern sans-serif. Used across platform and brand materials. Good weight variation for hierarchy. |
| **Color Palette** | Vibrant, multi-color palette. Brand colors: pink (#FF0077), purple (#6C6CFF), green (#00CA72), yellow, blue. Status columns use customizable color labels. The most colorful enterprise platform -- color is a core UX mechanism, not decoration. |
| **Icons** | Vibe icon library (open-source). 150+ icons. Consistent line-weight, rounded style. Used in navigation, column types, and automation triggers. |
| **Light / Dark Mode** | Three display themes: Light, Dark, and Night mode. User-selectable. Dark mode is mature and well-implemented (not an afterthought). |
| **Whitespace & Cards** | Moderate whitespace in board view. Kanban cards with rounded corners and color accent bars. Item Cards (detail panels) have generous padding. |
| **Geometry** | Rounded corners throughout. Buttons, inputs, cards, status pills, avatars -- all rounded. Friendly, approachable visual language. |
| **Micro-Animations** | Significant use of animation. Drag-and-drop feedback, status change color transitions, board loading animations, confetti on completion, pulse effects. More animated than any other platform in this benchmark. |
| **Loading States** | Custom branded loading animations (Monday.com logo pulse). Skeleton screens for board content. Progress bars for imports and automations. |

### E. UX Strengths & Weaknesses

**Top 3 Strengths:**
1. **View Flexibility as UX Superpower**: The same board data renders as Table, Kanban, Calendar, Gantt, Timeline, Workload, Chart, Files, or Form -- instantly switchable. No other platform offers this depth of perspective switching on the same dataset. Each view has purpose-specific interactions.
2. **Color as Functional Design**: Status columns, labels, timeline bars, and priority indicators use a rich, customizable color system that conveys information at a glance without reading text. Color is not decorative but structural -- teams define their own semantic color language.
3. **AI Depth Across Layers**: Monday AI is not a single chatbot. It spans column-level AI (AI Blocks), workflow-level AI (AI Workflows + Smart Conditions), assistant-level AI (Sidekick), generation-level AI (Magic for workflow creation), and development-level AI (Vibe for app building). Five distinct AI surfaces integrated into the product.

**Top 3 Weaknesses:**
1. **Board Clutter at Scale**: As organizations grow, managing hundreds of boards across multiple workspaces becomes chaotic. The flat sidebar hierarchy and lack of advanced board organization (tagging, smart grouping) means users struggle to find boards during busy periods. Quick Search helps but does not solve structural organization.
2. **Pricing Tier Lock-In**: Time tracking, formula columns, certain automation quotas, and advanced permissions are locked behind Pro and Enterprise tiers. The per-seat pricing model becomes expensive at 50+ users. Essential features feel like they should be standard.
3. **Not a True Database**: Despite looking like a spreadsheet/database, Monday.com boards lack relational database features (true foreign keys, referential integrity, complex queries). Mirror columns and Connect Boards are workarounds, not real relations. Teams needing structured data integrity outgrow the model.

---

## CROSS-PLATFORM COMPARISON MATRIX

### Navigation Comparison

| Feature | Salesforce | SAP S/4HANA | Katana | Cin7 | Freshworks | Monday.com |
|---|---|---|---|---|---|---|
| **Nav Type** | Top tabs | Tiles + Sidebar | Left sidebar | Left sidebar | Left sidebar | Left sidebar |
| **Command Palette** | No (3rd party) | Joule + Search | No | No | No | Yes (Cmd+B) |
| **Workspace Concept** | Apps | Spaces/Pages | No | No | Product Switcher | Workspaces |
| **Dark Mode** | Yes (SLDS 2) | Yes (Horizon) | No | No | Coming 2026 | Yes (3 themes) |
| **Mobile App** | Native | Native | Browser only | Basic native | Native | Native |

### Dashboard Comparison

| Feature | Salesforce | SAP S/4HANA | Katana | Cin7 | Freshworks | Monday.com |
|---|---|---|---|---|---|---|
| **Home Type** | Per-App Home | Tile Launchpad | Single Dashboard | Summary Dashboard | Per-Product | My Work + Custom |
| **Widget Drag-Drop** | Via App Builder | Limited | No | Reports only | Limited | Yes |
| **Real-Time** | Partial | Yes (HANA) | Yes (core) | Yes | Yes (live dash) | Yes |
| **AI Assistant** | Agentforce | Joule | Alerts only | Forecasting | Freddy AI | Sidekick + AI Blocks |

### Visual Design Comparison

| Feature | Salesforce | SAP S/4HANA | Katana | Cin7 | Freshworks | Monday.com |
|---|---|---|---|---|---|---|
| **Density** | Medium | High | Low-Medium | Medium-High | Low | Medium |
| **Design System** | SLDS 2 | Fiori/Horizon | Custom | Custom | Dew | Vibe |
| **Rounded Corners** | Yes (Cosmos) | Yes (Horizon) | Yes | Mixed | Yes (Dew) | Yes |
| **Color Approach** | Saturated blues | 9-hue palette | Green primary | Blue primary | Calm/balanced | Vibrant multi-color |
| **Animations** | Minimal | Minimal | Subtle | Minimal | Subtle | Significant |

### AI Integration Depth

| Capability | Salesforce | SAP S/4HANA | Katana | Cin7 | Freshworks | Monday.com |
|---|---|---|---|---|---|---|
| **Conversational AI** | Agentforce | Joule | -- | -- | Freddy Copilot | Sidekick |
| **Embedded in Workflow** | Yes | Yes | Alerts | Forecasting | Yes | AI Blocks + Workflows |
| **Code/App Generation** | -- | Joule for Dev | -- | -- | -- | Monday Vibe |
| **Autonomous Actions** | Yes (agents) | Yes (beta) | -- | -- | Limited | Agent Factory |

---

## KEY TAKEAWAYS FOR DESIGN DECISIONS

1. **Left sidebar is the dominant pattern** (4/5 platforms). Salesforce's top-tab approach is the outlier but offers an alternative for tab-heavy workflows. Consider sidebar as default with top-bar for secondary navigation.

2. **Command palette / Quick Search is a differentiator**. Only Monday.com has it natively. Salesforce users depend on third-party tools. SAP uses Joule conversationally. Implementing Cmd+K search provides an immediate power-user advantage.

3. **Real-time data is table stakes for inventory/operations** (Katana, Cin7). For CRM/helpdesk, real-time means live dashboards and collaborative editing (Monday.com, Freshdesk).

4. **AI integration is stratifying**. Salesforce (Agentforce) and SAP (Joule) offer deep, action-capable AI. Monday.com covers five distinct AI surfaces. Freshworks and inventory tools offer lighter AI. The bar is rising fast.

5. **Dark mode is now expected**. Salesforce, SAP, and Monday.com all offer it. Platforms without it (Katana, Cin7, Freshworks Phase 1) feel behind.

6. **Visual density is a spectrum**: SAP/Cin7 (high density, ERP-oriented) vs. Freshworks/Katana (low density, simplicity-first) vs. Salesforce/Monday.com (configurable medium density). The right density depends on user expertise and data complexity.

7. **Design system maturity matters**: SLDS 2, Fiori, and Vibe are mature, documented, open design systems. Dew is emerging. Katana and Cin7 lack published design systems, which limits consistency and ecosystem development.

---

## SOURCES

### Salesforce Lightning / SLDS 2 / Cosmos
- [What is Salesforce Lightning Design System 2 (SLDS 2 Beta)?](https://www.salesforce.com/blog/what-is-slds-2/)
- [How We Refreshed the Lightning UI Design (Cosmos)](https://www.salesforce.com/blog/salesforce-cosmos-slds-2/)
- [SLDS 2: How You Can Future-Proof Your Salesforce UI](https://www.salesforceben.com/slds-2-beta-how-you-can-future-proof-your-salesforce-ui/)
- [Salesforce Lightning UI 2025](https://www.pixelconsulting.io/post/salesforce-lightning-ui)
- [Salesforce Dark Mode Is Back (Updated for 2026)](https://www.salesforceben.com/salesforce-dark-mode-is-back-what-admins-need-to-know/)
- [SLDS 2 Guide - Cosmos Theme & Styling Hooks](https://astreait.com/Lightning-Design-System-2/)
- [Lightning Design System 2 Official](https://www.lightningdesignsystem.com/)
- [Patterns - Lightning Design System 2](https://www.lightningdesignsystem.com/2e1ef8501/p/355656-patterns)
- [A Fresh Look for Salesforce: Unpacking the New UI and SLDS 2.0](https://www.absyz.com/a-fresh-look-for-salesforce-unpacking-the-new-ui-and-slds-2-0/)
- [Salesforce Refreshed Lightning UI - Salesforce Ben](https://www.salesforceben.com/salesforce-announces-refreshed-lightning-user-interface/)
- [Dynamic Forms: Enhance Your Salesforce Experience](https://trailhead.salesforce.com/content/learn/modules/lightning_app_builder/get-started-with-dynamic-forms-lab)
- [How to Use Dynamic Forms in Salesforce in 2025](https://www.elearningsalesforce.in/2025/09/29/dynamic-forms-in-salesforce-2025/)
- [Mastering Lightning App Builder in 2025](https://dev.to/selavina_b_de3b87f13c96a6/mastering-lightning-app-builder-in-2025-a-practical-guide-for-salesforce-admins-builders-2h7m)
- [Why is Salesforce's UX so bad? - Quora](https://www.quora.com/Salesforce-com-product/Why-is-Salesforces-UX-so-bad)
- [Salesforce Lightning UX Design Guide - Noltic](https://noltic.com/stories/the-complete-guide-to-ui-ux-design-for-salesforce)
- [Agentforce Assistant (Formerly Einstein Copilot)](https://www.salesforce.com/agentforce/einstein-copilot/)
- [Einstein AI in Salesforce: 2025 Updates](https://dev.to/itechcloud_solution_01/einstein-ai-in-salesforce-2025-updates-441c)

### SAP S/4HANA Cloud / Fiori / Horizon
- [SAP UX Update: What's New for SAP S/4HANA 2025](https://community.sap.com/t5/technology-blog-posts-by-sap/sap-user-experience-update-what-s-new-for-sap-s-4hana-2025-private-cloud/ba-p/14257694)
- [SAP UX Q3/2025 Update - S/4HANA Cloud 2508 and Fiori Launchpad](https://community.sap.com/t5/technology-blog-posts-by-sap/sap-ux-q3-2025-update-part-2-sap-s-4hana-cloud-public-edition-2508-and-sap/ba-p/14171291)
- [SAP UX Q1/2026 Update - S/4HANA Cloud 2602 and Fiori Launchpad](https://community.sap.com/t5/technology-blog-posts-by-sap/sap-ux-q1-2026-update-part-2-sap-s-4hana-cloud-public-edition-2602-and-sap/ba-p/14316127)
- [SAP UX Q1/2026 Update - AI, Joule, SAP Build Work Zone](https://community.sap.com/t5/technology-blog-posts-by-sap/sap-ux-q1-2026-update-part-1-ai-joule-sap-build-work-zone-sap-mobile-start/ba-p/14312110)
- [What is SAP Fiori? - Pathlock](https://pathlock.com/blog/sap-fiori/)
- [What's New in SAP Fiori for S/4HANA 2025 Release](https://avotechs.com/blog/sap-fiori-for-s4hana-2025-release/)
- [Horizon Theme - SAP Fiori Design](https://www.sap.com/design-system/fiori-design-android/v25-4/foundations/colors/horizon-theme)
- [A New Horizon for SAP's Design System - Medium](https://medium.com/sap-design/a-new-horizon-for-saps-design-system-ed0e31abdc34)
- [Horizon: The New SAP Fiori Theme - Mindset Consulting](https://www.mindsetconsulting.com/horizon-the-new-sap-fiori-theme/)
- [Floorplan Overview - Fiori Design Guidelines](https://experience.sap.com/fiori-design-web/v1-46/floorplan-overview/)
- [Table Overview - SAP Fiori](https://www.sap.com/design-system/fiori-design-web/v1-96/foundations/best-practices/ui-elements/tables/table-overview)
- [SAP S/4HANA Cloud Reviews - Capterra](https://www.capterra.com/p/152293/SAP-S-4HANA/reviews/)
- [SAP S/4HANA Cloud Pros and Cons 2025 - PeerSpot](https://www.peerspot.com/products/sap-s-4hana-cloud-pros-and-cons)
- [SAP Joule: The AI Copilot - LeverX](https://leverx.com/solutions/sap-joule)
- [SAP AI Agents in 2026: Joule Studio Features](https://aimultiple.com/sap-ai-agents)

### Katana / Cin7
- [Katana Cloud Inventory - Official](https://katanamrp.com/)
- [Katana Cloud Inventory Review 2025](https://www.linktly.com/e-commerce-software/katana-cloud-inventory-review/)
- [Katana Review 2025: Features, Pricing & Pros](https://theretailexec.com/tools/katana-reviews/)
- [Katana Cloud Inventory Review 2026 for Shopify Brands](https://ecommercefastlane.com/katana-review/)
- [Katana MRP Reviews 2026 - SelectHub](https://www.selecthub.com/p/inventory-management-software/katana-mrp/)
- [Katana Features](https://katanamrp.com/features/)
- [Katana Real-Time Inventory](https://katanamrp.com/features/real-time-inventory/)
- [Cin7 Inventory Management Review 2026 - Business.org](https://www.business.org/finance/inventory-management/cin7-review/)
- [Cin7 Omni Reviews - Capterra](https://www.capterra.com/p/133133/Cin7/reviews/)
- [Cin7 Reviews: Features, Strengths & Criticisms - Unleashed](https://www.unleashedsoftware.com/blog/cin7-reviews/)
- [Cin7 vs Katana MRP 2025 - SelectHub](https://www.selecthub.com/inventory-management-software/cin7-vs-katana-mrp/)
- [Cin7 Omni Homepage Dashboard](https://help.omni.cin7.com/hc/en-us/articles/9052702412815-Cin7-Omni-homepage-dashboard)
- [Cin7 Inventory Review 2025 - Epic Design Labs](https://epicdesignlabs.com/cin7-inventory-review-managing-inventory-for-shopify-and-bigcommerce-stores/)
- [Cin7 Core Review - SoftwareConnect](https://softwareconnect.com/reviews/cin7-core/)

### Freshworks Suite
- [The Uncomplicated Upgrade: Dew Design System](https://www.freshworks.com/theworks/company-news/-dew-product-design-system/)
- [How We Crafted a Design System for Freshworks](https://www.freshworks.com/saas/how-we-crafted-a-design-system-for-freshworks-blog/)
- [Get Started with the New Freshdesk Interface](https://support.freshdesk.com/support/solutions/articles/50000011740-get-started-with-the-new-freshdesk-interface)
- [Freshdesk Upcoming Changes Dec 2025 - Mar 2026](https://support.freshdesk.com/support/solutions/articles/50000011682-freshdesk-upcoming-changes-december-2025-march-2026-)
- [Nucleus - The Freshworks Design System](https://freshworks-nucleus.netlify.app/)
- [Freshdesk by Freshworks Review 2026](https://www.linktly.com/customer-service-software/freshdesk-by-freshworks-review/)
- [Freshdesk Reviews 2026: The Good, the Bad, and the Ugly](https://www.desk365.io/blog/freshdesk-reviews)
- [Freshdesk Customer Support Software Review 2026](https://thecxlead.com/tools/freshdesk-review/)
- [Freshcaller Integration with Freshdesk](https://support.freshdesk.com/support/solutions/articles/232244-setting-up-the-freshcaller-integration)
- [Freshdesk Phone Widget](https://support.freshdesk.com/support/solutions/articles/169202-exploring-the-phone-widget)
- [Freshsales Unified Custom Dashboard](https://crmsupport.freshworks.com/support/solutions/articles/50000008505-unified-custom-dashboard)
- [Freshsales Deal Management System](https://www.freshworks.com/freshsales-crm/solutions/deal-management-system/)
- [Freshworks AI Capabilities for Freshdesk 2025](https://www.enterprisetimes.co.uk/2025/11/13/freshworks-launches-new-ai-capabilities-to-its-freshdesk-solution/)
- [Freshdesk Workflow Automations](https://www.freshworks.com/freshdesk/helpdesk-automation/workflow-automations/)

### Monday.com Work OS
- [Monday.com Features in 2025](https://stackby.com/blog/monday-com-features/)
- [Monday.com Review 2026 - Tech.co](https://tech.co/project-management-software/monday-review)
- [Monday.com Review 2026 - Work-Management.org](https://work-management.org/project-management/monday-com-review/)
- [Monday.com Review 2026 - RemoteWize](https://remotewize.com/monday-com-review/)
- [Monday.com(Work OS) Review 2026](https://www.linktly.com/operations-software/monday-com-work-os-review/)
- [Monday.com AI](https://monday.com/w/ai)
- [AI Feature Catalog - Monday.com](https://support.monday.com/hc/en-us/articles/24047211522194-AI-Feature-Catalog)
- [Monday.com Expands AI-Powered Agents](https://ir.monday.com/news-and-events/news-releases/news-details/2025/monday-com-Expands-AI-Powered-Agents-CRM-Suite-and-Enterprise-Grade-Capabilities/default.aspx)
- [Quick Search - Monday.com](https://support.monday.com/hc/en-us/articles/115005836005-The-Quick-Search)
- [Workspaces Navigation Dropdown](https://community.monday.com/t/introducing-the-new-workspaces-navigation-dropdown/16128)
- [Workload View - Monday.com](https://support.monday.com/hc/en-us/articles/360010166559-Resource-management-with-Workload)
- [Vibe Design System - Monday.com](https://vibe.monday.com/)
- [Vibe Design System - DesignSystems.surf](https://designsystems.surf/design-systems/mondaycom)
- [Monday.com Brand Colors](https://www.brand-monday.com/colors)
- [Monday.com Typography](https://www.brand-monday.com/typography)
- [Monday.com Display Themes](https://support.monday.com/hc/en-us/articles/360017414139-monday-com-display-themes-light-dark-and-night-mode)
- [Monday.com Reviews - Capterra](https://www.capterra.com/p/147657/monday-com/reviews/)
