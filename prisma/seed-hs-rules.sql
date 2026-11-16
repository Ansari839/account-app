-- Seed standard FBR Textile Reverse Consumption Rules
INSERT INTO hs_consumption_rules (
    id, output_hs_code, construction_type, fiber_type, stage_order, stage_name, stage_output_hs_code, yarn_range_start, yarn_range_end, default_unit, default_wastage_pct, created_at, updated_at
)
VALUES
-- 1. 6214.3000 (Woven Synthetic Scarves - Staple)
(gen_random_uuid(), '6214.3000', 'WOVEN', 'STAPLE', 1, 'YARN', NULL, '5509.1100', '5509.6900', 'KG', 1.50, NOW(), NOW()),
(gen_random_uuid(), '6214.3000', 'WOVEN', 'STAPLE', 2, 'WEAVING', '5515.1190', NULL, NULL, 'MTR', 1.50, NOW(), NOW()),
(gen_random_uuid(), '6214.3000', 'WOVEN', 'STAPLE', 3, 'PRINTING', '5515.1290', NULL, NULL, 'MTR', 0.50, NOW(), NOW()),
(gen_random_uuid(), '6214.3000', 'WOVEN', 'STAPLE', 4, 'DYEING', '5512.1900', NULL, NULL, 'KG', 0.50, NOW(), NOW()),
(gen_random_uuid(), '6214.3000', 'WOVEN', 'STAPLE', 5, 'CMT', '6214.3000', NULL, NULL, 'PCS', 0.50, NOW(), NOW()),

-- 6214.3000 (Woven Synthetic Scarves - Filament)
(gen_random_uuid(), '6214.3000', 'WOVEN', 'FILAMENT', 1, 'YARN', NULL, '5402.1100', '5402.6900', 'KG', 1.50, NOW(), NOW()),
(gen_random_uuid(), '6214.3000', 'WOVEN', 'FILAMENT', 2, 'WEAVING', '5407.6100', NULL, NULL, 'MTR', 1.50, NOW(), NOW()),
(gen_random_uuid(), '6214.3000', 'WOVEN', 'FILAMENT', 3, 'PRINTING', '5407.6100', NULL, NULL, 'MTR', 0.50, NOW(), NOW()),
(gen_random_uuid(), '6214.3000', 'WOVEN', 'FILAMENT', 4, 'DYEING', '5407.6100', NULL, NULL, 'KG', 0.50, NOW(), NOW()),
(gen_random_uuid(), '6214.3000', 'WOVEN', 'FILAMENT', 5, 'CMT', '6214.3000', NULL, NULL, 'PCS', 0.50, NOW(), NOW()),

-- 2. 6006.3400 (Printed Polyester Knitted Fabric - Loose)
(gen_random_uuid(), '6006.3400', 'KNITTED', 'FILAMENT', 1, 'YARN', NULL, '5402.1100', '5402.6900', 'KG', 1.50, NOW(), NOW()),
(gen_random_uuid(), '6006.3400', 'KNITTED', 'FILAMENT', 2, 'KNITTING', '6006.3110', NULL, NULL, 'KG', 1.50, NOW(), NOW()),
(gen_random_uuid(), '6006.3400', 'KNITTED', 'FILAMENT', 3, 'PRINTING', '6006.3400', NULL, NULL, 'KG', 1.00, NOW(), NOW()),
(gen_random_uuid(), '6006.3400', 'KNITTED', 'FILAMENT', 4, 'DYEING', '6006.3400', NULL, NULL, 'KG', 0.00, NOW(), NOW()),

-- 6006.3400 (Staple)
(gen_random_uuid(), '6006.3400', 'KNITTED', 'STAPLE', 1, 'YARN', NULL, '5509.1100', '5509.6900', 'KG', 1.50, NOW(), NOW()),
(gen_random_uuid(), '6006.3400', 'KNITTED', 'STAPLE', 2, 'KNITTING', '6006.3110', NULL, NULL, 'KG', 1.50, NOW(), NOW()),
(gen_random_uuid(), '6006.3400', 'KNITTED', 'STAPLE', 3, 'PRINTING', '6006.3400', NULL, NULL, 'KG', 1.00, NOW(), NOW()),

-- 3. 6006.3200 (Dyed Polyester Knitted Fabric)
(gen_random_uuid(), '6006.3200', 'KNITTED', 'FILAMENT', 1, 'YARN', NULL, '5402.1100', '5402.6900', 'KG', 2.00, NOW(), NOW()),
(gen_random_uuid(), '6006.3200', 'KNITTED', 'FILAMENT', 2, 'KNITTING', '6006.3110', NULL, NULL, 'KG', 2.00, NOW(), NOW()),
(gen_random_uuid(), '6006.3200', 'KNITTED', 'FILAMENT', 3, 'DYEING', '6006.3200', NULL, NULL, 'KG', 0.00, NOW(), NOW()),

-- 6006.3200 (Staple)
(gen_random_uuid(), '6006.3200', 'KNITTED', 'STAPLE', 1, 'YARN', NULL, '5509.1100', '5509.6900', 'KG', 2.00, NOW(), NOW()),
(gen_random_uuid(), '6006.3200', 'KNITTED', 'STAPLE', 2, 'KNITTING', '6006.3110', NULL, NULL, 'KG', 2.00, NOW(), NOW()),
(gen_random_uuid(), '6006.3200', 'KNITTED', 'STAPLE', 3, 'DYEING', '6006.3200', NULL, NULL, 'KG', 0.00, NOW(), NOW()),

-- 4. 6117.1000 (Knitted Synthetic Scarves - CMT)
(gen_random_uuid(), '6117.1000', 'KNITTED', 'FILAMENT', 1, 'YARN', NULL, '5402.1100', '5402.6900', 'KG', 1.50, NOW(), NOW()),
(gen_random_uuid(), '6117.1000', 'KNITTED', 'FILAMENT', 2, 'KNITTING', '6006.3110', NULL, NULL, 'KG', 1.50, NOW(), NOW()),
(gen_random_uuid(), '6117.1000', 'KNITTED', 'FILAMENT', 3, 'DYEING', '6006.3200', NULL, NULL, 'KG', 0.50, NOW(), NOW()),
(gen_random_uuid(), '6117.1000', 'KNITTED', 'FILAMENT', 4, 'CMT', '6117.1000', NULL, NULL, 'PCS', 0.50, NOW(), NOW())
ON CONFLICT DO NOTHING;
