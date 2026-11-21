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

    // Stock Settlement State (Unified Flow: Top Demands/Asks & Bottom Warehouse Stock Lots)
    const [isStockSettleModalOpen, setIsStockSettleModalOpen] = useState(false);
    const [stockSettleWarehouseId, setStockSettleWarehouseId] = useState("");
    const [stockSettleDate, setStockSettleDate] = useState(new Date().toISOString().split("T")[0]);
    const [stockSettleRemarks, setStockSettleRemarks] = useState("");
    const [isStockSettling, setIsStockSettling] = useState(false);
    const [stockSettleAsks, setStockSettleAsks] = useState<any[]>([]);
    const [stockLotAllocations, setStockLotAllocations] = useState<Record<string, { selected: boolean; allocatedQty: number; targetAccrualId: string }>>({});
    const [availableLots, setAvailableLots] = useState<any[]>([]);
    const [lotTableSearch, setLotTableSearch] = useState("");
    const [lotTableFilter, setLotTableFilter] = useState<"ALL" | "SELECTED_ONLY" | "LOCAL" | "IMPORT_EFS" | "IMPORT_COMMERCIAL" | "OPENING">("ALL");

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

    // Helper to determine if an item/lot is strictly Yarn (excluding printing, dyeing, finishing, fabrics, etc.)
    const isYarnProduct = (p: any) => {
        if (!p) return false;
        if (p.isService) return false;
        const name = (p.name || p.productName || '').toUpperCase();
        const unit = (p.Unit?.code || p.unitName || p.unitCode || '').toUpperCase();
        const stage = (p.stage || '').toUpperCase();

        // Disqualify known non-yarn categories (meters, fabrics, processing)
        if (
            name.includes('PRINTING') ||
            name.includes('DYEING') ||
            name.includes('FINISHING') ||
            name.includes('WEAVING') ||
            name.includes('STITCHING') ||
            name.includes('PACKING') ||
            name.includes('CARTON') ||
            unit === 'MTR' ||
            unit === 'METER' ||
            unit === 'METERS' ||
            unit === 'YDS' ||
            unit === 'PCS'
        ) {
            return false;
        }

        // Qualify Yarn
        if (
            name.includes('YARN') ||
            name.includes('DTY') ||
            name.includes('FDY') ||
            name.includes('MVS') ||
            name.includes('SPUN') ||
            name.includes('FILAMENT') ||
            stage === 'RAW'
        ) {
            return true;
        }

        return false;
    };

    const isYarnStageActive = useMemo(() => {
        return stockSettleAsks.some(a => 
            a.stage === "RAW" || 
            a.serviceType === "RAW_YARN" || 
            a.productName?.toUpperCase().includes("YARN")
        );
    }, [stockSettleAsks]);

    const isWeavingStageActive = useMemo(() => {
        return stockSettleAsks.some(a => 
            a.stage === "GREY" || 
            a.serviceType === "WEAVING" || 
            a.serviceType === "KNITTING"
        );
    }, [stockSettleAsks]);

    // Filtered lots for the stock lots table (strictly Yarn when settling Yarn accruals)
    const filteredStockLots = useMemo(() => {
        return availableLots
            .filter(lot => {
                // If settling a Yarn accrual, strictly show ONLY Yarn lots!
                if (isYarnStageActive) {
                    return isYarnProduct(lot);
                }
                // If settling a Weaving/Grey accrual, strictly show fabric/grey lots
                if (isWeavingStageActive) {
                    const name = (lot.productName || '').toUpperCase();
                    const stage = (lot.stage || '').toUpperCase();
                    return stage === 'GREY' || name.includes('FABRIC') || name.includes('GREY');
                }
                return true;
            })
            .filter(lot => {
                if (lotTableFilter === "ALL") return true;
                if (lotTableFilter === "SELECTED_ONLY") {
                    return Boolean(stockLotAllocations[lot.id]?.selected && Number(stockLotAllocations[lot.id]?.allocatedQty) > 0);
                }
                const isEfs = Boolean(lot.isEFS || (lot.invoiceNo && lot.invoiceNo.includes("[EFS]")));
                const isImport = lot.origin === "IMPORT" || isEfs || (lot.invoiceNo && lot.invoiceNo.includes("[IMPORT]"));
                if (lotTableFilter === "LOCAL") return !isImport;
                if (lotTableFilter === "IMPORT_EFS") return isEfs;
                if (lotTableFilter === "IMPORT_COMMERCIAL") return isImport && !isEfs;
                if (lotTableFilter === "OPENING") return Boolean(lot.isOpening);
                return true;
            })
            .filter(lot => {
                if (!lotTableSearch) return true;
                const q = lotTableSearch.toLowerCase();
                return (
                    lot.productName?.toLowerCase().includes(q) ||
                    lot.productCode?.toLowerCase().includes(q) ||
                    lot.hsCode?.toLowerCase().includes(q) ||
                    lot.invoiceNo?.toLowerCase().includes(q) ||
                    lot.supplierName?.toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                const aSel = Boolean(stockLotAllocations[a.id]?.selected);
                const bSel = Boolean(stockLotAllocations[b.id]?.selected);
                if (aSel && !bSel) return -1;
                if (!aSel && bSel) return 1;
                return b.qty - a.qty;
            });
    }, [availableLots, lotTableFilter, lotTableSearch, isYarnStageActive, isWeavingStageActive, stockLotAllocations]);

    // Live accrual ask coverage calculation
    const accrualCoverage = useMemo(() => {
        const coverage: Record<string, { allocatedQty: number; lots: any[] }> = {};
        stockSettleAsks.forEach(a => {
            coverage[a.accrualId] = { allocatedQty: 0, lots: [] };
        });

        const autoLots: any[] = [];
        availableLots.forEach(lot => {
            const alloc = stockLotAllocations[lot.id];
            if (alloc?.selected && Number(alloc.allocatedQty) > 0) {
                const allocQty = Number(alloc.allocatedQty);
                if (alloc.targetAccrualId && alloc.targetAccrualId !== 'AUTO') {
                    if (coverage[alloc.targetAccrualId]) {
                        coverage[alloc.targetAccrualId].allocatedQty += allocQty;
                        coverage[alloc.targetAccrualId].lots.push({ lot, qty: allocQty });
                    }
                } else {
                    autoLots.push({ lot, qty: allocQty });
                }
            }
        });

        // Distribute AUTO lots FIFO across remaining asks
        for (const item of autoLots) {
            let remainingLotQty = item.qty;
            for (const ask of stockSettleAsks) {
                if (remainingLotQty <= 0.001) break;
                const currentAlloc = coverage[ask.accrualId]?.allocatedQty || 0;
                const need = Math.max(0, ask.requiredQty - currentAlloc);
                if (need > 0) {
                    const take = Math.min(need, remainingLotQty);
                    coverage[ask.accrualId].allocatedQty += take;
                    coverage[ask.accrualId].lots.push({ lot: item.lot, qty: take });
                    remainingLotQty -= take;
                }
            }
            if (remainingLotQty > 0.001 && stockSettleAsks.length > 0) {
                const lastAsk = stockSettleAsks[stockSettleAsks.length - 1];
                coverage[lastAsk.accrualId].allocatedQty += remainingLotQty;
                coverage[lastAsk.accrualId].lots.push({ lot: item.lot, qty: remainingLotQty });
            }
        }

        return coverage;
    }, [stockSettleAsks, stockLotAllocations, availableLots]);

    const totalDemandedQty = useMemo(() => {
        return stockSettleAsks.reduce((sum, a) => sum + (Number(a.requiredQty) || 0), 0);
    }, [stockSettleAsks]);

    const totalStockAllocatedQty = useMemo(() => {
        return Object.values(stockLotAllocations)
            .filter(v => v.selected && Number(v.allocatedQty) > 0)
            .reduce((sum, v) => sum + Number(v.allocatedQty), 0);
    }, [stockLotAllocations]);

    const totalStockAllocatedValue = useMemo(() => {
        return availableLots
            .filter(lot => stockLotAllocations[lot.id]?.selected && Number(stockLotAllocations[lot.id]?.allocatedQty) > 0)
            .reduce((sum, lot) => sum + (Number(stockLotAllocations[lot.id]?.allocatedQty || 0) * Number(lot.rate || 0)), 0);
    }, [availableLots, stockLotAllocations]);

    const totalShortfall = Math.max(0, totalDemandedQty - totalStockAllocatedQty);
    const isOverallCovered = totalStockAllocatedQty >= totalDemandedQty && totalDemandedQty > 0;

    // Helpers to manage stock lot selection & allocation
    const handleToggleLot = (lot: any) => {
        setStockLotAllocations(prev => {
            const current = prev[lot.id];
            const isSelected = !current?.selected;
            if (!isSelected) {
                return { ...prev, [lot.id]: { selected: false, allocatedQty: 0, targetAccrualId: 'AUTO' } };
            }
            // Calculate how much ask is still remaining to allocate
            const totalDemanded = stockSettleAsks.reduce((sum, a) => sum + (Number(a.requiredQty) || 0), 0);
            const alreadyAllocated = Object.entries(prev)
                .filter(([k, v]) => v.selected && k !== lot.id)
                .reduce((sum, [_, v]) => sum + (Number(v.allocatedQty) || 0), 0);
            const remainingAsk = Math.max(0, totalDemanded - alreadyAllocated);
            const allocQty = remainingAsk > 0 ? Math.min(Number(lot.qty || 0), remainingAsk) : Number(lot.qty || 0);

            return {
                ...prev,
                [lot.id]: {
                    selected: true,
                    allocatedQty: Math.round(allocQty * 100) / 100,
                    targetAccrualId: current?.targetAccrualId || 'AUTO'
                }
            };
        });
    };

    const handleLotQtyChange = (lot: any, val: number) => {
        const capped = Math.min(Math.max(0, val), Number(lot.qty || 0));
        setStockLotAllocations(prev => ({
            ...prev,
            [lot.id]: {
                selected: capped > 0,
                allocatedQty: capped,
                targetAccrualId: prev[lot.id]?.targetAccrualId || 'AUTO'
            }
        }));
    };

    const handleLotTargetChange = (lotId: string, targetAccrualId: string) => {
        setStockLotAllocations(prev => ({
            ...prev,
            [lotId]: {
                ...(prev[lotId] || { selected: true, allocatedQty: 0 }),
                targetAccrualId
            }
        }));
    };

    const handleAutoAllocateStockFIFO = () => {
        const totalDemanded = stockSettleAsks.reduce((sum, a) => sum + (Number(a.requiredQty) || 0), 0);
        let needed = totalDemanded;
        const newAlloc: Record<string, { selected: boolean; allocatedQty: number; targetAccrualId: string }> = {};

        for (const lot of filteredStockLots) {
            if (needed <= 0.001) break;
            const avail = Number(lot.qty || 0);
            if (avail <= 0) continue;

            const toTake = Math.min(avail, needed);
            newAlloc[lot.id] = {
                selected: true,
                allocatedQty: Math.round(toTake * 100) / 100,
                targetAccrualId: 'AUTO'
            };
            needed -= toTake;
        }

        setStockLotAllocations(newAlloc);
        showNotification('success', `Auto-allocated stock across ${stockSettleAsks.length} accrual ask(s).`);
    };

    const handleStockSettleConfirm = async () => {
        if (stockSettleAsks.length === 0) {
            showNotification('error', 'No accrual asks selected.');
            return;
        }
        const targetWh = stockSettleWarehouseId || (warehouses.length > 0 ? warehouses[0].id : "");
        if (!targetWh) {
            showNotification('error', 'Please select a target warehouse.');
            return;
        }

        const flatItems: any[] = [];
        for (const ask of stockSettleAsks) {
            const cov = accrualCoverage[ask.accrualId];
            if (cov && cov.lots.length > 0) {
                for (const lItem of cov.lots) {
                    flatItems.push({
                        accrualId: ask.accrualId,
                        productId: lItem.lot.productId,
                        qty: Number(lItem.qty),
                        rate: Number(lItem.lot.rate || ask.rate || 0),
                        lotNo: lItem.lot.invoiceNo,
                        warehouseId: targetWh
                    });
                }
            }
        }

        if (flatItems.length === 0) {
            showNotification('error', 'Please tick and allocate at least one warehouse stock lot.');
            return;
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
                showNotification('success', data.message || `Successfully settled ${stockSettleAsks.length} batch(es) against physical warehouse stock.`);
                setIsStockSettleModalOpen(false);
                setIsBulkAccrualModalOpen(false);
                setBulkAllocations({});
                setStockSettleAsks([]);
                setStockLotAllocations({});
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

                                        const asks = selectedEntries.map(([accrualId, alloc]) => {
                                            const s = sources.find(src => src.id === accrualId);
                                            return {
                                                accrualId: s?.id || accrualId,
                                                accrualNo: s?.accrualNo || '',
                                                stage: s?.stage || 'RAW',
                                                serviceType: s?.serviceType || 'RAW_YARN',
                                                productName: s?.productName || 'Raw Material',
                                                productCode: s?.productCode || '',
                                                hsCode: s?.hsCode || '',
                                                requiredQty: Number(alloc.allocatedQty || s?.remainingQty || 0),
                                                rate: Number(s?.rate || alloc.rate || 0),
                                                unitCode: s?.unitCode || 'KG'
                                            };
                                        });

                                        setStockSettleAsks(asks);
                                        setStockLotAllocations({});
                                        setLotTableSearch("");
                                        setLotTableFilter("ALL");
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

            {/* Unified Settle Accruals Against Physical Warehouse Stock Modal */}
            {isStockSettleModalOpen && (
                <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-[1650px] w-[98vw] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                        {/* Modal Header */}
                        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        Settle Accruals Against Physical Warehouse Stock
                                    </h3>
                                    <p className="text-xs sm:text-sm text-slate-400">
                                        Review selected production accrual demands (asks) and tick warehouse stock lots below to fulfill and deduct them.
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
                        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
                            {/* 1. Global KPI Metrics Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Selected Accruals</span>
                                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                        {stockSettleAsks.length} Batches
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Total Demanded (Ask)</span>
                                    <p className="text-base font-black text-slate-800 dark:text-slate-200 mt-0.5">
                                        {totalDemandedQty.toLocaleString()} Units
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Total Stock Allocated</span>
                                    <p className={cn("text-base font-black mt-0.5", isOverallCovered ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500")}>
                                        {totalStockAllocatedQty.toLocaleString()} Units
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Remaining Shortfall</span>
                                    <p className={cn("text-base font-black mt-0.5", totalShortfall === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
                                        {totalShortfall === 0 ? "0.00 (Fully Covered ✓)" : `${totalShortfall.toLocaleString()} Units`}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Total Settlement Value</span>
                                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                        Rs. {totalStockAllocatedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            {/* 2. Top Section: Selected Production Accrual Demands ("Asks") */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                                <div className="bg-slate-100/90 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                            📋 Step 1: Production Accrual Demands (Asks to Clear)
                                        </span>
                                        <span className="text-xs text-slate-400 font-semibold">
                                            ({stockSettleAsks.length} batches selected)
                                        </span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-500">
                                        Coverage: <span className={cn("font-black", isOverallCovered ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500")}>
                                            {totalDemandedQty > 0 ? Math.min(100, Math.round((totalStockAllocatedQty / totalDemandedQty) * 100)) : 0}% Covered
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {stockSettleAsks.map(ask => {
                                        const cov = accrualCoverage[ask.accrualId] || { allocatedQty: 0, lots: [] };
                                        const allocated = cov.allocatedQty;
                                        const isAskCovered = allocated >= ask.requiredQty && ask.requiredQty > 0;
                                        const isPartial = allocated > 0 && allocated < ask.requiredQty;
                                        const shortfall = Math.max(0, ask.requiredQty - allocated);
                                        const percent = ask.requiredQty > 0 ? Math.min(100, Math.round((allocated / ask.requiredQty) * 100)) : 0;

                                        return (
                                            <div key={ask.accrualId} className={cn(
                                                "p-3.5 rounded-xl border transition-all",
                                                isAskCovered 
                                                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800" 
                                                    : isPartial
                                                    ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                                                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60"
                                            )}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                                                            {ask.accrualNo}
                                                        </span>
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase",
                                                            ask.stage === "RAW" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-blue-100 text-blue-800"
                                                        )}>
                                                            {ask.stage === "RAW" ? "🧶 RAW YARN" : ask.stage}
                                                        </span>
                                                    </div>
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                                        isAskCovered 
                                                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" 
                                                            : isPartial 
                                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" 
                                                            : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                                    )}>
                                                        {isAskCovered ? "✓ 100% Covered" : isPartial ? `⚠ Short: ${shortfall.toLocaleString()} ${ask.unitCode}` : "0% Covered"}
                                                    </span>
                                                </div>

                                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1 mb-2">
                                                    {ask.productName}
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                                                        <span>Ask: <strong className="text-slate-800 dark:text-slate-200">{Number(ask.requiredQty).toLocaleString()} {ask.unitCode}</strong></span>
                                                        <span>Covered: <strong className={isAskCovered ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}>{allocated.toLocaleString()} {ask.unitCode}</strong></span>
                                                    </div>
                                                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div 
                                                            className={cn("h-full transition-all duration-300", isAskCovered ? "bg-emerald-500" : isPartial ? "bg-amber-500" : "bg-slate-400")}
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Assigned Lots Pill */}
                                                {cov.lots.length > 0 && (
                                                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap gap-1">
                                                        {cov.lots.map((lItem: any, idx: number) => (
                                                            <span key={idx} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                {lItem.lot.invoiceNo}: <strong>{lItem.qty.toLocaleString()} {ask.unitCode}</strong>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Global Form Settings & Auto Actions */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Target Warehouse (Stock Deduction) *
                                    </label>
                                    <select
                                        value={stockSettleWarehouseId}
                                        onChange={(e) => setStockSettleWarehouseId(e.target.value)}
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

                                <div className="flex flex-col justify-end">
                                    <button
                                        type="button"
                                        onClick={handleAutoAllocateStockFIFO}
                                        className="w-full py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Zap size={15} className="text-amber-300 fill-amber-300" />
                                        <span>Auto-Allocate FIFO from Stock</span>
                                    </button>
                                </div>
                            </div>

                            {/* 4. Bottom Section: Warehouse Physical Stock Lots (Select & Cover Ask) */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                                {/* Toolbar: Search, Filters, Count */}
                                <div className="bg-slate-100/90 dark:bg-slate-800/80 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                            📦 Step 2: Warehouse Physical Stock Lots (Tick to Allocate)
                                        </span>
                                        <span className="text-xs text-slate-400 font-semibold">
                                            {isYarnStageActive && "(Strictly Raw Yarn)"}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* Search */}
                                        <div className="relative w-full sm:w-72">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                type="text"
                                                value={lotTableSearch}
                                                onChange={(e) => setLotTableSearch(e.target.value)}
                                                placeholder="Search yarn, lot, HS, GD #..."
                                                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>

                                        {/* Tabs */}
                                        <div className="flex items-center gap-1 overflow-x-auto">
                                            {[
                                                { id: "ALL", label: `All Lots (${filteredStockLots.length})` },
                                                { id: "SELECTED_ONLY", label: `Selected Only (${Object.values(stockLotAllocations).filter(v => v.selected && v.allocatedQty > 0).length})` },
                                                { id: "IMPORT_EFS", label: "Import EFS" },
                                                { id: "IMPORT_COMMERCIAL", label: "Commercial Import" },
                                                { id: "LOCAL", label: "Local Stock" },
                                                { id: "OPENING", label: "Opening Stock" },
                                            ].map(tab => (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    onClick={() => setLotTableFilter(tab.id as any)}
                                                    className={cn(
                                                        "px-2.5 py-1.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all whitespace-nowrap",
                                                        lotTableFilter === tab.id
                                                            ? "bg-emerald-600 text-white shadow-sm"
                                                            : "bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700"
                                                    )}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Stock Lots Table */}
                                <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                                    <table className="w-full text-left text-xs sm:text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider text-[11px] font-black text-slate-500 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-700 z-10">
                                            <tr>
                                                <th className="p-3 w-12 text-center">Select</th>
                                                <th className="p-3 min-w-[280px]">Yarn Product</th>
                                                <th className="p-3 min-w-[140px]">Origin / Scheme</th>
                                                <th className="p-3 min-w-[200px]">Reference / GD #</th>
                                                <th className="p-3 text-right min-w-[120px]">Available Qty</th>
                                                <th className="p-3 text-right min-w-[110px]">Rate (PKR)</th>
                                                <th className="p-3 text-right min-w-[140px]">Allocated Qty</th>
                                                <th className="p-3 min-w-[180px]">Apply To Accrual</th>
                                                <th className="p-3 text-right min-w-[110px]">Remaining in Lot</th>
                                                <th className="p-3 text-right min-w-[120px]">Line Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredStockLots.length === 0 ? (
                                                <tr>
                                                    <td colSpan={10} className="p-8 text-center text-slate-400 font-semibold">
                                                        No warehouse lots found matching the filter criteria.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredStockLots.map(lot => {
                                                    const alloc = stockLotAllocations[lot.id] || { selected: false, allocatedQty: 0, targetAccrualId: 'AUTO' };
                                                    const isSelected = Boolean(alloc.selected && Number(alloc.allocatedQty) > 0);
                                                    const allocatedVal = Number(alloc.allocatedQty || 0);
                                                    const lotAvail = Number(lot.qty || 0);
                                                    const remainingInLot = Math.max(0, lotAvail - allocatedVal);
                                                    const isLotExhausted = remainingInLot <= 0.001 && isSelected;

                                                    const isEfs = Boolean(lot.isEFS || (lot.invoiceNo && lot.invoiceNo.includes("[EFS]")));
                                                    const isImport = lot.origin === "IMPORT" || isEfs || (lot.invoiceNo && lot.invoiceNo.includes("[IMPORT]"));
                                                    const isOpening = Boolean(lot.isOpening);

                                                    return (
                                                        <tr key={lot.id} className={cn(
                                                            "transition-colors",
                                                            isSelected 
                                                                ? "bg-emerald-50/60 dark:bg-emerald-950/20 font-semibold" 
                                                                : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                                                        )}>
                                                            {/* Checkbox */}
                                                            <td className="p-3 text-center align-middle">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={alloc.selected}
                                                                    onChange={() => handleToggleLot(lot)}
                                                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                                />
                                                            </td>

                                                            {/* Yarn Product Info */}
                                                            <td className="p-3 align-middle">
                                                                <div className="font-bold text-slate-900 dark:text-white">
                                                                    {lot.productName}
                                                                </div>
                                                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                                                    {lot.productCode} {lot.hsCode ? `• HS: ${lot.hsCode}` : ''}
                                                                </div>
                                                            </td>

                                                            {/* Scheme / Origin */}
                                                            <td className="p-3 align-middle">
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

                                                            {/* Reference / GD # */}
                                                            <td className="p-3 align-middle">
                                                                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                                    {lot.invoiceNo}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    {lot.supplierName}
                                                                </div>
                                                            </td>

                                                            {/* Available Qty */}
                                                            <td className="p-3 text-right align-middle font-black text-slate-900 dark:text-white whitespace-nowrap">
                                                                {lotAvail.toLocaleString()} {lot.unitName || 'KG'}
                                                            </td>

                                                            {/* Cost Rate */}
                                                            <td className="p-3 text-right align-middle font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                                Rs. {Number(lot.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>

                                                            {/* Allocated Qty Input */}
                                                            <td className="p-3 text-right align-middle">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <input
                                                                        type="number"
                                                                        disabled={!alloc.selected}
                                                                        value={alloc.selected ? allocatedVal : ""}
                                                                        placeholder={alloc.selected ? "0" : "-"}
                                                                        max={lotAvail}
                                                                        min={0}
                                                                        onChange={(e) => handleLotQtyChange(lot, parseFloat(e.target.value) || 0)}
                                                                        className={cn(
                                                                            "w-24 p-1.5 rounded-lg border font-black text-right text-xs outline-none transition-all",
                                                                            alloc.selected
                                                                                ? "border-emerald-500 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
                                                                                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-400 cursor-not-allowed"
                                                                        )}
                                                                    />
                                                                    <span className="text-xs font-semibold text-slate-400">{lot.unitName || 'KG'}</span>
                                                                </div>
                                                            </td>

                                                            {/* Target Accrual Dropdown */}
                                                            <td className="p-3 align-middle">
                                                                <select
                                                                    disabled={!alloc.selected}
                                                                    value={alloc.targetAccrualId || 'AUTO'}
                                                                    onChange={(e) => handleLotTargetChange(lot.id, e.target.value)}
                                                                    className={cn(
                                                                        "w-full p-1.5 rounded-lg border font-semibold text-xs outline-none transition-all",
                                                                        alloc.selected
                                                                            ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
                                                                            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-400 cursor-not-allowed"
                                                                    )}
                                                                >
                                                                    <option value="AUTO">⚡ Auto (FIFO Across Asks)</option>
                                                                    {stockSettleAsks.map(a => (
                                                                        <option key={a.accrualId} value={a.accrualId}>
                                                                            Only {a.accrualNo} ({a.requiredQty.toLocaleString()} {a.unitCode})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* Remaining in Lot */}
                                                            <td className="p-3 text-right align-middle whitespace-nowrap">
                                                                {isLotExhausted ? (
                                                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                                                        Fully Allocated
                                                                    </span>
                                                                ) : (
                                                                    <span className={cn("text-xs font-bold", isSelected ? "text-slate-500" : "text-slate-400")}>
                                                                        {remainingInLot.toLocaleString()} {lot.unitName || 'KG'}
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Line Total */}
                                                            <td className="p-3 text-right align-middle font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                                {isSelected ? `Rs. ${(allocatedVal * Number(lot.rate)).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Accounting & Inventory Information Note */}
                            <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                                <p className="font-bold flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="shrink-0" />
                                    <span>Automated Accounting & Inventory Flow:</span>
                                </p>
                                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                                    <li><strong>Physical Stock Ledger:</strong> Deducts physical stock (<code className="font-mono">StockLedger Out</code>) for each selected warehouse lot.</li>
                                    <li><strong>GL Entry:</strong> Debits <code className="font-mono">Accrued Liabilities (2130)</code> to clear unbilled accrual demands and credits <code className="font-mono">Raw Material Inventory (1310)</code>. Any rate variance balances automatically to COGS.</li>
                                    <li><strong>Accrual Status:</strong> Selected production accruals are marked as <code className="font-mono">BILLED / SETTLED</code>. Zero vendor payable created.</li>
                                </ul>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                                <div>
                                    Demanded: <strong className="text-slate-800 dark:text-slate-200">{totalDemandedQty.toLocaleString()} Units</strong>
                                </div>
                                <div>
                                    Allocated: <strong className={isOverallCovered ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}>{totalStockAllocatedQty.toLocaleString()} Units</strong>
                                </div>
                                <div>
                                    Total Value: <strong className="text-emerald-600 dark:text-emerald-400">Rs. {totalStockAllocatedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    disabled={isStockSettling}
                                    onClick={() => setIsStockSettleModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isStockSettling || !stockSettleWarehouseId || totalStockAllocatedQty <= 0}
                                    onClick={handleStockSettleConfirm}
                                    className={cn(
                                        "px-6 py-2.5 rounded-xl font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/20 transition-all text-xs uppercase tracking-wider flex items-center gap-2",
                                        (isStockSettling || !stockSettleWarehouseId || totalStockAllocatedQty <= 0) && "opacity-50 cursor-not-allowed"
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
                                            <span>Confirm Stock Settlement ({totalStockAllocatedQty.toLocaleString()} Units)</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
