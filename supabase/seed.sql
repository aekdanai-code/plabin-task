insert into public.categories (category_name, color, sort_order)
values
  ('สินค้าใหม่', '#FF3B30', 10),
  ('งานกราฟิก', '#AF52DE', 20),
  ('Marketplace', '#007AFF', 30),
  ('สต๊อกสินค้า', '#FF9500', 40),
  ('งานทั่วไป', '#8E8E93', 50)
on conflict do nothing;

insert into public.settings (key, value)
values ('allow_viewer_clone', '{"enabled": true}'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
