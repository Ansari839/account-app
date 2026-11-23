"use client";

import React, { use } from "react";
import ProductionExecutionWizard from "../../new/page";

export default function EditProductionExecutionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return <ProductionExecutionWizard editId={id} />;
}
