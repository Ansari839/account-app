#!/bin/bash

# Production cleanup script for orphaned stock ledger entries
# Run this once after deploying the new deletion logic

echo "🔍 Checking for orphaned stock ledger entries..."

# Count orphaned entries before cleanup
ORPHANED_COUNT=$(psql $DATABASE_URL -t -c "
SELECT COUNT(*) FROM \"StockLedger\" sl
WHERE 
  (sl.\"refType\" = 'SALES_INVOICE' AND NOT EXISTS (SELECT 1 FROM \"SalesInvoice\" si WHERE si.id = sl.\"refId\"))
  OR (sl.\"refType\" = 'DO' AND NOT EXISTS (SELECT 1 FROM \"DeliveryOrder\" do WHERE do.id = sl.\"refId\"))
  OR (sl.\"refType\" = 'GRN' AND NOT EXISTS (SELECT 1 FROM \"GRN\" grn WHERE grn.id = sl.\"refId\"))
  OR (sl.\"refType\" = 'PURCHASE_INVOICE' AND NOT EXISTS (SELECT 1 FROM \"PurchaseInvoice\" pi WHERE pi.id = sl.\"refId\"))
  OR (sl.\"refType\" = 'RETURN' AND NOT EXISTS (SELECT 1 FROM \"PurchaseReturn\" pr WHERE pr.id = sl.\"refId\"))
  OR (sl.\"refType\" = 'SALES_RETURN' AND NOT EXISTS (SELECT 1 FROM \"SalesReturn\" sr WHERE sr.id = sl.\"refId\"));
" | xargs)

echo "Found $ORPHANED_COUNT orphaned entries"

if [ "$ORPHANED_COUNT" -gt 0 ]; then
    echo "🧹 Cleaning up orphaned entries..."
    psql $DATABASE_URL -f prisma/migrations/cleanup_orphaned_stock.sql
    echo "✅ Cleanup complete!"
else
    echo "✅ No orphaned entries found. Database is clean!"
fi
