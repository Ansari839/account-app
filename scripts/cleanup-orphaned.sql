-- Quick cleanup script for orphaned stock ledger entries
-- Run this in Prisma Studio's SQL tab or via: npx prisma db execute --file scripts/cleanup-orphaned.sql

-- Show orphaned entries before cleanup
SELECT 
    sl.id,
    p.name as product_name,
    sl."refType",
    sl."qtyIn",
    sl."qtyOut",
    sl.date
FROM "StockLedger" sl
LEFT JOIN "Product" p ON p.id = sl."productId"
WHERE 
    (sl."refType" = 'SALES_INVOICE' AND NOT EXISTS (SELECT 1 FROM "SalesInvoice" si WHERE si.id = sl."refId"))
    OR (sl."refType" = 'DO' AND NOT EXISTS (SELECT 1 FROM "DeliveryOrder" do WHERE do.id = sl."refId"))
    OR (sl."refType" = 'GRN' AND NOT EXISTS (SELECT 1 FROM "GRN" grn WHERE grn.id = sl."refId"))
    OR (sl."refType" = 'PURCHASE_INVOICE' AND NOT EXISTS (SELECT 1 FROM "PurchaseInvoice" pi WHERE pi.id = sl."refId"))
    OR (sl."refType" = 'RETURN' AND NOT EXISTS (SELECT 1 FROM "PurchaseReturn" pr WHERE pr.id = sl."refId"))
    OR (sl."refType" = 'SALES_RETURN' AND NOT EXISTS (SELECT 1 FROM "SalesReturn" sr WHERE sr.id = sl."refId"));

-- Count orphaned entries
SELECT COUNT(*) as orphaned_count
FROM "StockLedger" sl
WHERE 
    (sl."refType" = 'SALES_INVOICE' AND NOT EXISTS (SELECT 1 FROM "SalesInvoice" si WHERE si.id = sl."refId"))
    OR (sl."refType" = 'DO' AND NOT EXISTS (SELECT 1 FROM "DeliveryOrder" do WHERE do.id = sl."refId"))
    OR (sl."refType" = 'GRN' AND NOT EXISTS (SELECT 1 FROM "GRN" grn WHERE grn.id = sl."refId"))
    OR (sl."refType" = 'PURCHASE_INVOICE' AND NOT EXISTS (SELECT 1 FROM "PurchaseInvoice" pi WHERE pi.id = sl."refId"))
    OR (sl."refType" = 'RETURN' AND NOT EXISTS (SELECT 1 FROM "PurchaseReturn" pr WHERE pr.id = sl."refId"))
    OR (sl."refType" = 'SALES_RETURN' AND NOT EXISTS (SELECT 1 FROM "SalesReturn" sr WHERE sr.id = sl."refId"));

-- DELETE orphaned entries (uncomment to execute)
-- DELETE FROM "StockLedger" sl
-- WHERE 
--     (sl."refType" = 'SALES_INVOICE' AND NOT EXISTS (SELECT 1 FROM "SalesInvoice" si WHERE si.id = sl."refId"))
--     OR (sl."refType" = 'DO' AND NOT EXISTS (SELECT 1 FROM "DeliveryOrder" do WHERE do.id = sl."refId"))
--     OR (sl."refType" = 'GRN' AND NOT EXISTS (SELECT 1 FROM "GRN" grn WHERE grn.id = sl."refId"))
--     OR (sl."refType" = 'PURCHASE_INVOICE' AND NOT EXISTS (SELECT 1 FROM "PurchaseInvoice" pi WHERE pi.id = sl."refId"))
--     OR (sl."refType" = 'RETURN' AND NOT EXISTS (SELECT 1 FROM "PurchaseReturn" pr WHERE pr.id = sl."refId"))
--     OR (sl."refType" = 'SALES_RETURN' AND NOT EXISTS (SELECT 1 FROM "SalesReturn" sr WHERE sr.id = sl."refId"));
