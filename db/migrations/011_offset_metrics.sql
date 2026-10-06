-- Per-project outcome metrics.
--
-- The carbon offset reference shows two outcome rows per project ("Trees planted
-- 1,200", "Area restored 25 acres"). The existing `outcome` TEXT column holds one
-- free-text sentence and cannot express that, so metrics get their own table rather
-- than being encoded into a delimited string that a UI would have to parse.
--
-- icon_key is an application-level token ("tree", "cloud"), never a path or markup.
-- The interface maps it to a component. Storing a key rather than an icon name
-- means adding a glyph does not require a data migration.
CREATE TABLE IF NOT EXISTS offset_project_metrics (
  id         BIGSERIAL PRIMARY KEY,
  project_id BIGINT      NOT NULL REFERENCES offset_projects(id) ON DELETE CASCADE,
  icon_key   TEXT        NOT NULL,
  label      TEXT        NOT NULL,
  value      TEXT        NOT NULL,
  -- Preserves the reference's row order within a card.
  position   SMALLINT    NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS offset_project_metrics_project_idx
  ON offset_project_metrics (project_id, position);