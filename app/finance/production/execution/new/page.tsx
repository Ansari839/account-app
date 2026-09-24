"use client";
import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { Loader2, Save, Layers, Package, Factory, Scissors, CheckCircle, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProductionExecutionWizard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Meta data
    const [products, setProducts] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [unconsumedServices, setUnconsumedServices] = useState<any[]>([]);
    const [stockRates, setStockRates] = useState<Record<string, { qty: number, rate: number }>>({});

    // Tab State
    const [activeTab, setActiveTab] = useState<"GREY" | "FINISH">("GREY");
    const processStage = activeTab; // We'll just map activeTab to processStage to reuse logic!
    
    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [outputProductId, setOutputProductId] = useState("");
    const [outputQuantity, setOutputQuantity] = useState("");
    const [inputQuantity, setInputQuantity] = useState("");
    const [warehouseId, setWarehouseId] = useState("");
    const [mode, setMode] = useState<"IN-HOUSE" | "OUT-HOUSE">("IN-HOUSE");
    const [outputStage, setOutputStage] = useState("FINISH");
    const [lotNumber, setLotNumber] = useState("");
    const [perUnitOverhead, setPerUnitOverhead] = useState("");
    const [serviceSearch, setServiceSearch] = useState("");

    const [inputs, setInputs] = useState<any[]>([{ productId: "", quantity: "", costRate: "", lotNumber: "", stage: "" }]);
    const [overheads, setOverheads] = useState<any[]>([]);
    const [availableLots, setAvailableLots] = useState<any[]>([]);

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

    const handleTabChange = (tab: "GREY" | "FINISH") => {
        setActiveTab(tab);
        // Reset state
        setOutputProductId("");
        setOutputQuantity("");
        setLotNumber("");
        setPerUnitOverhead("");
        setInputs([{ productId: "", quantity: "", costRate: "", lotNumber: "", stage: "" }]);
        setOverheads([]);
    };

    const handleInputProductChange = (index: number, pid: string) => {
        const newInputs = [...inputs];
        newInputs[index].productId = pid;
        const reqStage = processStage === "FINISH" ? "GREY" : "RAW";
        const key = `${pid}-${reqStage}`;
        if (stockRates[key]) {
            newInputs[index].costRate = stockRates[key].rate.toFixed(2);
        } else {
            newInputs[index].costRate = "0";
        }
        setInputs(newInputs);
    };

    const addInput = () => setInputs([...inputs, { productId: "", quantity: "", costRate: "", lotNumber: "", stage: "" }]);
    const removeInput = (index: number) => setInputs(inputs.filter((_, i) => i !== index));

    const toggleService = (svcId: string, inclAmount: number, maxQty: number) => {
        const exists = overheads.find(o => o.purchaseInvoiceItemId === svcId);
        if (exists) {
            setOverheads(overheads.filter(o => o.purchaseInvoiceItemId !== svcId));
        } else {
            setOverheads([...overheads, { purchaseInvoiceItemId: svcId, amount: inclAmount, quantity: maxQty, maxQty: maxQty, rate: inclAmount / maxQty }]);
        }
    };

    const updateServiceQty = (svcId: string, newQty: string) => {
        setOverheads(overheads.map(o => {
            if (o.purchaseInvoiceItemId === svcId) {
                const qty = Math.min(Number(newQty) || 0, o.maxQty);
                return { ...o, quantity: qty, amount: qty * o.rate };
            }
            return o;
        }));
    };

    const validateForm = () => {
        if (!outputProductId || !outputQuantity) {
            alert("Please fill all required output fields");
            return false;
        }
        if (activeTab === "FINISH") {
            if (!inputQuantity) {
                alert("Please enter the consumed grey quantity (IN)");
                return false;
            }
        } else {
            if (inputs.length === 0 || !inputs[0].productId) {
                alert("Please add at least one input material");
                return false;
            }
            for (const input of inputs) {
                if (!input.productId || !input.quantity || !input.costRate) {
                    alert("Please fill all input fields completely");
                    return false;
                }
            }
        }
        if (mode === "OUT-HOUSE" && overheads.length === 0) {
            alert("Please select at least one service invoice to consume");
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        
        setSubmitting(true);
        try {
            const finalOverheads = mode === "IN-HOUSE" 
                ? (Number(perUnitOverhead) > 0 ? [{ description: "Factory Overhead", amount: Number(perUnitOverhead) * Number(outputQuantity), quantity: outputQuantity }] : [])
                : overheads;

            const finalInputs = activeTab === "FINISH" ? [{
                productId: outputProductId,
                quantity: inputQuantity,
                costRate: stockRates[`${outputProductId}-GREY`]?.rate || 0,
                stage: "GREY",
                lotNumber: ""
            }] : inputs;

            const payload = {
                date,
                outputProductId,
                outputQuantity,
                processStage: outputStage,
                warehouseId,
                mode,
                lotNumber,
                inputs: finalInputs,
                overheads: finalOverheads
            };

            const res = await authenticatedFetch("/api/finance/production/execution", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.success) {
                alert("Production batch posted successfully!");
                router.push("/finance/production/execution");
            } else {
                alert(json.error || "Failed to post batch");
            }
        } catch (error) {
            alert("An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    const totalRM = activeTab === "FINISH"
        ? (Number(inputQuantity) * (stockRates[`${outputProductId}-GREY`]?.rate || 0))
        : inputs.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.costRate)), 0);
    const totalSvc = mode === "IN-HOUSE" ? (Number(perUnitOverhead) * Number(outputQuantity)) : overheads.reduce((sum, o) => sum + Number(o.amount), 0);
    const grandTotal = totalRM + totalSvc;
    const costPerUnit = Number(outputQuantity) > 0 ? grandTotal / Number(outputQuantity) : 0;

    const outProduct = products.find(p => p.id === outputProductId);

    if (loading) {
        return (
            <MainLayout>
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
                
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                            <Factory className="text-indigo-400" />
                            Production Processing
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">Single-page consumption and output form</p>
                    </div>
                    
                    {/* Tab Selection */}
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button 
                            onClick={() => { handleTabChange("GREY"); setOutputStage("GREY"); }} 
                            className={cn("px-6 py-2.5 rounded-lg text-sm font-semibold transition-all", activeTab === "GREY" ? "bg-indigo-500 text-white shadow-lg" : "text-slate-400 hover:text-white")}
                        >
                            Grey Making
                        </button>
                        <button 
                            onClick={() => { handleTabChange("FINISH"); setOutputStage("FINISH"); setMode("OUT-HOUSE"); }} 
                            className={cn("px-6 py-2.5 rounded-lg text-sm font-semibold transition-all", activeTab === "FINISH" ? "bg-indigo-500 text-white shadow-lg" : "text-slate-400 hover:text-white")}
                        >
                            Finish Making
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Output Details section */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
                            <Package className="text-indigo-400" size={20} />
                            Output Details ({activeTab})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Date</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" />
                            </div>
                            {activeTab === "GREY" && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Mode</label>
                                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                                        <button onClick={() => setMode("IN-HOUSE")} className={cn("py-2 px-2 rounded-lg font-medium text-xs transition-all", mode === "IN-HOUSE" ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-white")}>In-House</button>
                                        <button onClick={() => setMode("OUT-HOUSE")} className={cn("py-2 px-2 rounded-lg font-medium text-xs transition-all", mode === "OUT-HOUSE" ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-white")}>Out-House</button>
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Output Stage</label>
                                <select value={outputStage} onChange={e => setOutputStage(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all">
                                    <option value="GREY">GREY</option>
                                    <option value="FINISH">FINISH</option>
                                </select>
                            </div>
                            <div className={cn("md:col-span-2", activeTab === "FINISH" ? "md:col-span-2" : "md:col-span-1")}>
                                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Output Product</label>
                                <select value={outputProductId} onChange={e => setOutputProductId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 hover:bg-slate-800 transition-all outline-none appearance-none cursor-pointer">
                                    <option value="">-- Select {activeTab} Product --</option>
                                    {products.filter(p => p.isManufactured).map(p => <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>)}
                                </select>
                            </div>
                            
                            {activeTab === "FINISH" && (
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider text-emerald-400">Consumed Grey Quantity (IN)</label>
                                    <div className="relative">
                                        <input type="number" value={inputQuantity} onChange={e => setInputQuantity(e.target.value)} className="w-full bg-emerald-500/10 border border-emerald-500/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="0.00" />
                                        <div className="absolute right-4 top-3 text-emerald-500/50">{outProduct?.baseUnit?.code}</div>
                                    </div>
                                    {outputProductId && (
                                        <div className="mt-2 text-xs text-slate-400">
                                            Grey Fabric in Stock: <span className="text-amber-400 font-semibold">{stockRates[`${outputProductId}-GREY`]?.qty || 0}</span> {outProduct?.baseUnit?.code}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Produced Quantity (OUT)</label>
                                <div className="relative">
                                    <input type="number" value={outputQuantity} onChange={e => setOutputQuantity(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="0.00" />
                                    <div className="absolute right-4 top-3 text-slate-500">{outProduct?.baseUnit?.code}</div>
                                </div>
                            </div>
                            
                            {mode === "IN-HOUSE" ? (
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider text-amber-400">Per Unit Overhead Cost (Optional)</label>
                                    <div className="relative">
                                        <input type="number" value={perUnitOverhead} onChange={e => setPerUnitOverhead(e.target.value)} className="w-full bg-amber-500/10 border border-amber-500/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 outline-none" placeholder="0.00" />
                                        <div className="absolute right-4 top-3 text-amber-500/50">PKR / {outProduct?.baseUnit?.code || 'Unit'}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Output Lot Number (Optional)</label>
                                    <input type="text" value={lotNumber} onChange={e => setLotNumber(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="e.g., LOT-1029" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Inputs section */}
                    {activeTab === "GREY" && (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Layers className="text-emerald-400" size={20} />
                                Material Consumption
                            </h2>
                            <button onClick={addInput} className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-500/30 transition-all">+ Add Row</button>
                        </div>
                        
                        <div className="space-y-4">
                            {inputs.map((input, idx) => (
                                <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-12 md:col-span-4">
                                        <label className="block text-[10px] text-slate-500 mb-1 uppercase">Material (Raw/Yarn)</label>
                                        <select value={input.productId} onChange={e => handleInputProductChange(idx, e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 hover:bg-slate-800 transition-all outline-none appearance-none cursor-pointer">
                                            <option value="">Select Material...</option>
                                            {activeTab === "GREY" ? (
                                                products.filter(p => p.category?.name?.toLowerCase().includes('yarn')).map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                                            ) : (
                                                products.filter(p => {
                                                    const stockKey = `${p.id}-GREY`;
                                                    return (stockRates[stockKey]?.qty || 0) > 0;
                                                }).map(p => {
                                                    const stockKey = `${p.id}-GREY`;
                                                    const qty = stockRates[stockKey]?.qty || 0;
                                                    return <option key={p.id} value={p.id}>{p.name} (Stock: {qty})</option>;
                                                })
                                            )}
                                        </select>
                                    </div>
                                    <div className="col-span-4 md:col-span-2 relative">
                                        <label className="block text-[10px] text-slate-500 mb-1 uppercase">Qty</label>
                                        <input type="number" value={input.quantity} onChange={e => { const n = [...inputs]; n[idx].quantity = e.target.value; setInputs(n); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="0" />
                                        <div className="absolute -bottom-5 left-1 text-[10px] text-slate-500 whitespace-nowrap">
                                            In Stock: {stockRates[`${input.productId}-${input.stage || 'RAW'}`]?.qty || 0}
                                        </div>
                                    </div>
                                    <div className="col-span-4 md:col-span-2">
                                        <label className="block text-[10px] text-slate-500 mb-1 uppercase">Consume Stage</label>
                                        <select value={input.stage || ""} onChange={e => { const n = [...inputs]; n[idx].stage = e.target.value; setInputs(n); }} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 hover:bg-slate-800 transition-all outline-none appearance-none cursor-pointer">
                                            <option value="">Auto (RAW)</option>
                                            <option value="RAW">RAW</option>
                                            <option value="GREY">GREY</option>
                                            <option value="FINISH">FINISH</option>
                                        </select>
                                    </div>
                                    <div className="col-span-4 md:col-span-2">
                                        <label className="block text-[10px] text-slate-500 mb-1 uppercase">Cost Rate</label>
                                        <input type="number" value={input.costRate} onChange={e => { const n = [...inputs]; n[idx].costRate = e.target.value; setInputs(n); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="0.00" />
                                    </div>
                                    <div className="col-span-10 md:col-span-1">
                                        <label className="block text-[10px] text-slate-500 mb-1 uppercase">Lot (Opt)</label>
                                        <select value={input.lotNumber} onChange={e => {
                                            const n = [...inputs];
                                            n[idx].lotNumber = e.target.value;
                                            if (e.target.value) {
                                                const lot = availableLots.find(l => l.id === e.target.value);
                                                if (lot) n[idx].costRate = lot.rate.toFixed(2);
                                            }
                                            setInputs(n);
                                        }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 hover:bg-slate-800 transition-all outline-none appearance-none cursor-pointer">
                                            <option value="">N/A</option>
                                            {availableLots.filter(l => l.productId === input.productId).map(l => (
                                                <option key={l.id} value={l.id}>{l.invoiceNo}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2 md:col-span-1 flex justify-end mt-5">
                                        <button onClick={() => removeInput(idx)} className="text-rose-400 p-2 hover:bg-rose-500/10 rounded-lg transition-all">×</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    )}


                    {/* Services section */}
                    {mode === "OUT-HOUSE" && (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Scissors className="text-amber-400" size={20} />
                                    Service / Overheads
                                </h2>
                                <input 
                                    type="text" 
                                    placeholder="Search invoice, vendor or product..." 
                                    value={serviceSearch} 
                                    onChange={e => setServiceSearch(e.target.value)} 
                                    className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500/50 outline-none w-full md:w-64"
                                />
                            </div>
                            {(() => {
                                const outProd = products.find(p => p.id === outputProductId);
                                const outCat = (outProd as any)?.category?.name || '';
                                
                                const isSuggested = (svcCat: string, oCat: string) => {
                                    if (!svcCat || !oCat) return false;
                                    const s = svcCat.toLowerCase();
                                    const o = oCat.toLowerCase();
                                    if (o.includes(s) || s.includes(o)) return true;
                                    if (o.includes('weav') && s.includes('weav')) return true;
                                    if (o.includes('knit') && s.includes('knit')) return true;
                                    if (o.includes('dye') && s.includes('dye')) return true;
                                    if (o.includes('print') && s.includes('print')) return true;
                                    return false;
                                };

                                const searchFilter = (svc: any) => {
                                    if (activeTab === "FINISH") {
                                        const cat = svc.categoryName?.toLowerCase() || "";
                                        if (cat.includes("weaving") || cat.includes("knitting")) return false;
                                    }
                                    if (!serviceSearch) return true;
                                    const term = serviceSearch.toLowerCase();
                                    return svc.productName?.toLowerCase().includes(term) || 
                                           svc.supplierName?.toLowerCase().includes(term) || 
                                           svc.invoiceNo?.toLowerCase().includes(term);
                                };

                                const validServices = unconsumedServices.filter(searchFilter);
                                const suggestedServices = validServices.filter(svc => isSuggested(svc.categoryName, outCat));
                                const otherServices = validServices.filter(svc => !isSuggested(svc.categoryName, outCat));

                                return (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-400">Select the unconsumed service bills that were used to process this batch.</p>
                                        
                                        <div className="flex flex-col gap-3">
                                            {suggestedServices.map(svc => {
                                                const selectedItem = overheads.find(o => o.purchaseInvoiceItemId === svc.id);
                                                const isSelected = !!selectedItem;
                                                const status = svc.consumedQty > 0 ? "PARTIAL" : "UNCONSUMED";
                                                
                                                return (
                                                    <div key={svc.id} className={cn("p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4", isSelected ? "bg-amber-500/10 border-amber-500/50 shadow-md" : "bg-slate-950 border-slate-800")}>
                                                        <div className="flex-1 cursor-pointer" onClick={() => toggleService(svc.id, svc.inclAmount, svc.unconsumedQty)}>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="text-amber-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Suggested</div>
                                                                <div className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded-full", status === "PARTIAL" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400")}>{status}</div>
                                                            </div>
                                                            <div className="text-white font-medium text-lg">{svc.productName}</div>
                                                            <div className="text-sm text-slate-400 mt-0.5">{svc.supplierName}</div>
                                                        </div>
                                                        <div className="flex-1 bg-slate-900/50 p-3 rounded-lg border border-slate-800/50 cursor-pointer" onClick={() => toggleService(svc.id, svc.inclAmount, svc.unconsumedQty)}>
                                                            <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Invoice:</span> <span className="text-slate-300 font-medium">{svc.invoiceNo}</span></div>
                                                            <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Date:</span> <span className="text-slate-300">{new Date(svc.date).toLocaleDateString()}</span></div>
                                                            <div className="flex justify-between text-xs"><span className="text-slate-500">Category:</span> <span className="text-slate-300">{svc.categoryName || 'N/A'}</span></div>
                                                        </div>
                                                        <div className="flex-1 flex items-center justify-end gap-4">
                                                            {isSelected ? (
                                                                <div className="flex flex-col items-end">
                                                                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Consume Qty (Max: {svc.unconsumedQty})</label>
                                                                    <div className="flex items-center gap-2">
                                                                        <input 
                                                                            type="number" 
                                                                            value={selectedItem.quantity || ''} 
                                                                            onChange={e => updateServiceQty(svc.id, e.target.value)}
                                                                            className="w-24 bg-slate-900 border border-amber-500/50 rounded-lg px-2 py-1 text-white text-right font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                                        />
                                                                        <span className="text-xs text-slate-400">{svc.unit}</span>
                                                                    </div>
                                                                    <div className="text-xs text-amber-400 mt-1 uppercase tracking-wider">Value: PKR {(selectedItem.amount).toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-right cursor-pointer" onClick={() => toggleService(svc.id, svc.inclAmount, svc.unconsumedQty)}>
                                                                    <div className="text-amber-400 font-bold text-xl">{svc.unconsumedQty} <span className="text-sm font-medium">{svc.unit}</span></div>
                                                                    <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Avail Value: PKR {svc.inclAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                                                                </div>
                                                            )}
                                                            <div onClick={() => toggleService(svc.id, svc.inclAmount, svc.unconsumedQty)} className={cn("w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center cursor-pointer", isSelected ? "bg-amber-500 border-amber-500 text-slate-900" : "border-slate-600 hover:border-slate-500")}>
                                                                {isSelected && <CheckCircle size={14} />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {otherServices.map(svc => {
                                                const selectedItem = overheads.find(o => o.purchaseInvoiceItemId === svc.id);
                                                const isSelected = !!selectedItem;
                                                const status = svc.consumedQty > 0 ? "PARTIAL" : "UNCONSUMED";
                                                
                                                return (
                                                    <div key={svc.id} className={cn("p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4", isSelected ? "bg-amber-500/10 border-amber-500/50 shadow-md" : "bg-slate-950 border-slate-800")}>
                                                        <div className="flex-1 cursor-pointer" onClick={() => toggleService(svc.id, svc.inclAmount, svc.unconsumedQty)}>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded-full", status === "PARTIAL" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400")}>{status}</div>
                                                            </div>
                                                            <div className="text-white font-medium text-lg">{svc.productName}</div>
                                                            <div className="text-sm text-slate-400 mt-0.5">{svc.supplierName}</div>
                                                        </div>
                                                        <div className="flex-1 bg-slate-900/50 p-3 rounded-lg border border-slate-800/50 cursor-pointer" onClick={() => toggleService(svc.id, svc.inclAmount, svc.unconsumedQty)}>
                                                            <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Invoice:</span> <span className="text-slate-300 font-medium">{svc.invoiceNo}</span></div>
                                                            <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Date:</span> <span className="text-slate-300">{new Date(svc.date).toLocaleDateString()}</span></div>
                                                            <div className="flex justify-between text-xs"><span className="text-slate-500">Category:</span> <span className="text-slate-300">{svc.categoryName || 'N/A'}</span></div>
                                                        </div>
                                                        <div className="flex-1 flex items-center justify-end gap-4">
                                                            {isSelected ? (
                                                                <div className="flex flex-col items-end">
                                                                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Consume Qty (Max: {svc.unconsumedQty})</label>
                                                                    <div className="flex items-center gap-2">
                                                                        <input 
                                                                            type="number" 
                                                                            value={selectedItem.quantity || ''} 
                                                                            onChange={e => updateServiceQty(svc.id, e.target.value)}
                                                                            className="w-24 bg-slate-900 border border-amber-500/50 rounded-lg px-2 py-1 text-white text-right font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                                        />
                                                                        <span className="text-xs text-slate-400">{svc.unit}</span>
                                                                    </div>
                                                                    <div className="text-xs text-amber-400 mt-1 uppercase tracking-wider">Value: PKR {(selectedItem.amount).toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-right cursor-pointer" onClick={() => toggleService(svc.id, svc.inclAmount, svc.unconsumedQty)}>
                                                                    <div className="text-amber-400 font-bold text-xl">{svc.unconsumedQty} <span className="text-sm font-medium">{svc.unit}</span></div>
                                                                    <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Avail Value: PKR {svc.inclAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                                                                </div>
                                                            )}
                                                            <div onClick={() => toggleService(svc.id, svc.inclAmount, svc.unconsumedQty)} className={cn("w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center cursor-pointer", isSelected ? "bg-amber-500 border-amber-500 text-slate-900" : "border-slate-600 hover:border-slate-500")}>
                                                                {isSelected && <CheckCircle size={14} />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        {otherServices.length === 0 && suggestedServices.length === 0 && (
                                            <div className="text-center py-8 text-slate-500 bg-slate-950 rounded-2xl border border-slate-800 border-dashed">
                                                No unconsumed services found matching your criteria.
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Summary & Submit */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Cost</div>
                                <div className="text-2xl font-bold text-white">{grandTotal.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                            </div>
                            <div className="w-px h-10 bg-slate-800"></div>
                            <div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Cost Per Unit</div>
                                <div className="text-2xl font-bold text-indigo-400">{costPerUnit.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                            </div>
                        </div>

                        <button onClick={handleSubmit} disabled={submitting} className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50">
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            Post Production Batch
                        </button>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
}
