// Avenick Commerce — Shared Mock Data
// Used by all three apps for demo/development purposes

export const MOCK_PRODUCTS = [
  { id: "p1", slug: "safety-helmet-pro", nameEn: "Safety Helmet Pro X200", nameAr: "خوذة السلامة X200", brand: "SafeGuard", category: "Safety & PPE", price: 89, currency: "AED", discount: 15, inStock: true, imageUrl: "https://placehold.co/400x400/f97316/fff?text=Helmet" },
  { id: "p2", slug: "nitrile-gloves-box", nameEn: "Nitrile Gloves (Box 100)", nameAr: "قفازات نيتريل (علبة 100)", brand: "MediSafe", category: "Safety & PPE", price: 45, currency: "AED", discount: 0, inStock: true, imageUrl: "https://placehold.co/400x400/3b82f6/fff?text=Gloves" },
  { id: "p3", slug: "industrial-drill-set", nameEn: "Industrial Drill Set 18V", nameAr: "طقم مثقاب صناعي 18V", brand: "ToolMaster", category: "Industrial Supplies", price: 420, currency: "AED", discount: 20, inStock: true, imageUrl: "https://placehold.co/400x400/8b5cf6/fff?text=Drill" },
  { id: "p4", slug: "office-chair-ergonomic", nameEn: "Ergonomic Office Chair", nameAr: "كرسي مكتب مريح", brand: "ComfortPlus", category: "Office Supplies", price: 750, currency: "AED", discount: 10, inStock: true, imageUrl: "https://placehold.co/400x400/10b981/fff?text=Chair" },
  { id: "p5", slug: "fire-extinguisher-co2", nameEn: "CO2 Fire Extinguisher 5kg", nameAr: "طفاية حريق CO2 5kg", brand: "FireShield", category: "Safety & PPE", price: 180, currency: "AED", discount: 0, inStock: false, imageUrl: "https://placehold.co/400x400/ef4444/fff?text=Fire+Ext" },
  { id: "p6", slug: "laptop-stand-adjustable", nameEn: "Adjustable Laptop Stand", nameAr: "حامل لابتوب قابل للضبط", brand: "TechDesk", category: "Office Supplies", price: 95, currency: "AED", discount: 25, inStock: true, imageUrl: "https://placehold.co/400x400/6366f1/fff?text=Stand" },
  { id: "p7", slug: "cement-bags-50kg", nameEn: "Portland Cement 50kg Bag", nameAr: "إسمنت بورتلاند 50كجم", brand: "BuildRight", category: "Building Materials", price: 28, currency: "AED", discount: 0, inStock: true, imageUrl: "https://placehold.co/400x400/78716c/fff?text=Cement" },
  { id: "p8", slug: "coffee-machine-commercial", nameEn: "Commercial Coffee Machine", nameAr: "ماكينة قهوة تجارية", brand: "CafePro", category: "Food & Hospitality", price: 1850, currency: "AED", discount: 5, inStock: true, imageUrl: "https://placehold.co/400x400/d97706/fff?text=Coffee" },
];

export const MOCK_BRANDS = [
  { id: "b1", name: "SafeGuard", slug: "safeguard", country: "AE", productCount: 48, color: "bg-orange-100 text-orange-700" },
  { id: "b2", name: "ToolMaster", slug: "toolmaster", country: "SA", productCount: 132, color: "bg-blue-100 text-blue-700" },
  { id: "b3", name: "MediSafe", slug: "medisafe", country: "AE", productCount: 67, color: "bg-green-100 text-green-700" },
  { id: "b4", name: "ComfortPlus", slug: "comfortplus", country: "QA", productCount: 29, color: "bg-purple-100 text-purple-700" },
  { id: "b5", name: "FireShield", slug: "fireshield", country: "AE", productCount: 21, color: "bg-red-100 text-red-700" },
  { id: "b6", name: "TechDesk", slug: "techdesk", country: "SA", productCount: 54, color: "bg-indigo-100 text-indigo-700" },
  { id: "b7", name: "BuildRight", slug: "buildright", country: "AE", productCount: 88, color: "bg-stone-100 text-stone-700" },
  { id: "b8", name: "CafePro", slug: "cafepro", country: "KW", productCount: 35, color: "bg-yellow-100 text-yellow-700" },
  { id: "b9", name: "PowerTool Co", slug: "powertool-co", country: "SA", productCount: 110, color: "bg-cyan-100 text-cyan-700" },
  { id: "b10", name: "CleanEdge", slug: "cleanedge", country: "AE", productCount: 44, color: "bg-teal-100 text-teal-700" },
  { id: "b11", name: "NovaTech", slug: "novatech", country: "QA", productCount: 77, color: "bg-violet-100 text-violet-700" },
  { id: "b12", name: "GulfPack", slug: "gulfpack", country: "OM", productCount: 19, color: "bg-pink-100 text-pink-700" },
];

export const MOCK_WISHLIST_PRODUCTS = [
  { id: "p1", slug: "safety-helmet-pro", nameEn: "Safety Helmet Pro X200", imageUrl: "https://placehold.co/400x400/f97316/fff?text=Helmet", price: 89, currency: "AED", inStock: true, sellerName: "SafeGuard AE" },
  { id: "p3", slug: "industrial-drill-set", nameEn: "Industrial Drill Set 18V", imageUrl: "https://placehold.co/400x400/8b5cf6/fff?text=Drill", price: 420, currency: "AED", inStock: true, sellerName: "ToolMaster SA" },
  { id: "p4", slug: "office-chair-ergonomic", nameEn: "Ergonomic Office Chair", imageUrl: "https://placehold.co/400x400/10b981/fff?text=Chair", price: 750, currency: "AED", inStock: true, sellerName: "ComfortPlus QA" },
];

export const MOCK_ORDERS = [
  {
    id: "ord_001", orderNumber: "AC-2024-00142", status: "DELIVERED", type: "B2C",
    total: 534, currency: "AED", createdAt: "2024-11-15",
    items: [
      { nameEn: "Safety Helmet Pro X200", quantity: 2, unitPrice: 89, vatRate: 5 },
      { nameEn: "Nitrile Gloves (Box 100)", quantity: 4, unitPrice: 45, vatRate: 5 },
    ],
    shippingAddress: { line1: "Office 402, Al Barsha Business Tower", city: "Dubai", country: "AE" },
    timeline: [
      { status: "CONFIRMED", label: "Order Confirmed", date: "2024-11-15 09:12" },
      { status: "PROCESSING", label: "Processing", date: "2024-11-15 14:30" },
      { status: "SHIPPED", label: "Shipped", date: "2024-11-16 10:00" },
      { status: "DELIVERED", label: "Delivered", date: "2024-11-17 14:45" },
    ],
  },
  {
    id: "ord_002", orderNumber: "AC-2024-00189", status: "SHIPPED", type: "B2B",
    total: 2100, currency: "AED", createdAt: "2024-11-20",
    items: [
      { nameEn: "Industrial Drill Set 18V", quantity: 5, unitPrice: 420, vatRate: 5 },
    ],
    shippingAddress: { line1: "Warehouse 7, JAFZA South", city: "Dubai", country: "AE" },
    timeline: [
      { status: "CONFIRMED", label: "Order Confirmed", date: "2024-11-20 11:00" },
      { status: "PROCESSING", label: "Processing", date: "2024-11-20 16:00" },
      { status: "SHIPPED", label: "Shipped", date: "2024-11-22 09:30" },
    ],
  },
  {
    id: "ord_003", orderNumber: "AC-2024-00201", status: "PROCESSING", type: "B2C",
    total: 95, currency: "AED", createdAt: "2024-11-25",
    items: [
      { nameEn: "Adjustable Laptop Stand", quantity: 1, unitPrice: 95, vatRate: 5 },
    ],
    shippingAddress: { line1: "Villa 12, Jumeirah 1", city: "Dubai", country: "AE" },
    timeline: [
      { status: "CONFIRMED", label: "Order Confirmed", date: "2024-11-25 08:45" },
      { status: "PROCESSING", label: "Processing", date: "2024-11-25 13:00" },
    ],
  },
];

export const MOCK_SUPPORT_TICKETS = [
  { id: "TKT-001", subject: "Wrong item delivered", orderId: "AC-2024-00142", status: "IN_PROGRESS", priority: "HIGH", createdAt: "2024-11-18", lastUpdate: "2024-11-19" },
  { id: "TKT-002", subject: "Request VAT invoice", orderId: "AC-2024-00189", status: "OPEN", priority: "LOW", createdAt: "2024-11-21", lastUpdate: "2024-11-21" },
  { id: "TKT-003", subject: "Item damaged on arrival", orderId: "AC-2024-00201", status: "CLOSED", priority: "MEDIUM", createdAt: "2024-10-30", lastUpdate: "2024-11-02" },
];

export const MOCK_RFQS = [
  { id: "rfq_001", rfqNumber: "RFQ-2024-0041", description: "Safety vests and hard hats for 50 workers", quantity: 50, targetPrice: 2500, currency: "AED", status: "QUOTED", requiredBy: "2024-12-15", createdAt: "2024-11-10" },
  { id: "rfq_002", rfqNumber: "RFQ-2024-0055", description: "Industrial shelving units for warehouse", quantity: 20, targetPrice: 8000, currency: "AED", status: "SUBMITTED", requiredBy: "2024-12-30", createdAt: "2024-11-18" },
  { id: "rfq_003", rfqNumber: "RFQ-2024-0061", description: "Monthly office supplies — paper, toner, stationery", quantity: 1, targetPrice: 1200, currency: "AED", status: "ACCEPTED", requiredBy: "2024-12-05", createdAt: "2024-11-20" },
  { id: "rfq_004", rfqNumber: "RFQ-2024-0067", description: "Fire suppression equipment for new facility", quantity: 1, targetPrice: 15000, currency: "AED", status: "DRAFT", requiredBy: "2025-01-31", createdAt: "2024-11-25" },
];

export const MOCK_QUOTES = [
  { id: "q_001", rfqNumber: "RFQ-2024-0041", sellerName: "SafeGuard AE", totalAmount: 2350, currency: "AED", validUntil: "2024-12-20", status: "RECEIVED", items: 2 },
  { id: "q_002", rfqNumber: "RFQ-2024-0041", sellerName: "FireShield LLC", totalAmount: 2600, currency: "AED", validUntil: "2024-12-18", status: "RECEIVED", items: 2 },
  { id: "q_003", rfqNumber: "RFQ-2024-0061", sellerName: "OfficeZone KW", totalAmount: 1180, currency: "AED", validUntil: "2024-12-10", status: "ACCEPTED", items: 8 },
];

export const MOCK_B2B_COMPANY = {
  id: "co_001",
  nameEn: "Gulf Industrial Trading LLC",
  nameAr: "شركة الخليج للتجارة الصناعية",
  crNumber: "1234567890",
  vatNumber: "300012345600003",
  industry: "INDUSTRIAL_SUPPLIES",
  size: "MEDIUM",
  country: "AE",
  city: "Dubai",
  status: "ACTIVE",
  creditLimit: 50000,
  paymentTerms: 30,
  memberCount: 5,
};

// --- Seller / Supplier mock data ---

export const MOCK_SELLER_DOCUMENTS = [
  { id: "doc_001", name: "Commercial Registration", type: "COMMERCIAL_REGISTRATION", expiryDate: "2025-08-15", status: "APPROVED", uploadedAt: "2024-01-10" },
  { id: "doc_002", name: "Trade License", type: "TRADE_LICENSE", expiryDate: "2024-12-31", status: "APPROVED", uploadedAt: "2024-01-10" },
  { id: "doc_003", name: "VAT Certificate", type: "VAT_CERTIFICATE", expiryDate: "2025-06-01", status: "APPROVED", uploadedAt: "2024-01-12" },
  { id: "doc_004", name: "ISO 9001 Certificate", type: "ISO_CERTIFICATE", expiryDate: "2024-12-15", status: "APPROVED", uploadedAt: "2024-03-20" },
  { id: "doc_005", name: "SASO Compliance", type: "SASO_CERTIFICATE", expiryDate: "2025-03-30", status: "PENDING_REVIEW", uploadedAt: "2024-11-01" },
];

export const MOCK_SELLER_PERFORMANCE = {
  overallScore: 87,
  onTimeDelivery: 94,
  returnRate: 2.1,
  avgResponseTime: "3.2h",
  slaStatus: "GREEN" as const,
  monthlyTrend: [
    { month: "Jul", score: 82 },
    { month: "Aug", score: 84 },
    { month: "Sep", score: 86 },
    { month: "Oct", score: 85 },
    { month: "Nov", score: 87 },
  ],
};

export const MOCK_SELLER_RFQ_INBOX = [
  { id: "rfq_101", rfqNumber: "RFQ-2024-0041", buyerCompany: "Gulf Industrial Trading LLC", description: "Safety vests and hard hats x50", status: "QUOTED", receivedAt: "2024-11-10", dueBy: "2024-11-15" },
  { id: "rfq_102", rfqNumber: "RFQ-2024-0055", buyerCompany: "Al Barsha Construction Co.", description: "Industrial shelving units x20", status: "PENDING", receivedAt: "2024-11-18", dueBy: "2024-11-23" },
  { id: "rfq_103", rfqNumber: "RFQ-2024-0071", buyerCompany: "Majid Al Futtaim Retail", description: "Monthly cleaning supplies bundle", status: "PENDING", receivedAt: "2024-11-24", dueBy: "2024-11-28" },
  { id: "rfq_104", rfqNumber: "RFQ-2024-0065", buyerCompany: "Emirates NBD Facilities", description: "Office furniture set x10", status: "ACCEPTED", receivedAt: "2024-11-05", dueBy: "2024-11-10" },
];

export const MOCK_PAYOUT_HISTORY = [
  { id: "pay_001", period: "Oct 2024", grossSales: 18420, commission: 921, net: 17499, status: "PAID", settledAt: "2024-11-05" },
  { id: "pay_002", period: "Sep 2024", grossSales: 14880, commission: 744, net: 14136, status: "PAID", settledAt: "2024-10-05" },
  { id: "pay_003", period: "Aug 2024", grossSales: 21050, commission: 1053, net: 19997, status: "PAID", settledAt: "2024-09-05" },
  { id: "pay_004", period: "Nov 2024", grossSales: 9840, commission: 492, net: 9348, status: "PENDING", settledAt: null },
];

// --- Admin mock data ---

export const MOCK_ADMIN_SUPPORT_TICKETS = [
  { id: "TKT-001", buyer: "Ahmed Al Mansouri", issue: "Wrong item delivered", type: "DELIVERY", status: "IN_PROGRESS", slaRemaining: "4h", createdAt: "2024-11-25" },
  { id: "TKT-002", buyer: "Sara Khalid", issue: "Refund not processed", type: "REFUND", status: "ESCALATED", slaRemaining: "1h", createdAt: "2024-11-24" },
  { id: "TKT-003", buyer: "Gulf Industrial LLC", issue: "Invoice dispute", type: "BILLING", status: "OPEN", slaRemaining: "22h", createdAt: "2024-11-26" },
  { id: "TKT-004", buyer: "Mohammed Al Farsi", issue: "Product quality complaint", type: "QUALITY", status: "IN_PROGRESS", slaRemaining: "8h", createdAt: "2024-11-23" },
  { id: "TKT-005", buyer: "Fatima Nasser", issue: "Cannot login to account", type: "ACCOUNT", status: "CLOSED", slaRemaining: "—", createdAt: "2024-11-20" },
  { id: "TKT-006", buyer: "Al Barsha Construction", issue: "B2B credit limit request", type: "BILLING", status: "OPEN", slaRemaining: "20h", createdAt: "2024-11-26" },
  { id: "TKT-007", buyer: "Khalid Al Rashid", issue: "Delayed shipment — 5 days overdue", type: "DELIVERY", status: "ESCALATED", slaRemaining: "30m", createdAt: "2024-11-22" },
  { id: "TKT-008", buyer: "Emirates Facilities Co.", issue: "PO approval workflow issue", type: "ACCOUNT", status: "IN_PROGRESS", slaRemaining: "12h", createdAt: "2024-11-25" },
];

// --- Support / Disputes (Module 8) ---

export const MOCK_TICKET_THREAD = {
  id: "TKT-001",
  buyer: "Ahmed Al Mansouri",
  email: "ahmed.m@gmail.com",
  issue: "Wrong item delivered",
  type: "DELIVERY",
  status: "IN_PROGRESS",
  priority: "HIGH",
  orderRef: "AC-2024-00142",
  slaRemaining: "4h",
  slaTotal: "24h",
  createdAt: "2024-11-25 09:12",
  assignedTo: "Layla Support",
  messages: [
    { id: "m1", from: "BUYER", author: "Ahmed Al Mansouri", time: "Nov 25, 9:12 AM", body: "I ordered Safety Helmet Pro X200 but received a different model. Order AC-2024-00142." },
    { id: "m2", from: "AGENT", author: "Layla Support", time: "Nov 25, 10:30 AM", body: "Hi Ahmed, apologies for the mix-up. I've checked your order — can you share a photo of the item received?" },
    { id: "m3", from: "BUYER", author: "Ahmed Al Mansouri", time: "Nov 25, 11:05 AM", body: "Attached. It's the X100 model, not X200." },
    { id: "m4", from: "AGENT", author: "Layla Support", time: "Nov 25, 11:40 AM", body: "Confirmed. I'm arranging a free replacement with expedited shipping. You'll receive a return label by email." },
  ],
  internalNotes: [
    { id: "n1", author: "Layla Support", time: "Nov 25, 11:42 AM", body: "Warehouse picking error — flagged to Dubai Main fulfillment team. Replacement SKU SH-X200 reserved." },
  ],
};

export const MOCK_DISPUTES = [
  { id: "DSP-001", orderRef: "AC-2024-00231", buyer: "Al Barsha Construction Co.", seller: "Gulf Industrial Supplies", type: "ITEM_NOT_RECEIVED", amount: 8400, currency: "AED", status: "OPEN", openedAt: "2024-11-24", evidence: 3, sellerResponded: false, priority: "HIGH" },
  { id: "DSP-002", orderRef: "AC-2024-00198", buyer: "Sara Khalid", seller: "SafeGuard AE", type: "NOT_AS_DESCRIBED", amount: 1240, currency: "AED", status: "AWAITING_SELLER", openedAt: "2024-11-22", evidence: 2, sellerResponded: false, priority: "MEDIUM" },
  { id: "DSP-003", orderRef: "AC-2024-00176", buyer: "Mohammed Al Farsi", seller: "FireShield LLC", type: "DAMAGED", amount: 560, currency: "AED", status: "UNDER_REVIEW", openedAt: "2024-11-20", evidence: 4, sellerResponded: true, priority: "MEDIUM" },
  { id: "DSP-004", orderRef: "AC-2024-00150", buyer: "Emirates Facilities Co.", seller: "OfficeZone KW", type: "REFUND_REQUEST", amount: 3200, currency: "AED", status: "RESOLVED_BUYER", openedAt: "2024-11-12", evidence: 2, sellerResponded: true, priority: "LOW" },
  { id: "DSP-005", orderRef: "AC-2024-00142", buyer: "Khalid Al Rashid", seller: "Gulf Industrial Supplies", type: "ITEM_NOT_RECEIVED", amount: 890, currency: "AED", status: "RESOLVED_SELLER", openedAt: "2024-11-08", evidence: 1, sellerResponded: true, priority: "LOW" },
];

export const MOCK_SLA_METRICS = {
  firstResponseTarget: "2h",
  resolutionTarget: "24h",
  avgFirstResponse: "1.4h",
  avgResolution: "18.2h",
  complianceRate: 87,
  breachesThisWeek: 3,
  ticketsInSla: 41,
  ticketsBreached: 6,
  byType: [
    { type: "Delivery", target: "24h", avgResolution: "16h", compliance: 92, volume: 124 },
    { type: "Refund", target: "48h", avgResolution: "38h", compliance: 84, volume: 67 },
    { type: "Billing", target: "24h", avgResolution: "21h", compliance: 90, volume: 45 },
    { type: "Quality", target: "48h", avgResolution: "52h", compliance: 71, volume: 38 },
    { type: "Account", target: "12h", avgResolution: "8h", compliance: 95, volume: 52 },
  ],
  breaches: [
    { id: "TKT-007", buyer: "Khalid Al Rashid", type: "Delivery", breachedBy: "6h", agent: "Unassigned", severity: "HIGH" },
    { id: "TKT-002", buyer: "Sara Khalid", type: "Refund", breachedBy: "2h", agent: "Omar Support", severity: "MEDIUM" },
    { id: "TKT-019", buyer: "Doha Facilities", type: "Quality", breachedBy: "12h", agent: "Layla Support", severity: "HIGH" },
  ],
};

export const MOCK_FINANCE_INVOICES = [
  { id: "inv_001", invoiceNo: "INV-2024-1422", buyer: "Gulf Industrial Trading LLC", type: "B2B", amount: 21000, vatAmount: 1000, status: "COLLECTED", issuedAt: "2024-11-01" },
  { id: "inv_002", invoiceNo: "INV-2024-1438", buyer: "Al Barsha Construction Co.", type: "B2B", amount: 8400, vatAmount: 400, status: "OUTSTANDING", issuedAt: "2024-11-05" },
  { id: "inv_003", invoiceNo: "INV-2024-1451", buyer: "Ahmed Al Mansouri", type: "B2C", amount: 534, vatAmount: 25.4, status: "COLLECTED", issuedAt: "2024-11-15" },
  { id: "inv_004", invoiceNo: "INV-2024-1467", buyer: "Majid Al Futtaim Retail", type: "B2B", amount: 45000, vatAmount: 2142.9, status: "OUTSTANDING", issuedAt: "2024-11-18" },
  { id: "inv_005", invoiceNo: "INV-2024-1490", buyer: "Emirates NBD Facilities", type: "B2B", amount: 12600, vatAmount: 600, status: "COLLECTED", issuedAt: "2024-11-22" },
];

// --- Finance (Module 7) ---

export const MOCK_PAYMENTS = [
  { id: "pay_001", ref: "PAY-2024-3301", invoiceNo: "INV-2024-1422", payer: "Gulf Industrial Trading LLC", method: "BANK_TRANSFER", amount: 22000, currency: "AED", status: "SUCCEEDED", processedAt: "2024-11-03", gateway: "Emirates NBD" },
  { id: "pay_002", ref: "PAY-2024-3315", invoiceNo: "INV-2024-1451", payer: "Ahmed Al Mansouri", method: "CREDIT_CARD", amount: 559, currency: "AED", status: "SUCCEEDED", processedAt: "2024-11-15", gateway: "Stripe" },
  { id: "pay_003", ref: "PAY-2024-3340", invoiceNo: "INV-2024-1490", payer: "Emirates NBD Facilities", method: "BANK_TRANSFER", amount: 13200, currency: "AED", status: "SUCCEEDED", processedAt: "2024-11-23", gateway: "Emirates NBD" },
  { id: "pay_004", ref: "PAY-2024-3352", invoiceNo: "INV-2024-1467", payer: "Majid Al Futtaim Retail", method: "MADA", amount: 47143, currency: "AED", status: "PENDING", processedAt: "—", gateway: "PayTabs" },
  { id: "pay_005", ref: "PAY-2024-3358", invoiceNo: "INV-2024-1502", payer: "Sara Al-Mansouri", method: "APPLE_PAY", amount: 312, currency: "AED", status: "FAILED", processedAt: "2024-11-24", gateway: "Stripe" },
  { id: "pay_006", ref: "PAY-2024-3361", invoiceNo: "INV-2024-1438", payer: "Al Barsha Construction Co.", method: "CREDIT_TERMS", amount: 8800, currency: "AED", status: "PENDING", processedAt: "—", gateway: "Net 30 Terms" },
  { id: "pay_007", ref: "PAY-2024-3370", invoiceNo: "INV-2024-1455", payer: "Khalid Al Rashid", method: "CREDIT_CARD", amount: 890, currency: "AED", status: "REFUNDED", processedAt: "2024-11-21", gateway: "Stripe" },
];

export const MOCK_SETTLEMENTS = [
  { id: "stl_001", seller: "Gulf Industrial Supplies LLC", grossSales: 48200, commission: 2410, commissionRate: 5.0, handlingFees: 320, netPayout: 45470, currency: "AED", status: "PENDING", periodEnd: "2024-11-30", orders: 18 },
  { id: "stl_002", seller: "SafeGuard AE", grossSales: 31600, commission: 1896, commissionRate: 6.0, handlingFees: 210, netPayout: 29494, currency: "AED", status: "PENDING", periodEnd: "2024-11-30", orders: 12 },
  { id: "stl_003", seller: "FireShield LLC", grossSales: 18400, commission: 920, commissionRate: 5.0, handlingFees: 140, netPayout: 17340, currency: "AED", status: "PROCESSING", periodEnd: "2024-11-30", orders: 7 },
  { id: "stl_004", seller: "OfficeZone KW", grossSales: 12800, commission: 768, commissionRate: 6.0, handlingFees: 95, netPayout: 11937, currency: "AED", status: "PENDING", periodEnd: "2024-11-30", orders: 9 },
  { id: "stl_005", seller: "Gulf Industrial Supplies LLC", grossSales: 52100, commission: 2605, commissionRate: 5.0, handlingFees: 340, netPayout: 49155, currency: "AED", status: "PAID", periodEnd: "2024-10-31", orders: 21 },
  { id: "stl_006", seller: "SafeGuard AE", grossSales: 28900, commission: 1734, commissionRate: 6.0, handlingFees: 190, netPayout: 26976, currency: "AED", status: "PAID", periodEnd: "2024-10-31", orders: 11 },
];

export const MOCK_VAT_PERIODS = [
  { id: "vat_q4", period: "Q4 2024 (Oct–Dec)", outputVat: 18420, inputVat: 6210, netVatDue: 12210, status: "OPEN", filingDeadline: "2025-01-28", country: "AE", rate: 5 },
  { id: "vat_q3", period: "Q3 2024 (Jul–Sep)", outputVat: 21800, inputVat: 7340, netVatDue: 14460, status: "FILED", filingDeadline: "2024-10-28", country: "AE", rate: 5 },
  { id: "vat_q2", period: "Q2 2024 (Apr–Jun)", outputVat: 16200, inputVat: 5120, netVatDue: 11080, status: "FILED", filingDeadline: "2024-07-28", country: "AE", rate: 5 },
  { id: "vat_sa_q4", period: "Q4 2024 (Oct–Dec)", outputVat: 9800, inputVat: 3100, netVatDue: 6700, status: "OPEN", filingDeadline: "2025-01-31", country: "SA", rate: 15 },
];

export const MOCK_CREDIT_ACCOUNTS = [
  { id: "cr1", company: "Gulf Industrial Trading LLC", creditLimit: 150000, used: 82000, terms: "Net 30", overdue: 0, status: "GOOD" },
  { id: "cr2", company: "Al Barsha Construction Co.", creditLimit: 100000, used: 91000, terms: "Net 30", overdue: 8400, status: "WARNING" },
  { id: "cr3", company: "Majid Al Futtaim Retail", creditLimit: 200000, used: 45000, terms: "Net 60", overdue: 0, status: "GOOD" },
  { id: "cr4", company: "Doha Facilities Management", creditLimit: 60000, used: 55000, terms: "Net 30", overdue: 12000, status: "HOLD" },
];

export const MOCK_WAREHOUSE_DATA = {
  utilization: 68,
  pendingDispatch: 14,
  inboundShipments: 6,
  stockByCategory: [
    { category: "Safety & PPE", units: 4820, value: 186000 },
    { category: "Industrial Supplies", units: 2310, value: 441000 },
    { category: "Office Supplies", units: 8900, value: 312000 },
    { category: "Building Materials", units: 1200, value: 98000 },
    { category: "Electronics", units: 560, value: 224000 },
  ],
  lowStockAlerts: [
    { product: "Safety Helmet Pro X200", sku: "SH-X200", qty: 8, reorderPoint: 20 },
    { product: "CO2 Fire Extinguisher 5kg", sku: "FE-CO2-5K", qty: 3, reorderPoint: 10 },
    { product: "Nitrile Gloves Box 100", sku: "NG-100B", qty: 15, reorderPoint: 50 },
  ],
};

export const MOCK_CRM_ACTIVITIES = [
  { id: "act_001", type: "ORDER", customer: "Gulf Industrial Trading LLC", detail: "Placed B2B order #AC-2024-00189 — AED 2,100", time: "2h ago" },
  { id: "act_002", type: "RFQ", customer: "Al Barsha Construction Co.", detail: "Submitted RFQ for industrial shelving — AED 8,000 target", time: "5h ago" },
  { id: "act_003", type: "REGISTRATION", customer: "Emirates Catering Services", detail: "New B2B company account registered", time: "1d ago" },
  { id: "act_004", type: "QUOTE_VIEW", customer: "Majid Al Futtaim Retail", detail: "Viewed quote for RFQ-2024-0041 but did not accept", time: "2d ago" },
  { id: "act_005", type: "RETURN", customer: "Ahmed Al Mansouri", detail: "Requested return for order #AC-2024-00142", time: "3d ago" },
];

export const MOCK_TOP_CUSTOMERS = [
  { id: "c1", name: "Gulf Industrial Trading LLC", type: "B2B", totalOrders: 24, totalSpent: 184000, lastOrder: "2024-11-20", country: "AE" },
  { id: "c2", name: "Al Barsha Construction Co.", type: "B2B", totalOrders: 18, totalSpent: 142000, lastOrder: "2024-11-18", country: "AE" },
  { id: "c3", name: "Majid Al Futtaim Retail", type: "B2B", totalOrders: 31, totalSpent: 98500, lastOrder: "2024-11-22", country: "AE" },
  { id: "c4", name: "Emirates NBD Facilities", type: "B2B", totalOrders: 12, totalSpent: 67200, lastOrder: "2024-11-15", country: "AE" },
  { id: "c5", name: "Ahmed Al Mansouri", type: "B2C", totalOrders: 8, totalSpent: 4320, lastOrder: "2024-11-25", country: "AE" },
];

// --- CRM & Growth (Module 6) ---

export const MOCK_CRM_ACCOUNTS = [
  { id: "acc1", name: "Gulf Industrial Trading LLC", type: "B2B", contact: "Mohammed Al-Rashidi", email: "m.rashidi@gulfindustrial.ae", phone: "+971 4 234 5678", totalOrders: 24, totalSpent: 184000, lastActivity: "2024-11-20", health: 92, stage: "CUSTOMER", owner: "Sara Ahmed", country: "AE" },
  { id: "acc2", name: "Al Barsha Construction Co.", type: "B2B", contact: "Fatima Hassan", email: "f.hassan@albarsha.ae", phone: "+971 4 345 6789", totalOrders: 18, totalSpent: 142000, lastActivity: "2024-11-18", health: 78, stage: "CUSTOMER", owner: "Ali Hassan", country: "AE" },
  { id: "acc3", name: "Majid Al Futtaim Retail", type: "B2B", contact: "Khalid Omar", email: "k.omar@maf.ae", phone: "+971 4 456 7890", totalOrders: 31, totalSpent: 98500, lastActivity: "2024-11-22", health: 85, stage: "CUSTOMER", owner: "Sara Ahmed", country: "AE" },
  { id: "acc4", name: "Doha Facilities Management", type: "B2B", contact: "Noura Al-Sayed", email: "noura@dohafm.qa", phone: "+974 4 567 8901", totalOrders: 6, totalSpent: 41000, lastActivity: "2024-10-12", health: 42, stage: "AT_RISK", owner: "Mohammed Al Sayed", country: "QA" },
  { id: "acc5", name: "Emirates Catering Services", type: "B2B", contact: "Yousef Karim", email: "y.karim@emiratescatering.ae", phone: "+971 4 678 9012", totalOrders: 2, totalSpent: 12400, lastActivity: "2024-11-23", health: 60, stage: "LEAD", owner: "Ali Hassan", country: "AE" },
  { id: "acc6", name: "Riyadh Tech Procurement", type: "B2B", contact: "Abdullah Saleh", email: "a.saleh@riyadhtech.sa", phone: "+966 11 234 5678", totalOrders: 0, totalSpent: 0, lastActivity: "2024-11-26", health: 50, stage: "PROSPECT", owner: "Ali Hassan", country: "SA" },
  { id: "acc7", name: "Ahmed Al Mansouri", type: "B2C", contact: "Ahmed Al Mansouri", email: "ahmed.m@gmail.com", phone: "+971 50 123 4567", totalOrders: 8, totalSpent: 4320, lastActivity: "2024-11-25", health: 70, stage: "CUSTOMER", owner: "—", country: "AE" },
  { id: "acc8", name: "Kuwait Office Solutions", type: "B2B", contact: "Layla Mansour", email: "l.mansour@kos.kw", phone: "+965 2 345 6789", totalOrders: 9, totalSpent: 58000, lastActivity: "2024-09-30", health: 35, stage: "AT_RISK", owner: "Mohammed Al Sayed", country: "KW" },
];

export const MOCK_CAMPAIGNS = [
  { id: "cmp1", name: "Q4 Safety Equipment Push", channel: "EMAIL", audience: "B2B Buyers", status: "ACTIVE", sent: 1240, opened: 612, clicked: 188, converted: 34, revenue: 142000, startDate: "2024-11-01", endDate: "2024-12-31" },
  { id: "cmp2", name: "Abandoned Cart Recovery", channel: "EMAIL", audience: "B2C — Cart Abandoners", status: "ACTIVE", sent: 856, opened: 401, clicked: 142, converted: 58, revenue: 18600, startDate: "2024-11-10", endDate: "Ongoing" },
  { id: "cmp3", name: "New Supplier Welcome Series", channel: "EMAIL", audience: "New Suppliers", status: "ACTIVE", sent: 64, opened: 52, clicked: 38, converted: 21, revenue: 0, startDate: "2024-10-15", endDate: "Ongoing" },
  { id: "cmp4", name: "Ramadan B2B Promo", channel: "SMS", audience: "All B2B Companies", status: "SCHEDULED", sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0, startDate: "2025-02-20", endDate: "2025-03-20" },
  { id: "cmp5", name: "VIP Customer Re-engagement", channel: "WHATSAPP", audience: "Inactive VIP (30+ days)", status: "SCHEDULED", sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0, startDate: "2024-12-05", endDate: "2024-12-15" },
  { id: "cmp6", name: "Black Friday Industrial Deals", channel: "EMAIL", audience: "All Customers", status: "COMPLETED", sent: 5840, opened: 3210, clicked: 1102, converted: 287, revenue: 412000, startDate: "2024-11-24", endDate: "2024-11-29" },
  { id: "cmp7", name: "Office Supplies Reorder Reminder", channel: "EMAIL", audience: "B2B — Repeat Buyers", status: "COMPLETED", sent: 420, opened: 298, clicked: 121, converted: 67, revenue: 89000, startDate: "2024-10-01", endDate: "2024-10-31" },
];

export const MOCK_SEGMENTS = [
  { id: "seg1", name: "VIP B2B Companies", description: "B2B accounts with AED 100k+ lifetime spend", count: 42, type: "B2B", growth: 12, avgSpend: 156000, color: "purple" },
  { id: "seg2", name: "High-Frequency Buyers", description: "10+ orders in last 90 days", count: 128, type: "MIXED", growth: 8, avgSpend: 42000, color: "blue" },
  { id: "seg3", name: "At-Risk Accounts", description: "No order in 30+ days, previously active", count: 36, type: "B2B", growth: -15, avgSpend: 38000, color: "red" },
  { id: "seg4", name: "New Customers (30d)", description: "Registered within last 30 days", count: 214, type: "MIXED", growth: 24, avgSpend: 1800, color: "green" },
  { id: "seg5", name: "Cart Abandoners", description: "Added to cart, no checkout in 24h", count: 89, type: "B2C", growth: 5, avgSpend: 0, color: "amber" },
  { id: "seg6", name: "Quote No-Converts", description: "Received quote, did not accept in 7 days", count: 53, type: "B2B", growth: -3, avgSpend: 0, color: "orange" },
  { id: "seg7", name: "Dormant Accounts", description: "No activity in 90+ days", count: 167, type: "MIXED", growth: -8, avgSpend: 22000, color: "slate" },
  { id: "seg8", name: "Single-Purchase B2C", description: "Exactly one order, eligible for repeat", count: 1840, type: "B2C", growth: 18, avgSpend: 320, color: "cyan" },
];

export const MOCK_RETENTION_RISKS = [
  { id: "r1", account: "Kuwait Office Solutions", type: "B2B", risk: "HIGH", daysSinceOrder: 61, lifetimeValue: 58000, reason: "No order in 61 days · 3 unanswered follow-ups", action: "Personal call from account manager", owner: "Mohammed Al Sayed" },
  { id: "r2", account: "Doha Facilities Management", type: "B2B", risk: "HIGH", daysSinceOrder: 49, lifetimeValue: 41000, reason: "Declining order frequency · last quote not converted", action: "Send win-back offer (10% off)", owner: "Mohammed Al Sayed" },
  { id: "r3", account: "Sharjah Safety Systems", type: "B2B", risk: "MEDIUM", daysSinceOrder: 34, lifetimeValue: 44100, reason: "Order frequency down 40% vs prior quarter", action: "Reorder reminder email", owner: "Sara Ahmed" },
  { id: "r4", account: "Ahmed Al Mansouri", type: "B2C", risk: "MEDIUM", daysSinceOrder: 28, lifetimeValue: 4320, reason: "Was monthly buyer, now 28 days inactive", action: "Personalized product recommendations", owner: "—" },
  { id: "r5", account: "Apex Procurement FZCO", type: "B2B", risk: "LOW", daysSinceOrder: 18, lifetimeValue: 67200, reason: "Slightly below usual cadence", action: "Monitor — no action yet", owner: "Sara Ahmed" },
];

export const MOCK_LIFECYCLE_STAGES = [
  { stage: "Prospects", count: 312, color: "slate" },
  { stage: "Leads", count: 186, color: "blue" },
  { stage: "Active Customers", count: 4108, color: "green" },
  { stage: "At Risk", count: 36, color: "amber" },
  { stage: "Churned", count: 94, color: "red" },
];

// --- Admin & Settings (Module 9) ---

export const MOCK_AUDIT_LOGS = [
  { id: "al1", actor: "Sara Ahmed", role: "ADMIN", action: "APPROVED", target: "Seller: FireShield LLC", category: "SELLER", ip: "94.207.12.4", time: "2024-11-26 14:32" },
  { id: "al2", actor: "Admin User", role: "SUPER_ADMIN", action: "UPDATED", target: "Commission rule: B2B default 5% → 5.5%", category: "PRICING", ip: "94.207.12.1", time: "2024-11-26 12:10" },
  { id: "al3", actor: "Mohammed Al Sayed", role: "ADMIN", action: "RESOLVED", target: "Dispute DSP-003", category: "DISPUTE", ip: "94.207.12.7", time: "2024-11-26 11:45" },
  { id: "al4", actor: "Sara Ahmed", role: "ADMIN", action: "REJECTED", target: "Product: Counterfeit Drill Set (SKU CD-001)", category: "PRODUCT", ip: "94.207.12.4", time: "2024-11-26 10:20" },
  { id: "al5", actor: "Ali Hassan", role: "ADMIN", action: "PROCESSED", target: "Settlement: SafeGuard AE — AED 29,494", category: "FINANCE", ip: "94.207.12.9", time: "2024-11-25 17:02" },
  { id: "al6", actor: "Admin User", role: "SUPER_ADMIN", action: "SUSPENDED", target: "User: omar.y@sharjah-safety.ae", category: "USER", ip: "94.207.12.1", time: "2024-11-25 15:38" },
  { id: "al7", actor: "System", role: "SYSTEM", action: "AUTO_FLAGGED", target: "Order AC-2024-00231 — fraud risk score 78", category: "SECURITY", ip: "—", time: "2024-11-25 09:14" },
  { id: "al8", actor: "Sara Ahmed", role: "ADMIN", action: "UPDATED", target: "Integration: PayTabs gateway reconnected", category: "INTEGRATION", ip: "94.207.12.4", time: "2024-11-24 16:50" },
  { id: "al9", actor: "Layla Support", role: "ADMIN", action: "ESCALATED", target: "Ticket TKT-007", category: "SUPPORT", ip: "94.207.12.11", time: "2024-11-24 14:22" },
  { id: "al10", actor: "Admin User", role: "SUPER_ADMIN", action: "CREATED", target: "Automation rule: Low-stock replenishment alert", category: "AUTOMATION", ip: "94.207.12.1", time: "2024-11-24 10:05" },
];

export const MOCK_SYSTEM_HEALTH = {
  uptime: 99.98,
  apiStatus: "OPERATIONAL",
  dbStatus: "OPERATIONAL",
  searchStatus: "OPERATIONAL",
  storageStatus: "DEGRADED",
  lastDeployment: "2024-11-26 08:00",
  avgResponseMs: 142,
  services: [
    { name: "API Gateway", status: "OPERATIONAL", latency: "142ms", uptime: 99.98 },
    { name: "PostgreSQL Database", status: "OPERATIONAL", latency: "8ms", uptime: 99.99 },
    { name: "Redis Cache", status: "OPERATIONAL", latency: "2ms", uptime: 100 },
    { name: "Elasticsearch", status: "OPERATIONAL", latency: "24ms", uptime: 99.95 },
    { name: "S3 Storage (MinIO)", status: "DEGRADED", latency: "320ms", uptime: 98.20 },
    { name: "Payment Gateway", status: "OPERATIONAL", latency: "210ms", uptime: 99.90 },
  ],
};

// --- Pricing & Commission (Module 10) ---

export const MOCK_PRICING_PRODUCTS = [
  { id: "pp1", sku: "SH-X200", name: "Safety Helmet Pro X200", category: "Safety & PPE", seller: "SafeGuard AE", supplierCost: 52, b2cPrice: 89, b2bPrice: 75, commissionRate: 6.0, handlingFee: 3, vatRate: 5 },
  { id: "pp2", sku: "NG-100B", name: "Nitrile Gloves (Box 100)", category: "Safety & PPE", seller: "MediSafe Gulf", supplierCost: 28, b2cPrice: 45, b2bPrice: 38, commissionRate: 5.0, handlingFee: 2, vatRate: 5 },
  { id: "pp3", sku: "DR-18V", name: "Industrial Drill Set 18V", category: "Tools", seller: "Gulf Industrial", supplierCost: 290, b2cPrice: 449, b2bPrice: 420, commissionRate: 5.5, handlingFee: 8, vatRate: 5 },
  { id: "pp4", sku: "FE-CO2-5K", name: "CO2 Fire Extinguisher 5kg", category: "Safety & PPE", seller: "FireShield LLC", supplierCost: 95, b2cPrice: 165, b2bPrice: 145, commissionRate: 6.0, handlingFee: 5, vatRate: 5 },
  { id: "pp5", sku: "OC-ERG", name: "Ergonomic Office Chair", category: "Office", seller: "OfficeZone KW", supplierCost: 480, b2cPrice: 799, b2bPrice: 700, commissionRate: 5.0, handlingFee: 12, vatRate: 5 },
];

export const MOCK_BULK_TIERS = [
  { minQty: 1, maxQty: 24, price: 75, label: "Standard" },
  { minQty: 25, maxQty: 99, price: 69, label: "Bulk" },
  { minQty: 100, maxQty: 499, price: 62, label: "Wholesale" },
  { minQty: 500, maxQty: null, price: 55, label: "Enterprise" },
];

export const MOCK_CONTRACT_PRICING = [
  { id: "cp1", company: "Gulf Industrial Trading LLC", sku: "SH-X200", product: "Safety Helmet Pro X200", contractPrice: 68, standardPrice: 75, discount: 9.3, validUntil: "2025-06-30", status: "ACTIVE" },
  { id: "cp2", company: "Al Barsha Construction Co.", sku: "DR-18V", product: "Industrial Drill Set 18V", contractPrice: 395, standardPrice: 420, discount: 6.0, validUntil: "2025-03-31", status: "ACTIVE" },
  { id: "cp3", company: "Majid Al Futtaim Retail", sku: "OC-ERG", product: "Ergonomic Office Chair", contractPrice: 640, standardPrice: 700, discount: 8.6, validUntil: "2024-12-31", status: "EXPIRING" },
  { id: "cp4", company: "Emirates NBD Facilities", sku: "FE-CO2-5K", product: "CO2 Fire Extinguisher 5kg", contractPrice: 135, standardPrice: 145, discount: 6.9, validUntil: "2025-09-30", status: "ACTIVE" },
];

export const MOCK_COMMISSION_RULES = [
  { id: "cr1", name: "Default B2C", scope: "All B2C orders", rate: 5.0, type: "PERCENTAGE", status: "ACTIVE" },
  { id: "cr2", name: "Default B2B", scope: "All B2B orders", rate: 5.5, type: "PERCENTAGE", status: "ACTIVE" },
  { id: "cr3", name: "Safety & PPE Category", scope: "Category: Safety & PPE", rate: 6.0, type: "PERCENTAGE", status: "ACTIVE" },
  { id: "cr4", name: "Gold Tier Sellers", scope: "Sellers with GOLD tier", rate: 4.0, type: "PERCENTAGE", status: "ACTIVE" },
  { id: "cr5", name: "Enterprise Volume (500+)", scope: "Orders over AED 50k", rate: 3.5, type: "PERCENTAGE", status: "ACTIVE" },
  { id: "cr6", name: "New Seller Promo", scope: "Sellers < 90 days", rate: 2.5, type: "PERCENTAGE", status: "SCHEDULED" },
];

// --- Executive Command Center (Dashboard) ---

export const MOCK_EXECUTIVE = {
  kpis: {
    gmvMonth: 1284500, gmvTrend: 18.4,
    b2bRevenue: 842300, b2bTrend: 22.1,
    b2cRevenue: 442200, b2cTrend: 11.3,
    activeCompanies: 287, companiesTrend: 6.7,
    activeCustomers: 4821, customersTrend: 3.0,
    activeSuppliers: 142, suppliersTrend: 2.1,
    rfqConversion: 34, rfqConversionTrend: 4.0,
    fulfillmentRate: 96.2, fulfillmentTrend: 1.4,
    warehouseUtilization: 68, warehouseTrend: -2.0,
    openDisputes: 3, disputesTrend: -1,
    commission: 68240, commissionTrend: 12.0,
    delayedOrders: 14, delayedTrend: 3,
  },
  revenueSplit: { b2b: 842300, b2c: 442200 },
  rfqFunnel: [
    { stage: "RFQs Created", count: 248, color: "bg-blue-500" },
    { stage: "Sent to Suppliers", count: 214, color: "bg-indigo-500" },
    { stage: "Quoted", count: 142, color: "bg-purple-500" },
    { stage: "Accepted", count: 84, color: "bg-green-500" },
  ],
  orderLifecycle: [
    { stage: "Confirmed", count: 64, color: "bg-blue-500" },
    { stage: "Processing", count: 38, color: "bg-purple-500" },
    { stage: "Shipped", count: 52, color: "bg-cyan-500" },
    { stage: "Delivered", count: 410, color: "bg-green-500" },
    { stage: "Disputed", count: 3, color: "bg-red-500" },
  ],
  topCategories: [
    { name: "Safety & PPE", gmv: 384000, share: 30 },
    { name: "Industrial Supplies", gmv: 312000, share: 24 },
    { name: "Office Supplies", gmv: 218000, share: 17 },
    { name: "Electronics", gmv: 196000, share: 15 },
    { name: "Building Materials", gmv: 174500, share: 14 },
  ],
  topSuppliers: [
    { name: "Gulf Industrial Supplies", gmv: 284000, orders: 142, rating: 4.8, tier: "GOLD" },
    { name: "SafeGuard AE", gmv: 196000, orders: 98, rating: 4.6, tier: "GOLD" },
    { name: "FireShield LLC", gmv: 142000, orders: 76, rating: 4.5, tier: "VERIFIED" },
    { name: "OfficeZone KW", gmv: 98000, orders: 54, rating: 4.3, tier: "VERIFIED" },
    { name: "MediSafe Gulf", gmv: 84000, orders: 47, rating: 4.7, tier: "GOLD" },
  ],
  aiRecommendations: [
    { icon: "TrendingDown", iconStyle: "bg-red-100 text-red-600", title: "High-value B2B account declining", description: "Kuwait Office Solutions (AED 58k LTV) has not ordered in 61 days. Win-back outreach recommended this week.", confidence: 92, tag: "Retention", tagStyle: "bg-red-100 text-red-700", actionLabel: "View Retention", actionHref: "/retention" },
    { icon: "Truck", iconStyle: "bg-amber-100 text-amber-600", title: "Supplier delay risk", description: "Gulf Industrial processing time up 40%. 14 orders at risk of missing SLA — affects 2 VIP buyers.", confidence: 86, tag: "Operations", tagStyle: "bg-amber-100 text-amber-700", actionLabel: "View Orders", actionHref: "/orders" },
    { icon: "FileQuestion", iconStyle: "bg-blue-100 text-blue-600", title: "RFQs need backup suppliers", description: "3 open RFQs have had no supplier response in 48h+. Inviting backup suppliers could prevent buyer churn.", confidence: 94, tag: "B2B", tagStyle: "bg-blue-100 text-blue-700", actionLabel: "View RFQs", actionHref: "/rfqs" },
    { icon: "ShoppingCart", iconStyle: "bg-purple-100 text-purple-600", title: "Abandoned cart recovery", description: "89 B2C carts abandoned in 24h (AED 18.6k value). An automated recovery campaign could recover ~22%.", confidence: 81, tag: "Growth", tagStyle: "bg-purple-100 text-purple-700", actionLabel: "Launch Campaign", actionHref: "/campaigns" },
    { icon: "Boxes", iconStyle: "bg-cyan-100 text-cyan-600", title: "Warehouse bottleneck alert", description: "Abu Dhabi cross-dock at 82% utilization with rising inbound volume. Consider redistributing fast-movers.", confidence: 77, tag: "Warehouse", tagStyle: "bg-cyan-100 text-cyan-700", actionLabel: "Open Warehouse", actionHref: "/warehouse" },
    { icon: "Coins", iconStyle: "bg-green-100 text-green-600", title: "Price optimization opportunity", description: "3 high-volume SKUs priced 10–18% above market. Adjusting could recover ~AED 8.2k/mo in conversions.", confidence: 89, tag: "Revenue", tagStyle: "bg-green-100 text-green-700", actionLabel: "View Pricing", actionHref: "/pricing" },
  ],
  operationalHealth: [
    { label: "RFQs pending supplier response", value: 3, severity: "warning", href: "/rfqs" },
    { label: "Orders stuck in processing", value: 38, severity: "warning", href: "/orders?status=PROCESSING" },
    { label: "Supplier documents expiring (30d)", value: 2, severity: "danger", href: "/compliance" },
    { label: "Tickets near SLA breach", value: 3, severity: "danger", href: "/sla" },
    { label: "Low inventory alerts", value: 3, severity: "warning", href: "/warehouse/stock?filter=low" },
  ],
};
