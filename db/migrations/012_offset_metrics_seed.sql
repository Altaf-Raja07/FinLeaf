-- Offset outcome metrics and corrected project locations.
--
-- The reference shows two outcome rows per project card ("Trees planted 1,200",
-- "Area restored 25 acres"), which the single free-text `outcome` column cannot
-- express. Metrics now live in their own table, keyed by an application-level icon
-- token rather than markup, so adding a glyph needs no data migration.

UPDATE offset_projects SET location = 'Dharwad district, Karnataka' WHERE code = 'trees-doddawadi';
UPDATE offset_projects SET location = 'Rural Karnataka'               WHERE code = 'clean-cookstoves';
UPDATE offset_projects SET location = 'Coastal Karnataka'             WHERE code = 'mangrove-coast';

INSERT INTO offset_project_metrics (project_id, icon_key, label, value, position)
SELECT p.id, m.icon_key, m.label, m.value, m.position
  FROM (VALUES
    ('trees-doddawadi','tree',  'Trees planted',      '1,200',    1),
    ('trees-doddawadi','cloud', 'Area restored',      '25 acres', 2),
    ('clean-cookstoves','stove','Cookstoves funded',  '310',      1),
    ('clean-cookstoves','cloud','Families supported', '310',      2),
    ('mangrove-coast','tree',  'Saplings planted',   '4,500',    1),
    ('mangrove-coast','waves', 'Coastline protected','12 km',    2)
  ) AS m(code, icon_key, label, value, position)
  JOIN offset_projects p ON p.code = m.code
WHERE NOT EXISTS (
  SELECT 1 FROM offset_project_metrics x WHERE x.project_id = p.id AND x.position = m.position
);

-- The offset rate shown on each card is derived from co2e_kg / points_cost rather
-- than stored, so it cannot drift out of step with the two numbers it is built
-- from. Recorded here so the derivation is not mistaken for a third source value:
--
--   trees-doddawadi   720 / 600  = 1.2 kg per point
--   clean-cookstoves  910 / 800  = 1.1 kg per point
--   mangrove-coast   1480 / 1100 = 1.3 kg per point
--
-- The carbon offset reference prints "About 12 kg CO2e offset per 600 points",
-- which implies 0.02 kg per point. That is three orders of magnitude below what a
-- tree absorbs and is not reproducible from any defensible figure, so the seed keeps
-- its own numbers and the divergence is recorded in artifacts/visual/REPORT.md
-- rather than being forced to match.