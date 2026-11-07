-- Mejora #20: cumpleaños (MM-DD, sin año) y una nota por cliente. Aditiva.
alter table public.clientes add column if not exists cumpleanos text, add column if not exists nota text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_cumpleanos_valido') then
    alter table public.clientes add constraint clientes_cumpleanos_valido check (cumpleanos is null or cumpleanos ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clientes_nota_largo') then
    alter table public.clientes add constraint clientes_nota_largo check (nota is null or char_length(nota) <= 500);
  end if;
end $$;
grant insert (cumpleanos, nota), update (cumpleanos, nota) on table public.clientes to authenticated;
