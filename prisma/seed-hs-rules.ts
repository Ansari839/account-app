import prisma from "../lib/prisma";

export async function seedHsConsumptionRules() {
    console.log("Seeding HS Consumption Rules...");

    const rules = [
        // 1. 6214.3000 (Woven Synthetic Scarves - Staple)
        {
            outputHsCode: "6214.3000",
            constructionType: "WOVEN",
            fiberType: "STAPLE",
            stageOrder: 1,
            stageName: "YARN",
            stageOutputHsCode: null,
            yarnRangeStart: "5509.1100",
            yarnRangeEnd: "5509.6900",
            defaultUnit: "KG",
            defaultWastagePct: 1.50
        },
        {
            outputHsCode: "6214.3000",
            constructionType: "WOVEN",
            fiberType: "STAPLE",
            stageOrder: 2,
            stageName: "WEAVING",
            stageOutputHsCode: "5515.1190",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "MTR",
            defaultWastagePct: 1.50
        },
        {
            outputHsCode: "6214.3000",
            constructionType: "WOVEN",
            fiberType: "STAPLE",
            stageOrder: 3,
            stageName: "PRINTING",
            stageOutputHsCode: "5515.1290",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "MTR",
            defaultWastagePct: 0.50
        },
        {
            outputHsCode: "6214.3000",
            constructionType: "WOVEN",
            fiberType: "STAPLE",
            stageOrder: 4,
            stageName: "DYEING",
            stageOutputHsCode: "5512.1900",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 0.50
        },
        {
            outputHsCode: "6214.3000",
            constructionType: "WOVEN",
            fiberType: "STAPLE",
            stageOrder: 5,
            stageName: "CMT",
            stageOutputHsCode: "6214.3000",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "PCS",
            defaultWastagePct: 0.50
        },

        // 6214.3000 (Woven Synthetic Scarves - Filament)
        {
            outputHsCode: "6214.3000",
            constructionType: "WOVEN",
            fiberType: "FILAMENT",
            stageOrder: 1,
            stageName: "YARN",
            stageOutputHsCode: null,
            yarnRangeStart: "5402.1100",
            yarnRangeEnd: "5402.6900",
            defaultUnit: "KG",
            defaultWastagePct: 1.50
        },
        {
            outputHsCode: "6214.3000",
            constructionType: "WOVEN",
            fiberType: "FILAMENT",
            stageOrder: 2,
            stageName: "WEAVING",
            stageOutputHsCode: "5407.6100",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "MTR",
            defaultWastagePct: 1.50
        },
        {
            outputHsCode: "6214.3000",
            constructionType: "WOVEN",
            fiberType: "FILAMENT",
            stageOrder: 3,
            stageName: "PRINTING",
            stageOutputHsCode: "5407.6100",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "MTR",
            defaultWastagePct: 0.50
        },
        {
            outputHsCode: "6214.3000",
            constructionType: "WOVEN",
            fiberType: "FILAMENT",
            stageOrder: 4,
            stageName: "DYEING",
            stageOutputHsCode: "5407.6100",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 0.50
        },
        {
            outputHsCode: "6214.3000",
            constructionType: "WOVEN",
            fiberType: "FILAMENT",
            stageOrder: 5,
            stageName: "CMT",
            stageOutputHsCode: "6214.3000",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "PCS",
            defaultWastagePct: 0.50
        },

        // 2. 6006.3400 (Printed Polyester Knitted Fabric - Loose)
        {
            outputHsCode: "6006.3400",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 1,
            stageName: "YARN",
            stageOutputHsCode: null,
            yarnRangeStart: "5402.1100",
            yarnRangeEnd: "5402.6900",
            defaultUnit: "KG",
            defaultWastagePct: 1.50
        },
        {
            outputHsCode: "6006.3400",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 2,
            stageName: "KNITTING",
            stageOutputHsCode: "6006.3110",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 1.50
        },
        {
            outputHsCode: "6006.3400",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 3,
            stageName: "PRINTING",
            stageOutputHsCode: "6006.3400",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 1.00
        },
        {
            outputHsCode: "6006.3400",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 4,
            stageName: "DYEING",
            stageOutputHsCode: "6006.3400",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 0.00
        },

        // 6006.3400 (Staple)
        {
            outputHsCode: "6006.3400",
            constructionType: "KNITTED",
            fiberType: "STAPLE",
            stageOrder: 1,
            stageName: "YARN",
            stageOutputHsCode: null,
            yarnRangeStart: "5509.1100",
            yarnRangeEnd: "5509.6900",
            defaultUnit: "KG",
            defaultWastagePct: 1.50
        },
        {
            outputHsCode: "6006.3400",
            constructionType: "KNITTED",
            fiberType: "STAPLE",
            stageOrder: 2,
            stageName: "KNITTING",
            stageOutputHsCode: "6006.3110",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 1.50
        },
        {
            outputHsCode: "6006.3400",
            constructionType: "KNITTED",
            fiberType: "STAPLE",
            stageOrder: 3,
            stageName: "PRINTING",
            stageOutputHsCode: "6006.3400",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 1.00
        },

        // 3. 6006.3200 (Dyed Polyester Knitted Fabric)
        {
            outputHsCode: "6006.3200",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 1,
            stageName: "YARN",
            stageOutputHsCode: null,
            yarnRangeStart: "5402.1100",
            yarnRangeEnd: "5402.6900",
            defaultUnit: "KG",
            defaultWastagePct: 2.00
        },
        {
            outputHsCode: "6006.3200",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 2,
            stageName: "KNITTING",
            stageOutputHsCode: "6006.3110",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 2.00
        },
        {
            outputHsCode: "6006.3200",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 3,
            stageName: "DYEING",
            stageOutputHsCode: "6006.3200",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 0.00
        },

        // 6006.3200 (Staple)
        {
            outputHsCode: "6006.3200",
            constructionType: "KNITTED",
            fiberType: "STAPLE",
            stageOrder: 1,
            stageName: "YARN",
            stageOutputHsCode: null,
            yarnRangeStart: "5509.1100",
            yarnRangeEnd: "5509.6900",
            defaultUnit: "KG",
            defaultWastagePct: 2.00
        },
        {
            outputHsCode: "6006.3200",
            constructionType: "KNITTED",
            fiberType: "STAPLE",
            stageOrder: 2,
            stageName: "KNITTING",
            stageOutputHsCode: "6006.3110",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 2.00
        },
        {
            outputHsCode: "6006.3200",
            constructionType: "KNITTED",
            fiberType: "STAPLE",
            stageOrder: 3,
            stageName: "DYEING",
            stageOutputHsCode: "6006.3200",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 0.00
        },

        // 4. 6117.1000 (Knitted Synthetic Scarves - CMT)
        {
            outputHsCode: "6117.1000",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 1,
            stageName: "YARN",
            stageOutputHsCode: null,
            yarnRangeStart: "5402.1100",
            yarnRangeEnd: "5402.6900",
            defaultUnit: "KG",
            defaultWastagePct: 1.50
        },
        {
            outputHsCode: "6117.1000",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 2,
            stageName: "KNITTING",
            stageOutputHsCode: "6006.3110",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 1.50
        },
        {
            outputHsCode: "6117.1000",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 3,
            stageName: "DYEING",
            stageOutputHsCode: "6006.3200",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "KG",
            defaultWastagePct: 0.50
        },
        {
            outputHsCode: "6117.1000",
            constructionType: "KNITTED",
            fiberType: "FILAMENT",
            stageOrder: 4,
            stageName: "CMT",
            stageOutputHsCode: "6117.1000",
            yarnRangeStart: null,
            yarnRangeEnd: null,
            defaultUnit: "PCS",
            defaultWastagePct: 0.50
        }
    ];

    for (const rule of rules) {
        const existing = await prisma.hsConsumptionRule.findFirst({
            where: {
                outputHsCode: rule.outputHsCode,
                constructionType: rule.constructionType,
                fiberType: rule.fiberType,
                stageName: rule.stageName
            }
        });

        if (!existing) {
            await prisma.hsConsumptionRule.create({
                data: rule
            });
        }
    }

    console.log(`✓ Seeded ${rules.length} HS Consumption Rules successfully.`);
}

if (require.main === module) {
    seedHsConsumptionRules()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("Seeding error:", err);
            process.exit(1);
        });
}
