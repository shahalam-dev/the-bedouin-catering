-- Testimonial details for the redesigned home section: who they are ("Bride"), where ("Shah Alam")
-- and the event ("Reception · 600 guests"). event_type is edited in the CMS again.
ALTER TABLE testimonials ADD COLUMN role TEXT;
ALTER TABLE testimonials ADD COLUMN location TEXT;
ALTER TABLE testimonials ADD COLUMN event_detail TEXT;
