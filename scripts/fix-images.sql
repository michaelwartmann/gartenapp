-- Fix broken Unsplash image URLs for all 8 plants
-- Run this SQL in your Supabase SQL editor

-- Tomate (Solanum lycopersicum)
UPDATE plants SET illustration_url = 'https://images.unsplash.com/photo-1592841200221-76275bd5499b?w=300&h=300&fit=crop&auto=format' WHERE name = 'Tomate';

-- Basilikum (Ocimum basilicum)
UPDATE plants SET illustration_url = 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=300&h=300&fit=crop&auto=format' WHERE name = 'Basilikum';

-- Möhre (Daucus carota)
UPDATE plants SET illustration_url = 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=300&h=300&fit=crop&auto=format' WHERE name = 'Möhre';

-- Zucchini (Cucurbita pepo)
UPDATE plants SET illustration_url = 'https://images.unsplash.com/photo-1579113800032-c38bd7635818?w=300&h=300&fit=crop&auto=format' WHERE name = 'Zucchini';

-- Ringelblume (Calendula officinalis)
UPDATE plants SET illustration_url = 'https://images.unsplash.com/photo-1563909940-1c8f3af6c70b?w=300&h=300&fit=crop&auto=format' WHERE name = 'Ringelblume';

-- Spinat (Spinacia oleracea)
UPDATE plants SET illustration_url = 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300&h=300&fit=crop&auto=format' WHERE name = 'Spinat';

-- Rosmarin (Salvia rosmarinus)
UPDATE plants SET illustration_url = 'https://images.unsplash.com/photo-1569163600638-8ed3b6ba4a99?w=300&h=300&fit=crop&auto=format' WHERE name = 'Rosmarin';

-- Kürbis (Cucurbita maxima)
UPDATE plants SET illustration_url = 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=300&h=300&fit=crop&auto=format' WHERE name = 'Kürbis';