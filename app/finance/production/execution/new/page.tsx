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
    
    // 2. Output Details & Multi-UOM (Defaulted cleanly to empty / 0)
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [outputProductId, setOutputProductId] = useState("");
    const [outputUnitCode, setOutputUnitCode] = useState<string>("PCS");
    const [outputQuantity, setOutputQuantity] = useState<string>("");
    const [outputNetWeightKg, setOutputNetWeightKg] = useState<string>("");
    const [weightPerUnit, setWeightPerUnit] = useState<string>("");
    const [balesCount, setBalesCount] = useState<string>("");
    const [warehouseId, setWarehouseId] = useState("");
    const [lotNumber, setLotNumber] = useState<string>("");

    // 3. Stage 1: Wet Processing / Finishing Services (Empty by default)
    const [processingServices, setProcessingServices] = useState<ProcessingServiceItem[]>([]);

    const handleAddProcessingService = () => {
        setProcessingServices(prev => [
            ...prev,
            {
                id: String(Date.now()),
                serviceId: "",
                mode: "VENDOR_BILL",
                manualName: "Processing / Dyeing Service",
                wastage: 0,
                qty: effectiveNetWeightKg > 0 ? effectiveNetWeightKg.toString() : "",
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
                        updated.qty = effectiveNetWeightKg > 0 ? effectiveNetWeightKg.toString() : "";
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
    const [inHouseWeavingRate, setInHouseWeavingRate] = useState<string>("");
    const [outHouseFabricMode, setOutHouseFabricMode] = useState<"VENDOR_BILL" | "MANUAL">("VENDOR_BILL");
    const [selectedWeavingServiceId, setSelectedWeavingServiceId] = useState<string>("");
    const [weavingServiceQty, setWeavingServiceQty] = useState<string>("");
    const [outHouseFabricManualRate, setOutHouseFabricManualRate] = useState<string>("");

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
            .map(s => {
                const p = products.find(prod => prod.id === s.productId);
                const hs = s.hsCode || p?.hsCode;
                const hsTag = hs ? ` [HS: ${hs}]` : '';
                return {
                    value: s.id,
                    label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName}${hsTag} [${s.categoryName || 'Service'}] | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}`
                };
            });
    }, [unconsumedServices, products]);

    // Stage 2: Weaving only
    const weavingServiceOptions = useMemo(() => {
        return unconsumedServices
            .filter(s => s.serviceType === "WEAVING" || s.categoryName.toUpperCase().includes("WEAV") || s.productName.toUpperCase().includes("WEAV"))
            .map(s => {
                const p = products.find(prod => prod.id === s.productId);
                const hs = s.hsCode || p?.hsCode;
                const hsTag = hs ? ` [HS: ${hs}]` : '';
                return {
                    value: s.id,
                    label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName}${hsTag} | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}`
                };
            });
    }, [unconsumedServices, products]);

    // Stage 2: Knitting only
    const knittingServiceOptions = useMemo(() => {
        return unconsumedServices
            .filter(s => s.serviceType === "KNITTING" || s.categoryName.toUpperCase().includes("KNIT") || s.productName.toUpperCase().includes("KNIT"))
            .map(s => {
                const p = products.find(prod => prod.id === s.productId);
                const hs = s.hsCode || p?.hsCode;
                const hsTag = hs ? ` [HS: ${hs}]` : '';
                return {
                    value: s.id,
                    label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName}${hsTag} | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}`
                };
            });
    }, [unconsumedServices, products]);

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
                if (!p.qty || p.qty === "0") {
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
            const prod = products.find(p => p.id === svc.productId);
            const hs = (svc.hsCode || prod?.hsCode || '').toLowerCase();

            if (search) {
                const supp = (svc.supplierName || '').toLowerCase();
                const inv = (svc.invoiceNo || '').toLowerCase();
                const pName = (svc.productName || '').toLowerCase();
                const pCode = (svc.productCode || prod?.code || '').toLowerCase();
                const cat = (svc.categoryName || '').toLowerCase();
                if (!supp.includes(search) && !inv.includes(search) && !pName.includes(search) && !pCode.includes(search) && !cat.includes(search) && !hs.includes(search)) {
                    return false;
                }
            }

            if (serviceModalTypeFilter !== "ALL") {
                if (svc.serviceType !== serviceModalTypeFilter) {
                    const cat = (svc.categoryName || '').toUpperCase();
                    const pName = (svc.productName || '').toUpperCase();
                    if (serviceModalTypeFilter === "WEAVING" && !cat.includes("WEAV") && !pName.includes("WEAV")) return false;
                    if (serviceModalTypeFilter === "KNITTING" && !cat.includes("KNIT") && !pName.includes("KNIT")) return false;
                    if (serviceModalTypeFilter === "DYEING" && !cat.includes("DYE") && !pName.includes("DYE")) return false;
                    if (serviceModalTypeFilter === "PRINTING" && !cat.includes("PRINT") && !pName.includes("PRINT")) return false;
                }
            }

            return true;
        });
    }, [unconsumedServices, products, serviceModalSearch, serviceModalTypeFilter]);

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
            <div className="w-full max-w-7xl mx-auto space-y-6 px-3 sm:px-6 pb-32 animate-in fade-in duration-300">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
                                <Factory size={13} /> Production Execution
                            </span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Production Execution Entry
                        </h1>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                            Record batch production, allocate raw yarn from warehouse lots, and link job-work service bills.
                        </p>
                    </div>

                    {/* Mode Selector Tabs */}
                    <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shrink-0 gap-1 text-xs font-bold self-start md:self-auto">
                        <button
                            type="button"
                            onClick={() => setExecutionMode("DIRECT_FINISH")}
                            className={cn(
                                "px-3.5 py-2 rounded-lg transition-all",
                                executionMode === "DIRECT_FINISH" 
                                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-black" 
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            )}
                        >
                            1. Direct to Finish
                        </button>
                        <button
                            type="button"
                            onClick={() => setExecutionMode("YARN_TO_GREY")}
                            className={cn(
                                "px-3.5 py-2 rounded-lg transition-all",
                                executionMode === "YARN_TO_GREY" 
                                    ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm font-black" 
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            )}
                        >
                            2. Grey Fabric Only
                        </button>
                        <button
                            type="button"
                            onClick={() => setExecutionMode("GREY_TO_FINISH")}
                            className={cn(
                                "px-3.5 py-2 rounded-lg transition-all",
                                executionMode === "GREY_TO_FINISH" 
                                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-black" 
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            )}
                        >
                            3. Grey to Finish
                        </button>
                    </div>
                </div>

                {/* Main 2-Column Content Layout */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT CANVAS: PRODUCTION STAGES (8 Cols) */}
                    <div className="xl:col-span-8 space-y-6">
                        
                        {/* SECTION 1: TARGET OUTPUT PRODUCT & QUANTITIES */}
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                                        1
                                    </div>
                                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                        {executionMode === "YARN_TO_GREY" ? "Target Output: Grey Fabric (WIP)" : "Target Output: Finished Goods"}
                                    </h2>
                                </div>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    Stage: {executionMode === "YARN_TO_GREY" ? "GREY" : "FINISH"}
                                </span>
                            </div>

                            {/* Row 1: Product, Warehouse, Date */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-6 space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Manufactured Item *
                                    </label>
                                    <Combobox
                                        options={outputOptions}
                                        value={outputProductId}
                                        onChange={(val) => setOutputProductId(val)}
                                        placeholder="Select manufactured product..."
                                        searchPlaceholder="Search product code or name..."
                                        className="w-full text-sm font-semibold"
                                    />
                                </div>

                                <div className="md:col-span-3 space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Warehouse *
                                    </label>
                                    <select
                                        value={warehouseId}
                                        onChange={(e) => setWarehouseId(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 h-[42px]"
                                    >
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-3 space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 h-[42px]"
                                    />
                                </div>
                            </div>

                            {/* Row 2: UOM, Quantities, Lot & Bales */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
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
                                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 h-[38px]"
                                    >
                                        <option value="PCS">PCS (Pieces)</option>
                                        <option value="MTR">MTR (Meters)</option>
                                        <option value="KG">KG (Kilograms)</option>
                                        <option value="YD">YD (Yards)</option>
                                        <option value="LBS">LBS (Pounds)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                        Ready Qty ({outputUnitCode}) *
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="0.00"
                                        value={outputQuantity}
                                        onChange={(e) => handleOutputQtyChange(e.target.value)}
                                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 text-right outline-none focus:ring-1 focus:ring-indigo-500 h-[38px]"
                                    />
                                </div>

                                {outputUnitCode !== "KG" ? (
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                            Wt / {outputUnitCode} (KG)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            placeholder="0.000"
                                            value={weightPerUnit}
                                            onChange={(e) => handleWeightPerUnitChange(e.target.value)}
                                            className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-indigo-500 h-[38px]"
                                        />
                                    </div>
                                ) : null}

                                <div className={outputUnitCode === "KG" ? "col-span-2" : ""}>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                                        Total Weight (KG) *
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="0.00"
                                        value={outputNetWeightKg}
                                        onChange={(e) => handleNetWeightChange(e.target.value)}
                                        className="w-full px-2.5 py-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 text-right outline-none focus:ring-1 focus:ring-emerald-500 h-[38px]"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                        Batch / Lot #
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Optional"
                                        value={lotNumber}
                                        onChange={(e) => setLotNumber(e.target.value)}
                                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 h-[38px]"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                        Bales / Packages
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Optional"
                                        value={balesCount}
                                        onChange={(e) => setBalesCount(e.target.value)}
                                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 h-[38px]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: WET PROCESSING & FINISHING SERVICES */}
                        {executionMode !== "YARN_TO_GREY" && (
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                                            2
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                                Wet Processing Services (Dyeing / Printing)
                                            </h2>
                                            <p className="text-[11px] text-slate-400">Attach vendor conversion bills or record in-house processing charges.</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddProcessingService}
                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                                    >
                                        <Plus size={14} /> Add Service
                                    </button>
                                </div>

                                {processingServices.length === 0 ? (
                                    <div className="py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                        <p className="text-xs font-semibold text-slate-500">No processing services attached.</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Add Service&quot; if this batch consumes dyeing, printing, or finishing bills.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {processingServices.map((ps, index) => {
                                            const lineCost = (parseFloat(ps.qty) || 0) * (parseFloat(ps.rate) || 0);
                                            return (
                                                <div key={ps.id} className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                            Service #{index + 1}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProcessingServiceChange(ps.id, "mode", "VENDOR_BILL")}
                                                                    className={cn("px-2 py-0.5 rounded transition-all", ps.mode === "VENDOR_BILL" ? "bg-amber-600 text-white font-black" : "text-slate-500")}
                                                                >
                                                                    Vendor Bill
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProcessingServiceChange(ps.id, "mode", "MANUAL")}
                                                                    className={cn("px-2 py-0.5 rounded transition-all", ps.mode === "MANUAL" ? "bg-amber-600 text-white font-black" : "text-slate-500")}
                                                                >
                                                                    Manual Rate
                                                                </button>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveProcessingService(ps.id)}
                                                                className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {ps.mode === "VENDOR_BILL" ? (
                                                        <div className="space-y-1.5">
                                                            <div className="flex flex-col sm:flex-row gap-2">
                                                                <div className="flex-1">
                                                                    <Combobox
                                                                        options={processingServiceOptions}
                                                                        value={ps.serviceId}
                                                                        onChange={(val) => handleProcessingServiceChange(ps.id, "serviceId", val)}
                                                                        placeholder="Select Vendor Service Bill..."
                                                                        searchPlaceholder="Search supplier or bill..."
                                                                        className="w-full text-xs font-bold"
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
                                                                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1 shrink-0"
                                                                >
                                                                    <Search size={13} /> Browse Bills
                                                                </button>
                                                            </div>
                                                            {ps.serviceId && (() => {
                                                                const s = unconsumedServices.find(item => item.id === ps.serviceId);
                                                                const prod = products.find(p => p.id === s?.productId);
                                                                const hs = s?.hsCode || prod?.hsCode;
                                                                if (!s) return null;
                                                                return (
                                                                    <div className="flex flex-wrap items-center gap-2 px-2.5 py-1 bg-amber-500/5 dark:bg-amber-950/20 rounded-lg border border-amber-500/15 text-[11px]">
                                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{s.supplierName}</span>
                                                                        <span className="text-slate-400 font-mono">({s.invoiceNo})</span>
                                                                        {hs && (
                                                                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono font-bold text-[10px]">
                                                                                HS {hs}
                                                                            </span>
                                                                        )}
                                                                        <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                                                                            Avail: {Number(s.unconsumedQty).toLocaleString()} {s.unit}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            placeholder="Service Description (e.g. Dyeing Service)"
                                                            value={ps.manualName}
                                                            onChange={(e) => handleProcessingServiceChange(ps.id, "manualName", e.target.value)}
                                                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                                                        />
                                                    )}

                                                    <div className="grid grid-cols-4 gap-2 pt-1">
                                                        <div>
                                                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Wastage %</label>
                                                            <input
                                                                type="number"
                                                                placeholder="0"
                                                                value={ps.wastage || ""}
                                                                onChange={(e) => handleProcessingServiceChange(ps.id, "wastage", parseFloat(e.target.value) || 0)}
                                                                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-right"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Billing Qty ({ps.unit || 'KG'})</label>
                                                            <input
                                                                type="number"
                                                                placeholder="0.00"
                                                                value={ps.qty}
                                                                onChange={(e) => handleProcessingServiceChange(ps.id, "qty", e.target.value)}
                                                                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-right"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Rate (PKR)</label>
                                                            <input
                                                                type="number"
                                                                placeholder="0.00"
                                                                value={ps.rate}
                                                                onChange={(e) => handleProcessingServiceChange(ps.id, "rate", e.target.value)}
                                                                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-right"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Line Total</label>
                                                            <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono font-black text-amber-600 dark:text-amber-400 text-right">
                                                                Rs. {lineCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECTION 3: FABRIC MANUFACTURING (WEAVING / KNITTING) */}
                        {executionMode !== "GREY_TO_FINISH" && (
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                                            3
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                                Fabric Manufacturing ({fabricProcessType})
                                            </h2>
                                            <p className="text-[11px] text-slate-400">Choose process and execution mode (In-House vs Outsourced vendor bill).</p>
                                        </div>
                                    </div>

                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                                        <button
                                            type="button"
                                            onClick={() => { setFabricProcessType("WEAVING"); setSelectedWeavingServiceId(""); }}
                                            className={cn("px-3 py-1 rounded-lg transition-all", fabricProcessType === "WEAVING" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500")}
                                        >
                                            Weaving
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setFabricProcessType("KNITTING"); setSelectedWeavingServiceId(""); }}
                                            className={cn("px-3 py-1 rounded-lg transition-all", fabricProcessType === "KNITTING" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-500")}
                                        >
                                            Knitting
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                            Execution Mode
                                        </label>
                                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl">
                                            <button
                                                type="button"
                                                onClick={() => setWeavingMode("IN_HOUSE")}
                                                className={cn("py-1.5 text-xs font-bold rounded-lg transition-all", weavingMode === "IN_HOUSE" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-black" : "text-slate-500")}
                                            >
                                                In-House
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWeavingMode("OUT_HOUSE")}
                                                className={cn("py-1.5 text-xs font-bold rounded-lg transition-all", weavingMode === "OUT_HOUSE" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-black" : "text-slate-500")}
                                            >
                                                Out-House
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                            Fabric Wastage %
                                        </label>
                                        <input
                                            type="number"
                                            value={weavingWastage}
                                            onChange={(e) => setWeavingWastage(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-indigo-500 h-[38px]"
                                        />
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex flex-col justify-center">
                                        <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block">Required Grey Fabric</span>
                                        <span className="text-base font-black font-mono text-blue-700 dark:text-blue-300">
                                            {reqWeavingQty.toLocaleString()} KG
                                        </span>
                                    </div>
                                </div>

                                {/* If Out-House */}
                                {weavingMode === "OUT_HOUSE" && (
                                    <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <div className="flex-1">
                                                <Combobox
                                                    options={fabricProcessType === "WEAVING" ? weavingServiceOptions : knittingServiceOptions}
                                                    value={selectedWeavingServiceId}
                                                    onChange={(val) => {
                                                        setSelectedWeavingServiceId(val);
                                                        const svc = unconsumedServices.find(s => s.id === val);
                                                        if (svc) setWeavingServiceQty(Math.min(svc.unconsumedQty, reqWeavingQty).toString());
                                                    }}
                                                    placeholder={`Select ${fabricProcessType} Vendor Bill...`}
                                                    className="w-full text-xs font-bold"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setServiceModalTarget("WEAVING_KNITTING");
                                                    setServiceModalTypeFilter(fabricProcessType);
                                                    setServiceModalSearch("");
                                                    setIsServiceModalOpen(true);
                                                }}
                                                className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1 shrink-0"
                                            >
                                                <Search size={13} /> Browse Bills
                                            </button>
                                        </div>
                                        {selectedWeavingServiceId && (() => {
                                            const s = unconsumedServices.find(item => item.id === selectedWeavingServiceId);
                                            const prod = products.find(p => p.id === s?.productId);
                                            const hs = s?.hsCode || prod?.hsCode;
                                            if (!s) return null;
                                            return (
                                                <div className="flex flex-wrap items-center gap-2 px-2.5 py-1 bg-blue-500/5 dark:bg-blue-950/20 rounded-lg border border-blue-500/15 text-[11px]">
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{s.supplierName}</span>
                                                    <span className="text-slate-400 font-mono">({s.invoiceNo})</span>
                                                    {hs && (
                                                        <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono font-bold text-[10px]">
                                                            HS {hs}
                                                        </span>
                                                    )}
                                                    <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                                                        Avail: {Number(s.unconsumedQty).toLocaleString()} {s.unit}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* If In-House */}
                                {weavingMode === "IN_HOUSE" && (
                                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                                In-House Rate (Rs. / KG)
                                            </label>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={inHouseWeavingRate}
                                                onChange={(e) => setInHouseWeavingRate(e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-indigo-500 h-[38px]"
                                            />
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Fabric Making Cost</span>
                                            <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                                                Rs. {fabricMakingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECTION 4: RAW YARN ALLOCATION */}
                        {executionMode !== "GREY_TO_FINISH" ? (
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                                            4
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                                Raw Yarn Consumption (Physical Stock)
                                            </h2>
                                            <p className="text-[11px] text-slate-400">Allocate raw yarn from warehouse lots or opening inventory.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Yarn Wastage %:</label>
                                            <input
                                                type="number"
                                                value={yarnWastage}
                                                onChange={(e) => setYarnWastage(parseFloat(e.target.value) || 0)}
                                                className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-right"
                                            />
                                        </div>
                                        <div className={cn(
                                            "px-3 py-1 rounded-xl text-xs font-black font-mono border",
                                            isYarnCovered 
                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                        )}>
                                            {isYarnCovered ? "Covered ✓" : `Short: ${yarnShortfall.toLocaleString()} KG`}
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Yarn Rows */}
                                <div className="space-y-2.5">
                                    {yarnInputs.map((row, idx) => {
                                        const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.costRate) || 0);
                                        return (
                                            <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5 sm:items-center">
                                                <div className="flex-1 flex gap-2 items-center">
                                                    <div className="flex-1">
                                                        <Combobox
                                                            options={yarnOptions}
                                                            value={row.purchaseInvoiceItemId ? `LOT|${row.purchaseInvoiceItemId}|${row.productId}|${row.costRate}|${row.isEFS}|${row.lotNumber}` : (row.productId ? `PROD|${row.productId}|${row.isEFS}` : "")}
                                                            onChange={(val) => handleYarnProductChange(idx, val)}
                                                            placeholder="Select Yarn Lot or Item..."
                                                            className="w-full text-xs font-bold"
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
                                                        className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1 shrink-0"
                                                    >
                                                        <Search size={13} /> Browse Lots
                                                    </button>
                                                </div>

                                                <div className="w-full sm:w-32">
                                                    <input
                                                        type="number"
                                                        placeholder="0.00 KG"
                                                        value={row.quantity}
                                                        onChange={(e) => {
                                                            const next = [...yarnInputs];
                                                            next[idx].quantity = e.target.value;
                                                            setYarnInputs(next);
                                                        }}
                                                        className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-right"
                                                    />
                                                </div>

                                                <div className="w-full sm:w-28">
                                                    <input
                                                        type="number"
                                                        placeholder="Rate"
                                                        value={row.costRate}
                                                        onChange={(e) => {
                                                            const next = [...yarnInputs];
                                                            next[idx].costRate = e.target.value;
                                                            setYarnInputs(next);
                                                        }}
                                                        className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-right"
                                                    />
                                                </div>

                                                <div className="w-full sm:w-28 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                    Rs. {rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => removeYarnRow(idx)}
                                                    disabled={yarnInputs.length <= 1}
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    onClick={addYarnRow}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                                >
                                    <Plus size={14} /> Add Yarn Row
                                </button>
                            </div>
                        ) : (
                            /* SECTION 4 ALT: GREY FABRIC INPUT (MODE 3) */
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                                        4
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                            Grey Fabric Input (Direct Thaan)
                                        </h2>
                                        <p className="text-[11px] text-slate-400">Select consumed grey fabric from warehouse inventory.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-1 space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 block">Grey Fabric Item *</label>
                                        <Combobox
                                            options={greyOptions}
                                            value={greyInputProductId}
                                            onChange={(val) => {
                                                setGreyInputProductId(val);
                                                const rateKey = `${val}-GREY-STD`;
                                                const matched = stockRates[rateKey];
                                                if (matched) setGreyInputCostRate(matched.rate.toFixed(2));
                                            }}
                                            placeholder="Select Grey Fabric..."
                                            className="w-full text-xs font-bold"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 block">Quantity (KG) *</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={greyInputQty}
                                            onChange={(e) => setGreyInputQty(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-right"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 block">Cost Rate (PKR)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={greyInputCostRate}
                                            onChange={(e) => setGreyInputCostRate(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-right"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDEBAR: REALTIME COSTING & POST BUTTON (4 Cols) */}
                    <div className="xl:col-span-4 space-y-6">
                        <div className="p-6 bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-xl space-y-5 sticky top-6">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                <div className="flex items-center gap-2">
                                    <Calculator size={18} className="text-indigo-400" />
                                    <h3 className="text-sm font-black uppercase tracking-wider">Batch Cost Summary</h3>
                                </div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">Live Preview</span>
                            </div>

                            <div className="space-y-2.5 text-xs">
                                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                                    <span className="text-slate-400">1. Yarn Cost:</span>
                                    <span className="font-mono font-bold text-slate-200">
                                        Rs. {yarnCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {executionMode !== "GREY_TO_FINISH" && (
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                                        <span className="text-slate-400">2. {fabricProcessType} Cost:</span>
                                        <span className="font-mono font-bold text-slate-200">
                                            Rs. {fabricMakingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                                    <span className="text-slate-400">3. Processing Cost:</span>
                                    <span className="font-mono font-bold text-amber-400">
                                        Rs. {processingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div className="pt-2 flex justify-between items-center">
                                    <span className="font-bold text-slate-300">Total Batch Cost:</span>
                                    <span className="text-xl font-black font-mono text-emerald-400">
                                        Rs. {totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                                        <span className="text-[10px] text-slate-400 block">Cost / KG:</span>
                                        <span className="text-sm font-black font-mono text-amber-400">
                                            Rs. {costPerKg.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                                        <span className="text-[10px] text-slate-400 block">Cost / {outputUnitCode}:</span>
                                        <span className="text-sm font-black font-mono text-emerald-400">
                                            Rs. {costPerUnit.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Posting Batch...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            <span>Post Production Execution</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => router.push("/finance/production")}
                                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs rounded-xl transition-colors"
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
                                    placeholder="Search supplier, bill #, HS Code, product name..."
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
                                                <th className="py-3 px-3">HS Code</th>
                                                <th className="py-3 px-3">Type</th>
                                                <th className="py-3 px-3 text-right">Available Qty</th>
                                                <th className="py-3 px-3 text-right">Rate</th>
                                                <th className="py-3 px-3 text-right">Remaining Value</th>
                                                <th className="py-3 px-4 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                            {filteredModalServices.map((svc, idx) => {
                                                const prod = products.find(p => p.id === svc.productId);
                                                const hsCode = svc.hsCode || prod?.hsCode;
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
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                                                                <span>{svc.productCode || prod?.code || ''}</span>
                                                                {svc.categoryName && <span>• {svc.categoryName}</span>}
                                                            </div>
                                                        </td>

                                                        <td className="py-3 px-3">
                                                            {hsCode ? (
                                                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono font-bold text-xs inline-flex items-center gap-1">
                                                                    <span className="text-[10px] font-black opacity-75">HS</span>
                                                                    {hsCode}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] text-slate-400 font-mono italic">-</span>
                                                            )}
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
