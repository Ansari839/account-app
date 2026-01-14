-- Migration to clean up orphaned stock ledger entries
-- This should be run once in production to clean existing orphaned data

-- Delete orphaned SALES_INVOICE entries
DELETE FROM "StockLedger" sl
WHERE sl."refType" = 'SALES_INVOICE'
AND NOT EXISTS (
    SELECT 1 FROM "SalesInvoice" si WHERE si.id = sl."refId"
);

-- Delete orphaned DO entries
DELETE FROM "StockLedger" sl
WHERE sl."refType" = 'DO'
AND NOT EXISTS (
    SELECT 1 FROM "DeliveryOrder" do WHERE do.id = sl."refId"
);

-- Delete orphaned GRN entries
DELETE FROM "StockLedger" sl
WHERE sl."refType" = 'GRN'
AND NOT EXISTS (
    SELECT 1 FROM "GRN" grn WHERE grn.id = sl."refId"
);

-- Delete orphaned PURCHASE_INVOICE entries
DELETE FROM "StockLedger" sl
WHERE sl."refType" = 'PURCHASE_INVOICE'
AND NOT EXISTS (
    SELECT 1 FROM "PurchaseInvoice" pi WHERE pi.id = sl."refId"
);

-- Delete orphaned RETURN entries
DELETE FROM "StockLedger" sl
WHERE sl."refType" = 'RETURN'
AND NOT EXISTS (
    SELECT 1 FROM "PurchaseReturn" pr WHERE pr.id = sl."refId"
);

-- Delete orphaned SALES_RETURN entries
DELETE FROM "StockLedger" sl
WHERE sl."refType" = 'SALES_RETURN'
AND NOT EXISTS (
    SELECT 1 FROM "SalesReturn" sr WHERE sr.id = sl."refId"
);
