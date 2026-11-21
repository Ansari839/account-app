"use client";

import React, { useState, useEffect, useMemo } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import Combobox from "@/components/Combobox";
import { useRouter } from "next/navigation";
import { 
    Save, 
    ArrowLeft, 
    Plus, 
    Trash2, 
    Receipt,
    Building2,
    Calendar,
    Warehouse,
    Calculator,
    CheckCircle2,
    Settings2,
    FileText,
    Truck,
    Layers,
    Zap,
    Search,
    X,
    CheckSquare,
    Square,
    Sparkles,
    Package
} from "lucide-react";
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function NewPurchaseInvoicePage() {
    const router = useRouter();
    const { showNotification } = useNotifications();

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Master Data
    const [sources, setSources] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [taxCodes, setTaxCodes] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isGrnMandatory, setIsGrnMandatory] = useState(false);
    const [currency, setCurrency] = useState<{ symbol: string }>({ symbol: '$' });

    // Form Data
    const [formData, setFormData] = useState<any>({
        sourceType: "PO", // PO | GRN | DIRECT
        sourceId: "",
        supplierId: "",
        warehouseId: "",
        date: new Date().toISOString().split("T")[0],
        dueDate: "",
        hasDiscount: false,
        discountAmount: 0,
        discountType: "FIXED",
        items: [],
        taxes: [],
    });

    const [accrualStageFilter, setAccrualStageFilter] = useState<"ALL" | "RAW" | "GREY" | "FINISH">("ALL");

    // Bulk Accrual Allocation Modal State
    const [isBulkAccrualModalOpen, setIsBulkAccrualModalOpen] = useState(false);
    const [bulkModalSearch, setBulkModalSearch] = useState("");
    const [bulkModalStage, setBulkModalStage] = useState<"ALL" | "RAW" | "GREY" | "FINISH">("ALL");
    const [bulkTotalQty, setBulkTotalQty] = useState<string>("");
    const [bulkOverrideRate, setBulkOverrideRate] = useState<string>("");
    // Map of accrual id -> { selected: boolean, allocatedQty: number, rate: number }
    const [bulkAllocations, setBulkAllocations] = useState<Record<string, { selected: boolean; allocatedQty: number; rate: number }>>({});

    // Stock Settlement Modal State (Settle Accruals directly from Physical Warehouse Stock)
    const [isStockSettleModalOpen, setIsStockSettleModalOpen] = useState(false);
    const [stockSettleWarehouseId, setStockSettleWarehouseId] = useState("");
    const [stockSettleDate, setStockSettleDate] = useState(new Date().toISOString().split("T")[0]);
    const [stockSettleRemarks, setStockSettleRemarks] = useState("");
    const [isStockSettling, setIsStockSettling] = useState(false);
    const [stockSettleRows, setStockSettleRows] = useState<any[]>([]);
    const [availableLots, setAvailableLots] = useState<any[]>([]);

    // Dedicated Stock Lot Browser Modal State (With EFS GD #, Origin, HS Code & Live Stock)
    const [isLotBrowserModalOpen, setIsLotBrowserModalOpen] = useState(false);
    const [activeAccrualGroupIndex, setActiveAccrualGroupIndex] = useState<number | null>(null);
    const [lotModalSearch, setLotModalSearch] = useState("");
    const [lotModalFilter, setLotModalFilter] = useState<"ALL" | "LOCAL" | "IMPORT_EFS" | "IMPORT_COMMERCIAL" | "OPENING">("ALL");
    const [lotModalAllocQtys, setLotModalAllocQtys] = useState<Record<string, number | string>>({});

    useEffect(() => {
        fetchSettings();
        fetchDropdowns();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await authenticatedFetch("/api/settings/inventory");
            const json = await res.json();
            if (json.success) {
                const mandatory = json.data.INVENTORY_GRN_MANDATORY === "true";
                setIsGrnMandatory(mandatory);
                if (mandatory) {
                    setFormData((p: any) => ({ ...p, sourceType: "GRN" }));
                }
            }
        } catch (e) { console.error(e); }
    };

    const fetchDropdowns = async () => {
        try {
            const [supRes, accRes, whRes, prodRes, unitRes, taxRes, currRes] = await Promise.all([
                authenticatedFetch("/api/finance/parties/suppliers"),
                authenticatedFetch('/api/accounts?isPosting=true'),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/products"),
                authenticatedFetch("/api/inventory/units"),
                authenticatedFetch("/api/finance/tax"),
                authenticatedFetch("/api/finance/currency"),
            ]);

            const sups = supRes.ok ? (await supRes.json()).data || [] : [];
            const accs = accRes.ok ? (await accRes.json()).accounts || [] : [];
            setAccounts(accs);
            
            const combined = [...sups];
            const existingIds = new Set(sups.map((s: any) => s.id));
            accs.forEach((a: any) => {
                if (!existingIds.has(a.id)) {
                    combined.push(a);
                    existingIds.add(a.id);
                }
            });

            setSuppliers(combined);
            if (whRes.ok) setWarehouses((await whRes.json()).data || []);
            if (prodRes.ok) setProducts((await prodRes.json()).data || []);
            if (unitRes.ok) {
                const uJson = await unitRes.json();
                console.log("Fetched units:", uJson);
                setUnits(uJson.data || []);
            }
            if (taxRes.ok) {
                const tJson = await taxRes.json();
                setTaxCodes(tJson.data || []);
            }
            
            if (currRes.ok) {
                const currJson = await currRes.json();
                if (currJson.success) {
                    const base = currJson.data.find((c: any) => c.isBase);
                    if (base) setCurrency({ symbol: base.symbol });
                }
            }

            // Fetch lots for yarn / stock settlement
            authenticatedFetch("/api/finance/production/execution/meta")
                .then(r => r.json())
                .then(j => {
                    if (j.success && j.data?.availableLots) {
                        setAvailableLots(j.data.availableLots);
                    }
                })
                .catch(console.error);
        } catch (error) {
            console.error("Error fetching dropdowns:", error);
        }
    };

    const fetchSources = async (type: string) => {
        try {
            const endpoint = type === "PO"
                ? "/api/finance/purchase/orders?status=OPEN"
                : type === "GRN"
                ? "/api/finance/purchase/grn"
                : "/api/finance/production/accruals?pendingOnly=true";
            const res = await authenticatedFetch(endpoint);
            const json = await res.json();
            if (json.success) {
                let data = json.data;
                if (type === "GRN") {
                    data = data.filter((g: any) => !g.invoices || g.invoices.length === 0);
                }
                setSources(data);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (formData.sourceType !== "DIRECT") {
            fetchSources(formData.sourceType);
        } else {
            setSources([]);
            setFormData((prev: any) => ({ ...prev, sourceId: '', items: [] }));
        }
    }, [formData.sourceType]);

    // Handle incoming URL parameters (e.g. ?sourceType=PRODUCTION&accrualId=...)
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const pSourceType = params.get("sourceType");
            const pAccrualId = params.get("accrualId");
            if (pSourceType === "PRODUCTION") {
                if (formData.sourceType !== "PRODUCTION") {
                    setFormData((prev: any) => ({ ...prev, sourceType: "PRODUCTION" }));
                }
                if (pAccrualId && sources.length > 0) {
                    const match = sources.find((s: any) => s.id === pAccrualId);
                    if (match && formData.sourceId !== pAccrualId) {
                        handleSelectSource(pAccrualId);
                    }
                }
            }
        }
    }, [sources]);

    const handleSelectSource = (id: string) => {
        const source = sources.find((s) => s.id === id);
        if (!source) {
            setFormData((prev: any) => ({ ...prev, sourceId: '', items: [] }));
            return;
        }

        let items: any[] = [];
        if (formData.sourceType === "PO") {
            items = source.items.map((item: any) => {
                const available = item.qty - (item.invoicedQty || 0);
                return {
                    id: Date.now().toString() + Math.random(),
                    productId: item.productId,
                    productName: item.product?.name,
                    unitId: item.unitId,
                    poItemId: item.id,
                    qtyAvailable: available,
                    qty: Math.max(0, available),
                    rate: item.rate,
                    total: available * item.rate,
                };
            });
        } else if (formData.sourceType === "GRN") {
            items = source.items.map((item: any) => ({
                id: Date.now().toString() + Math.random(),
                productId: item.productId,
                productName: item.product?.name,
                unitId: item.unitId,
                grnItemId: item.id,
                poItemId: item.poItemId,
                qtyAvailable: item.qtyReceived,
                qty: item.qtyReceived,
                rate: item.poItem?.rate || 0,
                total: item.qtyReceived * (item.poItem?.rate || 0),
            }));
        } else {
            // PRODUCTION ACCRUAL (allows multi-accrual and partial billing)
            const alreadyExists = formData.items.some((it: any) => it.productionAccrualId === source.id);
            if (alreadyExists) return;

            const newItem = {
                id: Date.now().toString() + Math.random(),
                productId: source.productId,
                productName: `${source.productName} [Accrual: ${source.accrualNo}]`,
                unitId: source.unitId,
                productionAccrualId: source.id,
                qtyAvailable: source.remainingQty,
                qty: source.remainingQty,
                rate: source.rate || 0,
                total: source.remainingQty * (source.rate || 0),
            };

            const existingAccrualItems = formData.items.filter((it: any) => it.productionAccrualId);
            items = [...existingAccrualItems, newItem];
        }

        setFormData({
            ...formData,
            sourceId: id,
            supplierId: source.supplierId || formData.supplierId,
            items,
        });
    };

    const handleAutoAllocateFIFO = () => {
        const totalQtyNeeded = parseFloat(bulkTotalQty);
        if (isNaN(totalQtyNeeded) || totalQtyNeeded <= 0) {
            showNotification('error', 'Please enter a valid Total Billed Quantity for FIFO allocation.');
            return;
        }

        const overrideRateNum = parseFloat(bulkOverrideRate);

        // Filter available sources based on stage and search
        const filtered = sources
            .filter(s => {
                if (bulkModalStage === "ALL") return true;
                if (bulkModalStage === "RAW") return s.stage === "RAW" || s.serviceType === "RAW_YARN";
                if (bulkModalStage === "GREY") return s.stage === "GREY" || s.serviceType === "WEAVING" || s.serviceType === "KNITTING";
                if (bulkModalStage === "FINISH") return s.stage === "FINISH" || s.serviceType === "DYEING" || s.serviceType === "PRINTING";
                return true;
            })
            .filter(s => {
                if (!bulkModalSearch) return true;
                const q = bulkModalSearch.toLowerCase();
                return (
                    s.accrualNo?.toLowerCase().includes(q) ||
                    s.productName?.toLowerCase().includes(q) ||
                    s.productCode?.toLowerCase().includes(q) ||
                    s.hsCode?.toLowerCase().includes(q) ||
                    s.supplierName?.toLowerCase().includes(q)
                );
            })
            // Strict FIFO order: Oldest date first
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (filtered.length === 0) {
            showNotification('error', 'No matching pending accruals found for this stage/filter.');
            return;
        }

        let remainingToAllocate = totalQtyNeeded;
        const newAllocations: Record<string, { selected: boolean; allocatedQty: number; rate: number }> = { ...bulkAllocations };

        for (const item of filtered) {
            const available = Number(item.remainingQty) || 0;
            if (available <= 0) continue;

            const rateToUse = (!isNaN(overrideRateNum) && overrideRateNum > 0) ? overrideRateNum : (Number(item.rate) || 0);

            if (remainingToAllocate > 0) {
                const qtyToTake = Math.min(available, remainingToAllocate);
                newAllocations[item.id] = {
                    selected: true,
                    allocatedQty: Math.round(qtyToTake * 100) / 100,
                    rate: rateToUse
                };
                remainingToAllocate -= qtyToTake;
            } else {
                newAllocations[item.id] = {
                    selected: false,
                    allocatedQty: available,
                    rate: rateToUse
                };
            }
        }

        setBulkAllocations(newAllocations);
        const allocatedBatchesCount = Object.values(newAllocations).filter(v => v.selected && v.allocatedQty > 0).length;
        showNotification('success', `FIFO Allocated across ${allocatedBatchesCount} batch(es). ${remainingToAllocate > 0 ? `Remaining shortfall: ${remainingToAllocate.toFixed(2)}` : 'Fully allocated!'}`);
    };

    const handleApplyBulkAccruals = () => {
        const selectedEntries = Object.entries(bulkAllocations).filter(([_, alloc]) => alloc.selected && alloc.allocatedQty > 0);
        if (selectedEntries.length === 0) {
            showNotification('error', 'No accrual batches selected for allocation.');
            return;
        }

        const newItems: any[] = [];
        let detectedSupplierId = formData.supplierId;

        for (const [accrualId, alloc] of selectedEntries) {
            const source = sources.find(s => s.id === accrualId);
            if (!source) continue;

            if (!detectedSupplierId && source.supplierId) {
                detectedSupplierId = source.supplierId;
            }

            newItems.push({
                id: Date.now().toString() + Math.random(),
                productId: source.productId,
                productName: `${source.productName} [Accrual: ${source.accrualNo}]`,
                unitId: source.unitId,
                unitName: source.unitCode,
                productionAccrualId: source.id,
                qtyAvailable: source.remainingQty,
                qty: alloc.allocatedQty,
                rate: alloc.rate,
                total: alloc.allocatedQty * alloc.rate,
                notes: `FIFO Offset [${source.accrualNo}]: Produced ${source.productionOutput}`
            });
        }

        const nonAccrualItems = formData.items.filter((it: any) => !it.productionAccrualId);
        setFormData((prev: any) => ({
            ...prev,
            supplierId: detectedSupplierId || prev.supplierId,
            items: [...nonAccrualItems, ...newItems]
        }));

        setIsBulkAccrualModalOpen(false);
        showNotification('success', `Added ${newItems.length} accrual batch(es) to purchase invoice.`);
    };

    // Map of product ID -> total stock qty, rate, and lots
    const productStockMap = useMemo(() => {
        const map: Record<string, { totalQty: number; avgRate: number; lots: any[] }> = {};
        availableLots.forEach(lot => {
            if (!map[lot.productId]) {
                map[lot.productId] = { totalQty: 0, avgRate: 0, lots: [] };
            }
            map[lot.productId].totalQty += Number(lot.qty || 0);
            map[lot.productId].lots.push(lot);
        });
        return map;
    }, [availableLots]);

    // Filtered lots for the lot browser modal
    const filteredStockLots = useMemo(() => {
        return availableLots
            .filter(lot => {
                if (lotModalFilter === "ALL") return true;
                const isEfs = Boolean(lot.isEFS || (lot.invoiceNo && lot.invoiceNo.includes("[EFS]")));
                const isImport = lot.origin === "IMPORT" || isEfs || (lot.invoiceNo && lot.invoiceNo.includes("[IMPORT]"));
                if (lotModalFilter === "LOCAL") return !isImport;
                if (lotModalFilter === "IMPORT_EFS") return isEfs;
                if (lotModalFilter === "IMPORT_COMMERCIAL") return isImport && !isEfs;
                if (lotModalFilter === "OPENING") return Boolean(lot.isOpening);
                return true;
            })
            .filter(lot => {
                if (!lotModalSearch) return true;
                const q = lotModalSearch.toLowerCase();
                return (
                    lot.productName?.toLowerCase().includes(q) ||
                    lot.productCode?.toLowerCase().includes(q) ||
                    lot.hsCode?.toLowerCase().includes(q) ||
                    lot.invoiceNo?.toLowerCase().includes(q) ||
                    lot.supplierName?.toLowerCase().includes(q)
                );
            })
            .sort((a, b) => b.qty - a.qty);
    }, [availableLots, lotModalFilter, lotModalSearch]);

    // Helpers to manage multi-lot deduction lines per accrual group
    const handleAddDeductionLine = (groupIndex: number) => {
        setStockSettleRows(prev => {
            const next = [...prev];
            const group = next[groupIndex];
            const currentAllocated = group.deductions.reduce((s: number, d: any) => s + (Number(d.qty) || 0), 0);
            const remainingToAllocate = Math.max(0, group.targetQty - currentAllocated);

            group.deductions.push({
                id: Date.now().toString() + Math.random(),
                productId: "",
                productName: "",
                productCode: "",
                hsCode: "",
                lotNo: "",
                isEFS: false,
                qty: remainingToAllocate > 0 ? remainingToAllocate : 0,
                rate: group.originalRate || 0
            });
            return next;
        });
    };

    const handleRemoveDeductionLine = (groupIndex: number, deductionIndex: number) => {
        setStockSettleRows(prev => {
            const next = [...prev];
            next[groupIndex].deductions.splice(deductionIndex, 1);
            if (next[groupIndex].deductions.length === 0) {
                // Keep at least one line
                next[groupIndex].deductions.push({
                    id: Date.now().toString() + Math.random(),
                    productId: "",
                    productName: "",
                    productCode: "",
                    hsCode: "",
                    lotNo: "",
                    isEFS: false,
                    qty: next[groupIndex].targetQty,
                    rate: next[groupIndex].originalRate || 0
                });
            }
            return next;
        });
    };

    const handleUpdateDeduction = (groupIndex: number, deductionIndex: number, field: string, value: any) => {
        setStockSettleRows(prev => {
            const next = [...prev];
            const d = next[groupIndex].deductions[deductionIndex];
            d[field] = value;

            if (field === 'productId') {
                const foundProd = products.find(p => p.id === value);
                if (foundProd) {
                    d.productName = foundProd.name;
                    d.productCode = foundProd.code;
                    d.hsCode = foundProd.hsCode || '';
                }
                const foundLots = productStockMap[value]?.lots || [];
                if (foundLots.length > 0) {
                    d.lotNo = foundLots[0].invoiceNo || '';
                    d.rate = foundLots[0].rate || d.rate;
                    d.isEFS = Boolean(foundLots[0].isEFS || (foundLots[0].invoiceNo && foundLots[0].invoiceNo.includes('[EFS]')));
                } else if (foundProd && (foundProd.purchasePrice || foundProd.standardCost)) {
                    d.rate = foundProd.purchasePrice || foundProd.standardCost || d.rate;
                    d.lotNo = '';
                    d.isEFS = false;
                }
            }

            if (field === 'lotNo') {
                const foundLot = availableLots.find(l => l.invoiceNo === value);
                if (foundLot) {
                    d.rate = foundLot.rate || d.rate;
                    d.isEFS = Boolean(foundLot.isEFS || (foundLot.invoiceNo && foundLot.invoiceNo.includes('[EFS]')));
                }
            }

            return next;
        });
    };

    const handleOpenLotBrowserModal = (groupIndex: number) => {
        setActiveAccrualGroupIndex(groupIndex);
        setLotModalSearch("");
        setLotModalFilter("ALL");

        const group = stockSettleRows[groupIndex];
        const currentAllocated = group.deductions.reduce((s: number, d: any) => s + (Number(d.qty) || 0), 0);
        const remainingToAllocate = Math.max(0, group.targetQty - currentAllocated);

        const initQtys: Record<string, number> = {};
        availableLots.forEach(lot => {
            initQtys[lot.id] = Math.min(Number(lot.qty || 0), remainingToAllocate > 0 ? remainingToAllocate : Number(lot.qty || 0));
        });
        setLotModalAllocQtys(initQtys);
        setIsLotBrowserModalOpen(true);
    };

    const handleAllocateLotToActiveGroup = (lot: any, customQty?: number) => {
        if (activeAccrualGroupIndex === null) return;
        const groupIndex = activeAccrualGroupIndex;
        const allocQty = customQty !== undefined ? customQty : Number(lotModalAllocQtys[lot.id] || lot.qty || 0);

        if (isNaN(allocQty) || allocQty <= 0) {
            showNotification('error', 'Please enter a valid allocation quantity.');
            return;
        }

        setStockSettleRows(prev => {
            const next = [...prev];
            const group = next[groupIndex];

            // If the group only had 1 empty deduction line, replace it
            if (group.deductions.length === 1 && !group.deductions[0].productId) {
                group.deductions = [];
            }

            // Check if lot already exists in deductions
            const existing = group.deductions.find((d: any) => d.lotNo === lot.invoiceNo && d.productId === lot.productId);
            if (existing) {
                existing.qty = Math.round((Number(existing.qty) + allocQty) * 100) / 100;
                existing.rate = lot.rate || existing.rate;
            } else {
                group.deductions.push({
                    id: Date.now().toString() + Math.random(),
                    productId: lot.productId,
                    productName: lot.productName,
                    productCode: lot.productCode,
                    hsCode: lot.hsCode,
                    lotNo: lot.invoiceNo,
                    isEFS: Boolean(lot.isEFS || (lot.invoiceNo && lot.invoiceNo.includes('[EFS]'))),
                    qty: allocQty,
                    rate: Number(lot.rate || 0)
                });
            }

            return next;
        });

        showNotification('success', `Allocated ${allocQty} KG from ${lot.invoiceNo} to ${stockSettleRows[groupIndex]?.accrualNo}.`);
    };

    const handleStockSettleConfirm = async () => {
        if (stockSettleRows.length === 0) {
            showNotification('error', 'Please select at least one accrual batch to settle from stock.');
            return;
        }
        const targetWh = stockSettleWarehouseId || (warehouses.length > 0 ? warehouses[0].id : "");
        if (!targetWh) {
            showNotification('error', 'Please select a target warehouse to deduct physical stock from.');
            return;
        }

        const flatItems: any[] = [];
        for (const group of stockSettleRows) {
            if (!group.deductions || group.deductions.length === 0) {
                showNotification('error', `Please allocate stock for accrual ${group.accrualNo}.`);
                return;
            }
            for (const d of group.deductions) {
                if (!d.productId) {
                    showNotification('error', `Please select a product/yarn from stock for ${group.accrualNo}.`);
                    return;
                }
                if (!d.qty || Number(d.qty) <= 0) {
                    showNotification('error', `Invalid deduction quantity for ${group.accrualNo}.`);
                    return;
                }
                flatItems.push({
                    accrualId: group.accrualId,
                    productId: d.productId,
                    qty: Number(d.qty),
                    rate: Number(d.rate),
                    lotNo: d.lotNo,
                    warehouseId: group.warehouseId || targetWh
                });
            }
        }

        try {
            setIsStockSettling(true);
            const payload = {
                warehouseId: targetWh,
                date: stockSettleDate,
                remarks: stockSettleRemarks || 'Settled against physical warehouse stock',
                items: flatItems
            };

            const res = await authenticatedFetch('/api/finance/production/accruals/settle-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showNotification('success', data.message || `Successfully settled ${stockSettleRows.length} batch(es) against physical warehouse stock.`);
                setIsStockSettleModalOpen(false);
                setIsBulkAccrualModalOpen(false);
                setBulkAllocations({});
                setStockSettleRows([]);
                fetchSources("PRODUCTION");
            } else {
                showNotification('error', data.error || 'Failed to settle against stock.');
            }
        } catch (e: any) {
            showNotification('error', e.message || 'Error occurred while settling stock.');
        } finally {
            setIsStockSettling(false);
        }
    };

    const handleAddItem = () => {
        setFormData((prev: any) => ({
            ...prev,
            items: [
                ...prev.items,
                { id: Date.now().toString(), productId: "", productName: "", unitId: "", qty: 1, rate: 0, taxCodeId: "", taxRate: 0, taxAmount: 0, total: 0, isEFS: false }
            ]
        }));
    };

    const handleRemoveItem = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            items: prev.items.filter((item: any) => item.id !== id)
        }));
    };

    const updateItem = (id: string, field: string, value: any) => {
        setFormData((prev: any) => {
            const newItems = prev.items.map((item: any) => {
                if (item.id === id) {
                    let refinedValue = value;
                    if (field === "qty" || field === "rate") {
                        refinedValue = isNaN(value) ? 0 : value;
                    }
                    const updatedItem = { ...item, [field]: refinedValue };
                    
                    if (field === "productId") {
                        const prod = products.find(p => p.id === value);
                        updatedItem.productName = prod?.name || "";
                        updatedItem.rate = Number(prod?.purchasePrice || 0);
                        if (prod?.baseUnitId) {
                            updatedItem.unitId = prod.baseUnitId;
                            setUnits((prev: any) => {
                                if (prev.some((u: any) => u.id === prod.baseUnitId)) return prev;
                                return [...prev, { id: prod.baseUnitId, name: prod.baseUnit?.name || 'Unit' }];
                            });
                        } else if (prod?.baseUnit?.id) {
                            updatedItem.unitId = prod.baseUnit.id;
                            setUnits((prev: any) => {
                                if (prev.some((u: any) => u.id === prod.baseUnit.id)) return prev;
                                return [...prev, { id: prod.baseUnit.id, name: prod.baseUnit.name || 'Unit' }];
                            });
                        }
                    }

                    const subtotal = Number(updatedItem.qty || 0) * Number(updatedItem.rate || 0);
                    updatedItem.total = subtotal; // No more tax in item total
                    
                    return updatedItem;
                }
                return item;
            });
            return { ...prev, items: newItems };
        });
    };

    const calculateSummary = () => {
        const subtotal = formData.items.reduce((sum: number, item: any) => sum + ((Number(item.qty) || 0) * (Number(item.rate) || 0)), 0);
        const discount = formData.hasDiscount ? Number(formData.discountAmount || 0) : 0;
        
        let currentTotal = subtotal - discount;
        let taxTotal = 0;
        
        // Calculate cascading taxes
        const calculatedTaxes = (formData.taxes || []).map((tax: any) => {
            const baseAmount = tax.calculation === 'PREVIOUS_TOTAL' ? currentTotal : (subtotal - discount);
            // If they typed a rate, calculate it. Otherwise, use the manually entered taxAmount.
            const rate = Number(tax.rate) || 0;
            const taxAmount = rate > 0 ? (baseAmount * (rate / 100)) : (Number(tax.taxAmount) || 0);
            
            taxTotal += taxAmount;
            currentTotal += taxAmount;
            
            return { ...tax, baseAmount, taxAmount };
        });

        const grandTotal = subtotal - discount + taxTotal;
        
        return { subtotal, discount, taxTotal, grandTotal, calculatedTaxes };
    };

    const handleAddTax = () => {
        setFormData((prev: any) => ({
            ...prev,
            taxes: [
                ...(prev.taxes || []),
                { id: Date.now().toString(), taxCodeId: "", taxName: "", calculation: "NET_TOTAL", rate: 0, taxAmount: 0 }
            ]
        }));
    };

    const handleRemoveTax = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            taxes: (prev.taxes || []).filter((t: any) => t.id !== id)
        }));
    };

    const updateTax = (id: string, field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            taxes: (prev.taxes || []).map((t: any) => {
                if (t.id === id) {
                    const updated = { ...t, [field]: value };
                    if (field === 'taxCodeId') {
                        if (value === 'MANUAL') {
                            updated.taxName = 'Manual Tax';
                        } else {
                            const tc = taxCodes.find(x => x.id === value);
                            if (tc) {
                                updated.taxName = tc.name;
                                updated.rate = Number(tc.rate);
                            }
                        }
                    }
                    // If they manually type tax amount, zero out the rate
                    if (field === 'taxAmount') {
                        updated.taxAmount = isNaN(value) ? 0 : value;
                        updated.rate = 0; // It becomes a fixed amount charge
                    }
                    return updated;
                }
                return t;
            })
        }));
    };

    const handleSubmit = async () => {
        if (!formData.supplierId) {
            showNotification('error', 'Please select a Supplier / Account.');
            return;
        }

        const validItems = formData.items.filter((i: any) => i.productId && Number(i.qty) > 0);
        if (validItems.length === 0) {
            showNotification('error', 'Please add at least one valid item.');
            return;
        }

        if (formData.sourceType !== "DIRECT") {
            const overFullfilled = formData.items.some((it: any) => it.qty > it.qtyAvailable);
            if (overFullfilled) {
                if (formData.sourceType === "PRODUCTION") {
                    // Allowed: Billed quantity above pending accrual automatically enters physical warehouse stock
                } else if (!confirm("One or more items exceed the remaining PO/GRN quantity. An 'Addendum PO' will be automatically created for the excess. Proceed?")) {
                    return;
                }
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                items: validItems,
                poId: formData.sourceType === "PO" ? formData.sourceId : undefined,
                grnId: formData.sourceType === "GRN" ? formData.sourceId : undefined,
            };

            const res = await authenticatedFetch('/api/finance/purchase/invoices', {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                showNotification('success', 'Purchase Invoice created successfully!');
                router.push('/finance/purchase/invoices');
            } else {
                const json = await res.json();
                showNotification('error', json.error || 'Failed to create invoice.');
            }
        } catch (error) {
            showNotification('error', 'Network error while saving invoice.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const supplierOptions = suppliers.map(s => ({
        value: s.id,
        label: `${s.code} - ${s.name}`
    }));

    const warehouseOptions = warehouses.map(w => ({
        value: w.id,
        label: w.name
    }));

    const sourceOptions = sources
        .filter(s => {
            if (formData.sourceType !== "PRODUCTION") return true;
            if (accrualStageFilter === "ALL") return true;
            if (accrualStageFilter === "RAW") return s.stage === "RAW" || s.serviceType === "RAW_YARN";
            if (accrualStageFilter === "GREY") return s.stage === "GREY" || s.serviceType === "WEAVING" || s.serviceType === "KNITTING";
            if (accrualStageFilter === "FINISH") return s.stage === "FINISH" || s.serviceType === "DYEING" || s.serviceType === "PRINTING";
            return true;
        })
        .map(s => {
            if (formData.sourceType === "PO") {
                return {
                    value: s.id,
                    label: `${s.poNo} - ${s.supplier?.name || "Unknown"} (Rs. ${Number(s.totalAmount).toLocaleString()})`
                };
            } else if (formData.sourceType === "GRN") {
                return {
                    value: s.id,
                    label: `${s.grnNo} - ${s.supplier?.name || "Unknown"}`
                };
            } else {
                let badge = "📦";
                if (s.stage === "RAW" || s.serviceType === "RAW_YARN") badge = "🧶 [RAW YARN]";
                else if (s.stage === "GREY" || s.serviceType === "WEAVING" || s.serviceType === "KNITTING") badge = `🧵 [${s.serviceType || 'WEAVING'}]`;
                else badge = `🎨 [${s.serviceType || 'FINISH'}]`;

                const dateStr = s.date ? new Date(s.date).toLocaleDateString('en-GB') : '';
                return {
                    value: s.id,
                    label: `${badge} ${s.accrualNo} (${dateStr}) | ${s.productName} | ${s.supplierName} | Avail: ${Number(s.remainingQty).toLocaleString()} ${s.unitCode} @ Rs. ${Number(s.rate).toFixed(2)}`
                };
            }
        });

    return (
        <MainLayout>
            <div className="max-w-[98%] 2xl:max-w-[1700px] mx-auto px-2 sm:px-4 space-y-6 pb-32 animate-in fade-in duration-500">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold text-sm"
                    >
                        <ArrowLeft size={16} /> Back to Invoices
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                        <CheckCircle2 size={16} className="text-emerald-500" /> New Bill
                    </div>
                </div>

                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-indigo-500/10 relative border border-slate-800 z-10">
                    <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    </div>
                    
                    <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-4 space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        ● Local Purchase
                                    </span>
                                </div>
                                <h1 className="text-4xl font-black text-white tracking-tight">New Bill</h1>
                                <p className="text-slate-400 font-medium">Create a Local Purchase Invoice</p>
                            </div>
                            
                            <div className="bg-slate-900/80 rounded-xl p-2 flex gap-1 border border-slate-800">
                                <button 
                                    onClick={() => setFormData({ ...formData, sourceType: "PO", sourceId: "", items: [] })}
                                    disabled={isGrnMandatory}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all",
                                        formData.sourceType === "PO" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200",
                                        isGrnMandatory && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <FileText size={14} /> PO
                                </button>
                                <button 
                                    onClick={() => setFormData({ ...formData, sourceType: "GRN", sourceId: "", items: [] })}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all",
                                        formData.sourceType === "GRN" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    <Truck size={14} /> GRN
                                </button>
                                <button 
                                    onClick={() => setFormData({ ...formData, sourceType: "PRODUCTION", sourceId: "", items: [] })}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                        formData.sourceType === "PRODUCTION" ? "bg-amber-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    <Layers size={14} /> Accrual
                                </button>
                                {!isGrnMandatory && (
                                    <button 
                                        onClick={() => setFormData({ ...formData, sourceType: "DIRECT", sourceId: "", items: [] })}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all",
                                            formData.sourceType === "DIRECT" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                                        )}
                                    >
                                        <Settings2 size={14} /> Direct
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {formData.sourceType !== "DIRECT" ? (
                                <div className="md:col-span-2 space-y-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            <FileText size={14} /> Link {formData.sourceType === "PRODUCTION" ? "Production Accrual (FIFO Date-wise)" : formData.sourceType}
                                        </label>
                                        {formData.sourceType === "PRODUCTION" && (
                                            <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs font-bold">
                                                <button
                                                    type="button"
                                                    onClick={() => setAccrualStageFilter("ALL")}
                                                    className={cn("px-2.5 py-1 rounded-md transition-all", accrualStageFilter === "ALL" ? "bg-amber-600 text-white shadow-sm font-black" : "text-slate-400 hover:text-white")}
                                                >
                                                    All
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAccrualStageFilter("RAW")}
                                                    className={cn("px-2.5 py-1 rounded-md transition-all", accrualStageFilter === "RAW" ? "bg-emerald-600 text-white shadow-sm font-black" : "text-slate-400 hover:text-white")}
                                                >
                                                    🧶 Raw Yarn
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAccrualStageFilter("GREY")}
                                                    className={cn("px-2.5 py-1 rounded-md transition-all", accrualStageFilter === "GREY" ? "bg-blue-600 text-white shadow-sm font-black" : "text-slate-400 hover:text-white")}
                                                >
                                                    🧵 Weaving/Knit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAccrualStageFilter("FINISH")}
                                                    className={cn("px-2.5 py-1 rounded-md transition-all", accrualStageFilter === "FINISH" ? "bg-indigo-600 text-white shadow-sm font-black" : "text-slate-400 hover:text-white")}
                                                >
                                                    🎨 Dyeing/Print
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {formData.sourceType === "PRODUCTION" ? (
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                            <div className="flex-1">
                                                <Combobox
                                                    options={sourceOptions}
                                                    value={formData.sourceId}
                                                    onChange={(val) => handleSelectSource(val)}
                                                    placeholder="Select single Pending Production Accrual..."
                                                    searchPlaceholder="Search accrual #, service, supplier, HS code..."
                                                    className="w-full bg-slate-900/50 border-slate-700 text-white"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const init: any = {};
                                                    sources.forEach(s => {
                                                        init[s.id] = { selected: false, allocatedQty: s.remainingQty, rate: s.rate };
                                                    });
                                                    setBulkAllocations(init);
                                                    setBulkModalStage(accrualStageFilter);
                                                    setIsBulkAccrualModalOpen(true);
                                                }}
                                                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
                                            >
                                                <Zap size={14} className="fill-current text-white" />
                                                <span>⚡ Bulk FIFO Allocation</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <Combobox
                                            options={sourceOptions}
                                            value={formData.sourceId}
                                            onChange={(val) => handleSelectSource(val)}
                                            placeholder={`Select ${formData.sourceType}...`}
                                            className="w-full bg-slate-900/50 border-slate-700 text-white"
                                        />
                                    )}
                                    {formData.sourceType === "PRODUCTION" && formData.items.length > 0 && (
                                        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1 pt-1">
                                            <span>Linked Accrual Items: <b className="text-white font-mono">{formData.items.length} line(s)</b> (You can add more accruals from the dropdown above)</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            <Building2 size={14} /> Supplier Account
                                        </label>
                                        <Combobox
                                            options={supplierOptions}
                                            value={formData.supplierId}
                                            onChange={(val) => setFormData({ ...formData, supplierId: val })}
                                            placeholder="Select supplier..."
                                            className="w-full bg-slate-900/50 border-slate-700 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            <Warehouse size={14} /> Target Warehouse
                                        </label>
                                        <Combobox
                                            options={warehouseOptions}
                                            value={formData.warehouseId}
                                            onChange={(val) => setFormData({ ...formData, warehouseId: val })}
                                            placeholder="Choose Warehouse..."
                                            className="w-full bg-slate-900/60 border-slate-700 text-white"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Invoice Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Due Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Receipt size={20} className="text-indigo-500" /> Billed Items
                        </h2>
                        {formData.sourceType === "DIRECT" && (
                            <button 
                                onClick={handleAddItem}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                            >
                                <Plus size={16} /> Add Product
                            </button>
                        )}
                    </div>

                    <div className="p-6 overflow-visible">
                        <div className="min-w-[800px]">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-3">Product</div>
                                <div className="col-span-2">Unit</div>
                                {formData.sourceType !== "DIRECT" && <div className="col-span-1 text-center">Available</div>}
                                <div className="col-span-2">Bill Qty</div>
                                <div className="col-span-2">Rate</div>
                                <div className="col-span-2 text-right">Total</div>
                                {formData.sourceType === "DIRECT" && <div className="col-span-1 text-center">Act</div>}
                            </div>

                            <div className="space-y-3">
                                {formData.items.map((item: any, index: number) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-indigo-200 dark:hover:border-indigo-500/30">
                                        <div className="col-span-3">
                                            {formData.sourceType === "PRODUCTION" || item.productionAccrualId ? (
                                                <div className="space-y-1">
                                                    <Combobox
                                                        options={products.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                                                        value={item.productId}
                                                        onChange={(val) => updateItem(item.id, 'productId', val)}
                                                        placeholder="Select product..."
                                                        searchPlaceholder="Search products..."
                                                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold"
                                                    />
                                                    {item.notes && (
                                                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono truncate px-1" title={item.notes}>
                                                            {item.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : formData.sourceType !== "DIRECT" ? (
                                                <div className="px-2 font-bold text-slate-800 dark:text-slate-200">
                                                    {item.productName}
                                                </div>
                                            ) : (
                                                <Combobox
                                                    options={products.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                                                    value={item.productId}
                                                    onChange={(val) => updateItem(item.id, 'productId', val)}
                                                    placeholder="Select product..."
                                                    searchPlaceholder="Search products..."
                                                    className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                />
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <Combobox
                                                options={units.map(u => ({ value: u.id, label: u.name }))}
                                                value={item.unitId || ''}
                                                onChange={(val) => updateItem(item.id, 'unitId', val)}
                                                placeholder="Select Unit..."
                                                searchPlaceholder="Search units..."
                                                className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            />
                                        </div>
                                        {formData.sourceType !== "DIRECT" && (
                                            <div className="col-span-1 text-center text-sm">
                                                <span className="font-bold text-slate-500">{item.qtyAvailable}</span>
                                            </div>
                                        )}

                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.qty || ''}
                                                onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))}
                                                placeholder="0"
                                                min="0"
                                                max={(formData.sourceType !== "DIRECT" && formData.sourceType !== "PRODUCTION") ? item.qtyAvailable : undefined}
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-right"
                                            />
                                            {item.productionAccrualId && item.qty > item.qtyAvailable && (
                                                <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 text-right mt-0.5">
                                                    +{(item.qty - item.qtyAvailable).toFixed(2)} to Stock
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.rate || ''}
                                                onChange={e => updateItem(item.id, 'rate', parseFloat(e.target.value))}
                                                placeholder="0.00"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-right"
                                            />
                                        </div>

                                        <div className="col-span-2 flex items-center justify-end px-2">
                                            <span className="font-black text-slate-800 dark:text-white">
                                                {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {formData.sourceType === "DIRECT" && (
                                            <div className="col-span-1 flex justify-center">
                                                <button 
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {formData.items.length === 0 && (
                                    <div className="text-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold">
                                        No items. Please select a source or add items.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Taxes & Charges Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible mt-6">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Receipt size={20} className="text-indigo-500" /> Taxes & Charges
                        </h2>
                        <button 
                            onClick={handleAddTax}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                        >
                            <Plus size={16} /> Add Tax
                        </button>
                    </div>

                    <div className="p-6 overflow-visible">
                        <div className="min-w-[700px]">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-3">Tax Type</div>
                                <div className="col-span-3">Calculate On</div>
                                <div className="col-span-2 text-right">Base Amount</div>
                                <div className="col-span-1 text-right">Rate %</div>
                                <div className="col-span-2 text-right">Tax Amount</div>
                                <div className="col-span-1 text-center">Act</div>
                            </div>

                            <div className="space-y-3">
                                {(formData.taxes || []).map((tax: any, index: number) => {
                                    const computed = calculateSummary().calculatedTaxes[index];
                                    return (
                                        <div key={tax.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-indigo-200 dark:hover:border-indigo-500/30">
                                            <div className="col-span-3">
                                                <Combobox
                                                    options={[
                                                        ...taxCodes.map(t => ({ value: t.id, label: t.name })),
                                                        { value: 'MANUAL', label: 'Manual Tax' }
                                                    ]}
                                                    value={tax.taxCodeId || ''}
                                                    onChange={(val) => updateTax(tax.id, 'taxCodeId', val)}
                                                    placeholder="Select Tax..."
                                                    searchPlaceholder="Search taxes..."
                                                    className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <Combobox
                                                    options={[
                                                        { value: 'NET_TOTAL', label: 'Net Total (Subtotal - Discount)' },
                                                        { value: 'PREVIOUS_TOTAL', label: 'Previous Row Total (Cascading)' }
                                                    ]}
                                                    value={tax.calculation}
                                                    onChange={(val) => updateTax(tax.id, 'calculation', val)}
                                                    placeholder="Calculate On..."
                                                    searchPlaceholder="Search options..."
                                                    className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                />
                                            </div>
                                            <div className="col-span-2 text-right font-medium text-slate-500">
                                                {computed?.baseAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                            <div className="col-span-1">
                                                <input
                                                    type="number"
                                                    value={tax.rate || ''}
                                                    onChange={e => updateTax(tax.id, 'rate', parseFloat(e.target.value))}
                                                    placeholder="0"
                                                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-right"
                                                />
                                            </div>
                                            <div className="col-span-2 text-right font-black text-slate-800 dark:text-white">
                                                {computed?.taxAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <button 
                                                    onClick={() => handleRemoveTax(tax.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {(formData.taxes || []).length === 0 && (
                                    <div className="text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold text-sm">
                                        No taxes added. Click "Add Tax" to apply document-level taxes.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Discount Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-8 mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                Invoice Discount
                            </h2>
                            <p className="text-xs text-slate-400">Apply a document-level discount to this invoice.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={formData.hasDiscount}
                                onChange={e => setFormData({...formData, hasDiscount: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {formData.hasDiscount && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Discount Amount</label>
                                <input
                                    type="number"
                                    value={formData.discountAmount || ''}
                                    onChange={e => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) })}
                                    placeholder="0.00"
                                    min="0"
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-[98%] 2xl:max-w-[1700px] mx-auto px-2 sm:px-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-6 md:gap-8 overflow-x-auto pb-2 md:pb-0">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                                {currency.symbol} {calculateSummary().subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        
                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                        
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tax Amount</span>
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                                + {currency.symbol} {calculateSummary().taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        {formData.hasDiscount && (
                            <>
                                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Discount</span>
                                    <span className="text-lg font-bold text-rose-500">
                                        - {currency.symbol} {calculateSummary().discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </>
                        )}

                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 hidden md:flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Calculator size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Grand Total</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
                                    {currency.symbol} {calculateSummary().grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={() => router.back()}
                            className="flex-1 md:flex-none px-6 py-4 rounded-2xl font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase tracking-widest text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={isSubmitting || formData.items.length === 0}
                            className={cn(
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-xl shadow-indigo-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (isSubmitting || formData.items.length === 0) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <Save size={18} />
                            {isSubmitting ? 'Saving...' : 'Create Bill'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Bulk FIFO Settle & Multi-Accrual Allocation Modal */}
            {isBulkAccrualModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
                    <div className="w-full max-w-[96vw] 2xl:max-w-[1600px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                                    <Zap size={24} className="fill-current" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        Bulk FIFO Accrual Settlement & Multi-Allocation
                                    </h3>
                                    <p className="text-xs sm:text-sm text-slate-400">
                                        Enter total vendor bill quantity to auto-distribute across oldest batches (FIFO), or selectively tick batches to clear.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBulkAccrualModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Top FIFO Auto-Allocation Control Bar */}
                        <div className="p-5 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-slate-100 dark:from-amber-950/20 dark:via-indigo-950/20 dark:to-slate-800/40 border-b border-slate-200 dark:border-slate-800 space-y-4">
                            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                                {/* Stage Filter Pills */}
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setBulkModalStage("ALL")}
                                        className={cn("px-3 py-1.5 rounded-lg transition-all", bulkModalStage === "ALL" ? "bg-amber-600 text-white shadow font-black" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                                    >
                                        All Stages
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBulkModalStage("RAW")}
                                        className={cn("px-3 py-1.5 rounded-lg transition-all", bulkModalStage === "RAW" ? "bg-emerald-600 text-white shadow font-black" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                                    >
                                        🧶 Raw Yarn
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBulkModalStage("GREY")}
                                        className={cn("px-3 py-1.5 rounded-lg transition-all", bulkModalStage === "GREY" ? "bg-blue-600 text-white shadow font-black" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                                    >
                                        🧵 Weaving/Knit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBulkModalStage("FINISH")}
                                        className={cn("px-3 py-1.5 rounded-lg transition-all", bulkModalStage === "FINISH" ? "bg-indigo-600 text-white shadow font-black" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                                    >
                                        🎨 Dyeing/Print
                                    </button>
                                </div>

                                {/* Search Bar */}
                                <div className="relative flex-1 max-w-md">
                                    <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                                    <input
                                        type="text"
                                        value={bulkModalSearch}
                                        onChange={(e) => setBulkModalSearch(e.target.value)}
                                        placeholder="Filter by product name, HS code, supplier, accrual #..."
                                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Auto-Distribute FIFO Calculator Bar */}
                            <div className="flex flex-wrap items-center gap-3 bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-amber-500/30 shadow-sm">
                                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                    <Sparkles size={16} />
                                    <span>FIFO Auto-Distribute:</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-slate-500">Bill Qty:</label>
                                    <input
                                        type="number"
                                        value={bulkTotalQty}
                                        onChange={(e) => setBulkTotalQty(e.target.value)}
                                        placeholder="e.g. 50000"
                                        className="w-32 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-slate-500">Invoice Rate (Optional):</label>
                                    <input
                                        type="number"
                                        value={bulkOverrideRate}
                                        onChange={(e) => setBulkOverrideRate(e.target.value)}
                                        placeholder="Rate override..."
                                        className="w-36 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAutoAllocateFIFO}
                                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all"
                                >
                                    <Zap size={14} className="fill-current" />
                                    <span>Auto-Allocate FIFO</span>
                                </button>
                                <span className="text-xs text-slate-400 italic hidden xl:inline">
                                    (Oldest production batches will be fulfilled first until bill quantity is exhausted)
                                </span>
                            </div>
                        </div>

                        {/* Batches Table with Checkboxes */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
                            <div className="flex items-center justify-between pb-2 text-xs font-bold text-slate-400 px-2">
                                <span>Pending Production Accruals (Sorted Strictly by Production Date FIFO):</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const allSelected: any = {};
                                            sources.forEach(s => {
                                                allSelected[s.id] = { selected: true, allocatedQty: s.remainingQty, rate: s.rate };
                                            });
                                            setBulkAllocations(allSelected);
                                        }}
                                        className="text-indigo-500 hover:underline"
                                    >
                                        Select All
                                    </button>
                                    <span>•</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const noneSelected: any = {};
                                            sources.forEach(s => {
                                                noneSelected[s.id] = { selected: false, allocatedQty: s.remainingQty, rate: s.rate };
                                            });
                                            setBulkAllocations(noneSelected);
                                        }}
                                        className="text-slate-400 hover:underline"
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            </div>

                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left text-xs sm:text-sm">
                                    <thead className="bg-slate-100 dark:bg-slate-800/80 uppercase tracking-wider text-[11px] font-black text-slate-600 dark:text-slate-300">
                                        <tr>
                                            <th className="p-3 text-center w-12">Tick</th>
                                            <th className="p-3">Accrual #</th>
                                            <th className="p-3">Prod Date</th>
                                            <th className="p-3">Stage</th>
                                            <th className="p-3">Product / Service</th>
                                            <th className="p-3">Supplier</th>
                                            <th className="p-3 text-right">Pending Qty</th>
                                            <th className="p-3 text-right">Allocated Qty</th>
                                            <th className="p-3 text-right">Bill Rate</th>
                                            <th className="p-3 text-right">Line Total</th>
                                            <th className="p-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {sources
                                            .filter(s => {
                                                if (bulkModalStage === "ALL") return true;
                                                if (bulkModalStage === "RAW") return s.stage === "RAW" || s.serviceType === "RAW_YARN";
                                                if (bulkModalStage === "GREY") return s.stage === "GREY" || s.serviceType === "WEAVING" || s.serviceType === "KNITTING";
                                                if (bulkModalStage === "FINISH") return s.stage === "FINISH" || s.serviceType === "DYEING" || s.serviceType === "PRINTING";
                                                return true;
                                            })
                                            .filter(s => {
                                                if (!bulkModalSearch) return true;
                                                const q = bulkModalSearch.toLowerCase();
                                                return (
                                                    s.accrualNo?.toLowerCase().includes(q) ||
                                                    s.productName?.toLowerCase().includes(q) ||
                                                    s.productCode?.toLowerCase().includes(q) ||
                                                    s.hsCode?.toLowerCase().includes(q) ||
                                                    s.supplierName?.toLowerCase().includes(q)
                                                );
                                            })
                                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                            .map((source) => {
                                                const alloc = bulkAllocations[source.id] || { selected: false, allocatedQty: source.remainingQty, rate: source.rate };
                                                const isSelected = alloc.selected;
                                                const allocatedQty = alloc.allocatedQty || 0;
                                                const lineRate = alloc.rate || 0;
                                                const lineTotal = allocatedQty * lineRate;
                                                const isFull = allocatedQty >= source.remainingQty;
                                                const isPartial = allocatedQty > 0 && allocatedQty < source.remainingQty;

                                                let stageBadge = "🎨 FINISH";
                                                let badgeClass = "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300";
                                                if (source.stage === "RAW" || source.serviceType === "RAW_YARN") {
                                                    stageBadge = "🧶 RAW YARN";
                                                    badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
                                                } else if (source.stage === "GREY" || source.serviceType === "WEAVING" || source.serviceType === "KNITTING") {
                                                    stageBadge = `🧵 ${source.serviceType || 'WEAVING'}`;
                                                    badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
                                                }

                                                return (
                                                    <tr 
                                                        key={source.id}
                                                        className={cn(
                                                            "transition-colors",
                                                            isSelected ? "bg-amber-50/50 dark:bg-amber-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                                        )}
                                                    >
                                                        {/* Checkbox */}
                                                        <td className="p-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    setBulkAllocations({
                                                                        ...bulkAllocations,
                                                                        [source.id]: {
                                                                            ...alloc,
                                                                            selected: e.target.checked,
                                                                            allocatedQty: alloc.allocatedQty || source.remainingQty
                                                                        }
                                                                    });
                                                                }}
                                                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                                            />
                                                        </td>
                                                        {/* Accrual # */}
                                                        <td className="p-3 font-mono font-black text-indigo-600 dark:text-indigo-400">
                                                            {source.accrualNo}
                                                        </td>
                                                        {/* Production Date */}
                                                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                            {source.date ? new Date(source.date).toLocaleDateString('en-GB') : '-'}
                                                        </td>
                                                        {/* Stage */}
                                                        <td className="p-3">
                                                            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-black uppercase", badgeClass)}>
                                                                {stageBadge}
                                                            </span>
                                                        </td>
                                                        {/* Product & HS Code */}
                                                        <td className="p-3">
                                                            <div className="font-bold text-slate-900 dark:text-white">{source.productName}</div>
                                                            <div className="text-[11px] text-slate-400 font-mono">
                                                                {source.productCode} {source.hsCode ? `• HS: ${source.hsCode}` : ''}
                                                            </div>
                                                        </td>
                                                        {/* Supplier */}
                                                        <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">
                                                            {source.supplierName || 'Unassigned'}
                                                        </td>
                                                        {/* Available Pending */}
                                                        <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                                                            {Number(source.remainingQty).toLocaleString()} <span className="text-xs font-normal text-slate-400">{source.unitCode}</span>
                                                        </td>
                                                        {/* Editable Allocated Qty */}
                                                        <td className="p-3 text-right">
                                                            <input
                                                                type="number"
                                                                disabled={!isSelected}
                                                                value={alloc.allocatedQty}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    setBulkAllocations({
                                                                        ...bulkAllocations,
                                                                        [source.id]: {
                                                                            ...alloc,
                                                                            allocatedQty: Math.min(val, source.remainingQty)
                                                                        }
                                                                    });
                                                                }}
                                                                className={cn(
                                                                    "w-28 px-2 py-1 rounded-lg border text-right font-bold text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500",
                                                                    isSelected 
                                                                        ? "bg-white dark:bg-slate-900 border-amber-500 text-amber-600 dark:text-amber-400 font-black" 
                                                                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                                                                )}
                                                            />
                                                        </td>
                                                        {/* Editable Rate */}
                                                        <td className="p-3 text-right">
                                                            <input
                                                                type="number"
                                                                disabled={!isSelected}
                                                                value={alloc.rate}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    setBulkAllocations({
                                                                        ...bulkAllocations,
                                                                        [source.id]: {
                                                                            ...alloc,
                                                                            rate: val
                                                                        }
                                                                    });
                                                                }}
                                                                className={cn(
                                                                    "w-24 px-2 py-1 rounded-lg border text-right font-medium text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500",
                                                                    isSelected 
                                                                        ? "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white" 
                                                                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                                                                )}
                                                            />
                                                        </td>
                                                        {/* Line Total */}
                                                        <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                                                            Rs. {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Allocation Status */}
                                                        <td className="p-3 text-center">
                                                            {!isSelected ? (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400 dark:bg-slate-800">
                                                                    UNSELECTED
                                                                </span>
                                                            ) : isFull ? (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                                    100% FULL
                                                                </span>
                                                            ) : isPartial ? (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                                                    PARTIAL
                                                                </span>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4 text-xs sm:text-sm">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Selected Batches</span>
                                    <p className="font-black text-slate-900 dark:text-white text-base">
                                        {Object.values(bulkAllocations).filter(v => v.selected && v.allocatedQty > 0).length} Batch(es)
                                    </p>
                                </div>
                                <div className="w-px h-8 bg-slate-300 dark:bg-slate-700"></div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Total Allocated Qty</span>
                                    <p className="font-black text-amber-600 dark:text-amber-400 text-base">
                                        {Object.values(bulkAllocations)
                                            .filter(v => v.selected)
                                            .reduce((sum, v) => sum + (Number(v.allocatedQty) || 0), 0)
                                            .toLocaleString()} Units
                                    </p>
                                </div>
                                <div className="w-px h-8 bg-slate-300 dark:bg-slate-700"></div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Total Bill Amount</span>
                                    <p className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                                        Rs. {Object.values(bulkAllocations)
                                            .filter(v => v.selected)
                                            .reduce((sum, v) => sum + ((Number(v.allocatedQty) || 0) * (Number(v.rate) || 0)), 0)
                                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsBulkAccrualModalOpen(false)}
                                    className="px-5 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const selectedEntries = Object.entries(bulkAllocations).filter(([_, alloc]) => alloc.selected && alloc.allocatedQty > 0);
                                        if (selectedEntries.length === 0) {
                                            showNotification('error', 'Please tick at least one accrual batch to settle from stock.');
                                            return;
                                        }
                                        const defaultWhId = stockSettleWarehouseId || (warehouses.length > 0 ? warehouses[0].id : "");
                                        if (!stockSettleWarehouseId && defaultWhId) {
                                            setStockSettleWarehouseId(defaultWhId);
                                        }

                                        const initialGroups = selectedEntries.map(([accrualId, alloc]) => {
                                            const s = sources.find(src => src.id === accrualId);
                                            const targetQty = alloc.allocatedQty || s?.remainingQty || 0;
                                            const matchingProdId = s?.productId || '';
                                            const matchingLots = matchingProdId ? (productStockMap[matchingProdId]?.lots || []) : [];
                                            const firstLot = matchingLots[0];

                                            const defaultDeduction = {
                                                id: Date.now().toString() + Math.random(),
                                                productId: matchingProdId,
                                                productName: s?.productName || 'Raw Material',
                                                productCode: s?.productCode || '',
                                                hsCode: s?.hsCode || '',
                                                lotNo: firstLot ? firstLot.invoiceNo : '',
                                                isEFS: firstLot ? Boolean(firstLot.isEFS || (firstLot.invoiceNo && firstLot.invoiceNo.includes('[EFS]'))) : false,
                                                qty: targetQty,
                                                rate: firstLot ? (Number(firstLot.rate) || Number(s?.rate || 0)) : (Number(alloc.rate) || Number(s?.rate || 0))
                                            };

                                            return {
                                                accrualId: s?.id || accrualId,
                                                accrualNo: s?.accrualNo || '',
                                                stage: s?.stage || 'RAW',
                                                serviceType: s?.serviceType || 'RAW_YARN',
                                                originalProductName: s?.productName || 'Raw Material',
                                                originalProductCode: s?.productCode || '',
                                                targetQty: targetQty,
                                                originalRate: s?.rate || 0,
                                                unitCode: s?.unitCode || 'KG',
                                                warehouseId: defaultWhId,
                                                deductions: [defaultDeduction]
                                            };
                                        });
                                        setStockSettleRows(initialGroups);
                                        setIsStockSettleModalOpen(true);
                                    }}
                                    className="px-6 py-3 rounded-2xl font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xl shadow-emerald-600/20 transition-all text-xs uppercase tracking-wider flex items-center gap-2"
                                >
                                    <Package size={16} />
                                    <span>Settle Selected from Stock</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyBulkAccruals}
                                    className="px-6 py-3 rounded-2xl font-black text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-xl shadow-amber-500/20 transition-all text-xs uppercase tracking-wider flex items-center gap-2"
                                >
                                    <CheckCircle2 size={16} />
                                    <span>Apply Selected Accruals to Bill</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settle from Warehouse Stock Confirmation Modal */}
            {isStockSettleModalOpen && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
                    <div className="w-full max-w-6xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        Settle Accruals Against Physical Stock
                                    </h3>
                                    <p className="text-xs sm:text-sm text-slate-400">
                                        Select and change which Yarn or Material from your warehouse stock will be deducted to clear each unbilled accrual liability.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsStockSettleModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Selected Batches</span>
                                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                        {stockSettleRows.length} Batches
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Total Required Qty</span>
                                    <p className="text-base font-black text-slate-700 dark:text-slate-300 mt-0.5">
                                        {stockSettleRows.reduce((sum, g) => sum + (Number(g.targetQty) || 0), 0).toLocaleString()} Units
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Total Allocated Qty</span>
                                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        {stockSettleRows.reduce((sum, g) => sum + (g.deductions || []).reduce((dSum: number, d: any) => dSum + (Number(d.qty) || 0), 0), 0).toLocaleString()} Units
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Total Settlement Value</span>
                                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                        Rs. {stockSettleRows.reduce((sum, g) => sum + (g.deductions || []).reduce((dSum: number, d: any) => dSum + ((Number(d.qty) || 0) * (Number(d.rate) || 0)), 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            {/* Global Form Settings */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Target Warehouse (Stock Deduction) *
                                    </label>
                                    <select
                                        value={stockSettleWarehouseId}
                                        onChange={(e) => {
                                            setStockSettleWarehouseId(e.target.value);
                                            setStockSettleRows(prev => prev.map(r => ({ ...r, warehouseId: e.target.value })));
                                        }}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="">Choose Warehouse...</option>
                                        {warehouses.map((w: any) => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Settlement Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={stockSettleDate}
                                        onChange={(e) => setStockSettleDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Settlement Remarks (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={stockSettleRemarks}
                                        onChange={(e) => setStockSettleRemarks(e.target.value)}
                                        placeholder="e.g. Settle against warehouse stock..."
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            {/* Accruals Stock Allocation Table (Grouped with Multi-Deduction Split & Live Stock) */}
                            <div className="space-y-4">
                                {stockSettleRows.map((group, gIdx) => {
                                    const isYarnStage = group.stage === "RAW" || group.serviceType === "RAW_YARN";
                                    const isWeavingStage = group.stage === "GREY" || group.serviceType === "WEAVING" || group.serviceType === "KNITTING";
                                    const allocatedQty = (group.deductions || []).reduce((acc: number, d: any) => acc + (Number(d.qty) || 0), 0);
                                    const shortfall = group.targetQty - allocatedQty;
                                    const isCovered = allocatedQty >= group.targetQty && group.targetQty > 0;
                                    const isPartial = allocatedQty > 0 && allocatedQty < group.targetQty;

                                    return (
                                        <div key={group.accrualId || gIdx} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                                            {/* Batch Header Bar */}
                                            <div className="bg-slate-100/80 dark:bg-slate-800/70 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                                                        {group.accrualNo}
                                                    </div>
                                                    <span className={cn(
                                                        "inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                                        isYarnStage ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                                                        isWeavingStage ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" :
                                                        "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                                                    )}>
                                                        {isYarnStage ? "🧶 RAW YARN" : isWeavingStage ? "🧵 WEAVING" : "🎨 DYEING"}
                                                    </span>
                                                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                        Original: <span className="text-slate-900 dark:text-white font-black">{group.originalProductName}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {/* Requirement & Allocation Coverage */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400 font-semibold">Target:</span>
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                                            {Number(group.targetQty).toLocaleString()} {group.unitCode}
                                                        </span>
                                                        <span className="text-xs text-slate-400 font-semibold">• Allocated:</span>
                                                        <span className={cn(
                                                            "text-xs font-black",
                                                            isCovered ? "text-emerald-600 dark:text-emerald-400" :
                                                            isPartial ? "text-amber-500" : "text-rose-500"
                                                        )}>
                                                            {allocatedQty.toLocaleString()} {group.unitCode}
                                                        </span>
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-black uppercase ml-1",
                                                            isCovered ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" :
                                                            isPartial ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" :
                                                            "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400"
                                                        )}>
                                                            {isCovered ? "✓ 100% Covered" : isPartial ? `⚠ Short: ${shortfall.toLocaleString()} ${group.unitCode}` : "0% Allocated"}
                                                        </span>
                                                    </div>

                                                    {/* Quick Action Buttons */}
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenLotBrowserModal(gIdx)}
                                                            className="px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center gap-1.5"
                                                        >
                                                            <Zap size={13} className="text-amber-500 fill-amber-500" />
                                                            <span>Browse Stock Lots</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddDeductionLine(gIdx)}
                                                            className="px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1.5"
                                                        >
                                                            <Plus size={13} />
                                                            <span>Add Yarn / Lot Line</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Deductions Table */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs sm:text-sm">
                                                    <thead className="bg-slate-50 dark:bg-slate-800/40 uppercase tracking-wider text-[11px] font-black text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                                        <tr>
                                                            <th className="p-3 min-w-[340px]">Physical Stock Yarn / Material</th>
                                                            <th className="p-3 min-w-[200px]">Warehouse Lot / GD Ref</th>
                                                            <th className="p-3 text-right w-28">Deduct Qty</th>
                                                            <th className="p-3 text-right w-28">Cost Rate (PKR)</th>
                                                            <th className="p-3 text-right w-32">Total Value</th>
                                                            <th className="p-3 text-center w-12">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {group.deductions.map((d: any, dIdx: number) => {
                                                            const productLots = d.productId ? (productStockMap[d.productId]?.lots || []) : [];
                                                            const isEfs = Boolean(d.isEFS || (d.lotNo && d.lotNo.includes("[EFS]")));

                                                            return (
                                                                <tr key={d.id || dIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                                    {/* Product Selector with Live Stock & HS Code */}
                                                                    <td className="p-3 align-top">
                                                                        <select
                                                                            value={d.productId || ""}
                                                                            onChange={(e) => handleUpdateDeduction(gIdx, dIdx, 'productId', e.target.value)}
                                                                            className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                                                        >
                                                                            <option value="">Select Yarn / Material from stock...</option>
                                                                            {products
                                                                                .slice()
                                                                                .sort((a, b) => {
                                                                                    if (isYarnStage) {
                                                                                        const aY = a.name.includes('YARN') || a.name.includes('DTY') || a.name.includes('FDY');
                                                                                        const bY = b.name.includes('YARN') || b.name.includes('DTY') || b.name.includes('FDY');
                                                                                        if (aY && !bY) return -1;
                                                                                        if (!aY && bY) return 1;
                                                                                    }
                                                                                    return a.name.localeCompare(b.name);
                                                                                })
                                                                                .map((p: any) => {
                                                                                    const stockInfo = productStockMap[p.id];
                                                                                    const availKg = stockInfo?.totalQty || 0;
                                                                                    const availLots = stockInfo?.lots || [];
                                                                                    const avgRate = availLots.length > 0 && availKg > 0
                                                                                        ? (availLots.reduce((acc: number, l: any) => acc + (Number(l.qty) * Number(l.rate)), 0) / availKg).toFixed(2)
                                                                                        : (p.standardCost || p.purchasePrice || 0);

                                                                                    return (
                                                                                        <option key={p.id} value={p.id}>
                                                                                            {p.name} {p.code ? `(${p.code})` : ''} • HS: {p.hsCode || 'N/A'} • [Stock Avail: {availKg.toLocaleString()} KG @ Rs. {avgRate}]
                                                                                        </option>
                                                                                    );
                                                                                })
                                                                            }
                                                                        </select>
                                                                        {d.productId && (
                                                                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                                                                <span>Stock Avail: {Number(productStockMap[d.productId]?.totalQty || 0).toLocaleString()} KG</span>
                                                                                {d.hsCode && <span className="text-slate-400 font-mono">• HS: {d.hsCode}</span>}
                                                                            </div>
                                                                        )}
                                                                    </td>

                                                                    {/* Lot Selector / EFS Reference */}
                                                                    <td className="p-3 align-top">
                                                                        {productLots.length > 0 ? (
                                                                            <select
                                                                                value={d.lotNo || ""}
                                                                                onChange={(e) => handleUpdateDeduction(gIdx, dIdx, 'lotNo', e.target.value)}
                                                                                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                                                            >
                                                                                <option value="">General Stock Lot</option>
                                                                                {productLots.map((lot: any) => {
                                                                                    const lotEfs = Boolean(lot.isEFS || (lot.invoiceNo && lot.invoiceNo.includes('[EFS]')));
                                                                                    return (
                                                                                        <option key={lot.id} value={lot.invoiceNo}>
                                                                                            {lot.invoiceNo} {lotEfs ? ' [EFS]' : ''} (Avail: {Number(lot.qty).toLocaleString()} {lot.unitName || 'KG'} @ Rs. {lot.rate})
                                                                                        </option>
                                                                                    );
                                                                                })}
                                                                            </select>
                                                                        ) : (
                                                                            <input
                                                                                type="text"
                                                                                value={d.lotNo || ""}
                                                                                onChange={(e) => handleUpdateDeduction(gIdx, dIdx, 'lotNo', e.target.value)}
                                                                                placeholder="Lot / GD ref (Optional)..."
                                                                                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                                                            />
                                                                        )}
                                                                        {isEfs && (
                                                                            <div className="mt-1.5">
                                                                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300">
                                                                                    ⚡ Import EFS Scheme Lot
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </td>

                                                                    {/* Deduct Qty */}
                                                                    <td className="p-3 align-top text-right">
                                                                        <div className="flex items-center gap-1 justify-end">
                                                                            <input
                                                                                type="number"
                                                                                value={d.qty}
                                                                                onChange={(e) => handleUpdateDeduction(gIdx, dIdx, 'qty', parseFloat(e.target.value) || 0)}
                                                                                className="w-24 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-right text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                                                            />
                                                                            <span className="text-xs font-semibold text-slate-400">{group.unitCode}</span>
                                                                        </div>
                                                                    </td>

                                                                    {/* Stock Rate */}
                                                                    <td className="p-3 align-top text-right">
                                                                        <input
                                                                            type="number"
                                                                            value={d.rate}
                                                                            onChange={(e) => handleUpdateDeduction(gIdx, dIdx, 'rate', parseFloat(e.target.value) || 0)}
                                                                            className="w-24 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-right text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                                                        />
                                                                    </td>

                                                                    {/* Line Total */}
                                                                    <td className="p-3 align-top text-right font-black text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm whitespace-nowrap">
                                                                        Rs. {(Number(d.qty || 0) * Number(d.rate || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </td>

                                                                    {/* Delete Action */}
                                                                    <td className="p-3 align-top text-center">
                                                                        <button
                                                                            type="button"
                                                                            disabled={group.deductions.length <= 1}
                                                                            onClick={() => handleRemoveDeductionLine(gIdx, dIdx)}
                                                                            className={cn(
                                                                                "p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors",
                                                                                group.deductions.length <= 1 && "opacity-30 cursor-not-allowed hover:text-slate-400 hover:bg-transparent"
                                                                            )}
                                                                            title="Remove deduction line"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Accounting & Inventory Information Note */}
                            <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                                <p className="font-bold flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="shrink-0" />
                                    <span>Automated Accounting & Inventory Flow:</span>
                                </p>
                                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                                    <li><strong>Physical Stock Ledger:</strong> Deducts stock (<code className="font-mono">StockLedger Out</code>) for the selected Yarn/Material product from warehouse.</li>
                                    <li><strong>GL Entry:</strong> Debits <code className="font-mono">Accrued Liabilities (2130)</code> to clear unbilled accruals and credits <code className="font-mono">Raw Material Inventory (1310)</code>. Any rate difference automatically balances to Variance/COGS.</li>
                                    <li><strong>Accrual Status:</strong> Marked as <code className="font-mono">BILLED / SETTLED</code>. Zero vendor payable created.</li>
                                </ul>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                            <div className="text-xs font-bold text-slate-500">
                                Total Settled Value: <span className="font-black text-emerald-600 dark:text-emerald-400">Rs. {stockSettleRows.reduce((sum, g) => sum + (g.deductions || []).reduce((dSum: number, d: any) => dSum + ((Number(d.qty) || 0) * (Number(d.rate) || 0)), 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    disabled={isStockSettling}
                                    onClick={() => setIsStockSettleModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase tracking-wider"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    disabled={isStockSettling || !stockSettleWarehouseId || stockSettleRows.some(g => (g.deductions || []).some((d: any) => !d.productId || !d.qty))}
                                    onClick={handleStockSettleConfirm}
                                    className={cn(
                                        "px-6 py-2.5 rounded-xl font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/20 transition-all text-xs uppercase tracking-wider flex items-center gap-2",
                                        (isStockSettling || !stockSettleWarehouseId || stockSettleRows.some(g => (g.deductions || []).some((d: any) => !d.productId || !d.qty))) && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {isStockSettling ? (
                                        <>
                                            <Sparkles size={16} className="animate-spin" />
                                            <span>Settling Stock...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={16} />
                                            <span>Confirm Stock Settlement</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dedicated Stock Lot Browser Modal (Matching User's Execution Lot Browser) */}
            {isLotBrowserModalOpen && activeAccrualGroupIndex !== null && (
                <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        Select Stock Lot (Invoices, GRN & Opening Stock)
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Strictly filtered to warehouse raw material lots. Click &quot;Allocate&quot; to assign lot quantity to Accrual #{stockSettleRows[activeAccrualGroupIndex]?.accrualNo}.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsLotBrowserModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Toolbar: Search & Filter Tabs */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="relative w-full sm:w-96">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    value={lotModalSearch}
                                    onChange={(e) => setLotModalSearch(e.target.value)}
                                    placeholder="Search yarn name, count, invoice, lot, HS code, GD #..."
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                                {[
                                    { id: "ALL", label: "All Lots" },
                                    { id: "LOCAL", label: "Local Stock" },
                                    { id: "IMPORT_EFS", label: "Import EFS" },
                                    { id: "IMPORT_COMMERCIAL", label: "Commercial Import" },
                                    { id: "OPENING", label: "Opening Stock" },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setLotModalFilter(tab.id as any)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap",
                                            lotModalFilter === tab.id
                                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                                : "bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Modal Lots Table */}
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead className="bg-slate-100 dark:bg-slate-800/80 uppercase tracking-wider text-[11px] font-black text-slate-500 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-700/80 z-10">
                                    <tr>
                                        <th className="p-3">Yarn Product</th>
                                        <th className="p-3">Origin / Scheme</th>
                                        <th className="p-3">Reference / Source (GD #)</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3 text-right">Available Qty</th>
                                        <th className="p-3 text-right">Rate (PKR)</th>
                                        <th className="p-3 text-right">Total Value</th>
                                        <th className="p-3 text-right w-28">Alloc Qty</th>
                                        <th className="p-3 text-center w-28">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredStockLots.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                                                No warehouse lots found matching the filter criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStockLots.map(lot => {
                                            const isEfs = Boolean(lot.isEFS || (lot.invoiceNo && lot.invoiceNo.includes("[EFS]")));
                                            const isImport = lot.origin === "IMPORT" || isEfs || (lot.invoiceNo && lot.invoiceNo.includes("[IMPORT]"));
                                            const isOpening = Boolean(lot.isOpening);
                                            const allocVal = lotModalAllocQtys[lot.id] !== undefined ? lotModalAllocQtys[lot.id] : lot.qty;

                                            return (
                                                <tr key={lot.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-900 dark:text-white">
                                                            {lot.productName}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                                            {lot.productCode} {lot.hsCode ? `• HS: ${lot.hsCode}` : ''}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={cn(
                                                            "inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                                            isEfs ? "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300" :
                                                            isOpening ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                                                            isImport ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" :
                                                            "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                                        )}>
                                                            {isEfs ? "Import EFS" : isOpening ? "Opening Stock" : isImport ? "Commercial Import" : "Local Stock"}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                                            {lot.invoiceNo}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">
                                                            {lot.supplierName}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                                                        {lot.date ? new Date(lot.date).toISOString().split('T')[0] : 'N/A'}
                                                    </td>
                                                    <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                        {Number(lot.qty).toLocaleString()} {lot.unitName || 'KG'}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                                        Rs. {Number(lot.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-3 text-right font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                        Rs. {(Number(lot.qty) * Number(lot.rate)).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <input
                                                            type="number"
                                                            value={allocVal}
                                                            max={lot.qty}
                                                            onChange={(e) => setLotModalAllocQtys(prev => ({ ...prev, [lot.id]: parseFloat(e.target.value) || 0 }))}
                                                            className="w-20 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-right text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAllocateLotToActiveGroup(lot, Number(allocVal))}
                                                            className="px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
                                                        >
                                                            Allocate
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-semibold">
                                Showing {filteredStockLots.length} lot(s)
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsLotBrowserModalOpen(false)}
                                className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase tracking-wider"
                            >
                                Done / Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
