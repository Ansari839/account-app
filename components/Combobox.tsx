"use client";

import React, { useState, useRef, useEffect } from 'react';

interface Option {
    value: string;
    label: string;
}

interface ComboboxProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
    id?: string;
    placeholder?: string;
    onKeyDown?: (e: React.KeyboardEvent) => void;
}

export default function Combobox({ options, value, onChange, placeholder = "Select...", className, disabled = false, id, onKeyDown }: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isPointer, setIsPointer] = useState(false);

    const selectedOption = options.find(o => o.value === value);

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Reset highlight when search changes
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [searchTerm]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            triggerRef.current?.focus();
            return;
        }

        if (e.key === 'Tab') {
            // Let the browser naturally move focus to the next element, but close the dropdown
            setIsOpen(false);
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
                onChange(filteredOptions[highlightedIndex].value);
                setIsOpen(false);
                setSearchTerm("");
                // Return focus to wrapper so user can tab to next field
                setTimeout(() => triggerRef.current?.focus(), 0);
            } else if (filteredOptions.length === 1) {
                onChange(filteredOptions[0].value);
                setIsOpen(false);
                setSearchTerm("");
                setTimeout(() => triggerRef.current?.focus(), 0);
            }
        }
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <button
                type="button"
                id={id}
                ref={triggerRef}
                disabled={disabled}
                className={`w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/50 flex justify-between items-center transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onPointerDown={() => setIsPointer(true)}
                onFocus={() => {
                    if (!disabled && !isOpen && !isPointer) {
                        setIsOpen(true);
                    }
                    setIsPointer(false);
                }}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={(e) => {
                    if (onKeyDown) onKeyDown(e);
                    if (e.defaultPrevented) return;

                    // Open on Enter/Space if closed
                    if ((e.key === 'Enter' || e.key === ' ') && !isOpen) {
                        e.preventDefault();
                        setIsOpen(true);
                    } else if (e.key === 'ArrowDown' && !isOpen) {
                        e.preventDefault();
                        setIsOpen(true);
                    }
                }}
            >
                <span className={`block truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-900 dark:text-white font-medium'}`}>
                    {selectedOption?.label || placeholder}
                </span>
                <span className="text-slate-400 text-xs">▼</span>
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 sticky top-0">
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full p-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-slate-400 text-slate-900 dark:text-white transition-all shadow-sm"
                            placeholder="Search account..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, idx) => (
                                <div
                                    key={option.value}
                                    className={`p-3 text-sm rounded-lg cursor-pointer transition-colors ${
                                        option.value === value 
                                            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold' 
                                            : highlightedIndex === idx
                                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium'
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                        setSearchTerm("");
                                        // Give focus back to trigger so Tab goes to the next cell
                                        triggerRef.current?.focus();
                                    }}
                                >
                                    {option.label}
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-sm text-slate-400 text-center font-medium">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
