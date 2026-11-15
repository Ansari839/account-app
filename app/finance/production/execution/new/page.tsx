"use client";

import React, { useState, useEffect, useMemo } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import {
    Loader2, Save, Layers, Package, Factory, Scissors, CheckCircle2,
    Calculator, Droplets, Box, AlertTriangle, ArrowRight, Plus, Trash2,
    Calendar, Warehouse, FileText, Check, ShieldCheck, ShoppingCart, RefreshCw,
    Printer, Info, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import Combobox from "@/components/Combobox";

type ExecutionMode = "DIRECT_FINISH" | "YARN_TO_GREY" | "GREY_TO_FINISH";
type FinishingType = "DYEING" | "PRINTING" | "BOTH" | "NONE";
type FabricProcessType = "WEAVING" | "KNITTING";

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

    // 3. Stage 1: Wet Processing / Finishing (Dyeing & Printing)
    const [finishingType, setFinishingType] = useState<FinishingType>("DYEING");
    
    // Dyeing options
    const [dyeingWastage, setDyeingWastage] = useState<number>(0);
    const [dyeingMode, setDyeingMode] = useState<"VENDOR_BILL" | "MANUAL" | "BYPASS">("VENDOR_BILL");
    const [selectedDyeingServiceId, setSelectedDyeingServiceId] = useState<string>("");
    const [dyeingServiceQty, setDyeingServiceQty] = useState<string>("");
    const [dyeingManualRate, setDyeingManualRate] = useState<string>("380");

    // Printing options
    const [printingWastage, setPrintingWastage] = useState<number>(0);
    const [printingMode, setPrintingMode] = useState<"VENDOR_BILL" | "MANUAL" | "BYPASS">("VENDOR_BILL");
    const [selectedPrintingServiceId, setSelectedPrintingServiceId] = useState<string>("");
    const [printingServiceMtr, setPrintingServiceMtr] = useState<string>("");
    const [printingManualRate, setPrintingManualRate] = useState<string>("45");

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
    const dyeingServiceOptions = useMemo(() => {
        return unconsumedServices
            .filter(s => s.serviceType === "DYEING" || s.categoryName.toUpperCase().includes("DYE") || s.productName.toUpperCase().includes("DYE"))
            .map(s => ({
                value: s.id,
                label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName} | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}/KG`
            }));
    }, [unconsumedServices]);

    const printingServiceOptions = useMemo(() => {
        return unconsumedServices
            .filter(s => s.serviceType === "PRINTING" || s.categoryName.toUpperCase().includes("PRINT") || s.productName.toUpperCase().includes("PRINT"))
            .map(s => ({
                value: s.id,
                label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName} | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}/MTR`
            }));
    }, [unconsumedServices]);

    const weavingServiceOptions = useMemo(() => {
        return unconsumedServices
            .filter(s => s.serviceType === "WEAVING" || s.categoryName.toUpperCase().includes("WEAV") || s.productName.toUpperCase().includes("WEAV"))
            .map(s => ({
                value: s.id,
                label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName} | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}`
            }));
    }, [unconsumedServices]);

    const knittingServiceOptions = useMemo(() => {
        return unconsumedServices
            .filter(s => s.serviceType === "KNITTING" || s.categoryName.toUpperCase().includes("KNIT") || s.productName.toUpperCase().includes("KNIT"))
            .map(s => ({
                value: s.id,
                label: `${s.supplierName} | Inv: ${s.invoiceNo} | ${s.productName} | Avail: ${s.unconsumedQty.toLocaleString()} ${s.unit} @ Rs. ${s.rate}`
            }));
    }, [unconsumedServices]);

    // Stage 1 Dyeing Quantity (KG)
    const isDyeingActive = executionMode !== "YARN_TO_GREY" && (finishingType === "DYEING" || finishingType === "BOTH");
    const isPrintingActive = executionMode !== "YARN_TO_GREY" && (finishingType === "PRINTING" || finishingType === "BOTH");

    const reqDyeingQty = useMemo(() => {
        if (!isDyeingActive) return 0;
        return dyeingWastage > 0 
            ? Math.round((effectiveNetWeightKg / ((100 - dyeingWastage) / 100)) * 100) / 100 
            : effectiveNetWeightKg;
    }, [effectiveNetWeightKg, dyeingWastage, isDyeingActive]);

    // Stage 1 Printing Quantity (MTR)
    const reqPrintingMtr = useMemo(() => {
        if (!isPrintingActive) return 0;
        const baseMtr = outputUnitCode === "MTR" ? (parseFloat(outputQuantity) || 0) : effectiveNetWeightKg;
        return printingWastage > 0
            ? Math.round((baseMtr / ((100 - printingWastage) / 100)) * 100) / 100
            : baseMtr;
    }, [effectiveNetWeightKg, outputQuantity, outputUnitCode, printingWastage, isPrintingActive]);

    // Stage 2 Weaving / Knitting Quantity (KG)
    const reqWeavingQty = useMemo(() => {
        if (executionMode === "GREY_TO_FINISH") return 0;
        const base = isDyeingActive ? reqDyeingQty : effectiveNetWeightKg;
        return weavingWastage > 0 
            ? Math.round((base / ((100 - weavingWastage) / 100)) * 100) / 100 
            : base;
    }, [effectiveNetWeightKg, isDyeingActive, reqDyeingQty, weavingWastage, executionMode]);

    // Stage 3 Raw Yarn Quantity (KG)
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

    // Sync printing input qty default
    useEffect(() => {
        if (reqPrintingMtr > 0 && !printingServiceMtr) {
            setPrintingServiceMtr(reqPrintingMtr.toString());
        }
    }, [reqPrintingMtr]);

    // Sync weaving service qty default
    useEffect(() => {
        if (reqWeavingQty > 0 && !weavingServiceQty) {
            setWeavingServiceQty(reqWeavingQty.toString());
        }
    }, [reqWeavingQty]);

    // Sync grey input qty for GREY_TO_FINISH
    useEffect(() => {
        if (executionMode === "GREY_TO_FINISH" && effectiveNetWeightKg > 0 && !greyInputQty) {
            setGreyInputQty(effectiveNetWeightKg.toString());
        }
    }, [executionMode, effectiveNetWeightKg]);

    // Yarn Options with Available Lots (Purchase Lots + Opening Stock Lots)
    const yarnProductList = useMemo(() => {
        return products.filter(p => p.stage === "RAW" || p.hsCode?.startsWith("54") || p.hsCode?.startsWith("55") || p.name.toUpperCase().includes("DEN") || p.name.toUpperCase().includes("YARN"));
    }, [products]);

    const yarnOptions = useMemo(() => {
        const opts: { value: string; label: string }[] = [];

        // 1. First add individual available lots (Purchased lots + Opening Stock lots)
        for (const lot of availableLots) {
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
    }, [availableLots, yarnProductList, products, stockRates]);

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

    const dyeingCostTotal = useMemo(() => {
        if (!isDyeingActive || dyeingMode === "BYPASS") return 0;
        if (dyeingMode === "VENDOR_BILL") {
            const svc = unconsumedServices.find(s => s.id === selectedDyeingServiceId);
            return svc ? (parseFloat(dyeingServiceQty) || 0) * svc.rate : 0;
        } else {
            return reqDyeingQty * (parseFloat(dyeingManualRate) || 0);
        }
    }, [isDyeingActive, dyeingMode, reqDyeingQty, dyeingManualRate, selectedDyeingServiceId, dyeingServiceQty, unconsumedServices]);

    const printingCostTotal = useMemo(() => {
        if (!isPrintingActive || printingMode === "BYPASS") return 0;
        if (printingMode === "VENDOR_BILL") {
            const svc = unconsumedServices.find(s => s.id === selectedPrintingServiceId);
            return svc ? (parseFloat(printingServiceMtr) || 0) * svc.rate : 0;
        } else {
            return reqPrintingMtr * (parseFloat(printingManualRate) || 0);
        }
    }, [isPrintingActive, printingMode, reqPrintingMtr, printingManualRate, selectedPrintingServiceId, printingServiceMtr, unconsumedServices]);

    const totalBatchCost = yarnCostTotal + fabricMakingCostTotal + dyeingCostTotal + printingCostTotal;
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

        // 2. Dyeing Overhead
        if (isDyeingActive && dyeingMode !== "BYPASS") {
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

        // 3. Printing Overhead
        if (isPrintingActive && printingMode !== "BYPASS") {
            if (printingMode === "VENDOR_BILL" && selectedPrintingServiceId) {
                finalOverheads.push({
                    purchaseInvoiceItemId: selectedPrintingServiceId,
                    quantity: parseFloat(printingServiceMtr) || reqPrintingMtr
                });
            } else if (printingMode === "MANUAL") {
                const amt = reqPrintingMtr * (parseFloat(printingManualRate) || 0);
                if (amt > 0) {
                    finalOverheads.push({
                        description: `Printing Service Overhead (@ Rs. ${printingManualRate}/MTR)`,
                        amount: amt,
                        quantity: reqPrintingMtr
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
            mode: (weavingMode === "OUT_HOUSE" || dyeingMode === "VENDOR_BILL" || printingMode === "VENDOR_BILL") ? "OUT-HOUSE" : "IN-HOUSE",
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

                        {/* STAGE 1: WET PROCESSING / FINISHING (DYEING & PRINTING) */}
                        {executionMode !== "YARN_TO_GREY" && (
                            <div className="p-7 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-base shadow-sm">
                                            <Droplets size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                Stage 1: Wet Processing & Finishing
                                            </h3>
                                            <p className="text-xs sm:text-sm text-slate-400">Choose Dyeing (in KG), Printing (in MTR), or Both with respective vendor bills.</p>
                                        </div>
                                    </div>

                                    {/* Finishing Selector Pill */}
                                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0 gap-1 text-xs font-bold">
                                        <button
                                            type="button"
                                            onClick={() => setFinishingType("DYEING")}
                                            className={cn("px-3 py-1.5 rounded-xl transition-all", finishingType === "DYEING" ? "bg-amber-600 text-white shadow" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                                        >
                                            Dyeing Only (KG)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFinishingType("PRINTING")}
                                            className={cn("px-3 py-1.5 rounded-xl transition-all", finishingType === "PRINTING" ? "bg-purple-600 text-white shadow" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                                        >
                                            Printing Only (MTR)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFinishingType("BOTH")}
                                            className={cn("px-3 py-1.5 rounded-xl transition-all", finishingType === "BOTH" ? "bg-indigo-600 text-white shadow" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                                        >
                                            Both (Dye & Print)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFinishingType("NONE")}
                                            className={cn("px-3 py-1.5 rounded-xl transition-all", finishingType === "NONE" ? "bg-slate-700 text-white shadow" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                                        >
                                            None (Direct Grey)
                                        </button>
                                    </div>
                                </div>

                                {/* A. DYEING SERVICE BLOCK */}
                                {isDyeingActive && (
                                    <div className="p-6 rounded-2xl bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/70 dark:border-amber-900/40 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-black text-sm uppercase tracking-wide">
                                                <Droplets size={16} className="text-amber-600" />
                                                <span>Dyeing Service (Measured in KG)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-500 uppercase">Req Dyeing:</span>
                                                <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/50 px-2.5 py-0.5 rounded-lg">
                                                    {reqDyeingQty.toLocaleString()} KG
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {/* Dyeing Mode */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Dyeing Mode</label>
                                                <select
                                                    value={dyeingMode}
                                                    onChange={(e: any) => setDyeingMode(e.target.value)}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white shadow-sm"
                                                >
                                                    <option value="VENDOR_BILL">Out-House (Vendor Service Bill)</option>
                                                    <option value="MANUAL">Manual Rate (Rs. / KG)</option>
                                                    <option value="BYPASS">Bypass / In-house (0 Cost)</option>
                                                </select>
                                            </div>

                                            {/* Dyeing Wastage */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Dyeing Wastage %</label>
                                                <input
                                                    type="number"
                                                    value={dyeingWastage}
                                                    onChange={(e) => setDyeingWastage(parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-slate-900 dark:text-white text-right shadow-sm"
                                                />
                                            </div>

                                            {/* Dyeing Total Cost */}
                                            <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-right flex flex-col justify-center">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Dyeing Total Cost</span>
                                                <span className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
                                                    Rs. {dyeingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Dyeing Bill Selector if VENDOR_BILL */}
                                        {dyeingMode === "VENDOR_BILL" && (
                                            <div className="space-y-2 pt-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                                        Select Unconsumed Dyeing Bill (Category: DYEING):
                                                    </span>
                                                    <span className="text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                                                        {dyeingServiceOptions.length} bill(s) available
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
                                                    className="w-full text-sm font-bold"
                                                />
                                            </div>
                                        )}

                                        {dyeingMode === "MANUAL" && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Manual Dyeing Rate (Rs. / KG)</label>
                                                    <input
                                                        type="number"
                                                        value={dyeingManualRate}
                                                        onChange={(e) => setDyeingManualRate(e.target.value)}
                                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-right"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* B. PRINTING SERVICE BLOCK */}
                                {isPrintingActive && (
                                    <div className="p-6 rounded-2xl bg-purple-50/40 dark:bg-purple-950/15 border border-purple-200/70 dark:border-purple-900/40 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-black text-sm uppercase tracking-wide">
                                                <Printer size={16} className="text-purple-600" />
                                                <span>Printing Service (Measured in MTR)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-500 uppercase">Req Printing:</span>
                                                <span className="font-mono text-sm font-black text-purple-600 dark:text-purple-400 bg-purple-100/80 dark:bg-purple-900/50 px-2.5 py-0.5 rounded-lg">
                                                    {reqPrintingMtr.toLocaleString()} MTR
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {/* Printing Mode */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Printing Mode</label>
                                                <select
                                                    value={printingMode}
                                                    onChange={(e: any) => setPrintingMode(e.target.value)}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white shadow-sm"
                                                >
                                                    <option value="VENDOR_BILL">Out-House (Vendor Service Bill)</option>
                                                    <option value="MANUAL">Manual Rate (Rs. / MTR)</option>
                                                    <option value="BYPASS">Bypass / Optional (0 Cost)</option>
                                                </select>
                                            </div>

                                            {/* Printing Wastage */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Printing Wastage %</label>
                                                <input
                                                    type="number"
                                                    value={printingWastage}
                                                    onChange={(e) => setPrintingWastage(parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-slate-900 dark:text-white text-right shadow-sm"
                                                />
                                            </div>

                                            {/* Printing Total Cost */}
                                            <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-right flex flex-col justify-center">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Printing Total Cost</span>
                                                <span className="text-base font-black font-mono text-purple-600 dark:text-purple-400">
                                                    Rs. {printingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Printing Bill Selector if VENDOR_BILL */}
                                        {printingMode === "VENDOR_BILL" && (
                                            <div className="space-y-2 pt-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                                                        Select Unconsumed Printing Bill (Category: PRINTING):
                                                    </span>
                                                    <span className="text-xs font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full">
                                                        {printingServiceOptions.length} bill(s) available
                                                    </span>
                                                </div>
                                                <Combobox
                                                    options={printingServiceOptions}
                                                    value={selectedPrintingServiceId}
                                                    onChange={(val) => {
                                                        setSelectedPrintingServiceId(val);
                                                        const s = unconsumedServices.find(it => it.id === val);
                                                        if (s) setPrintingServiceMtr(Math.min(s.unconsumedQty, reqPrintingMtr).toString());
                                                    }}
                                                    placeholder="-- Choose Printing Invoice --"
                                                    searchPlaceholder="Search supplier or invoice no..."
                                                    className="w-full text-sm font-bold"
                                                />
                                            </div>
                                        )}

                                        {printingMode === "MANUAL" && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Manual Printing Rate (Rs. / MTR)</label>
                                                    <input
                                                        type="number"
                                                        value={printingManualRate}
                                                        onChange={(e) => setPrintingManualRate(e.target.value)}
                                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-right"
                                                    />
                                                </div>
                                            </div>
                                        )}
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
                                                <div className="flex-1 space-y-1">
                                                    <Combobox
                                                        options={yarnOptions}
                                                        value={row.purchaseInvoiceItemId ? `LOT|${row.purchaseInvoiceItemId}|${row.productId}|${row.costRate}|${row.isEFS}|${row.lotNumber}` : (row.productId ? `PROD|${row.productId}|${row.isEFS}` : "")}
                                                        onChange={(val) => handleYarnProductChange(idx, val)}
                                                        placeholder="-- Select Yarn Lot from Purchase or Opening Stock --"
                                                        searchPlaceholder="Search yarn by name, invoice no, or opening stock..."
                                                        className="w-full text-sm font-bold"
                                                    />
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

                                {isDyeingActive && (
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800/60 pb-2">
                                        <span className="text-slate-400">3. Dyeing Finishing Cost:</span>
                                        <span className="font-mono font-bold text-amber-400">
                                            Rs. {dyeingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}

                                {isPrintingActive && (
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800/60 pb-2">
                                        <span className="text-slate-400">4. Printing Finishing Cost:</span>
                                        <span className="font-mono font-bold text-purple-400">
                                            Rs. {printingCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}

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
                                {isPrintingActive && (
                                    <div className="font-mono text-purple-300">Printing: {reqPrintingMtr.toLocaleString()} MTR ({printingWastage}% wastage)</div>
                                )}
                                {isDyeingActive && (
                                    <div className="font-mono text-amber-300">Dyeing: {reqDyeingQty.toLocaleString()} KG ({dyeingWastage}% wastage)</div>
                                )}
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
        </MainLayout>
    );
}
