-- Packages and menu items lose their text description: the details now live in an
-- uploaded PDF (R2 key under packages/ or menu/, NULL = no PDF yet).

ALTER TABLE packages ADD COLUMN pdf_key TEXT;
ALTER TABLE packages DROP COLUMN description;
ALTER TABLE packages DROP COLUMN description_bm;

ALTER TABLE menu_items ADD COLUMN pdf_key TEXT;
ALTER TABLE menu_items DROP COLUMN description;
ALTER TABLE menu_items DROP COLUMN description_bm;
