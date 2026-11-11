"use client";

import React, { useState, useEffect } from "react";
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
    FileText,
    ShieldCheck,
    Anchor,
    Percent,
    DollarSign,
    Coins,
    Sparkles,
    SlidersHorizontal
} from "lucide-react";
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function NewImportInvoicePage() {
    const router = useRouter();
    const { showNotification } = useNotifications();

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Master Data
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [taxCodes, setTaxCodes] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [currency, setCurrency] = useState<{ symbol: string }>({ symbol: '$' });

    // Insurance & Landing Charges States
    const [insuranceType, setInsuranceType] = useState<'PERCENT' | 'FC' | 'PKR'>('PERCENT');
    const [insuranceValue, setInsuranceValue] = useState<number>(1.0); // Standard Customs: 1%
    const [insuranceAccountId, setInsuranceAccountId] = useState<string>('');

    const [landingType, setLandingType] = useState<'PERCENT' | 'FC' | 'PKR'>('PERCENT');
    const [landingValue, setLandingValue] = useState<number>(1.0); // Standard Customs: 1%
    const [landingAccountId, setLandingAccountId] = useState<string>('');

    // Form Data - Direct Import Bill (No PO / GRN)
    const [formData, setFormData] = useState<any>({
        supplierId: "",
        beneficiaryName: "",
        gdNumber: "",
        blNumber: "",
        warehouseId: "",
        date: new Date().toISOString().split("T")[0],
        dueDate: "",
        hasDiscount: false,
        discountAmount: 0,
        discountType: "FIXED",
        exchangeRate: 1.0,
        docExchangeRate: 1.0, // Bank Doc Retirement Rate
        customsExchangeRate: 1.0, // Customs GD Currency Rate
        foreignTotal: 0,
        items: [
            { 
                id: Date.now().toString(), 
                productId: "", 
                productName: "", 
                unitId: "", 
                qty: 1, 
                foreignRate: 0, 
                rate: 0, 
                foreignAmount: 0, 
                total: 0, 
                isEFS: false,
                isAutoDuties: true,
                assessedRate: 0,
                cdAmount: '',
                rdAmount: '',
                acdAmount: '',
                itpRate: 0,
                assessedValuePKR: 0
            }
        ],
        gdTaxes: [],
    });

    useEffect(() => {
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const [supRes, accRes, whRes, prodRes, unitRes, taxRes, currRes] = await Promise.allSettled([
                authenticatedFetch("/api/finance/parties/suppliers"),
                authenticatedFetch('/api/accounts?isPosting=true'),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/products"),
                authenticatedFetch("/api/inventory/units"),
                authenticatedFetch("/api/finance/tax"),
                authenticatedFetch("/api/finance/currency"),
            ]);

            let sups: any[] = [];
            if (supRes.status === 'fulfilled' && supRes.value.ok) {
                const json = await supRes.value.json();
                sups = json.data || [];
            }

            let accs: any[] = [];
            if (accRes.status === 'fulfilled' && accRes.value.ok) {
                const json = await accRes.value.json();
                accs = json.accounts || [];
                setAccounts(accs);
            }
            
            // Auto select default accounts for Insurance and Landing
            const defaultInsAcc = accs.find((a: any) => a.code === '2180' || a.name.toLowerCase().includes('insurance'));
            if (defaultInsAcc) setInsuranceAccountId(defaultInsAcc.id);

            const defaultPortAcc = accs.find((a: any) => a.code === '2190' || a.name.toLowerCase().includes('port') || a.name.toLowerCase().includes('clearing'));
            if (defaultPortAcc) setLandingAccountId(defaultPortAcc.id);

            // Combined options: Suppliers + Posting Accounts (2111 Import Account, 2110, etc.)
            const combined = [...sups];
            const existingIds = new Set(sups.map((s: any) => s.id));
            accs.forEach((a: any) => {
                if (!existingIds.has(a.id)) {
                    combined.push(a);
                    existingIds.add(a.id);
                }
            });

            setSuppliers(combined);

            // Auto-select Import Account / Supplier if not yet selected
            const defaultSup = sups.find((s: any) => s.code?.includes('IMP') || s.name?.toLowerCase().includes('import'))
                || accs.find((a: any) => a.code === '2111')
                || sups[0];
            if (defaultSup) {
                setFormData((prev: any) => prev.supplierId ? prev : { ...prev, supplierId: defaultSup.id });
            }

            // Auto-populate standard Pakistan Customs GD Duties if empty
            const customsAcc = accs.find((a: any) => a.code === '2170' || a.name.toLowerCase().includes('customs'));
            const inputStAcc = accs.find((a: any) => a.code === '1160' || a.name.toLowerCase().includes('input tax'));
            const advItAcc = accs.find((a: any) => a.code === '1170' || a.name.toLowerCase().includes('advance income'));

            setFormData((prev: any) => {
                if ((prev.gdTaxes || []).length > 0) return prev;
                return {
                    ...prev,
                    gdTaxes: [
                        { id: '1', taxCodeId: '', taxName: 'Customs Duty (CD)', calculation: 'ASSESSED_VALUE', rate: 10, taxAmount: 0, isCapitalized: true, accountId: customsAcc?.id || null },
                        { id: '2', taxCodeId: '', taxName: 'Regulatory Duty (RD)', calculation: 'ASSESSED_VALUE', rate: 2, taxAmount: 0, isCapitalized: true, accountId: customsAcc?.id || null },
                        { id: '3', taxCodeId: '', taxName: 'Additional Customs Duty (ACD)', calculation: 'ASSESSED_VALUE', rate: 0, taxAmount: 0, isCapitalized: true, accountId: customsAcc?.id || null },
                        { id: '4', taxCodeId: '', taxName: 'Sales Tax (ST 18%)', calculation: 'ASSESSED_PLUS_DUTIES', rate: 18, taxAmount: 0, isCapitalized: false, accountId: inputStAcc?.id || null },
                        { id: '5', taxCodeId: '', taxName: 'Advance Income Tax (Sec 148)', calculation: 'ASSESSED_PLUS_ALL', rate: 1, taxAmount: 0, isCapitalized: false, accountId: advItAcc?.id || null }
                    ]
                };
            });

            if (whRes.status === 'fulfilled' && whRes.value.ok) {
                const json = await whRes.value.json();
                setWarehouses(json.data || []);
            }
            if (prodRes.status === 'fulfilled' && prodRes.value.ok) {
                const json = await prodRes.value.json();
                setProducts(json.data || []);
            }
            if (unitRes.status === 'fulfilled' && unitRes.value.ok) {
                const uJson = await unitRes.value.json();
                setUnits(uJson.data || []);
            }
            if (taxRes.status === 'fulfilled' && taxRes.value.ok) {
                const tJson = await taxRes.value.json();
                setTaxCodes(tJson.data || []);
            }
            
            if (currRes.status === 'fulfilled' && currRes.value.ok) {
                const currJson = await currRes.value.json();
                if (currJson.success) {
                    const base = currJson.data.find((c: any) => c.isBase);
                    if (base) setCurrency({ symbol: base.symbol });
                }
            }
        } catch (error) {
            console.error("Error fetching dropdowns:", error);
        }
    };

    const handleAddItem = () => {
        setFormData((prev: any) => ({
            ...prev,
            items: [
                ...prev.items,
                { 
                    id: Date.now().toString() + Math.random().toString().slice(-4), 
                    productId: "", 
                    productName: "", 
                    unitId: "", 
                    qty: 1, 
                    foreignRate: 0, 
                    rate: 0, 
                    foreignAmount: 0, 
                    total: 0, 
                    isEFS: false,
                    isAutoDuties: true,
                    assessedRate: 0,
                    cdAmount: '',
                    rdAmount: '',
                    acdAmount: '',
                    itpRate: 0,
                    assessedValuePKR: 0
                }
            ]
        }));
    };

    const handleExchangeRateChange = (field: 'docExchangeRate' | 'customsExchangeRate', value: number) => {
        const numVal = isNaN(value) ? 0 : value;
        setFormData((prev: any) => {
            const docXRate = field === 'docExchangeRate' ? numVal : Number(prev.docExchangeRate || 1);
            const customsXRate = field === 'customsExchangeRate' ? numVal : Number(prev.customsExchangeRate || 1);

            const updatedItems = prev.items.map((item: any) => {
                const qty = Number(item.qty || 0);
                const foreignRate = Number(item.foreignRate || 0);
                const subtotalFC = qty * foreignRate;
                const aRate = Number(item.assessedRate || 0);
                
                // Assess Value = Assessed Rate X Qty X GD Rate + Insurance + Landing Charges
                const rawPKR = aRate * qty * customsXRate;
                const ins = insuranceType === 'PERCENT' ? (rawPKR * (Number(insuranceValue) || 1) / 100) : 0;
                const land = landingType === 'PERCENT' ? ((rawPKR + ins) * (Number(landingValue) || 1) / 100) : 0;
                const assessedValuePKR = Math.round(rawPKR + ins + land);

                return {
                    ...item,
                    foreignAmount: subtotalFC,
                    rate: foreignRate * docXRate,
                    total: subtotalFC * docXRate,
                    assessedValuePKR
                };
            });

            return {
                ...prev,
                [field]: numVal,
                exchangeRate: docXRate,
                items: updatedItems
            };
        });
    };

    const handleRemoveItem = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            items: prev.items.filter((item: any) => item.id !== id)
        }));
    };

    const updateItem = (id: string, field: string, value: any) => {
        setFormData((prev: any) => {
            const customsXRate = Number(prev.customsExchangeRate || prev.exchangeRate || 1);
            const docXRate = Number(prev.docExchangeRate || prev.exchangeRate || 1);

            const newItems = prev.items.map((item: any) => {
                if (item.id === id) {
                    let refinedValue = value;
                    if (["qty", "foreignRate", "rate", "assessedRate", "cdAmount", "rdAmount", "acdAmount"].includes(field)) {
                        refinedValue = isNaN(value) ? 0 : value;
                    }
                    const updatedItem = { ...item, [field]: refinedValue };
                    
                    // When EFS is toggled, zero out all non-EFS duties (CD, RD, ACD)
                    if (field === "isEFS") {
                        updatedItem.isEFS = Boolean(value);
                        if (value === true) {
                            updatedItem.cdAmount = 0;
                            updatedItem.rdAmount = 0;
                            updatedItem.acdAmount = 0;
                        }
                    }

                    // Auto % Duties vs Manual PKR Toggle
                    if (field === "isAutoDuties") {
                        updatedItem.isAutoDuties = Boolean(value);
                        if (value === true) {
                            updatedItem.cdAmount = '';
                            updatedItem.rdAmount = '';
                            updatedItem.acdAmount = '';
                        }
                    }

                    if (field === "productId") {
                        const prod = products.find(p => p.id === value);
                        updatedItem.productName = prod?.name || "";
                        updatedItem.rate = Number(prod?.purchasePrice || 0);
                        if (prod?.baseUnitId) {
                            updatedItem.unitId = prod.baseUnitId;
                        } else if (prod?.Unit?.id) {
                            updatedItem.unitId = prod.Unit.id;
                        }
                        if (prod?.itpRate) {
                            updatedItem.assessedRate = Number(prod.itpRate);
                        }
                    }

                    const qty = Number(updatedItem.qty || 0);
                    const foreignRate = Number(updatedItem.foreignRate || 0);
                    const subtotalFC = qty * foreignRate;
                    updatedItem.foreignAmount = subtotalFC; 
                    updatedItem.rate = foreignRate * docXRate;
                    updatedItem.total = subtotalFC * docXRate;

                    // Sync between Assessed Rate ($) and Total Assessed Value (PKR as per GD)
                    // Formula: Assessed Value = (Assessed Rate X Qty X GD Rate) + Insurance + Landing Charges
                    if (field === "assessedRate" || field === "qty") {
                        const aRate = Number(updatedItem.assessedRate || 0);
                        const rawPKR = aRate * qty * customsXRate;
                        const ins = insuranceType === 'PERCENT' ? (rawPKR * (Number(insuranceValue) || 1) / 100) : 0;
                        const land = landingType === 'PERCENT' ? ((rawPKR + ins) * (Number(landingValue) || 1) / 100) : 0;
                        updatedItem.assessedValuePKR = Math.round(rawPKR + ins + land);
                    } else if (field === "assessedValuePKR") {
                        const valPKR = isNaN(value) ? 0 : parseFloat(value);
                        updatedItem.assessedValuePKR = Math.round(valPKR);
                        const factor = (1 + (Number(insuranceValue) || 1)/100) * (1 + (Number(landingValue) || 1)/100);
                        const rawPKR = factor > 0 ? (valPKR / factor) : valPKR;
                        updatedItem.assessedRate = (qty > 0 && customsXRate > 0) ? Number((rawPKR / (qty * customsXRate)).toFixed(4)) : 0;
                    }

                    return updatedItem;
                }
                return item;
            });
            return { ...prev, items: newItems };
        });
    };

    // Helper: Extract duty percentages (CD, RD, ACD) from gdTaxes
    const getDutyRates = () => {
        let cdRate = 0;
        let rdRate = 0;
        let acdRate = 0;
        (formData.gdTaxes || []).forEach((t: any) => {
            const name = (t.taxName || '').toLowerCase();
            const r = Number(t.rate) || 0;
            if (name.includes('acd') || name.includes('additional customs')) {
                acdRate += r;
            } else if (name.includes('cd') || name.includes('customs duty')) {
                cdRate += r;
            } else if (name.includes('rd') || name.includes('regulatory')) {
                rdRate += r;
            }
        });
        return { cdRate, rdRate, acdRate };
    };

    // Calculate Insurance in PKR: (Base x 1% or FC / PKR)
    const calculateInsurancePKR = (rawPKR: number) => {
        const customsXRate = Number(formData.customsExchangeRate || 1);
        const foreignTotal = formData.items.reduce((sum: number, it: any) => sum + ((Number(it.qty) || 0) * (Number(it.foreignRate) || 0)), 0);
        const base = rawPKR > 0 ? rawPKR : (foreignTotal * customsXRate);
        const val = Number(insuranceValue) || 0;
        if (insuranceType === 'PERCENT') {
            return Math.round(base * (val / 100));
        } else if (insuranceType === 'FC') {
            return Math.round(val * customsXRate);
        } else {
            return Math.round(val);
        }
    };

    // Calculate Landing Charges in PKR: (Base + Insurance) x 1% or FC / PKR
    const calculateLandingPKR = (rawPKR: number, insPKR: number) => {
        const customsXRate = Number(formData.customsExchangeRate || 1);
        const foreignTotal = formData.items.reduce((sum: number, it: any) => sum + ((Number(it.qty) || 0) * (Number(it.foreignRate) || 0)), 0);
        const base = rawPKR > 0 ? (rawPKR + insPKR) : ((foreignTotal * customsXRate) + insPKR);
        const val = Number(landingValue) || 0;
        if (landingType === 'PERCENT') {
            return Math.round(base * (val / 100));
        } else if (landingType === 'FC') {
            return Math.round(val * customsXRate);
        } else {
            return Math.round(val);
        }
    };

    const calculateSummary = () => {
        const subtotal = Math.round(formData.items.reduce((sum: number, item: any) => sum + ((Number(item.qty) || 0) * (Number(item.rate) || 0)), 0));
        const discount = formData.hasDiscount ? Math.round(Number(formData.discountAmount || 0)) : 0;
        
        // Customs Assessed Value (PKR) entered by user on items
        const totalAssessedPKR = Math.round(formData.items.reduce((sum: number, it: any) => sum + (Number(it.assessedValuePKR) || 0), 0));
        
        // Total raw C&F PKR for all items (before insurance & landing)
        const customsXRate = Number(formData.customsExchangeRate || 1);
        const totalRawPKR = Math.round(formData.items.reduce((sum: number, it: any) => sum + ((Number(it.assessedRate) || 0) * (Number(it.qty) || 0) * customsXRate), 0));
        const effectiveRawBase = totalRawPKR > 0 ? totalRawPKR : (totalAssessedPKR > 0 ? Math.round(totalAssessedPKR / 1.0201) : subtotal);

        // 1. Insurance = Base x 1%
        const insPKR = calculateInsurancePKR(effectiveRawBase);
        
        // 2. Landing = (Base + Insurance) x 1%
        const landPKR = calculateLandingPKR(effectiveRawBase, insPKR);
        const gdChargesTotal = insPKR + landPKR;

        // 3. Pakistan Customs Base for CD, RD, ACD is directly the Customs Assessed Value!
        const customsBasePKR = totalAssessedPKR > 0 ? totalAssessedPKR : (subtotal - discount);

        let runningTotal = subtotal - discount;
        let runningDuties = 0;
        let runningSalesTaxes = 0;
        let taxTotal = 0;
        
        // Calculate duties and taxes on their exact Customs Assessment Bases
        const calculatedTaxes = (formData.gdTaxes || []).map((tax: any) => {
            let baseAmount = customsBasePKR;

            if (tax.calculation === 'ASSESSED_VALUE') {
                // CD, RD, ACD: Base is directly Customs Assessed Value!
                baseAmount = customsBasePKR;
            } else if (tax.calculation === 'ASSESSED_PLUS_DUTIES') {
                // GD Rule for Sales Tax & AST: Assessed Value + CD + RD + ACD
                baseAmount = customsBasePKR + runningDuties;
            } else if (tax.calculation === 'ASSESSED_PLUS_ALL') {
                // GD Rule for Income Tax Sec 148: Assessed Value + Duties + Sales Tax + AST
                baseAmount = customsBasePKR + runningDuties + runningSalesTaxes;
            } else if (tax.calculation === 'PREVIOUS_TOTAL') {
                baseAmount = runningTotal;
            } else if (tax.calculation === 'NET_TOTAL') {
                baseAmount = subtotal - discount;
            }

            baseAmount = Math.round(baseAmount);
            const rate = Number(tax.rate) || 0;
            const taxAmount = rate > 0 ? Math.round(baseAmount * (rate / 100)) : Math.round(Number(tax.taxAmount) || 0);
            
            taxTotal += taxAmount;
            runningTotal += taxAmount;

            const tName = (tax.taxName || '').toLowerCase();
            if (tax.isCapitalized || tName.includes('duty') || tName.includes('cd') || tName.includes('rd') || tName.includes('acd')) {
                runningDuties += taxAmount;
            } else if (tName.includes('sales') || tName.includes('st') || tName.includes('ast')) {
                runningSalesTaxes += taxAmount;
            }
            
            return { ...tax, baseAmount, taxAmount };
        });

        const grandTotal = subtotal - discount + taxTotal + gdChargesTotal;
        
        return { subtotal, discount, taxTotal, gdChargesTotal, insPKR, landPKR, grandTotal, calculatedTaxes, totalAssessedPKR, customsBasePKR };
    };

    const handleAddTax = () => {
        setFormData((prev: any) => ({
            ...prev,
            gdTaxes: [
                ...(prev.gdTaxes || []),
                { id: Date.now().toString(), taxCodeId: "", taxName: "", calculation: "ASSESSED_VALUE", rate: 0, taxAmount: 0, isCapitalized: true, accountId: null }
            ]
        }));
    };

    // Helper: Auto-load standard GD duties for Non-EFS Commercial Imports
    const handleLoadStandardDuties = () => {
        const customsAcc = accounts.find((a: any) => a.code === '2170' || a.name.toLowerCase().includes('customs'));
        const inputStAcc = accounts.find((a: any) => a.code === '1160' || a.name.toLowerCase().includes('input tax'));
        const advItAcc = accounts.find((a: any) => a.code === '1170' || a.name.toLowerCase().includes('advance income'));

        const standardDuties = [
            { id: Date.now().toString() + '1', taxCodeId: '', taxName: 'Customs Duty (CD)', calculation: 'ASSESSED_VALUE', rate: 11, taxAmount: 0, isCapitalized: true, accountId: customsAcc?.id || null },
            { id: Date.now().toString() + '2', taxCodeId: '', taxName: 'Additional Customs Duty (ACD)', calculation: 'ASSESSED_VALUE', rate: 4, taxAmount: 0, isCapitalized: true, accountId: customsAcc?.id || null },
            { id: Date.now().toString() + '3', taxCodeId: '', taxName: 'Regulatory Duty (RD)', calculation: 'ASSESSED_VALUE', rate: 5, taxAmount: 0, isCapitalized: true, accountId: customsAcc?.id || null },
            { id: Date.now().toString() + '4', taxCodeId: '', taxName: 'Sales Tax (ST 18%)', calculation: 'ASSESSED_PLUS_DUTIES', rate: 18, taxAmount: 0, isCapitalized: false, accountId: inputStAcc?.id || null },
            { id: Date.now().toString() + '5', taxCodeId: '', taxName: 'Additional Sales Tax (AST 3%)', calculation: 'ASSESSED_PLUS_DUTIES', rate: 3, taxAmount: 0, isCapitalized: false, accountId: inputStAcc?.id || null },
            { id: Date.now().toString() + '6', taxCodeId: '', taxName: 'Advance Income Tax (Sec 148)', calculation: 'ASSESSED_PLUS_ALL', rate: 2, taxAmount: 0, isCapitalized: false, accountId: advItAcc?.id || null }
        ];

        setFormData((prev: any) => ({
            ...prev,
            gdTaxes: [...(prev.gdTaxes || []), ...standardDuties]
        }));
        showNotification('success', 'Standard Pakistan Customs GD Duties (CD, ACD, RD on Assessed Value; ST on Assessed+Duties; IT on Total) loaded!');
    };

    const handleRemoveTax = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            gdTaxes: (prev.gdTaxes || []).filter((t: any) => t.id !== id)
        }));
    };

    const updateTax = (id: string, field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            gdTaxes: (prev.gdTaxes || []).map((t: any) => {
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
                                updated.accountId = tc.accountId;
                            }
                        }
                    }
                    if (field === 'taxAmount') {
                        updated.taxAmount = isNaN(value) ? 0 : value;
                        updated.rate = 0;
                    }
                    return updated;
                }
                return t;
            })
        }));
    };

    const handleSubmit = async () => {
        if (!formData.supplierId) {
            showNotification('error', 'Please select a Supplier / Import Account.');
            return;
        }

        const validItems = formData.items.filter((i: any) => i.productId && Number(i.qty) > 0);
        if (validItems.length === 0) {
            showNotification('error', 'Please add at least one valid item with quantity.');
            return;
        }

        setIsSubmitting(true);
        try {
            const summary = calculateSummary();
            const dutyRates = getDutyRates();
            const finalTaxes = [...(formData.gdTaxes || [])];

            // Append Insurance to gdTaxes if amount > 0
            if (summary.insPKR > 0) {
                finalTaxes.push({
                    taxName: `Marine Insurance (${insuranceType === 'PERCENT' ? `${insuranceValue}%` : insuranceType === 'FC' ? `$${insuranceValue}` : 'Fixed PKR'})`,
                    rate: insuranceType === 'PERCENT' ? Number(insuranceValue) : 0,
                    baseAmount: summary.totalAssessedPKR > 0 ? summary.totalAssessedPKR : summary.subtotal,
                    taxAmount: summary.insPKR,
                    isCapitalized: true,
                    accountId: insuranceAccountId || null
                });
            }

            // Append Landing Charges to gdTaxes if amount > 0
            if (summary.landPKR > 0) {
                finalTaxes.push({
                    taxName: `Landing Charges (${landingType === 'PERCENT' ? `${landingValue}%` : landingType === 'FC' ? `$${landingValue}` : 'Fixed PKR'})`,
                    rate: landingType === 'PERCENT' ? Number(landingValue) : 0,
                    baseAmount: summary.totalAssessedPKR > 0 ? (summary.totalAssessedPKR + summary.insPKR) : (summary.subtotal + summary.insPKR),
                    taxAmount: summary.landPKR,
                    isCapitalized: true,
                    accountId: landingAccountId || null
                });
            }

            // Map valid items with calculated duties and ITP rate
            const processedItemsToSubmit = validItems.map((it: any) => {
                const qty = Number(it.qty || 0);
                const assessedVal = Math.round(Number(it.assessedValuePKR || 0));
                const isAuto = it.isAutoDuties !== false;

                const autoCD = it.isEFS ? 0 : Math.round(assessedVal * (dutyRates.cdRate / 100));
                const autoRD = it.isEFS ? 0 : Math.round(assessedVal * (dutyRates.rdRate / 100));
                const autoACD = it.isEFS ? 0 : Math.round(assessedVal * (dutyRates.acdRate / 100));

                const cd = it.isEFS ? 0 : (isAuto ? autoCD : (it.cdAmount !== undefined && it.cdAmount !== null && it.cdAmount !== '' ? Number(it.cdAmount) : autoCD));
                const rd = it.isEFS ? 0 : (isAuto ? autoRD : (it.rdAmount !== undefined && it.rdAmount !== null && it.rdAmount !== '' ? Number(it.rdAmount) : autoRD));
                const acd = it.isEFS ? 0 : (isAuto ? autoACD : (it.acdAmount !== undefined && it.acdAmount !== null && it.acdAmount !== '' ? Number(it.acdAmount) : autoACD));
                // ITP Rate = (Assessed Value + RD + CD + ACD) / qty
                const itp = qty > 0 ? Number(((assessedVal + cd + rd + acd) / qty).toFixed(4)) : 0;

                return {
                    ...it,
                    assessedValuePKR: assessedVal,
                    cdAmount: cd,
                    rdAmount: rd,
                    acdAmount: acd,
                    itpRate: itp
                };
            });

            const payload = {
                ...formData,
                items: processedItemsToSubmit,
                gdTaxes: finalTaxes
            };

            const res = await authenticatedFetch('/api/finance/purchase/invoices/import', {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                showNotification('success', 'Import Invoice created and Journal Entry posted successfully!');
                router.push('/finance/purchase/invoices');
            } else {
                const json = await res.json();
                showNotification('error', json.error || 'Failed to create import invoice.');
            }
        } catch (error) {
            showNotification('error', 'Network error while saving import invoice.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const supplierOptions = suppliers.map(s => ({
        value: s.id,
        label: `${s.code ? `${s.code} - ` : ''}${s.name}`
    }));

    const productOptions = products.map(p => {
        const catName = p.Category?.name || p.category?.name || '-';
        const hs = p.hsCode ? ` (HS: ${p.hsCode})` : '';
        return {
            value: p.id,
            label: `${p.name} [${catName}]${hs} - ${p.code}`
        };
    });

    const isAnyEfs = formData.items.some((it: any) => it.isEFS);
    const summary = calculateSummary();

    return (
        <MainLayout>
            <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-36 animate-in fade-in duration-500">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold text-sm"
                    >
                        <ArrowLeft size={16} /> Back to Invoices
                    </button>
                    <div className="flex items-center gap-3">
                        {isAnyEfs && (
                            <span className="flex items-center gap-1.5 text-xs font-black px-3.5 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-full uppercase tracking-wider">
                                <ShieldCheck size={14} /> EFS Duty Exempted Scheme
                            </span>
                        )}
                        <span className="text-xs font-bold px-3 py-1 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 rounded-full uppercase tracking-wider">
                            Direct Import Purchase (GD)
                        </span>
                    </div>
                </div>

                {/* Import Hero Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-indigo-500/10 relative border border-slate-800 z-10">
                    <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    </div>
                    
                    <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Title Header */}
                        <div className="lg:col-span-3 space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                        ● Direct Import Bill
                                    </span>
                                </div>
                                <h1 className="text-3xl font-black text-white tracking-tight">New Import Bill</h1>
                                <p className="text-slate-400 font-medium text-xs mt-1 leading-relaxed">
                                    Direct Goods Declaration (GD) & Commercial Import Invoice with EFS & ITP calculation.
                                </p>
                            </div>
                        </div>
                        
                        {/* Import Details Form */}
                        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Building2 size={14} /> Import Account / Supplier <span className="text-rose-400">*</span>
                                </label>
                                <Combobox
                                    options={supplierOptions}
                                    value={formData.supplierId}
                                    onChange={(val) => setFormData({ ...formData, supplierId: val })}
                                    placeholder="Select import account..."
                                    className="w-full bg-slate-900/50 border-slate-700 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Building2 size={14} /> Beneficiary (Foreign Exporter)
                                </label>
                                <input
                                    type="text"
                                    value={formData.beneficiaryName || ''}
                                    onChange={(e) => setFormData({ ...formData, beneficiaryName: e.target.value })}
                                    placeholder="e.g. Shaoxing Textiles Co."
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Warehouse size={14} /> Target Warehouse (Optional)
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    value={formData.warehouseId}
                                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                                >
                                    <option value="">Choose Warehouse (Optional)...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            {/* GD & BL Info */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest">
                                    <FileText size={14} /> GD Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.gdNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, gdNumber: e.target.value })}
                                    placeholder="e.g. KAPE-HC-12345-2026"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-indigo-500/30 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <FileText size={14} /> BL Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.blNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, blNumber: e.target.value })}
                                    placeholder="e.g. MAEU12345678"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Invoice Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>

                            {/* Dual Exchange Rates */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest" title="Commercial Bank exchange rate charged when retiring shipping documents">
                                    <Calculator size={14} /> Bank Doc Rate (PKR)
                                </label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={formData.docExchangeRate || ''}
                                    onChange={(e) => handleExchangeRateChange('docExchangeRate', parseFloat(e.target.value))}
                                    placeholder="e.g. 280.50"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-emerald-500/40 text-emerald-300 outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                                />
                                <span className="text-[10px] text-slate-500 block">Supplier commercial cost rate</span>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest" title="Customs/National Bank exchange rate printed on GD for duties">
                                    <Calculator size={14} /> Customs GD Rate (PKR)
                                </label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={formData.customsExchangeRate || ''}
                                    onChange={(e) => handleExchangeRateChange('customsExchangeRate', parseFloat(e.target.value))}
                                    placeholder="e.g. 278.20"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-amber-500/40 text-amber-300 outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold"
                                />
                                <span className="text-[10px] text-slate-500 block">GD duty assessment currency rate</span>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calculator size={14} /> Foreign Total (Invoice Val)
                                </label>
                                <input
                                    type="number"
                                    value={formData.foreignTotal || ''}
                                    onChange={(e) => setFormData({ ...formData, foreignTotal: parseFloat(e.target.value) })}
                                    placeholder="0.00"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                                />
                                <span className="text-[10px] text-slate-500 block">Foreign currency sum</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Receipt size={20} className="text-indigo-500" /> Billed Items
                            </h2>
                            {isAnyEfs && (
                                <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 font-extrabold text-xs rounded-xl">
                                    ● EFS ACTIVE: CD, RD, ACD, ST, IT = 0 (Exempt)
                                </span>
                            )}
                        </div>
                        <button 
                            onClick={handleAddItem}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                        >
                            <Plus size={16} /> Add Product
                        </button>
                    </div>

                    <div className="p-6 overflow-visible">
                        <div className="w-full">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-4">Product</div>
                                <div className="col-span-2">Unit</div>
                                <div className="col-span-2 text-right">Bill Qty</div>
                                <div className="col-span-2 text-right">Supplier Rate ($)</div>
                                <div className="col-span-1 text-center">EFS</div>
                                <div className="col-span-1 text-center">Action</div>
                            </div>

                            <div className="space-y-4">
                                {formData.items.map((item: any) => {
                                    const qty = Number(item.qty || 0);
                                    const foreignRate = Number(item.foreignRate || 0);
                                    const totalFC = qty * foreignRate;
                                    const assessedValPKR = Number(item.assessedValuePKR || 0);

                                    const isAutoDuties = item.isAutoDuties !== false;

                                    // Duty rates from gdTaxes below
                                    const dutyRates = getDutyRates();

                                    // CD, RD, ACD: directly calculated on Assessed Value (PKR)
                                    const autoCD = item.isEFS ? 0 : Math.round(assessedValPKR * (dutyRates.cdRate / 100));
                                    const autoRD = item.isEFS ? 0 : Math.round(assessedValPKR * (dutyRates.rdRate / 100));
                                    const autoACD = item.isEFS ? 0 : Math.round(assessedValPKR * (dutyRates.acdRate / 100));

                                    const effectiveCD = item.isEFS ? 0 : (isAutoDuties ? autoCD : (item.cdAmount !== undefined && item.cdAmount !== null && item.cdAmount !== '' ? Number(item.cdAmount) : autoCD));
                                    const effectiveRD = item.isEFS ? 0 : (isAutoDuties ? autoRD : (item.rdAmount !== undefined && item.rdAmount !== null && item.rdAmount !== '' ? Number(item.rdAmount) : autoRD));
                                    const effectiveACD = item.isEFS ? 0 : (isAutoDuties ? autoACD : (item.acdAmount !== undefined && item.acdAmount !== null && item.acdAmount !== '' ? Number(item.acdAmount) : autoACD));

                                    // ITP Rate = (Assessed Value + RD + CD + ACD) / qty
                                    const calculatedITPRate = qty > 0 ? ((assessedValPKR + effectiveCD + effectiveRD + effectiveACD) / qty) : 0;

                                    return (
                                        <div key={item.id} className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 transition-all hover:border-indigo-300 dark:hover:border-indigo-500/40">
                                            {/* Tier 1: Product, Qty, Commercial Supplier Rate */}
                                            <div className="grid grid-cols-12 gap-4 items-center">
                                                <div className="col-span-4">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Product</label>
                                                    <Combobox
                                                        options={productOptions}
                                                        value={item.productId}
                                                        onChange={(val) => updateItem(item.id, 'productId', val)}
                                                        placeholder="Select product..."
                                                        searchPlaceholder="Search products by name, category, HS code..."
                                                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Unit</label>
                                                    <Combobox
                                                        options={units.map(u => ({ value: u.id, label: u.name }))}
                                                        value={item.unitId || ''}
                                                        onChange={(val) => updateItem(item.id, 'unitId', val)}
                                                        placeholder="Unit..."
                                                        searchPlaceholder="Search units..."
                                                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1 text-right">Bill Qty</label>
                                                    <input
                                                        type="number"
                                                        value={item.qty || ''}
                                                        onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))}
                                                        placeholder="0"
                                                        min="0"
                                                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-right"
                                                    />
                                                </div>
                                                
                                                <div className="col-span-2">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Supplier Rate ($)</label>
                                                        {totalFC > 0 && (
                                                            <span className="text-[10px] font-extrabold text-emerald-500 dark:text-emerald-400">
                                                                Total: ${totalFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        value={item.foreignRate || ''}
                                                        onChange={e => updateItem(item.id, 'foreignRate', parseFloat(e.target.value))}
                                                        placeholder="0.00"
                                                        min="0"
                                                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-right text-slate-900 dark:text-white"
                                                    />
                                                </div>

                                                <div className="col-span-1 text-center">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">EFS</label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            className="sr-only peer" 
                                                            checked={item.isEFS}
                                                            onChange={e => updateItem(item.id, 'isEFS', e.target.checked)}
                                                        />
                                                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
                                                    </label>
                                                    {item.isEFS && <span className="text-[9px] block font-black text-amber-500 tracking-tighter">DUTY-FREE</span>}
                                                </div>

                                                <div className="col-span-1 flex justify-center items-center pt-4">
                                                    <button 
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                                                        title="Remove Item"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Tier 2: Customs Assessed Value & ITP Formula Breakdown */}
                                            <div className="bg-white/80 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center gap-5 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Assessed Rate ($):</span>
                                                    <input
                                                        type="number"
                                                        step="0.0001"
                                                        value={item.assessedRate || ''}
                                                        onChange={e => updateItem(item.id, 'assessedRate', parseFloat(e.target.value))}
                                                        placeholder="Rate ($)"
                                                        className="w-28 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right font-semibold text-xs text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider text-xs" title="GD printed Assessed Value in PKR (includes customs insurance & landing)">
                                                        Assessed Value (PKR):
                                                    </span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.assessedValuePKR || ''}
                                                        onChange={e => updateItem(item.id, 'assessedValuePKR', parseFloat(e.target.value))}
                                                        placeholder="As per GD in PKR"
                                                        className="w-44 p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-400/50 text-right font-black text-xs text-indigo-600 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                                    />
                                                </div>

                                                {item.isEFS ? (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                                        <ShieldCheck size={16} />
                                                        <span>EFS EXEMPT: CD, RD & ACD = Rs. 0 (Duty-Free under SRO 957(I)/2021)</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Toggle: % Auto from GD vs Manual PKR */}
                                                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateItem(item.id, 'isAutoDuties', true)}
                                                                className={cn(
                                                                    "px-2.5 py-1 rounded-lg text-[10px] font-black tracking-tight transition-all flex items-center gap-1",
                                                                    isAutoDuties
                                                                        ? "bg-indigo-600 text-white shadow-sm"
                                                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                                                )}
                                                                title="Auto-calculate duties from GD % table below"
                                                            >
                                                                <Percent size={11} /> Auto %
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateItem(item.id, 'isAutoDuties', false)}
                                                                className={cn(
                                                                    "px-2.5 py-1 rounded-lg text-[10px] font-black tracking-tight transition-all flex items-center gap-1",
                                                                    !isAutoDuties
                                                                        ? "bg-amber-600 text-white shadow-sm"
                                                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                                                )}
                                                                title="Enter custom PKR amounts manually"
                                                            >
                                                                <SlidersHorizontal size={11} /> Manual
                                                            </button>
                                                        </div>

                                                        {/* CD */}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                                                                CD {isAutoDuties && dutyRates.cdRate > 0 ? `(${dutyRates.cdRate}%)` : '(PKR)'}:
                                                            </span>
                                                            <input
                                                                type="number"
                                                                value={isAutoDuties ? (autoCD || '') : (item.cdAmount !== undefined && item.cdAmount !== null ? item.cdAmount : '')}
                                                                onChange={e => updateItem(item.id, 'cdAmount', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                                disabled={isAutoDuties}
                                                                placeholder={isAutoDuties ? `${autoCD.toLocaleString()}` : "0"}
                                                                className={cn(
                                                                    "w-28 p-1.5 rounded-xl border text-right font-bold text-xs transition-all",
                                                                    isAutoDuties 
                                                                        ? "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 cursor-not-allowed select-none"
                                                                        : "bg-white dark:bg-slate-900 border-amber-400 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500"
                                                                )}
                                                            />
                                                        </div>

                                                        {/* RD */}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                                                                RD {isAutoDuties && dutyRates.rdRate > 0 ? `(${dutyRates.rdRate}%)` : '(PKR)'}:
                                                            </span>
                                                            <input
                                                                type="number"
                                                                value={isAutoDuties ? (autoRD || '') : (item.rdAmount !== undefined && item.rdAmount !== null ? item.rdAmount : '')}
                                                                onChange={e => updateItem(item.id, 'rdAmount', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                                disabled={isAutoDuties}
                                                                placeholder={isAutoDuties ? `${autoRD.toLocaleString()}` : "0"}
                                                                className={cn(
                                                                    "w-28 p-1.5 rounded-xl border text-right font-bold text-xs transition-all",
                                                                    isAutoDuties 
                                                                        ? "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 cursor-not-allowed select-none"
                                                                        : "bg-white dark:bg-slate-900 border-amber-400 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500"
                                                                )}
                                                            />
                                                        </div>

                                                        {/* ACD */}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                                                                ACD {isAutoDuties && dutyRates.acdRate > 0 ? `(${dutyRates.acdRate}%)` : '(PKR)'}:
                                                            </span>
                                                            <input
                                                                type="number"
                                                                value={isAutoDuties ? (autoACD || 0) : (item.acdAmount !== undefined && item.acdAmount !== null ? item.acdAmount : '')}
                                                                onChange={e => updateItem(item.id, 'acdAmount', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                                disabled={isAutoDuties}
                                                                placeholder="0"
                                                                className={cn(
                                                                    "w-24 p-1.5 rounded-xl border text-right font-bold text-xs transition-all",
                                                                    isAutoDuties 
                                                                        ? "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 cursor-not-allowed select-none"
                                                                        : "bg-white dark:bg-slate-900 border-amber-400 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500"
                                                                )}
                                                            />
                                                        </div>
                                                    </>
                                                )}

                                                {/* Calculated ITP Rate Badge */}
                                                <div className="ml-auto flex items-center gap-3">
                                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">(Assessed + Duties)/Qty:</span>
                                                    <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 rounded-xl font-black text-sm whitespace-nowrap">
                                                        ITP Rate: Rs. {calculatedITPRate.toFixed(2)} / unit
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {formData.items.length === 0 && (
                                    <div className="text-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
                                        <p>No items added yet. Click below to add an import product.</p>
                                        <button
                                            onClick={handleAddItem}
                                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                        >
                                            <Plus size={14} /> Add Product
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Insurance & Landing Charges Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
                                <Anchor size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    Landed Charges (Insurance & Landing Charges)
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Marine Insurance & Port Landing Charges capitalized into inventory cost (IAS 2).
                                </p>
                            </div>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-full">
                            ● Capitalized to Stock Value
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* 1. Marine Insurance */}
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-sky-500" /> Marine Insurance
                                </label>
                                <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400">
                                    Calculated: Rs. {summary.insPKR.toLocaleString()}
                                </span>
                            </div>

                            <div className="grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Calculation Method</label>
                                    <div className="relative">
                                        <select
                                            value={insuranceType}
                                            onChange={(e) => setInsuranceType(e.target.value as any)}
                                            className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs outline-none focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="PERCENT">% (Assessed Value x 1%)</option>
                                            <option value="FC">$ (Foreign Currency at GD Rate)</option>
                                            <option value="PKR">PKR (Direct Rupees)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                        {insuranceType === 'PERCENT' ? 'Rate (%)' : insuranceType === 'FC' ? 'Amount ($)' : 'Amount (PKR)'}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={insuranceValue}
                                        onChange={(e) => setInsuranceValue(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm text-right outline-none focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>

                                <div className="col-span-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Credit Account (Payable)</label>
                                    <Combobox
                                        options={accounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                                        value={insuranceAccountId}
                                        onChange={(val) => setInsuranceAccountId(val)}
                                        placeholder="Insurance Payable..."
                                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Landing Charges */}
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                    <Anchor size={16} className="text-amber-500" /> Landing Charges
                                </label>
                                <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                                    Calculated: Rs. {summary.landPKR.toLocaleString()}
                                </span>
                            </div>

                            <div className="grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Calculation Method</label>
                                    <div className="relative">
                                        <select
                                            value={landingType}
                                            onChange={(e) => setLandingType(e.target.value as any)}
                                            className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="PERCENT">% ((Assessed + Insurance) x 1%)</option>
                                            <option value="FC">$ (Foreign Currency at GD Rate)</option>
                                            <option value="PKR">PKR (Direct Rupees)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                        {landingType === 'PERCENT' ? 'Rate (%)' : landingType === 'FC' ? 'Amount ($)' : 'Amount (PKR)'}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={landingValue}
                                        onChange={(e) => setLandingValue(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm text-right outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>

                                <div className="col-span-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Credit Account (Payable)</label>
                                    <Combobox
                                        options={accounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                                        value={landingAccountId}
                                        onChange={(val) => setLandingAccountId(val)}
                                        placeholder="Port/Clearing Payable..."
                                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Taxes & Charges Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                        <div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Receipt size={20} className="text-indigo-500" /> Customs Duties & Taxes (GD)
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                CD, RD, ACD (Capitalized to Stock), and Sales Tax 18% & Advance Income Tax Sec 148 (Adjustable Receivables).
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {!isAnyEfs && (
                                <button
                                    onClick={handleLoadStandardDuties}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 rounded-xl font-bold text-xs hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                                    title="Auto-fill CD, ACD, RD, ST 18%, AST 3%, IT Sec 148"
                                >
                                    <Sparkles size={14} /> + Add Standard GD Duties (CD, RD, ST, IT)
                                </button>
                            )}
                            <button 
                                onClick={handleAddTax}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                            >
                                <Plus size={16} /> Add Tax
                            </button>
                        </div>
                    </div>

                    <div className="p-6 overflow-visible">
                        <div className="w-full">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-2">Tax Type / Name</div>
                                <div className="col-span-2">Account</div>
                                <div className="col-span-2">Calculate On</div>
                                <div className="col-span-1 text-right">Base</div>
                                <div className="col-span-1 text-right">Rate %</div>
                                <div className="col-span-2 text-right">PKR Amount</div>
                                <div className="col-span-1 text-center">Capit.</div>
                                <div className="col-span-1 text-center">Act</div>
                            </div>

                            <div className="space-y-3">
                                {(formData.gdTaxes || []).map((tax: any, index: number) => {
                                    const computed = summary.calculatedTaxes[index];
                                    return (
                                        <div key={tax.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-indigo-200 dark:hover:border-indigo-500/30">
                                            <div className="col-span-2">
                                                <input
                                                    type="text"
                                                    value={tax.taxName || ''}
                                                    onChange={(e) => updateTax(tax.id, 'taxName', e.target.value)}
                                                    placeholder="Tax / Duty Name..."
                                                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Combobox
                                                    options={accounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                                                    value={tax.accountId || ''}
                                                    onChange={(val) => updateTax(tax.id, 'accountId', val)}
                                                    placeholder="Target Account..."
                                                    searchPlaceholder="Search accounts..."
                                                    className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Combobox
                                                    options={[
                                                        { value: 'ASSESSED_VALUE', label: 'Customs Base (Assessed+Ins+Land for CD, RD, ACD)' },
                                                        { value: 'ASSESSED_PLUS_DUTIES', label: 'Customs Base + Duties (for ST 18% / AST 3%)' },
                                                        { value: 'ASSESSED_PLUS_ALL', label: 'Customs Base + Duties + ST (for IT Sec 148)' },
                                                        { value: 'PREVIOUS_TOTAL', label: 'Previous Row Total (Cascading)' },
                                                        { value: 'NET_TOTAL', label: 'Commercial Invoice Value (PKR)' }
                                                    ]}
                                                    value={tax.calculation}
                                                    onChange={(val) => updateTax(tax.id, 'calculation', val)}
                                                    placeholder="Calculate On..."
                                                    searchPlaceholder="Search options..."
                                                    className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                                                />
                                            </div>
                                            <div className="col-span-1 text-right font-medium text-slate-500 text-xs">
                                                {Math.round(computed?.baseAmount || 0).toLocaleString()}
                                            </div>
                                            <div className="col-span-1">
                                                <input
                                                    type="number"
                                                    value={tax.rate || ''}
                                                    onChange={e => updateTax(tax.id, 'rate', parseFloat(e.target.value))}
                                                    placeholder="0"
                                                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-right"
                                                />
                                            </div>
                                            <div className="col-span-2 text-right font-black text-slate-800 dark:text-white text-sm">
                                                {Math.round(computed?.taxAmount || 0).toLocaleString()}
                                            </div>
                                            <div className="col-span-1 flex flex-col items-center justify-center">
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        className="sr-only peer" 
                                                        checked={tax.isCapitalized}
                                                        onChange={e => updateTax(tax.id, 'isCapitalized', e.target.checked)}
                                                    />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                                </label>
                                                <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                                                    {tax.isCapitalized ? 'Stock Cost' : 'Receivable'}
                                                </span>
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
                                {(formData.gdTaxes || []).length === 0 && (
                                    <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold text-sm">
                                        No customs duties added yet. Click "+ Add Standard GD Duties" for commercial imports, or leave blank if 100% EFS exempt.
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
                            <h3 className="text-base font-black text-slate-800 dark:text-white">Commercial Discount</h3>
                            <p className="text-xs text-slate-400">Apply foreign currency or overall bill discount</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={formData.hasDiscount}
                                onChange={e => setFormData({ ...formData, hasDiscount: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {formData.hasDiscount && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Discount Amount (PKR)</label>
                                <input
                                    type="number"
                                    value={formData.discountAmount || ''}
                                    onChange={e => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Action Footer */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl rounded-[2.5rem] p-4 flex flex-col md:flex-row items-center justify-between gap-6 max-w-[1700px] w-[95%] transition-all">
                    <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-start px-2">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Goods Value (FC)</p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                Rs. {Math.round(summary.subtotal).toLocaleString()}
                            </p>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">Insurance & Landing</p>
                            <p className="text-sm font-black text-sky-600 dark:text-sky-400">
                                + Rs. {Math.round(summary.gdChargesTotal).toLocaleString()}
                            </p>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duties & Taxes</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                + Rs. {Math.round(summary.taxTotal).toLocaleString()}
                            </p>
                        </div>

                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 hidden md:flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Calculator size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Total Landed Value</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
                                    Rs. {Math.round(summary.grandTotal).toLocaleString()}
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
        </MainLayout>
    );
}
