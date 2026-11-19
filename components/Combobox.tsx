"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Option {
    value: string;
    label: string;
    sublabel?: string;
}

interface ComboboxProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
    id?: string;
    placeholder?: string;
    searchPlaceholder?: string;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    position?: 'top' | 'bottom';
    forceDark?: boolean;
    size?: 'sm' | 'md' | 'lg';
    clearable?: boolean;
}

export default function Combobox({ 
    options, 
    value, 
    onChange, 
    placeholder = "Select...", 
    searchPlaceholder = "Search...", 
    className, 
    disabled = false, 
    id, 
    onKeyDown, 
    position = 'bottom', 
    forceDark = false,
    size = 'md',
    clearable = false
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Auto-detect dark mode if forceDark or if caller passed dark classes
    const isDark = forceDark || 
        Boolean(className && (
            className.includes('bg-slate-900') || 
            className.includes('bg-slate-950') || 
            className.includes('text-white') ||
            className.includes('border-slate-700') ||
            className.includes('border-slate-800')
        ));

    const selectedOption = options.find(o => String(o.value) === String(value));

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (option.sublabel && option.sublabel.toLowerCase().includes(searchTerm.toLowerCase())) ||
        String(option.value).toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Reset highlight when search changes
    useEffect(() => {
        setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
    }, [searchTerm, filteredOptions.length]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (isOpen && highlightedIndex >= 0 && listRef.current) {
            const items = listRef.current.querySelectorAll('[data-combobox-item]');
            if (items[highlightedIndex]) {
                items[highlightedIndex].scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedIndex, isOpen]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm("");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 30);
        }
    }, [isOpen]);

    const selectOption = useCallback((val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearchTerm("");
        // Return focus to trigger button so user can continue keyboard navigation
        requestAnimationFrame(() => {
            triggerRef.current?.focus();
        });
    }, [onChange]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchTerm("");
            triggerRef.current?.focus();
            return;
        }

        if (e.key === 'Tab') {
            setIsOpen(false);
            setSearchTerm("");
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                selectOption(filteredOptions[highlightedIndex].value);
            } else if (filteredOptions.length === 1) {
                selectOption(filteredOptions[0].value);
            }
        }
    };

    const sizeClasses = {
        sm: "py-1.5 px-3 text-xs rounded-lg min-h-[36px]",
        md: "py-2.5 px-3.5 text-sm rounded-xl min-h-[42px]",
        lg: "py-3 px-4 text-base rounded-2xl min-h-[48px]"
    }[size];

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <button
                type="button"
                id={id}
                ref={triggerRef}
                disabled={disabled}
                className={cn(
                    "w-full border flex justify-between items-center transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left cursor-pointer",
                    sizeClasses,
                    isDark 
                        ? "bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-400 hover:border-slate-600 focus:ring-offset-slate-900" 
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 dark:focus:ring-offset-slate-900",
                    disabled && "opacity-50 cursor-not-allowed",
                    className
                )}
                onClick={() => !disabled && setIsOpen(prev => !prev)}
                onKeyDown={(e) => {
                    if (onKeyDown) onKeyDown(e);
                    if (e.defaultPrevented) return;

                    if ((e.key === 'Enter' || e.key === ' ') && !isOpen) {
                        e.preventDefault();
                        setIsOpen(true);
                    } else if (e.key === 'ArrowDown' && !isOpen) {
                        e.preventDefault();
                        setIsOpen(true);
                    }
                }}
            >
                <span className={cn(
                    "block truncate font-medium flex-1 mr-2",
                    !selectedOption 
                        ? (isDark ? "text-slate-400" : "text-slate-400 dark:text-slate-500 font-normal")
                        : (isDark ? "text-white" : "text-slate-900 dark:text-white")
                )}>
                    {selectedOption?.label || placeholder}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                    {clearable && selectedOption && !disabled && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange("");
                            }}
                            className={cn(
                                "p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors",
                                isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <X size={14} />
                        </span>
                    )}
                    <ChevronDown 
                        size={16} 
                        className={cn(
                            "transition-transform duration-200",
                            isDark ? "text-slate-400" : "text-slate-400 dark:text-slate-500",
                            isOpen && "rotate-180"
                        )} 
                    />
                </div>
            </button>

            {isOpen && (
                <div 
                    className={cn(
                        "absolute z-[9999] w-full border rounded-2xl shadow-2xl max-h-72 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150",
                        isDark 
                            ? "bg-slate-900 border-slate-700 text-white shadow-black/70" 
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xl shadow-slate-900/10"
                    )}
                    style={position === 'top' ? { bottom: '100%', marginBottom: '6px' } : { top: '100%', marginTop: '6px' }}
                >
                    {/* Search Input Bar */}
                    <div className={cn(
                        "p-2.5 border-b sticky top-0 z-10 flex items-center gap-2",
                        isDark ? "border-slate-800 bg-slate-900" : "border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm"
                    )}>
                        <Search size={15} className={cn("shrink-0", isDark ? "text-slate-400" : "text-slate-400 dark:text-slate-500")} />
                        <input
                            ref={inputRef}
                            type="text"
                            className={cn(
                                "w-full text-sm outline-none bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium",
                                isDark ? "text-white" : "text-slate-900 dark:text-white"
                            )}
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm("")}
                                className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Options List */}
                    <div ref={listRef} className="overflow-y-auto flex-1 p-1.5 space-y-0.5">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, idx) => {
                                const isSelected = String(option.value) === String(value);
                                const isHighlighted = highlightedIndex === idx;

                                return (
                                    <div
                                        key={`${option.value}-${idx}`}
                                        data-combobox-item
                                        className={cn(
                                            "px-3 py-2 text-sm rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-2",
                                            isSelected 
                                                ? (isDark ? "bg-indigo-600/25 text-indigo-300 font-bold" : "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold")
                                                : isHighlighted
                                                    ? (isDark ? "bg-slate-800 text-white font-medium" : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium")
                                                    : (isDark ? "text-slate-300 hover:bg-slate-800/60" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60")
                                        )}
                                        onMouseDown={(e) => {
                                            // Prevent input from losing focus prematurely
                                            e.preventDefault();
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            selectOption(option.value);
                                        }}
                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                    >
                                        <div className="flex flex-col truncate">
                                            <span className="truncate">{option.label}</span>
                                            {option.sublabel && (
                                                <span className={cn(
                                                    "text-xs truncate font-normal",
                                                    isDark ? "text-slate-400" : "text-slate-400 dark:text-slate-500"
                                                )}>
                                                    {option.sublabel}
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <Check size={15} className="shrink-0 text-indigo-500 dark:text-indigo-400" />
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-6 px-4 text-xs font-semibold text-slate-400 text-center flex flex-col items-center justify-center gap-1">
                                <span>No results matching &ldquo;{searchTerm}&rdquo;</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
