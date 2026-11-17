"use client";

import React, { useState, useEffect, useMemo } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import {
    Loader2, Save, Layers, Package, Factory, Scissors, CheckCircle2,
    Calculator, Droplets, Box, AlertTriangle, ArrowRight, Plus, Trash2,
    Calendar, Warehouse, FileText, Check, ShieldCheck, ShoppingCart, RefreshCw,
    Printer, Info, Sparkles, Search, X, Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import Combobox from "@/components/Combobox";

type ExecutionMode = "DIRECT_FINISH" | "YARN_TO_GREY" | "GREY_TO_FINISH";
type FabricProcessType = "WEAVING" | "KNITTING";

export interface ProcessingServiceItem {
    id: string;
    serviceId: string;
    mode: "VENDOR_BILL" | "MANUAL";
    manualName: string;
    wastage: number;
    qty: string;
    rate: string;
    unit: string;
}

export default function ProductionExecutionWizard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Meta data
    const [products, setProducts] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [unconsumedServices, setUnconsumedServices] = useState<any[]>([]);
    const [stockRates, setStockRates] = useState<Record<string, { qty: number, rate: number, isEFS: boolean }>>({});
    const [availableLots, setAvailableLots] = useState<any[]>([]);

    // Modal state for Yarn Lot Selection Table
    const [isYarnModalOpen, setIsYarnModalOpen] = useState(false);
    const [activeYarnRowIndex, setActiveYarnRowIndex] = useState<number | null>(null);
    const [yarnModalSearch, setYarnModalSearch] = useState("");
    const [yarnModalFilter, setYarnModalFilter] = useState<"ALL" | "LOCAL" | "IMPORT_EFS" | "IMPORT_COMMERCIAL" | "OPENING">("ALL");

    // Modal state for Service Bill Selection Table (Weaving, Knitting, Dyeing, Printing)
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [serviceModalTarget, setServiceModalTarget] = useState<"WEAVING_KNITTING" | "PROCESSING">("WEAVING_KNITTING");
    const [activeProcessingRowIndex, setActiveProcessingRowIndex] = useState<number | null>(null);
    const [serviceModalSearch, setServiceModalSearch] = useState("");
    const [serviceModalTypeFilter, setServiceModalTypeFilter] = useState<"ALL" | "DYEING" | "PRINTING" | "WEAVING" | "KNITTING" | "OTHER">("ALL");

    // 1. Target Production Mode (Full Flexibility)
    const [executionMode, setExecutionMode] = useState<ExecutionMode>("DIRECT_FINISH");
    
    // 2. Output Details & Multi-UOM
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [outputProductId, setOutputProductId] = useState("");
    const [outputUnitCode, setOutputUnitCode] = useState<string>("PCS");
    const [outputQuantity, setOutputQuantity] = useState<string>("331490");
    const [outputNetWeightKg, setOutputNetWeightKg] = useState<string>("61004");
    const [weightPerUnit, setWeightPerUnit] = useState<string>("0.18403");
    const [balesCount, setBalesCount] = useState<string>("881");
    const [warehouseId, setWarehouseId] = useState("");
    const [lotNumber, setLotNumber] = useState("EXPORT-LOT-5336");

    // 3. Stage 1: Wet Processing / Finishing Services (Excludes Weaving & Knitting)
    const [processingServices, setProcessingServices] = useState<ProcessingServiceItem[]>([
        {
            id: "1",
            serviceId: "",
            mode: "VENDOR_BILL",
            manualName: "Processing / Dyeing Service",
            wastage: 0,
            qty: "61004",
            rate: "",
            unit: "KG"
        }
    ]);

    const handleAddProcessingService = () => {
        setProcessingServices(prev => [
            ...prev,
            {
                id: String(Date.now()),
                serviceId: "",
                mode: "VENDOR_BILL",
                manualName: "Additional Processing Service",
                wastage: 0,
                qty: effectiveNetWeightKg ? effectiveNetWeightKg.toString() : "",
                rate: "",
                unit: "KG"
            }
        ]);
    };

    const handleRemoveProcessingService = (id: string) => {
        setProcessingServices(prev => prev.filter(p => p.id !== id));
    };

    const handleProcessingServiceChange = (id: string, field: keyof ProcessingServiceItem, value: any) => {
        setProcessingServices(prev => prev.map(p => {
            if (p.id !== id) return p;
            const updated = { ...p, [field]: value };
            if (field === "serviceId") {
                const svc = unconsumedServices.find(s => s.id === value);
                if (svc) {
                    updated.rate = svc.rate.toString();
                    updated.unit = svc.unit || "KG";
                    if (svc.unit === "MTR" && outputUnitCode === "MTR") {
                        updated.qty = outputQuantity;
                    } else if (!p.qty || p.qty === "0") {
                        updated.qty = effectiveNetWeightKg.toString();
                    }
                }
            }
            return updated;
        }));
    };

    // 4. Stage 2: Fabric Manufacturing (Weaving vs Knitting)
    const [fabricProcessType, setFabricProcessType] = useState<FabricProcessType>("WEAVING");
    const [weavingWastage, setWeavingWastage] = useState<number>(4.0);
    const [weavingMode, setWeavingMode] = useState<"IN_HOUSE" | "OUT_HOUSE">("IN_HOUSE");
    const [inHouseWeavingRate, setInHouseWeavingRate] = useState<string>("10");
    const [outHouseFabricMode, setOutHouseFabricMode] = useState<"VENDOR_BILL" | "MANUAL">("VENDOR_BILL");
    const [selectedWeavingServiceId, setSelectedWeavingServiceId] = useState<string>("");
    const [weavingServiceQty, setWeavingServiceQty] = useState<string>("");
    const [outHouseFabricManualRate, setOutHouseFabricManualRate] = useState<string>("25");

    // 5. Stage 3: Yarn Consumption
    const [yarnWastage, setYarnWastage] = useState<number>(4.0);
    const [yarnInputs, setYarnInputs] = useState<Array<{
        productId: string;
        isEFS: boolean;
        quantity: string;
        costRate: string;
        lotNumber: string;
        purchaseInvoiceItemId?: string;
    }>>([
        { productId: "", isEFS: false, quantity: "", costRate: "", lotNumber: "" }
    ]);

    // 6. For GREY_TO_FINISH: Grey Fabric Input
    const [greyInputProductId, setGreyInputProductId] = useState<string>("");
    const [greyInputQty, setGreyInputQty] = useState<string>("");
    const [greyInputIsEFS, setGreyInputIsEFS] = useState<boolean>(false);
    const [greyInputCostRate, setGreyInputCostRate] = useState<string>("");

    useEffect(() => {
        fetchMeta();
    }, []);

    const fetchMeta = async () => {
        try {
            const res = await authenticatedFetch(`/api/finance/production/execution/meta?t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (json.success) {
                setProducts(json.data.products);
                setWarehouses(json.data.warehouses);
                setUnits(json.data.units);
                setUnconsumedServices(json.data.unconsumedServices);
                setStockRates(json.data.stockRates);
                if (json.data.availableLots) setAvailableLots(json.data.availableLots);
                if (json.data.warehouses.length > 0) setWarehouseId(json.data.warehouses[0].id);
            }
        } catch (error) {
            alert("Failed to fetch meta data");
        } finally {
            setLoading(false);
        }
    };

    // Filter products strictly to Manufactured products for Output
    const outputProductList = useMemo(() => {
        const mfgProducts = products.filter(p => p.isManufactured === true);
        if (executionMode === "YARN_TO_GREY") {
            const grey = mfgProducts.filter(p => p.stage === "GREY" || p.name.toUpperCase().includes("GREY"));
            return grey.length > 0 ? grey : mfgProducts;
        } else {
            const finish = mfgProducts.filter(p => p.stage === "FINISH" || p.stage === null || !p.name.toUpperCase().includes("GREY"));
            return finish.length > 0 ? finish : mfgProducts;
        }
    }, [products, executionMode]);

    const outputOptions = useMemo(() => {
        return outputProductList.map(p => ({
            value: p.id,
            label: `${p.code} - ${p.name} ${p.hsCode ? `[HS ${p.hsCode}]` : ''} ${p.stage ? `(${p.stage})` : ''}`
        }));
    }, [outputProductList]);

    // Auto-select product unit when output product changes
    useEffect(() => {
        if (!outputProductId) return;
        const p = products.find(it => it.id === outputProductId);
        if (p?.baseUnit?.code) {
            setOutputUnitCode(p.baseUnit.code.toUpperCase());
        }
    }, [outputProductId, products]);

    // Multi-UOM & Finished Weight Bi-Directional Synchronization
    const handleOutputQtyChange = (val: string) => {
        setOutputQuantity(val);
        const qtyNum = parseFloat(val) || 0;
        if (outputUnitCode === "KG") {
            setOutputNetWeightKg(val);
        } else {
            const rateNum = parseFloat(weightPerUnit) || 0;
            if (rateNum > 0 && qtyNum > 0) {
                setOutputNetWeightKg((Math.round(qtyNum * rateNum * 100) / 100).toString());
            }
        }
    };

    const handleWeightPerUnitChange = (val: string) => {
        setWeightPerUnit(val);
        const rateNum = parseFloat(val) || 0;
        const qtyNum = parseFloat(outputQuantity) || 0;
        if (qtyNum > 0 && rateNum > 0) {
            setOutputNetWeightKg((Math.round(qtyNum * rateNum * 100) / 100).toString());
        }
    };

    const handleNetWeightChange = (val: string) => {
        setOutputNetWeightKg(val);
        const wtNum = parseFloat(val) || 0;
        const qtyNum = parseFloat(outputQuantity) || 0;
        if (outputUnitCode === "KG") {
            setOutputQuantity(val);
        } else if (qtyNum > 0 && wtNum > 0) {
            setWeightPerUnit((wtNum / qtyNum).toFixed(5));
        }
    };

    // Effective Finished Fabric Weight in KG
    const effectiveNetWeightKg = useMemo(() => {
        if (outputUnitCode === "KG") return parseFloat(outputQuantity) || 0;
        return parseFloat(outputNetWeightKg) || 0;
    }, [outputQuantity, outputNetWeightKg, outputUnitCode]);

    // Service Bill Options Categorized
    // Stage 1: All processing services EXCEPT Weaving and Knitting
    const processingServiceOptions = useMemo(() => {
        return unconsumedServices
            .filter(s => {
                const cat = (s.categoryName || "").toUpperCase();
                const prod = (s.productName || "").toUpperCase();
                const isWeaving = s.serviceType === "WEAVING" || cat.includes("WEAV") || prod.includes("WEAV");
                const isKnitting = s.serviceType === "KNITTING" || cat.includes("KNIT") || prod.includes("KNIT");
                return !isWeaving && !isKnitting;
            })
            .map(s => ({
                value: s.id,
                label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName} [${s.categoryName || 'Service'}] | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}`
            }));
    }, [unconsumedServices]);

    // Stage 2: Weaving only
    const weavingServiceOptions = useMemo(() => {
        return unconsumedServices
            .filter(s => s.serviceType === "WEAVING" || s.categoryName.toUpperCase().includes("WEAV") || s.productName.toUpperCase().includes("WEAV"))
            .map(s => ({
                value: s.id,
                label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName} | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}`
            }));
    }, [unconsumedServices]);

    // Stage 2: Knitting only
    const knittingServiceOptions = useMemo(() => {
        return unconsumedServices
            .filter(s => s.serviceType === "KNITTING" || s.categoryName.toUpperCase().includes("KNIT") || s.productName.toUpperCase().includes("KNIT"))
            .map(s => ({
                value: s.id,
                label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName} | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}`
            }));
    }, [unconsumedServices]);

    // Maximum wastage among all active processing services
    const maxProcessingWastage = useMemo(() => {
        if (processingServices.length === 0) return 0;
        return processingServices.reduce((max, ps) => Math.max(max, ps.wastage || 0), 0);
    }, [processingServices]);

    // Stage 2 Weaving / Knitting Quantity (KG)
    const reqWeavingQty = useMemo(() => {
        if (executionMode === "GREY_TO_FINISH") return 0;
        const base = maxProcessingWastage > 0 
            ? Math.round((effectiveNetWeightKg / ((100 - maxProcessingWastage) / 100)) * 100) / 100 
            : effectiveNetWeightKg;
        return weavingWastage > 0 
            ? Math.round((base / ((100 - weavingWastage) / 100)) * 100) / 100 
            : base;
    }, [effectiveNetWeightKg, maxProcessingWastage, weavingWastage, executionMode]);

    // Stage 3 Raw Yarn Quantity (KG)
    const reqYarnQty = useMemo(() => {
        if (executionMode === "GREY_TO_FINISH") return 0;
        return yarnWastage > 0 
            ? Math.round((reqWeavingQty / ((100 - yarnWastage) / 100)) * 100) / 100 
            : reqWeavingQty;
    }, [reqWeavingQty, yarnWastage, executionMode]);

    // Sync weaving service qty default
    useEffect(() => {
        if (reqWeavingQty > 0 && !weavingServiceQty) {
            setWeavingServiceQty(reqWeavingQty.toString());
        }
    }, [reqWeavingQty]);

    // Sync default processing service qty
    useEffect(() => {
        if (effectiveNetWeightKg > 0) {
            setProcessingServices(prev => prev.map(p => {
                if (!p.qty || p.qty === "0" || p.qty === "61004") {
                    return { ...p, qty: effectiveNetWeightKg.toString() };
                }
                return p;
            }));
        }
    }, [effectiveNetWeightKg]);

    // Sync grey input qty for GREY_TO_FINISH
    useEffect(() => {
        if (executionMode === "GREY_TO_FINISH" && effectiveNetWeightKg > 0 && !greyInputQty) {
            setGreyInputQty(effectiveNetWeightKg.toString());
        }
    }, [executionMode, effectiveNetWeightKg]);

    // Helper to strictly identify Yarn items (Raw Materials only, excluding fabrics & services)
    const isYarnProduct = (p: any) => {
        if (!p || p.isService) return false;
        if (p.stage === "RAW") return true;
        const hs = (p.hsCode || "").replace(/\./g, "").trim();
        if (hs.startsWith("5402") || hs.startsWith("5401") || hs.startsWith("5509") || hs.startsWith("5510") || hs.startsWith("5508")) return true;
        if (hs.startsWith("54") || hs.startsWith("55")) {
            // Exclude woven fabric HS codes (5407, 5408, 5512-5516)
            if (!hs.startsWith("5407") && !hs.startsWith("5408") && !hs.startsWith("5512") && !hs.startsWith("5513") && !hs.startsWith("5514") && !hs.startsWith("5515") && !hs.startsWith("5516")) {
                return true;
            }
        }
        const name = `${p.name || ''} ${p.code || ''}`.toUpperCase();
        return name.includes("YARN") || name.includes("DTY") || name.includes("FDY") || name.includes("SPUN") || name.includes("FILAMENT") || name.includes("DENIER") || /\b\d+\/\d+\b/.test(name);
    };

    // Available Yarn Lots (strictly filtered so ONLY Yarn shows up on yarn side)
    const availableYarnLots = useMemo(() => {
        return availableLots.filter(lot => {
            const prod = products.find(p => p.id === lot.productId);
            return isYarnProduct(prod || lot);
        });
    }, [availableLots, products]);

    // Yarn Options with Available Lots (Purchase Lots + Opening Stock Lots)
    const yarnProductList = useMemo(() => {
        return products.filter(p => isYarnProduct(p));
    }, [products]);

    const yarnOptions = useMemo(() => {
        const opts: { value: string; label: string }[] = [];

        // 1. First add individual available lots (Purchased lots + Opening Stock lots)
        for (const lot of availableYarnLots) {
            const prod = products.find(p => p.id === lot.productId);
            const lotLabel = lot.isOpening 
                ? `[Opening Stock] ${prod ? `${prod.code} - ${prod.name}` : ''} | Avail: ${lot.qty.toLocaleString()} KG @ Rs. ${Number(lot.rate).toFixed(2)}`
                : `[Inv: ${lot.invoiceNo}] ${prod ? `${prod.code} - ${prod.name}` : ''} | Avail: ${lot.qty.toLocaleString()} KG @ Rs. ${Number(lot.rate).toFixed(2)}`;
            
            opts.push({
                value: `LOT|${lot.id}|${lot.productId}|${lot.rate}|${lot.isEFS || false}|${lot.invoiceNo}`,
                label: lotLabel
            });
        }

        // 2. Add product general stock options
        for (const p of yarnProductList) {
            const stdKey = `${p.id}-RAW-STD`;
            const efsKey = `${p.id}-RAW-EFS`;
            const stdStock = stockRates[stdKey]?.qty || 0;
            const efsStock = stockRates[efsKey]?.qty || 0;

            if (stdStock > 0) {
                opts.push({
                    value: `PROD|${p.id}|false`,
                    label: `[General Stock] ${p.code} - ${p.name} (Stock: ${stdStock.toLocaleString()} KG @ Rs. ${stockRates[stdKey]?.rate?.toFixed(2) || '0'})`
                });
            }
            if (efsStock > 0) {
                opts.push({
                    value: `PROD|${p.id}|true`,
                    label: `[EFS Duty-Free] ${p.code} - ${p.name} (Stock: ${efsStock.toLocaleString()} KG @ Rs. ${stockRates[efsKey]?.rate?.toFixed(2) || '0'})`
                });
            }
            if (stdStock <= 0 && efsStock <= 0) {
                opts.push({
                    value: `PROD|${p.id}|false`,
                    label: `${p.code} - ${p.name} (0 KG in Stock)`
                });
            }
        }
        return opts;
    }, [availableYarnLots, yarnProductList, products, stockRates]);

    // Filtered Yarn Lots for Modal Table
    const filteredModalYarnLots = useMemo(() => {
        return availableYarnLots.filter(lot => {
            const prod = products.find(p => p.id === lot.productId);
            const search = yarnModalSearch.toLowerCase().trim();
            if (search) {
                const name = (prod?.name || lot.productName || '').toLowerCase();
                const code = (prod?.code || lot.productCode || '').toLowerCase();
                const hs = (prod?.hsCode || lot.hsCode || '').toLowerCase();
                const inv = (lot.invoiceNo || '').toLowerCase();
                const supp = (lot.supplierName || '').toLowerCase();
                if (!name.includes(search) && !code.includes(search) && !hs.includes(search) && !inv.includes(search) && !supp.includes(search)) {
                    return false;
                }
            }

            if (yarnModalFilter === "LOCAL") {
                if (lot.isEFS || lot.origin === "IMPORT" || (lot.invoiceNo && lot.invoiceNo.includes("[EFS]")) || (lot.invoiceNo && lot.invoiceNo.includes("[IMPORT]"))) {
                    return false;
                }
            } else if (yarnModalFilter === "IMPORT_EFS") {
                if (!lot.isEFS && !(lot.invoiceNo && lot.invoiceNo.includes("[EFS]"))) {
                    return false;
                }
            } else if (yarnModalFilter === "IMPORT_COMMERCIAL") {
                const isEfs = Boolean(lot.isEFS || (lot.invoiceNo && lot.invoiceNo.includes("[EFS]")));
                const isImport = lot.origin === "IMPORT" || (lot.invoiceNo && lot.invoiceNo.includes("[IMPORT]"));
                if (!isImport || isEfs) return false;
            } else if (yarnModalFilter === "OPENING") {
                if (!lot.isOpening) return false;
            }

            return true;
        });
    }, [availableYarnLots, products, yarnModalSearch, yarnModalFilter]);

    // Filtered Services for Modal Table
    const filteredModalServices = useMemo(() => {
        return unconsumedServices.filter(svc => {
            const search = serviceModalSearch.toLowerCase().trim();
            if (search) {
                const supp = (svc.supplierName || '').toLowerCase();
                const inv = (svc.invoiceNo || '').toLowerCase();
                const prod = (svc.productName || '').toLowerCase();
                const cat = (svc.categoryName || '').toLowerCase();
                if (!supp.includes(search) && !inv.includes(search) && !prod.includes(search) && !cat.includes(search)) {
                    return false;
                }
            }

            if (serviceModalTypeFilter !== "ALL") {
                if (svc.serviceType !== serviceModalTypeFilter) {
                    const cat = (svc.categoryName || '').toUpperCase();
                    const prod = (svc.productName || '').toUpperCase();
                    if (serviceModalTypeFilter === "WEAVING" && !cat.includes("WEAV") && !prod.includes("WEAV")) return false;
                    if (serviceModalTypeFilter === "KNITTING" && !cat.includes("KNIT") && !prod.includes("KNIT")) return false;
                    if (serviceModalTypeFilter === "DYEING" && !cat.includes("DYE") && !prod.includes("DYE")) return false;
                    if (serviceModalTypeFilter === "PRINTING" && !cat.includes("PRINT") && !prod.includes("PRINT")) return false;
                }
            }

            return true;
        });
    }, [unconsumedServices, serviceModalSearch, serviceModalTypeFilter]);

    // Modal Selection Handlers
    const handleSelectYarnLotFromModal = (lot: any) => {
        if (activeYarnRowIndex === null) return;
        const next = [...yarnInputs];
        const currentQty = parseFloat(next[activeYarnRowIndex].quantity) || 0;
        const autoQty = lot.qty ? Math.min(lot.qty, Math.max(0, reqYarnQty - totalYarnAllocated + currentQty)) : 0;
        
        next[activeYarnRowIndex] = {
            productId: lot.productId,
            isEFS: Boolean(lot.isEFS),
            quantity: autoQty > 0 ? autoQty.toString() : (lot.qty ? lot.qty.toString() : ""),
            costRate: Number(lot.rate || 0).toFixed(2),
            lotNumber: lot.invoiceNo || "",
            purchaseInvoiceItemId: lot.isOpening ? undefined : lot.id
        };
        setYarnInputs(next);
        setIsYarnModalOpen(false);
        setActiveYarnRowIndex(null);
    };

    const handleSelectServiceFromModal = (svc: any) => {
        if (serviceModalTarget === "WEAVING_KNITTING") {
            setSelectedWeavingServiceId(svc.id);
            setWeavingServiceQty(Math.min(svc.unconsumedQty, reqWeavingQty).toString());
        } else if (serviceModalTarget === "PROCESSING" && activeProcessingRowIndex !== null) {
            setProcessingServices(prev => prev.map((p, idx) => {
                if (idx !== activeProcessingRowIndex) return p;
                let autoQty = p.qty;
                if (svc.unit === "MTR" && outputUnitCode === "MTR") {
                    autoQty = outputQuantity;
                } else if (!p.qty || p.qty === "0") {
                    autoQty = effectiveNetWeightKg.toString();
                }
                return {
                    ...p,
                    serviceId: svc.id,
                    rate: Number(svc.rate || 0).toString(),
                    unit: svc.unit || "KG",
                    qty: autoQty
                };
            }));
        }
        setIsServiceModalOpen(false);
    };

    // Grey Fabric Options
    const greyProductList = useMemo(() => {
        return products.filter(p => p.stage === "GREY" || p.name.toUpperCase().includes("GREY") || p.hsCode?.startsWith("60"));
    }, [products]);

    const greyOptions = useMemo(() => {
        return greyProductList.map(p => ({
            value: p.id,
            label: `${p.code} - ${p.name} ${p.hsCode ? `[HS ${p.hsCode}]` : ''}`
        }));
    }, [greyProductList]);

    // Yarn Input Handlers
    const handleYarnProductChange = (index: number, val: string) => {
        const next = [...yarnInputs];
        if (!val) {
            next[index] = { productId: "", isEFS: false, quantity: "", costRate: "0", lotNumber: "" };
            setYarnInputs(next);
            return;
        }

        if (val.startsWith("LOT|")) {
            const [, lotId, pid, rate, isEFSStr, lotNo] = val.split('|');
            const isEFS = isEFSStr === 'true';
            const lot = availableLots.find(l => l.id === lotId);
            const autoQty = lot ? Math.min(lot.qty, reqYarnQty - totalYarnAllocated + (parseFloat(next[index].quantity) || 0)) : 0;

            next[index] = {
                productId: pid,
                isEFS,
                quantity: autoQty > 0 ? autoQty.toString() : "",
                costRate: parseFloat(rate).toFixed(2),
                lotNumber: lotNo || "",
                purchaseInvoiceItemId: lotId
            };
            setYarnInputs(next);
        } else {
            const [, pid, isEFSStr] = val.split('|');
            const isEFS = isEFSStr === 'true';
            next[index].productId = pid;
            next[index].isEFS = isEFS;
            next[index].purchaseInvoiceItemId = undefined;

            const rateKey = `${pid}-RAW-${isEFS ? 'EFS' : 'STD'}`;
            const fallbackKey = `${pid}-RAW-STD`;
            const matched = stockRates[rateKey] || stockRates[fallbackKey];
            next[index].costRate = matched?.rate ? matched.rate.toFixed(2) : "0";
            setYarnInputs(next);
        }
    };

    const addYarnRow = () => {
        setYarnInputs([...yarnInputs, { productId: "", isEFS: false, quantity: "", costRate: "", lotNumber: "" }]);
    };

    const removeYarnRow = (idx: number) => {
        if (yarnInputs.length > 1) {
            setYarnInputs(yarnInputs.filter((_, i) => i !== idx));
        }
    };

    // Calculate Total Yarn Allocated
    const totalYarnAllocated = useMemo(() => {
        return yarnInputs.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
    }, [yarnInputs]);

    const yarnShortfall = Math.max(0, Math.round((reqYarnQty - totalYarnAllocated) * 100) / 100);
    const isYarnCovered = totalYarnAllocated >= reqYarnQty && reqYarnQty > 0;

    // Financial Totals
    const yarnCostTotal = useMemo(() => {
        if (executionMode === "GREY_TO_FINISH") {
            return (parseFloat(greyInputQty) || 0) * (parseFloat(greyInputCostRate) || 0);
        }
        return yarnInputs.reduce((sum, i) => sum + ((parseFloat(i.quantity) || 0) * (parseFloat(i.costRate) || 0)), 0);
    }, [yarnInputs, executionMode, greyInputQty, greyInputCostRate]);

    const fabricMakingCostTotal = useMemo(() => {
        if (executionMode === "GREY_TO_FINISH") return 0;
        if (weavingMode === "IN_HOUSE") {
            return reqWeavingQty * (parseFloat(inHouseWeavingRate) || 0);
        } else {
            if (outHouseFabricMode === "VENDOR_BILL") {
                const svcList = fabricProcessType === "WEAVING" ? weavingServiceOptions : knittingServiceOptions;
                const svc = unconsumedServices.find(s => s.id === selectedWeavingServiceId);
                return svc ? (parseFloat(weavingServiceQty) || 0) * svc.rate : 0;
            } else {
                return reqWeavingQty * (parseFloat(outHouseFabricManualRate) || 0);
            }
        }
    }, [executionMode, weavingMode, outHouseFabricMode, reqWeavingQty, inHouseWeavingRate, selectedWeavingServiceId, weavingServiceQty, outHouseFabricManualRate, unconsumedServices, fabricProcessType, weavingServiceOptions, knittingServiceOptions]);

    const processingCostTotal = useMemo(() => {
        return processingServices.reduce((sum, ps) => {
            const q = parseFloat(ps.qty) || 0;
            const r = parseFloat(ps.rate) || 0;
            return sum + (q * r);
        }, 0);
    }, [processingServices]);

    const totalBatchCost = yarnCostTotal + fabricMakingCostTotal + processingCostTotal;
    const costPerKg = effectiveNetWeightKg > 0 ? totalBatchCost / effectiveNetWeightKg : 0;
    const outQtyNum = parseFloat(outputQuantity) || 0;
    const costPerUnit = outQtyNum > 0 ? totalBatchCost / outQtyNum : 0;

    // Handle Form Submit
    const handleSubmit = async () => {
        if (!outputProductId) {
            alert("Please select the Output Product");
            return;
        }
        if (!outputQuantity || parseFloat(outputQuantity) <= 0) {
            alert("Please enter a valid Ready Output Quantity");
            return;
        }

        // Validate Inputs
        if (executionMode === "GREY_TO_FINISH") {
            if (!greyInputProductId || !greyInputQty || parseFloat(greyInputQty) <= 0) {
                alert("Please select Grey Fabric and enter consumed quantity");
                return;
            }
        } else {
            if (yarnInputs.length === 0 || !yarnInputs[0].productId || !yarnInputs[0].quantity) {
                alert("Please allocate at least one Yarn input material");
                return;
            }
        }

        // Overheads compilation
        const finalOverheads: any[] = [];

        // 1. Fabric Making (Weaving / Knitting)
        if (executionMode !== "GREY_TO_FINISH") {
            if (weavingMode === "IN_HOUSE") {
                const amt = reqWeavingQty * (parseFloat(inHouseWeavingRate) || 0);
                if (amt > 0) {
                    finalOverheads.push({
                        description: `In-house ${fabricProcessType} Overhead (@ Rs. ${inHouseWeavingRate}/KG)`,
                        amount: amt,
                        quantity: reqWeavingQty
                    });
                }
            } else if (outHouseFabricMode === "VENDOR_BILL" && selectedWeavingServiceId) {
                finalOverheads.push({
                    purchaseInvoiceItemId: selectedWeavingServiceId,
                    quantity: parseFloat(weavingServiceQty) || reqWeavingQty
                });
            } else if (outHouseFabricMode === "MANUAL") {
                const amt = reqWeavingQty * (parseFloat(outHouseFabricManualRate) || 0);
                if (amt > 0) {
                    finalOverheads.push({
                        description: `Out-house ${fabricProcessType} Overhead (@ Rs. ${outHouseFabricManualRate}/KG)`,
                        amount: amt,
                        quantity: reqWeavingQty
                    });
                }
            }
        }

        // 2. Processing Services Overheads (Dyeing, Printing, Bleaching, Washing, etc.)
        for (const ps of processingServices) {
            if (ps.mode === "VENDOR_BILL" && ps.serviceId) {
                const q = parseFloat(ps.qty) || 0;
                if (q > 0) {
                    finalOverheads.push({
                        purchaseInvoiceItemId: ps.serviceId,
                        quantity: q
                    });
                }
            } else if (ps.mode === "MANUAL") {
                const q = parseFloat(ps.qty) || 0;
                const r = parseFloat(ps.rate) || 0;
                const amt = q * r;
                if (amt > 0) {
                    finalOverheads.push({
                        description: `${ps.manualName || 'Processing Service'} Overhead (@ Rs. ${r}/${ps.unit || 'KG'})`,
                        amount: amt,
                        quantity: q
                    });
                }
            }
        }

        // Final Inputs compilation
        const finalInputs = executionMode === "GREY_TO_FINISH" ? [{
            productId: greyInputProductId,
            quantity: parseFloat(greyInputQty),
            costRate: parseFloat(greyInputCostRate) || 0,
            stage: "GREY",
            isEFS: greyInputIsEFS
        }] : yarnInputs.map(y => ({
            productId: y.productId,
            quantity: parseFloat(y.quantity),
            costRate: parseFloat(y.costRate) || 0,
            lotNumber: y.lotNumber || null,
            purchaseInvoiceItemId: y.purchaseInvoiceItemId,
            stage: "RAW",
            isEFS: y.isEFS
        }));

        const processStage = executionMode === "YARN_TO_GREY" ? "GREY" : "FINISH";

        const payload = {
            date,
            outputProductId,
            outputQuantity: parseFloat(outputQuantity),
            outputUom: outputUnitCode,
            outputNetWeightKg: effectiveNetWeightKg,
            processStage,
            warehouseId,
            mode: (weavingMode === "OUT_HOUSE" || processingServices.some(p => p.mode === "VENDOR_BILL" && p.serviceId)) ? "OUT-HOUSE" : "IN-HOUSE",
            lotNumber: lotNumber || null,
            balesCount: balesCount || null,
            inputs: finalInputs,
            overheads: finalOverheads
        };

        setSubmitting(true);
        try {
            const res = await authenticatedFetch("/api/finance/production/execution", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json.success) {
                alert("Production batch posted successfully!");
                router.push("/finance/production/execution");
            } else {
                alert(json.error || "Failed to post production batch");
            }
        } catch (e: any) {
            alert(e.message || "An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                    <p className="text-slate-500 font-bold">Loading Production Environment...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="w-full max-w-[98%] 2xl:max-w-[96%] mx-auto space-y-7 px-2 sm:px-4 pb-32 animate-in fade-in duration-300">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-5 bg-slate-900 text-white p-7 rounded-3xl shadow-xl border border-slate-800">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1.5">
                            <Factory size={18} />
                            <span>Export Production Execution</span>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">Export Batch Production Wizard</h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Set export item UOM (Pcs, Mtr, Kg), link category service bills (Dyeing, Printing, Weaving/Knitting), and auto-calculate yarn consumption with wastage.
                        </p>
                    </div>

                    {/* Mode Selector Tabs (Full Flexibility) */}
                    <div className="flex bg-slate-950 p-2 rounded-2xl border border-slate-800 shrink-0 gap-1.5">
                        <button
                            type="button"
                            onClick={() => setExecutionMode("DIRECT_FINISH")}
                            className={cn(
                                "px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2",
                                executionMode === "DIRECT_FINISH" 
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" 
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <span>1. Direct to Finish</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200">Full</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setExecutionMode("YARN_TO_GREY")}
                            className={cn(
                                "px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2",
                                executionMode === "YARN_TO_GREY" 
                                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30" 
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <span>2. Grey Fabric Only</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200">Grey</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setExecutionMode("GREY_TO_FINISH")}
                            className={cn(
                                "px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2",
                                executionMode === "GREY_TO_FINISH" 
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30" 
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <span>3. Grey to Finish</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200">Wet Only</span>
                        </button>
                    </div>
                </div>

                {/* Main 2-Column Content Layout */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT CANVAS: PRODUCTION STAGES (8 Cols) */}
                    <div className="xl:col-span-8 space-y-7">
                        
                        {/* STAGE 0: TARGET OUTPUT PRODUCT & MULTI-UOM */}
                        <div className="p-7 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-base shadow-sm">
                                        1
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                            {executionMode === "YARN_TO_GREY" ? "Target Output: Grey Fabric (WIP)" : "Target Output: Finished Goods (Export Item)"}
                                        </h3>
                                        <p className="text-xs sm:text-sm text-slate-400">Specify batch quantity, export UOM (Pieces, Meter, KG), and destination warehouse.</p>
                                    </div>
                                </div>
                                <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    Stage: {executionMode === "YARN_TO_GREY" ? "GREY" : "FINISH"}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-5">
                                {/* Output Product (Only Manufactured Goods) */}
                                <div className="md:col-span-8 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                            Manufactured Output Product *
                                        </label>
                                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full">
                                            {outputOptions.length} manufactured items
                                        </span>
                                    </div>
                                    <Combobox
                                        options={outputOptions}
                                        value={outputProductId}
                                        onChange={(val) => setOutputProductId(val)}
                                        placeholder="Search or select manufactured product..."
                                        searchPlaceholder="Type name, code, or HS code..."
                                        className="w-full text-sm font-bold"
                                    />
                                </div>

                                {/* UOM Selector */}
                                <div className="md:col-span-4 space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Export UOM *
                                    </label>
                                    <select
                                        value={outputUnitCode}
                                        onChange={(e) => {
                                            const uom = e.target.value;
                                            setOutputUnitCode(uom);
                                            if (uom === "KG") {
                                                setOutputNetWeightKg(outputQuantity);
                                            }
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white shadow-sm"
                                    >
                                        <option value="PCS">PCS (Pieces / Shawls / Towels)</option>
                                        <option value="MTR">MTR (Meters Fabric)</option>
                                        <option value="KG">KG (Kilograms)</option>
                                        <option value="YD">YD (Yards)</option>
                                        <option value="LBS">LBS (Pounds)</option>
                                    </select>
                                </div>

                                {/* Output Quantity in Selected UOM */}
                                <div className="md:col-span-4 space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Ready Quantity ({outputUnitCode}) *
                                    </label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={outputQuantity}
                                        onChange={(e) => handleOutputQtyChange(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 text-right shadow-sm"
                                    />
                                </div>

                                {/* Weight per unit helper (If not KG) */}
                                {outputUnitCode !== "KG" && (
                                    <div className="md:col-span-4 space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex justify-between">
                                            <span>Weight / {outputUnitCode} (KG)</span>
                                            <span className="text-[10px] text-slate-400">
                                                {outputUnitCode === "PCS" ? `~${Math.round((parseFloat(weightPerUnit) || 0) * 1000)}g / pc` : ''}
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.00001"
                                            value={weightPerUnit}
                                            onChange={(e) => handleWeightPerUnitChange(e.target.value)}
                                            placeholder="0.184"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-slate-900 dark:text-white text-right shadow-sm"
                                        />
                                    </div>
                                )}

                                {/* Total Net Finished Weight (KG) */}
                                <div className={cn(outputUnitCode === "KG" ? "md:col-span-4" : "md:col-span-4", "space-y-2")}>
                                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                                        <span>Total Finished Weight (KG) *</span>
                                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 px-2 py-0.5 rounded-full font-bold">Base KG</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={outputNetWeightKg}
                                        onChange={(e) => handleNetWeightChange(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/20 text-sm font-mono font-black text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 text-right shadow-sm"
                                    />
                                </div>

                                {/* Bales / Packages Count (Optional) */}
                                <div className="md:col-span-4 space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Bales / Packages (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 881 Bales"
                                        value={balesCount}
                                        onChange={(e) => setBalesCount(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-white shadow-sm"
                                    />
                                </div>

                                {/* Destination Warehouse */}
                                <div className="md:col-span-4 space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Destination Warehouse *
                                    </label>
                                    <select
                                        value={warehouseId}
                                        onChange={(e) => setWarehouseId(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                    >
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Production Date */}
                                <div className="md:col-span-4 space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Production Date
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* STAGE 1: WET PROCESSING & FINISHING SERVICES */}
                        {executionMode !== "YARN_TO_GREY" && (
                            <div className="p-7 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-base shadow-sm">
                                            <Droplets size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                    Stage 1: Wet Processing & Finishing
                                                </h3>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase">
                                                    {processingServices.length} Service(s)
                                                </span>
                                            </div>
                                            <p className="text-xs sm:text-sm text-slate-400">
                                                Add Dyeing, Printing, Bleaching, Washing or any other finishing service bills (excluding Weaving & Knitting).
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleAddProcessingService}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/20 active:scale-95 transition-all self-start sm:self-auto"
                                    >
                                        <Plus size={15} /> Add Processing Service
                                    </button>
                                </div>

                                {processingServices.length === 0 ? (
                                    <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                                        <p className="text-sm font-bold text-slate-500">No processing services selected for this batch.</p>
                                        <p className="text-xs text-slate-400">Use this if producing direct grey fabric or un-dyed goods.</p>
                                        <button
                                            type="button"
                                            onClick={handleAddProcessingService}
                                            className="px-4 py-2 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5"
                                        >
                                            <Plus size={14} /> Add Service (Dyeing / Printing / Finishing)
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {processingServices.map((ps, index) => {
                                            const lineCost = (parseFloat(ps.qty) || 0) * (parseFloat(ps.rate) || 0);
                                            const selectedSvc = unconsumedServices.find(s => s.id === ps.serviceId);

                                            return (
                                                <div
                                                    key={ps.id}
                                                    className="p-5 sm:p-6 rounded-2xl bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/70 dark:border-amber-900/40 space-y-4 relative"
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-mono font-black text-xs">
                                                                {index + 1}
                                                            </span>
                                                            <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                                                                Processing Service #{index + 1}
                                                            </span>
                                                            {selectedSvc?.categoryName && (
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 uppercase">
                                                                    {selectedSvc.categoryName}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            {/* Mode Toggle */}
                                                            <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProcessingServiceChange(ps.id, "mode", "VENDOR_BILL")}
                                                                    className={cn(
                                                                        "px-2.5 py-1 rounded-lg transition-all",
                                                                        ps.mode === "VENDOR_BILL"
                                                                            ? "bg-amber-600 text-white shadow-sm font-black"
                                                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                                                    )}
                                                                >
                                                                    Vendor Bill
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProcessingServiceChange(ps.id, "mode", "MANUAL")}
                                                                    className={cn(
                                                                        "px-2.5 py-1 rounded-lg transition-all",
                                                                        ps.mode === "MANUAL"
                                                                            ? "bg-amber-600 text-white shadow-sm font-black"
                                                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                                                    )}
                                                                >
                                                                    Manual Rate
                                                                </button>
                                                            </div>

                                                            {/* Remove Button */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveProcessingService(ps.id)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                                                title="Remove this service"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Mode 1: Vendor Service Bill */}
                                                    {ps.mode === "VENDOR_BILL" ? (
                                                        <div className="space-y-3">
                                                            <div className="space-y-1.5">
                                                                <div className="flex justify-between items-center text-xs font-bold text-amber-900 dark:text-amber-200">
                                                                    <span>Select Processing Bill (Dyeing, Printing, Bleaching, Washing, etc.):</span>
                                                                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                                                        {processingServiceOptions.length} bill(s) available
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                                                    <div className="flex-1">
                                                                        <Combobox
                                                                            options={processingServiceOptions}
                                                                            value={ps.serviceId}
                                                                            onChange={(val) => handleProcessingServiceChange(ps.id, "serviceId", val)}
                                                                            placeholder="-- Choose Processing Service Bill (Category: Dyeing, Printing, etc.) --"
                                                                            searchPlaceholder="Search supplier, item or invoice #..."
                                                                            className="w-full text-sm font-bold"
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setServiceModalTarget("PROCESSING");
                                                                            setActiveProcessingRowIndex(index);
                                                                            setServiceModalTypeFilter("ALL");
                                                                            setServiceModalSearch("");
                                                                            setIsServiceModalOpen(true);
                                                                        }}
                                                                        className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-sm active:scale-95"
                                                                        title="Open full table to search and select process bills"
                                                                    >
                                                                        <Search size={14} />
                                                                        <span>Browse Service Bills</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                                                                {/* Qty to Consume */}
                                                                <div className="space-y-1">
                                                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                                        Qty to Consume ({ps.unit || "KG"})
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        step="any"
                                                                        placeholder="0.00"
                                                                        value={ps.qty}
                                                                        onChange={(e) => handleProcessingServiceChange(ps.id, "qty", e.target.value)}
                                                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-right"
                                                                    />
                                                                </div>

                                                                {/* Service Rate */}
                                                                <div className="space-y-1">
                                                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                                        Rate (Rs. / {ps.unit || "Unit"})
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        step="any"
                                                                        value={ps.rate}
                                                                        onChange={(e) => handleProcessingServiceChange(ps.id, "rate", e.target.value)}
                                                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-right"
                                                                    />
                                                                </div>

                                                                {/* Wastage % */}
                                                                <div className="space-y-1">
                                                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                                        Wastage %
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        step="any"
                                                                        value={ps.wastage}
                                                                        onChange={(e) => handleProcessingServiceChange(ps.id, "wastage", parseFloat(e.target.value) || 0)}
                                                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-right"
                                                                    />
                                                                </div>

                                                                {/* Line Cost */}
                                                                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-right flex flex-col justify-center">
                                                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Line Cost</span>
                                                                    <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                                                                        Rs. {lineCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* Mode 2: Manual Rate */
                                                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                                            <div className="space-y-1 sm:col-span-2">
                                                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                                    Service Name
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="e.g. In-house Dyeing / Washing / Printing"
                                                                    value={ps.manualName}
                                                                    onChange={(e) => handleProcessingServiceChange(ps.id, "manualName", e.target.value)}
                                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold"
                                                                />
                                                            </div>

                                                            <div className="space-y-1">
                                                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                                    Qty ({ps.unit || "KG"})
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    value={ps.qty}
                                                                    onChange={(e) => handleProcessingServiceChange(ps.id, "qty", e.target.value)}
                                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-right"
                                                                />
                                                            </div>

                                                            <div className="space-y-1">
                                                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                                    Rate (Rs./Unit)
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    value={ps.rate}
                                                                    onChange={(e) => handleProcessingServiceChange(ps.id, "rate", e.target.value)}
                                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-right"
                                                                />
                                                            </div>

                                                            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-right flex flex-col justify-center">
                                                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Line Cost</span>
                                                                <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                                                                    Rs. {lineCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Action footer & total */}
                                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-wrap items-center justify-between gap-4">
                                            <button
                                                type="button"
                                                onClick={handleAddProcessingService}
                                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                                            >
                                                <Plus size={15} /> Add Another Processing Service
                                            </button>

                                            <div className="flex items-center gap-4 text-right">
                                                <span className="text-xs font-bold text-slate-500 uppercase">
                                                    Stage 1 Total Processing Cost:
                                                </span>
                                                <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                                                    Rs. {processingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STAGE 2: FABRIC MANUFACTURING (WEAVING / KNITTING) */}
                        {executionMode !== "GREY_TO_FINISH" && (
                            <div className="p-7 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black text-base shadow-sm">
                                            <Scissors size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                Stage 2: Fabric Manufacturing ({fabricProcessType})
                                            </h3>
                                            <p className="text-xs sm:text-sm text-slate-400">Choose Weaving or Knitting process; execute In-house machine or Out-house vendor bill.</p>
                                        </div>
                                    </div>

                                    {/* Weaving vs Knitting Process Selector */}
                                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0 gap-1 text-xs font-bold">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFabricProcessType("WEAVING");
                                                setSelectedWeavingServiceId("");
                                            }}
                                            className={cn("px-4 py-1.5 rounded-xl transition-all", fabricProcessType === "WEAVING" ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                                        >
                                            Weaving
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFabricProcessType("KNITTING");
                                                setSelectedWeavingServiceId("");
                                            }}
                                            className={cn("px-4 py-1.5 rounded-xl transition-all", fabricProcessType === "KNITTING" ? "bg-cyan-600 text-white shadow" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                                        >
                                            Knitting
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                    {/* Location Toggle: In-House vs Out-House */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Execution Location</label>
                                        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => setWeavingMode("IN_HOUSE")}
                                                className={cn(
                                                    "py-2 text-xs sm:text-sm font-bold rounded-lg transition-all",
                                                    weavingMode === "IN_HOUSE" ? "bg-white dark:bg-slate-800 shadow text-blue-600 dark:text-blue-400 font-black" : "text-slate-500"
                                                )}
                                            >
                                                In-House
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWeavingMode("OUT_HOUSE")}
                                                className={cn(
                                                    "py-2 text-xs sm:text-sm font-bold rounded-lg transition-all",
                                                    weavingMode === "OUT_HOUSE" ? "bg-white dark:bg-slate-800 shadow text-blue-600 dark:text-blue-400 font-black" : "text-slate-500"
                                                )}
                                            >
                                                Out-House
                                            </button>
                                        </div>
                                    </div>

                                    {/* Wastage % (Default 4%) */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Fabric Wastage %</label>
                                        <input
                                            type="number"
                                            value={weavingWastage}
                                            onChange={(e) => setWeavingWastage(parseFloat(e.target.value) || 0)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-slate-900 dark:text-white text-right shadow-sm"
                                        />
                                    </div>

                                    {/* Fabric Required Qty Badge & Cost */}
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-right flex flex-col justify-center">
                                        <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-0.5">
                                            <span>Req Fabric:</span>
                                            <span className="font-mono text-blue-600 dark:text-blue-400">{reqWeavingQty.toLocaleString()} KG</span>
                                        </div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">{fabricProcessType} Cost Total</span>
                                        <span className="text-base sm:text-lg font-black font-mono text-blue-600 dark:text-blue-400">
                                            Rs. {fabricMakingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                {/* In-House Rate Input */}
                                {weavingMode === "IN_HOUSE" ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-1">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                In-House Machine Rate (Rs. / KG)
                                            </label>
                                            <input
                                                type="number"
                                                value={inHouseWeavingRate}
                                                onChange={(e) => setInHouseWeavingRate(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-slate-900 dark:text-white text-right shadow-sm"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* Out-House Vendor Bills strictly filtered by category */
                                    <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-200">
                                                    Select Out-House {fabricProcessType} Bill (Category: {fabricProcessType}):
                                                </span>
                                            </div>
                                            <span className="text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-0.5 rounded-full">
                                                {(fabricProcessType === "WEAVING" ? weavingServiceOptions : knittingServiceOptions).length} bill(s) available
                                            </span>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                            <div className="flex-1">
                                                <Combobox
                                                    options={fabricProcessType === "WEAVING" ? weavingServiceOptions : knittingServiceOptions}
                                                    value={selectedWeavingServiceId}
                                                    onChange={(val) => {
                                                        setSelectedWeavingServiceId(val);
                                                        const s = unconsumedServices.find(it => it.id === val);
                                                        if (s) setWeavingServiceQty(Math.min(s.unconsumedQty, reqWeavingQty).toString());
                                                    }}
                                                    placeholder={`-- Choose ${fabricProcessType} Vendor Invoice --`}
                                                    searchPlaceholder={`Search ${fabricProcessType} supplier or invoice no...`}
                                                    className="w-full text-sm font-bold"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setServiceModalTarget("WEAVING_KNITTING");
                                                    setServiceModalTypeFilter(fabricProcessType === "WEAVING" ? "WEAVING" : "KNITTING");
                                                    setServiceModalSearch("");
                                                    setIsServiceModalOpen(true);
                                                }}
                                                className="px-3.5 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-sm active:scale-95"
                                            >
                                                <Search size={14} />
                                                <span>Browse {fabricProcessType} Bills Table</span>
                                            </button>
                                        </div>

                                        {/* Fallback to manual rate if no invoice available */}
                                        {(fabricProcessType === "WEAVING" ? weavingServiceOptions : knittingServiceOptions).length === 0 && (
                                            <div className="pt-2 flex items-center gap-4">
                                                <div className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                                                    No unconsumed {fabricProcessType} bills found. Enter Out-house manual rate:
                                                </div>
                                                <div className="w-36">
                                                    <input
                                                        type="number"
                                                        value={outHouseFabricManualRate}
                                                        onChange={(e) => setOutHouseFabricManualRate(e.target.value)}
                                                        placeholder="Rate / KG"
                                                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono font-bold text-right"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STAGE 3: RAW YARN ALLOCATION (PURCHASE LOTS & OPENING STOCK) */}
                        {executionMode !== "GREY_TO_FINISH" ? (
                            <div className="p-7 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-base shadow-sm">
                                            <Box size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                Stage 3: Raw Yarn Consumption (Physical Stock)
                                            </h3>
                                            <p className="text-xs sm:text-sm text-slate-400">Allocate raw yarn lots from warehouse inventory and opening stock ({yarnWastage}% wastage included).</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Total Req Yarn:</span>
                                        <span className="font-mono text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-xl">
                                            {reqYarnQty.toLocaleString()} KG
                                        </span>
                                    </div>
                                </div>

                                {/* Live Excel-like Balance Status Card */}
                                <div className={cn(
                                    "p-5 rounded-2xl border flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-all shadow-sm",
                                    isYarnCovered 
                                        ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800" 
                                        : "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                                )}>
                                    <div className="flex items-center gap-3.5">
                                        <div className={cn(
                                            "w-11 h-11 rounded-2xl flex items-center justify-center font-bold shadow-md",
                                            isYarnCovered ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                                        )}>
                                            {isYarnCovered ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                                        </div>
                                        <div>
                                            <div className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                <span>{isYarnCovered ? "Status: Fulfilled (Full Yarn Allocated)" : `Status: Shortfall (${yarnShortfall.toLocaleString()} KG Short)`}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                {isYarnCovered 
                                                    ? "Required quantity has been fully allocated from inventory." 
                                                    : "Allocate additional yarn lots from purchase invoices or opening stock to fulfill required weight."}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right font-mono bg-white/60 dark:bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Allocated / Required</span>
                                        <span className="text-base font-black text-slate-900 dark:text-white">
                                            {totalYarnAllocated.toLocaleString()} / {reqYarnQty.toLocaleString()} KG
                                        </span>
                                    </div>
                                </div>

                                {/* Dynamic Yarn Rows */}
                                <div className="space-y-4 pt-1">
                                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex justify-between">
                                        <span>Yarn Lots Selection (Purchase Lots & Opening Stock)</span>
                                        <span>Allocated Weight & Cost</span>
                                    </div>

                                    {yarnInputs.map((row, idx) => {
                                        return (
                                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 sm:items-center shadow-sm">
                                                {/* Product & Lot Selection */}
                                                <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-center">
                                                    <div className="flex-1">
                                                        <Combobox
                                                            options={yarnOptions}
                                                            value={row.purchaseInvoiceItemId ? `LOT|${row.purchaseInvoiceItemId}|${row.productId}|${row.costRate}|${row.isEFS}|${row.lotNumber}` : (row.productId ? `PROD|${row.productId}|${row.isEFS}` : "")}
                                                            onChange={(val) => handleYarnProductChange(idx, val)}
                                                            placeholder="-- Select Yarn Lot from Purchase or Opening Stock --"
                                                            searchPlaceholder="Search yarn by name, invoice no, or opening stock..."
                                                            className="w-full text-sm font-bold"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveYarnRowIndex(idx);
                                                            setYarnModalSearch("");
                                                            setYarnModalFilter("ALL");
                                                            setIsYarnModalOpen(true);
                                                        }}
                                                        className="px-3.5 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-sm active:scale-95"
                                                        title="Open full table to search and select yarn lots"
                                                    >
                                                        <Search size={14} />
                                                        <span>Browse Yarn Table</span>
                                                    </button>
                                                </div>

                                                {/* Allocated Qty */}
                                                <div className="w-full sm:w-44 space-y-1">
                                                    <input
                                                        type="number"
                                                        placeholder="Qty (KG)"
                                                        value={row.quantity}
                                                        onChange={(e) => {
                                                            const next = [...yarnInputs];
                                                            next[idx].quantity = e.target.value;
                                                            setYarnInputs(next);
                                                        }}
                                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white text-right shadow-sm"
                                                    />
                                                </div>

                                                {/* Rate */}
                                                <div className="w-full sm:w-32 space-y-1">
                                                    <input
                                                        type="number"
                                                        placeholder="Rate"
                                                        value={row.costRate}
                                                        onChange={(e) => {
                                                            const next = [...yarnInputs];
                                                            next[idx].costRate = e.target.value;
                                                            setYarnInputs(next);
                                                        }}
                                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white text-right shadow-sm"
                                                    />
                                                </div>

                                                {/* Line Total */}
                                                <div className="w-36 text-right font-mono font-black text-sm text-slate-800 dark:text-slate-200">
                                                    Rs. {((parseFloat(row.quantity) || 0) * (parseFloat(row.costRate) || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>

                                                {/* Remove button */}
                                                <button
                                                    type="button"
                                                    onClick={() => removeYarnRow(idx)}
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all shrink-0"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}

                                    <button
                                        type="button"
                                        onClick={addYarnRow}
                                        className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
                                    >
                                        <Plus size={16} />
                                        <span>+ Add Another Yarn Lot</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* GREY_TO_FINISH: Consumed Grey Fabric Input */
                            <div className="p-7 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-black text-base shadow-sm">
                                            <Package size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                Stage 2: Consumed Grey Fabric (In-Stock & Opening)
                                            </h3>
                                            <p className="text-xs sm:text-sm text-slate-400">Select available on-hand Grey fabric inventory from warehouse to be dyed.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                    <div className="sm:col-span-2 space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Grey Fabric *</label>
                                        <Combobox
                                            options={greyOptions}
                                            value={greyInputProductId}
                                            onChange={(val) => {
                                                setGreyInputProductId(val);
                                                const rateKey = `${val}-GREY-STD`;
                                                setGreyInputCostRate(stockRates[rateKey]?.rate ? stockRates[rateKey].rate.toFixed(2) : "0");
                                            }}
                                            placeholder="Select Grey Fabric from stock..."
                                            searchPlaceholder="Search grey fabric..."
                                            className="w-full text-sm font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Consumed Qty (KG) *</label>
                                        <input
                                            type="number"
                                            value={greyInputQty}
                                            onChange={(e) => setGreyInputQty(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-slate-900 dark:text-white text-right shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* RIGHT SIDEBAR: REALTIME COSTING & POST BUTTON (4 Cols) */}
                    <div className="xl:col-span-4 space-y-7">
                        
                        {/* Cost Breakdown Card */}
                        <div className="p-7 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl space-y-7 sticky top-6">
                            <div className="flex items-center justify-between pb-5 border-b border-slate-800">
                                <div className="flex items-center gap-2.5">
                                    <Calculator size={22} className="text-indigo-400" />
                                    <h3 className="text-base font-black uppercase tracking-wider">Batch Cost Summary</h3>
                                </div>
                                <span className="text-[11px] uppercase font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">Live Preview</span>
                            </div>

                            {/* Line by line breakdown */}
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between items-center py-1 border-b border-slate-800/60 pb-2">
                                    <span className="text-slate-400">1. Yarn Material Cost:</span>
                                    <span className="font-mono font-bold text-slate-100">
                                        Rs. {yarnCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {executionMode !== "GREY_TO_FINISH" && (
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800/60 pb-2">
                                        <span className="text-slate-400">2. {fabricProcessType} Cost:</span>
                                        <span className="font-mono font-bold text-slate-100">
                                            Rs. {fabricMakingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}

                                {processingServices.map((ps, idx) => {
                                    const svc = unconsumedServices.find(s => s.id === ps.serviceId);
                                    const name = ps.mode === "VENDOR_BILL" 
                                        ? (svc ? svc.productName : `Processing Service #${idx + 1}`)
                                        : (ps.manualName || `Processing Service #${idx + 1}`);
                                    const cost = (parseFloat(ps.qty) || 0) * (parseFloat(ps.rate) || 0);
                                    if (cost <= 0 && !ps.serviceId) return null;
                                    return (
                                        <div key={ps.id} className="flex justify-between items-center py-1 border-b border-slate-800/60 pb-2">
                                            <span className="text-slate-400 text-xs truncate max-w-[200px]">3.{idx + 1} {name}:</span>
                                            <span className="font-mono font-bold text-amber-400">
                                                Rs. {cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    );
                                })}

                                <div className="pt-2 flex justify-between items-center">
                                    <span className="font-bold text-slate-300">Total Batch Cost:</span>
                                    <span className="text-2xl font-black font-mono text-emerald-400">
                                        Rs. {totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {/* Per KG and Per Unit Costs */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                                        <span className="text-[11px] font-bold text-slate-400 block">Cost / KG:</span>
                                        <span className="text-base font-black font-mono text-amber-400">
                                            Rs. {costPerKg.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                                        <span className="text-[11px] font-bold text-slate-400 block">Cost / {outputUnitCode}:</span>
                                        <span className="text-base font-black font-mono text-emerald-400">
                                            Rs. {costPerUnit.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Backward Ratio Audit summary */}
                            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-300 space-y-1.5">
                                <div className="font-bold flex items-center gap-2 text-indigo-200">
                                    <ShieldCheck size={16} />
                                    <span>Export Ratio & Formula Audit:</span>
                                </div>
                                <div className="font-mono">Output: {outQtyNum.toLocaleString()} {outputUnitCode} (Net Weight: {effectiveNetWeightKg.toLocaleString()} KG)</div>
                                {processingServices.map((ps, idx) => {
                                    const svc = unconsumedServices.find(s => s.id === ps.serviceId);
                                    const name = ps.mode === "VENDOR_BILL" ? (svc ? svc.productName : `Processing #${idx + 1}`) : (ps.manualName || `Processing #${idx + 1}`);
                                    const q = parseFloat(ps.qty) || 0;
                                    return (
                                        <div key={ps.id} className="font-mono text-amber-300">
                                            {name}: {q.toLocaleString()} {ps.unit || "KG"} ({ps.wastage}% wastage)
                                        </div>
                                    );
                                })}
                                {executionMode !== "GREY_TO_FINISH" && (
                                    <>
                                        <div className="font-mono">Fabric ({fabricProcessType}): {reqWeavingQty.toLocaleString()} KG ({weavingWastage}% wastage)</div>
                                        <div className="font-mono">Yarn (Raw): {reqYarnQty.toLocaleString()} KG ({yarnWastage}% wastage)</div>
                                    </>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-black text-base rounded-2xl shadow-xl shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw size={18} className="animate-spin" />
                                            <span>Posting Batch...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            <span>Post Production Batch</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => router.push("/finance/production")}
                                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                            </div>

                        </div>

                    </div>

                </div>

            </div>

            {/* 1. YARN LOT SELECTION MODAL TABLE */}
            {isYarnModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                                    <Package size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                        Select Yarn Lot (Purchase Invoices & Opening Stock)
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Strictly filtered to raw yarn materials. Click &quot;Select Lot&quot; to allocate to batch row.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setIsYarnModalOpen(false); setActiveYarnRowIndex(null); }}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Filter and Search Bar */}
                        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="relative w-full sm:w-80">
                                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input
                                    type="text"
                                    value={yarnModalSearch}
                                    onChange={(e) => setYarnModalSearch(e.target.value)}
                                    placeholder="Search yarn name, count, invoice, lot..."
                                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                                {(["ALL", "LOCAL", "IMPORT_EFS", "IMPORT_COMMERCIAL", "OPENING"] as const).map(flt => (
                                    <button
                                        key={flt}
                                        type="button"
                                        onClick={() => setYarnModalFilter(flt)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                                            yarnModalFilter === flt
                                                ? "bg-indigo-600 text-white shadow-sm font-black"
                                                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        )}
                                    >
                                        {flt === "ALL" && "All Lots"}
                                        {flt === "LOCAL" && "Local Stock"}
                                        {flt === "IMPORT_EFS" && "Import EFS"}
                                        {flt === "IMPORT_COMMERCIAL" && "Commercial Import"}
                                        {flt === "OPENING" && "Opening Stock"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table Area */}
                        <div className="overflow-y-auto flex-1 p-4">
                            {filteredModalYarnLots.length === 0 ? (
                                <div className="text-center py-16 space-y-2">
                                    <Package size={36} className="mx-auto text-slate-400/50" />
                                    <p className="text-sm font-bold text-slate-500">No matching yarn lots found in stock.</p>
                                    <p className="text-xs text-slate-400">Ensure raw yarn purchases or opening stock have been entered.</p>
                                </div>
                            ) : (
                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-black uppercase tracking-wider">
                                            <tr>
                                                <th className="py-3 px-4">Yarn Product</th>
                                                <th className="py-3 px-3">Origin / Scheme</th>
                                                <th className="py-3 px-3">Reference / Source</th>
                                                <th className="py-3 px-3">Date</th>
                                                <th className="py-3 px-3 text-right">Available Qty</th>
                                                <th className="py-3 px-3 text-right">Rate (PKR)</th>
                                                <th className="py-3 px-3 text-right">Total Value</th>
                                                <th className="py-3 px-4 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                            {filteredModalYarnLots.map((lot, idx) => {
                                                const prod = products.find(p => p.id === lot.productId);
                                                const isEfs = Boolean(lot.isEFS || (lot.invoiceNo && lot.invoiceNo.includes("[EFS]")));
                                                const isImport = lot.origin === "IMPORT" || isEfs || (lot.invoiceNo && lot.invoiceNo.includes("[IMPORT]"));
                                                const totalVal = (Number(lot.qty) || 0) * (Number(lot.rate) || 0);

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                        <td className="py-3 px-4">
                                                            <div className="font-bold text-slate-900 dark:text-white">
                                                                {prod?.name || lot.productName || 'Yarn'}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-slate-400">
                                                                <span>{prod?.code || lot.productCode}</span>
                                                                {(prod?.hsCode || lot.hsCode) && (
                                                                    <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold">
                                                                        HS {prod?.hsCode || lot.hsCode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        <td className="py-3 px-3">
                                                            {!isImport ? (
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                                    Local
                                                                </span>
                                                            ) : isEfs ? (
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                                                    Import EFS
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                                                                    Import Non-EFS
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="py-3 px-3 font-mono">
                                                            <div className="font-bold text-slate-700 dark:text-slate-300">
                                                                {lot.isOpening ? '[Opening Stock]' : lot.invoiceNo}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                                                {lot.supplierName || (lot.isOpening ? 'Opening Balance' : 'Vendor Invoice')}
                                                            </div>
                                                        </td>

                                                        <td className="py-3 px-3 text-slate-500 font-mono">
                                                            {lot.date || '-'}
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                                                            {Number(lot.qty).toLocaleString()} <span className="text-[10px] text-slate-400">KG</span>
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                            Rs. {Number(lot.rate).toFixed(2)}
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-mono font-black text-slate-700 dark:text-slate-300">
                                                            Rs. {totalVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </td>

                                                        <td className="py-3 px-4 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectYarnLotFromModal(lot)}
                                                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
                                                            >
                                                                Select Lot
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-400">
                            <span>Showing {filteredModalYarnLots.length} lot(s)</span>
                            <button
                                type="button"
                                onClick={() => { setIsYarnModalOpen(false); setActiveYarnRowIndex(null); }}
                                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. SERVICE BILL SELECTION MODAL TABLE */}
            {isServiceModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                    <FileText size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                        Select Service / Process Bill (Dyeing, Printing, Weaving, Knitting)
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Choose available vendor service bill or opening service to offset conversion costs.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsServiceModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Filter and Search Bar */}
                        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="relative w-full sm:w-80">
                                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input
                                    type="text"
                                    value={serviceModalSearch}
                                    onChange={(e) => setServiceModalSearch(e.target.value)}
                                    placeholder="Search supplier, bill no, service name..."
                                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                                {(["ALL", "WEAVING", "KNITTING", "DYEING", "PRINTING", "OTHER"] as const).map(flt => (
                                    <button
                                        key={flt}
                                        type="button"
                                        onClick={() => setServiceModalTypeFilter(flt)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                                            serviceModalTypeFilter === flt
                                                ? "bg-amber-600 text-white shadow-sm font-black"
                                                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        )}
                                    >
                                        {flt === "ALL" && "All Bills"}
                                        {flt === "WEAVING" && "Weaving"}
                                        {flt === "KNITTING" && "Knitting"}
                                        {flt === "DYEING" && "Dyeing"}
                                        {flt === "PRINTING" && "Printing"}
                                        {flt === "OTHER" && "Other"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table Area */}
                        <div className="overflow-y-auto flex-1 p-4">
                            {filteredModalServices.length === 0 ? (
                                <div className="text-center py-16 space-y-2">
                                    <FileText size={36} className="mx-auto text-slate-400/50" />
                                    <p className="text-sm font-bold text-slate-500">No matching service bills found.</p>
                                    <p className="text-xs text-slate-400">Ensure service purchase invoices or opening services have been recorded.</p>
                                </div>
                            ) : (
                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-black uppercase tracking-wider">
                                            <tr>
                                                <th className="py-3 px-4">Vendor / Supplier</th>
                                                <th className="py-3 px-3">Bill / Invoice No</th>
                                                <th className="py-3 px-3">Service / Process</th>
                                                <th className="py-3 px-3">Type</th>
                                                <th className="py-3 px-3 text-right">Available Qty</th>
                                                <th className="py-3 px-3 text-right">Rate</th>
                                                <th className="py-3 px-3 text-right">Remaining Value</th>
                                                <th className="py-3 px-4 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                            {filteredModalServices.map((svc, idx) => {
                                                const remVal = (Number(svc.unconsumedQty) || 0) * (Number(svc.rate) || 0);

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                        <td className="py-3 px-4">
                                                            <div className="font-bold text-slate-900 dark:text-white">
                                                                {svc.supplierName}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {svc.isOpening ? 'Opening Service Lot' : 'Job Work Vendor'}
                                                            </div>
                                                        </td>

                                                        <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                            {svc.invoiceNo}
                                                            {svc.date && (
                                                                <div className="text-[10px] text-slate-400 font-normal">
                                                                    {new Date(svc.date).toISOString().split('T')[0]}
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="py-3 px-3">
                                                            <div className="font-bold text-slate-900 dark:text-white">
                                                                {svc.productName}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {svc.categoryName || 'Service'}
                                                            </div>
                                                        </td>

                                                        <td className="py-3 px-3">
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                                                                svc.serviceType === "WEAVING" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" :
                                                                svc.serviceType === "KNITTING" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" :
                                                                svc.serviceType === "DYEING" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" :
                                                                svc.serviceType === "PRINTING" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" :
                                                                "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                                                            )}>
                                                                {svc.serviceType}
                                                            </span>
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                            {Number(svc.unconsumedQty).toLocaleString()} <span className="text-[10px] text-slate-400">{svc.unit || 'KG'}</span>
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                            Rs. {Number(svc.rate).toFixed(2)}
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                                                            Rs. {remVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </td>

                                                        <td className="py-3 px-4 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectServiceFromModal(svc)}
                                                                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
                                                            >
                                                                Select Bill
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-400">
                            <span>Showing {filteredModalServices.length} bill(s)</span>
                            <button
                                type="button"
                                onClick={() => setIsServiceModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
