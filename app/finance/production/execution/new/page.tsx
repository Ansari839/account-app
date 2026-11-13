"use client";

import React, { useState, useEffect, useMemo } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import {
    Loader2, Save, Layers, Package, Factory, Scissors, CheckCircle2,
    Calculator, Droplets, Box, AlertTriangle, ArrowRight, Plus, Trash2,
    Calendar, Warehouse, FileText, Check, ShieldCheck, ShoppingCart, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import Combobox from "@/components/Combobox";

type ExecutionMode = "DIRECT_FINISH" | "YARN_TO_GREY" | "GREY_TO_FINISH";

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

    // 1. Target Production Mode (Full Flexibility)
    const [executionMode, setExecutionMode] = useState<ExecutionMode>("DIRECT_FINISH");
    
    // 2. Output Details
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [outputProductId, setOutputProductId] = useState("");
    const [outputQuantity, setOutputQuantity] = useState<string>("61004");
    const [warehouseId, setWarehouseId] = useState("");
    const [lotNumber, setLotNumber] = useState("");

    // 3. Stage 1: Dyeing / Printing
    const [dyeingWastage, setDyeingWastage] = useState<number>(0);
    const [selectedDyeingServiceId, setSelectedDyeingServiceId] = useState<string>("");
    const [dyeingServiceQty, setDyeingServiceQty] = useState<string>("");
    const [dyeingManualRate, setDyeingManualRate] = useState<string>("380");
    const [dyeingMode, setDyeingMode] = useState<"VENDOR_BILL" | "MANUAL" | "BYPASS">("VENDOR_BILL");

    // 4. Stage 2: Weaving / Knitting
    const [weavingWastage, setWeavingWastage] = useState<number>(4.0);
    const [weavingMode, setWeavingMode] = useState<"IN_HOUSE" | "OUT_HOUSE">("IN_HOUSE");
    const [inHouseWeavingRate, setInHouseWeavingRate] = useState<string>("10");
    const [selectedWeavingServiceId, setSelectedWeavingServiceId] = useState<string>("");
    const [weavingServiceQty, setWeavingServiceQty] = useState<string>("");

    // 5. Stage 3: Yarn Consumption
    const [yarnWastage, setYarnWastage] = useState<number>(4.0);
    const [yarnInputs, setYarnInputs] = useState<Array<{
        productId: string;
        isEFS: boolean;
        quantity: string;
        costRate: string;
        lotNumber: string;
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
        // Strictly only show items marked as isManufactured: true
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

    const yarnProductList = useMemo(() => {
        return products.filter(p => p.stage === "RAW" || p.hsCode?.startsWith("54") || p.hsCode?.startsWith("55") || p.name.toUpperCase().includes("DEN") || p.name.toUpperCase().includes("YARN"));
    }, [products]);

    const yarnOptions = useMemo(() => {
        const opts: { value: string; label: string }[] = [];
        for (const p of yarnProductList) {
            const stdKey = `${p.id}-RAW-STD`;
            const efsKey = `${p.id}-RAW-EFS`;
            const stdStock = stockRates[stdKey]?.qty || 0;
            const efsStock = stockRates[efsKey]?.qty || 0;

            if (stdStock > 0) {
                opts.push({
                    value: `${p.id}|false`,
                    label: `${p.code} - ${p.name} [Non-EFS] (Stock: ${stdStock.toLocaleString()} KG)`
                });
            }
            if (efsStock > 0) {
                opts.push({
                    value: `${p.id}|true`,
                    label: `${p.code} - ${p.name} [EFS Duty-Free] (Stock: ${efsStock.toLocaleString()} KG)`
                });
            }
            if (stdStock <= 0 && efsStock <= 0) {
                opts.push({
                    value: `${p.id}|false`,
                    label: `${p.code} - ${p.name} (0 KG in Stock)`
                });
            }
        }
        return opts;
    }, [yarnProductList, stockRates]);

    const greyProductList = useMemo(() => {
        return products.filter(p => p.stage === "GREY" || p.name.toUpperCase().includes("GREY") || p.hsCode?.startsWith("60"));
    }, [products]);

    const greyOptions = useMemo(() => {
        return greyProductList.map(p => ({
            value: p.id,
            label: `${p.code} - ${p.name} ${p.hsCode ? `[HS ${p.hsCode}]` : ''}`
        }));
    }, [greyProductList]);

    const dyeingServiceOptions = useMemo(() => {
        return unconsumedServices.map(s => ({
            value: s.id,
            label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName} | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}/KG`
        }));
    }, [unconsumedServices]);

    // Calculate Quantities Backwards (Like Excel)
    const outQty = parseFloat(outputQuantity) || 0;

    // Stage 1 Dyeing Quantity
    const reqDyeingQty = useMemo(() => {
        if (executionMode === "YARN_TO_GREY") return 0;
        return dyeingWastage > 0 
            ? Math.round((outQty / ((100 - dyeingWastage) / 100)) * 100) / 100 
            : outQty;
    }, [outQty, dyeingWastage, executionMode]);

    // Stage 2 Weaving Quantity
    const reqWeavingQty = useMemo(() => {
        if (executionMode === "GREY_TO_FINISH") return 0;
        const base = executionMode === "DIRECT_FINISH" ? reqDyeingQty : outQty;
        return weavingWastage > 0 
            ? Math.round((base / ((100 - weavingWastage) / 100)) * 100) / 100 
            : base;
    }, [outQty, reqDyeingQty, weavingWastage, executionMode]);

    // Stage 3 Yarn Quantity
    const reqYarnQty = useMemo(() => {
        if (executionMode === "GREY_TO_FINISH") return 0;
        return yarnWastage > 0 
            ? Math.round((reqWeavingQty / ((100 - yarnWastage) / 100)) * 100) / 100 
            : reqWeavingQty;
    }, [reqWeavingQty, yarnWastage, executionMode]);

    // Sync dyeing input qty default
    useEffect(() => {
        if (reqDyeingQty > 0 && !dyeingServiceQty) {
            setDyeingServiceQty(reqDyeingQty.toString());
        }
    }, [reqDyeingQty]);

    // Sync weaving service qty default
    useEffect(() => {
        if (reqWeavingQty > 0 && !weavingServiceQty) {
            setWeavingServiceQty(reqWeavingQty.toString());
        }
    }, [reqWeavingQty]);

    // Sync grey input qty for GREY_TO_FINISH
    useEffect(() => {
        if (executionMode === "GREY_TO_FINISH" && outQty > 0 && !greyInputQty) {
            setGreyInputQty(outQty.toString());
        }
    }, [executionMode, outQty]);

    // Yarn Inputs Handlers
    const handleYarnProductChange = (index: number, val: string) => {
        const next = [...yarnInputs];
        if (!val) {
            next[index] = { productId: "", isEFS: false, quantity: "", costRate: "0", lotNumber: "" };
            setYarnInputs(next);
            return;
        }

        const [pid, isEFSStr] = val.split('|');
        const isEFS = isEFSStr === 'true';
        next[index].productId = pid;
        next[index].isEFS = isEFS;

        const rateKey = `${pid}-RAW-${isEFS ? 'EFS' : 'STD'}`;
        const fallbackKey = `${pid}-RAW-STD`;
        const matched = stockRates[rateKey] || stockRates[fallbackKey];
        next[index].costRate = matched?.rate ? matched.rate.toFixed(2) : "0";
        setYarnInputs(next);
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

    const weavingCostTotal = useMemo(() => {
        if (executionMode === "GREY_TO_FINISH") return 0;
        if (weavingMode === "IN_HOUSE") {
            return reqWeavingQty * (parseFloat(inHouseWeavingRate) || 0);
        } else {
            const svc = unconsumedServices.find(s => s.id === selectedWeavingServiceId);
            return svc ? (parseFloat(weavingServiceQty) || 0) * svc.rate : 0;
        }
    }, [executionMode, weavingMode, reqWeavingQty, inHouseWeavingRate, selectedWeavingServiceId, weavingServiceQty, unconsumedServices]);

    const dyeingCostTotal = useMemo(() => {
        if (executionMode === "YARN_TO_GREY" || dyeingMode === "BYPASS") return 0;
        if (dyeingMode === "VENDOR_BILL") {
            const svc = unconsumedServices.find(s => s.id === selectedDyeingServiceId);
            return svc ? (parseFloat(dyeingServiceQty) || 0) * svc.rate : 0;
        } else {
            return reqDyeingQty * (parseFloat(dyeingManualRate) || 0);
        }
    }, [executionMode, dyeingMode, reqDyeingQty, dyeingManualRate, selectedDyeingServiceId, dyeingServiceQty, unconsumedServices]);

    const totalBatchCost = yarnCostTotal + weavingCostTotal + dyeingCostTotal;
    const costPerKg = outQty > 0 ? totalBatchCost / outQty : 0;

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

        // 1. Weaving Overhead
        if (executionMode !== "GREY_TO_FINISH") {
            if (weavingMode === "IN_HOUSE") {
                const amt = reqWeavingQty * (parseFloat(inHouseWeavingRate) || 0);
                if (amt > 0) {
                    finalOverheads.push({
                        description: `In-house Weaving Overhead (@ Rs. ${inHouseWeavingRate}/KG)`,
                        amount: amt,
                        quantity: reqWeavingQty
                    });
                }
            } else if (selectedWeavingServiceId) {
                finalOverheads.push({
                    purchaseInvoiceItemId: selectedWeavingServiceId,
                    quantity: parseFloat(weavingServiceQty) || reqWeavingQty
                });
            }
        }

        // 2. Dyeing Overhead
        if (executionMode !== "YARN_TO_GREY" && dyeingMode !== "BYPASS") {
            if (dyeingMode === "VENDOR_BILL" && selectedDyeingServiceId) {
                finalOverheads.push({
                    purchaseInvoiceItemId: selectedDyeingServiceId,
                    quantity: parseFloat(dyeingServiceQty) || reqDyeingQty
                });
            } else if (dyeingMode === "MANUAL") {
                const amt = reqDyeingQty * (parseFloat(dyeingManualRate) || 0);
                if (amt > 0) {
                    finalOverheads.push({
                        description: `Dyeing Service Overhead (@ Rs. ${dyeingManualRate}/KG)`,
                        amount: amt,
                        quantity: reqDyeingQty
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
            stage: "RAW",
            isEFS: y.isEFS
        }));

        const processStage = executionMode === "YARN_TO_GREY" ? "GREY" : "FINISH";

        const payload = {
            date,
            outputProductId,
            outputQuantity: parseFloat(outputQuantity),
            processStage,
            warehouseId,
            mode: (weavingMode === "OUT_HOUSE" || dyeingMode === "VENDOR_BILL") ? "OUT-HOUSE" : "IN-HOUSE",
            lotNumber: lotNumber || null,
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
            <div className="max-w-[90rem] mx-auto space-y-6 pb-32 animate-in fade-in duration-300">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
                            <Factory size={16} />
                            <span>Batch Production Execution</span>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Flexible Production Flow</h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Output ready qty batayein, backward stages (Dyeing $\rightarrow$ Weaving $\rightarrow$ Yarn) auto-calc honge.
                        </p>
                    </div>

                    {/* Mode Selector Tabs (Full Flexibility) */}
                    <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
                        <button
                            type="button"
                            onClick={() => setExecutionMode("DIRECT_FINISH")}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                                executionMode === "DIRECT_FINISH" 
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" 
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <span>1. Direct to Finish</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-200">Full</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setExecutionMode("YARN_TO_GREY")}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                                executionMode === "YARN_TO_GREY" 
                                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30" 
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <span>2. Grey Fabric Only</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200">Grey</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setExecutionMode("GREY_TO_FINISH")}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                                executionMode === "GREY_TO_FINISH" 
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30" 
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <span>3. Grey to Finish</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-200">Dye Only</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* LEFT & CENTER: Step-by-Step Production Canvas (2 Cols) */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* STEP 1: OUTPUT READY PRODUCT CARD */}
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-sm">
                                        1
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                            {executionMode === "YARN_TO_GREY" ? "Target Output: Grey Fabric (WIP)" : "Target Output: Finished Goods (Export Item)"}
                                        </h3>
                                        <p className="text-xs text-slate-400">Kitna maal ready hua aur kis warehouse me jayega.</p>
                                    </div>
                                </div>
                                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    Stage: {executionMode === "YARN_TO_GREY" ? "GREY" : "FINISH"}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {/* Output Product (Only Manufactured Goods) */}
                                <div className="sm:col-span-2 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Manufactured Output Product *</label>
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.2 rounded-full">
                                            {outputOptions.length} manufactured items
                                        </span>
                                    </div>
                                    <Combobox
                                        options={outputOptions}
                                        value={outputProductId}
                                        onChange={(val) => setOutputProductId(val)}
                                        placeholder="Search or select manufactured product..."
                                        searchPlaceholder="Type name, code, or HS code..."
                                        className="w-full text-xs font-bold"
                                    />
                                </div>

                                {/* Ready Output Qty */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Ready Qty (KG) *</label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={outputQuantity}
                                        onChange={(e) => setOutputQuantity(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 text-right"
                                    />
                                </div>

                                {/* Warehouse */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Destination Warehouse *</label>
                                    <select
                                        value={warehouseId}
                                        onChange={(e) => setWarehouseId(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Production Date</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
                                    />
                                </div>

                                {/* Lot / Batch # */}
                                <div className="sm:col-span-3 space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Batch / Lot Reference (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. EXPORT-LOT-5336 / BATCH-01"
                                        value={lotNumber}
                                        onChange={(e) => setLotNumber(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* STAGE 1: PRINTING / DYEING (Only if DIRECT_FINISH or GREY_TO_FINISH) */}
                        {executionMode !== "YARN_TO_GREY" && (
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-sm">
                                            <Droplets size={16} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                Stage 1: Printing / Dyeing Service
                                            </h3>
                                            <p className="text-xs text-slate-400">Bahar ka dye-house vendor bill (Chemicals humare nahi hain).</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500">Req Qty:</span>
                                        <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                                            {reqDyeingQty.toLocaleString()} KG
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* Dyeing Mode Toggle */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500">Dyeing Mode</label>
                                        <select
                                            value={dyeingMode}
                                            onChange={(e: any) => setDyeingMode(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
                                        >
                                            <option value="VENDOR_BILL">Out-House (Vendor Service Bill)</option>
                                            <option value="MANUAL">Manual Rate (Rs. / KG)</option>
                                            <option value="BYPASS">Bypass / Optional (0 Cost)</option>
                                        </select>
                                    </div>

                                    {/* Wastage % */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500">Dyeing Wastage %</label>
                                        <input
                                            type="number"
                                            value={dyeingWastage}
                                            onChange={(e) => setDyeingWastage(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white text-right"
                                        />
                                    </div>

                                    {/* Cost Summary of Dyeing */}
                                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-right">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Dyeing Cost Total</span>
                                        <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                                            Rs. {dyeingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                {/* Service Bill Selector if VENDOR_BILL */}
                                {dyeingMode === "VENDOR_BILL" && (
                                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                                Select Unconsumed Dyeing Bill from Supplier:
                                            </span>
                                            <span className="text-[11px] text-amber-600">
                                                {unconsumedServices.filter(s => s.productName.toUpperCase().includes("DYE") || s.categoryName.toUpperCase().includes("DYE")).length} bill(s) available
                                            </span>
                                        </div>

                                        <Combobox
                                            options={dyeingServiceOptions}
                                            value={selectedDyeingServiceId}
                                            onChange={(val) => {
                                                setSelectedDyeingServiceId(val);
                                                const s = unconsumedServices.find(it => it.id === val);
                                                if (s) setDyeingServiceQty(Math.min(s.unconsumedQty, reqDyeingQty).toString());
                                            }}
                                            placeholder="-- Choose Dyeing / Finishing Invoice --"
                                            searchPlaceholder="Search supplier or invoice no..."
                                            className="w-full text-xs font-bold"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STAGE 2: WEAVING / KNITTING (Only if DIRECT_FINISH or YARN_TO_GREY) */}
                        {executionMode !== "GREY_TO_FINISH" && (
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black text-sm">
                                            <Scissors size={16} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                Stage 2: Weaving / Knitting Stage
                                            </h3>
                                            <p className="text-xs text-slate-400">Kapra banane ki cost (In-House machine ya bahar ka weaver bill).</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500">Req Fabric Qty:</span>
                                        <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                                            {reqWeavingQty.toLocaleString()} KG
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* Mode Toggle: In-House vs Out-House */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500">Weaving Location</label>
                                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => setWeavingMode("IN_HOUSE")}
                                                className={cn(
                                                    "py-1.5 text-xs font-bold rounded-lg transition-all",
                                                    weavingMode === "IN_HOUSE" ? "bg-white dark:bg-slate-800 shadow text-blue-600 dark:text-blue-400" : "text-slate-500"
                                                )}
                                            >
                                                In-House
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWeavingMode("OUT_HOUSE")}
                                                className={cn(
                                                    "py-1.5 text-xs font-bold rounded-lg transition-all",
                                                    weavingMode === "OUT_HOUSE" ? "bg-white dark:bg-slate-800 shadow text-blue-600 dark:text-blue-400" : "text-slate-500"
                                                )}
                                            >
                                                Out-House
                                            </button>
                                        </div>
                                    </div>

                                    {/* Wastage % (Default 4%) */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500">Weaving Wastage %</label>
                                        <input
                                            type="number"
                                            value={weavingWastage}
                                            onChange={(e) => setWeavingWastage(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white text-right"
                                        />
                                    </div>

                                    {/* In-House Rate or Out-House Cost */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500">
                                            {weavingMode === "IN_HOUSE" ? "In-House Charge (Rs./KG)" : "Weaving Total Cost"}
                                        </label>
                                        {weavingMode === "IN_HOUSE" ? (
                                            <input
                                                type="number"
                                                value={inHouseWeavingRate}
                                                onChange={(e) => setInHouseWeavingRate(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white text-right"
                                            />
                                        ) : (
                                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 text-right">
                                                Rs. {weavingCostTotal.toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STAGE 3: RAW YARN ALLOCATION (If DIRECT_FINISH or YARN_TO_GREY) */}
                        {executionMode !== "GREY_TO_FINISH" ? (
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-sm">
                                            <Box size={16} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                Stage 3: Raw Yarn Consumption (Physical Stock)
                                            </h3>
                                            <p className="text-xs text-slate-400">Warehouse se Yarn lots allocate karein (4% wastage included).</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500">Total Req Yarn:</span>
                                        <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                                            {reqYarnQty.toLocaleString()} KG
                                        </span>
                                    </div>
                                </div>

                                {/* Live Excel-like Balance Status Card */}
                                <div className={cn(
                                    "p-4 rounded-2xl border flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-all",
                                    isYarnCovered 
                                        ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800" 
                                        : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center font-bold",
                                            isYarnCovered ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                                        )}>
                                            {isYarnCovered ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                                        </div>
                                        <div>
                                            <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                                                <span>{isYarnCovered ? "Status: OK (Full Yarn Allocated)" : `Status: Kam hai (${yarnShortfall.toLocaleString()} KG Short)`}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {isYarnCovered 
                                                    ? "Required quantity poori allocate ho chuki hai." 
                                                    : "Mazeed yarn lots allocate karein taake required weight poora ho."}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right font-mono">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Allocated / Required</span>
                                        <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                                            {totalYarnAllocated.toLocaleString()} / {reqYarnQty.toLocaleString()} KG
                                        </span>
                                    </div>
                                </div>

                                {/* Dynamic Yarn Rows */}
                                <div className="space-y-3">
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between">
                                        <span>Yarn Lots Selection</span>
                                        <span>Allocated Weight & Cost</span>
                                    </div>

                                    {yarnInputs.map((row, idx) => {
                                        return (
                                            <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 sm:items-center">
                                                {/* Product & EFS Selection */}
                                                <div className="flex-1 space-y-1">
                                                    <Combobox
                                                        options={yarnOptions}
                                                        value={row.productId ? `${row.productId}|${row.isEFS}` : ""}
                                                        onChange={(val) => handleYarnProductChange(idx, val)}
                                                        placeholder="-- Select Yarn from Stock --"
                                                        searchPlaceholder="Search yarn by name or count..."
                                                        className="w-full text-xs font-bold"
                                                    />
                                                </div>

                                                {/* Allocated Qty */}
                                                <div className="w-full sm:w-36 space-y-1">
                                                    <input
                                                        type="number"
                                                        placeholder="Qty (KG)"
                                                        value={row.quantity}
                                                        onChange={(e) => {
                                                            const next = [...yarnInputs];
                                                            next[idx].quantity = e.target.value;
                                                            setYarnInputs(next);
                                                        }}
                                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white text-right"
                                                    />
                                                </div>

                                                {/* Rate */}
                                                <div className="w-full sm:w-28 space-y-1">
                                                    <input
                                                        type="number"
                                                        placeholder="Rate"
                                                        value={row.costRate}
                                                        onChange={(e) => {
                                                            const next = [...yarnInputs];
                                                            next[idx].costRate = e.target.value;
                                                            setYarnInputs(next);
                                                        }}
                                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white text-right"
                                                    />
                                                </div>

                                                {/* Line Total */}
                                                <div className="w-28 text-right font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                                                    Rs. {((parseFloat(row.quantity) || 0) * (parseFloat(row.costRate) || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>

                                                {/* Remove button */}
                                                <button
                                                    type="button"
                                                    onClick={() => removeYarnRow(idx)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all shrink-0"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        );
                                    })}

                                    <button
                                        type="button"
                                        onClick={addYarnRow}
                                        className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
                                    >
                                        <Plus size={14} />
                                        <span>+ Add Another Yarn Lot</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* GREY_TO_FINISH: Consumed Grey Fabric Input */
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-black text-sm">
                                            <Package size={16} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                Stage 2: Consumed Grey Fabric (In-Stock)
                                            </h3>
                                            <p className="text-xs text-slate-400">Warehouse me pehle se mojud Grey stock select karein jo dye hua hai.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2 space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500">Grey Fabric *</label>
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
                                            className="w-full text-xs font-bold"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500">Consumed Qty (KG) *</label>
                                        <input
                                            type="number"
                                            value={greyInputQty}
                                            onChange={(e) => setGreyInputQty(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* RIGHT SIDEBAR: REALTIME COSTING & POST BUTTON (1 Col) */}
                    <div className="space-y-6">
                        
                        {/* Cost Breakdown Card */}
                        <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl space-y-6 sticky top-6">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                                <div className="flex items-center gap-2">
                                    <Calculator size={18} className="text-indigo-400" />
                                    <h3 className="text-sm font-black uppercase tracking-wider">Batch Cost Summary</h3>
                                </div>
                                <span className="text-[10px] uppercase font-bold text-slate-400">Live Preview</span>
                            </div>

                            {/* Line by line breakdown */}
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-slate-400">1. Yarn Material Cost:</span>
                                    <span className="font-mono font-bold text-slate-200">
                                        Rs. {yarnCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {executionMode !== "GREY_TO_FINISH" && (
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-slate-400">2. Weaving / Knitting Cost:</span>
                                        <span className="font-mono font-bold text-slate-200">
                                            Rs. {weavingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}

                                {executionMode !== "YARN_TO_GREY" && (
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-slate-400">3. Printing / Dyeing Cost:</span>
                                        <span className="font-mono font-bold text-slate-200">
                                            Rs. {dyeingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}

                                <div className="border-t border-slate-800 pt-3 flex justify-between items-center">
                                    <span className="font-bold text-slate-300">Total Batch Cost:</span>
                                    <span className="text-base font-black font-mono text-emerald-400">
                                        Rs. {totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                                    <span className="text-[11px] font-bold text-slate-400">Cost per Finished KG:</span>
                                    <span className="text-sm font-black font-mono text-amber-400">
                                        Rs. {costPerKg.toFixed(2)} / KG
                                    </span>
                                </div>
                            </div>

                            {/* Backward Ratio Audit summary */}
                            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-[11px] text-indigo-300 space-y-1">
                                <div className="font-bold flex items-center gap-1.5 text-indigo-200">
                                    <ShieldCheck size={14} />
                                    <span>Formula Audit:</span>
                                </div>
                                <div>Output: {outQty.toLocaleString()} KG</div>
                                {executionMode !== "GREY_TO_FINISH" && (
                                    <>
                                        <div>Fabric (Weaving): {reqWeavingQty.toLocaleString()} KG (4% wastage)</div>
                                        <div>Yarn (Raw): {reqYarnQty.toLocaleString()} KG (4% wastage)</div>
                                    </>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            <span>Posting Batch...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            <span>Post Production Batch</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => router.push("/finance/production")}
                                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                            </div>

                        </div>

                    </div>

                </div>

            </div>
        </MainLayout>
    );
}
