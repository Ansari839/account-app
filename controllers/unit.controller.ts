
import { NextResponse } from 'next/server';
import { UnitService } from '@/services/unit.service';

export class UnitController {
    static async getAll() {
        try {
            const units = await UnitService.getAllUnits();
            return NextResponse.json({ success: true, data: units });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async create(req: Request) {
        try {
            const body = await req.json();
            const unit = await UnitService.createUnit(body);
            return NextResponse.json({ success: true, data: unit });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async addConversion(req: Request) {
        try {
            const body = await req.json();
            const conversion = await UnitService.addConversion(body);
            return NextResponse.json({ success: true, data: conversion });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }
}
