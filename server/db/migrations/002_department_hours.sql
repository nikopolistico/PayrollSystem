-- Department scan hours. Paste into the Neon SQL Editor ONCE (after 001). Keeps all data.
-- NULL start/end = no limit. Start later than end = window crosses midnight (night shift).
BEGIN;

ALTER TABLE department
    ADD COLUMN time_in_start  TIME,
    ADD COLUMN time_in_end    TIME,
    ADD COLUMN time_out_start TIME,
    ADD COLUMN time_out_end   TIME,
    ADD CONSTRAINT chk_time_in_pair  CHECK ((time_in_start  IS NULL) = (time_in_end  IS NULL)),
    ADD CONSTRAINT chk_time_out_pair CHECK ((time_out_start IS NULL) = (time_out_end IS NULL));

COMMIT;
