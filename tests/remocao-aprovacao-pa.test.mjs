import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('remoção de aprovação persiste e respeita perfil, vendedora, mês e loja', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const admin = '00000000-0000-0000-0000-000000000001';
  const gestora = '00000000-0000-0000-0000-000000000002';
  const inativa = '00000000-0000-0000-0000-000000000003';
  const vendedora = '00000000-0000-0000-0000-000000000004';
  const outra = '00000000-0000-0000-0000-000000000005';
  await db.exec(`
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated;
    create table perfis (id uuid primary key, papel text, ativo boolean);
    alter table perfis enable row level security;
    create policy perfil_proprio on perfis for select to authenticated using(id=auth.uid());
    grant select on perfis to authenticated;
    insert into perfis values ('${admin}','admin',true),('${gestora}','gestora',true),
      ('${inativa}','admin',false),('${vendedora}','vendedora',true);
    create table conferencias_pa (usuario_id uuid, mes date, loja_id bigint, primary key(usuario_id,mes,loja_id));
    alter table conferencias_pa enable row level security;
    grant select,delete on conferencias_pa to authenticated;
    create policy gestao_le_conferencias_pa on conferencias_pa for select to authenticated
      using(exists(select 1 from perfis where id=auth.uid() and ativo and papel in ('admin','gestora')));
    insert into conferencias_pa values ('${vendedora}','2026-09-01',1),('${vendedora}','2026-09-01',2),
      ('${vendedora}','2026-08-01',1),('${outra}','2026-09-01',1);
  `);
  const asUser = async (id) => {
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  };
  const remover = () => db.query('delete from conferencias_pa where usuario_id=$1 and mes=$2 and loja_id=$3 returning *',
    [vendedora,'2026-09-01',1]);
  await asUser(admin);
  assert.equal((await remover()).rows.length,0,'Reproduz DELETE sem erro que não remove nada quando falta policy');
  assert.equal((await db.query('select * from conferencias_pa')).rows.length,4);
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../supabase/migrations/20260904015555_permitir_remocao_conferencias_pa.sql',import.meta.url),'utf8'));
  for (const id of [inativa,vendedora]) {
    await asUser(id);
    assert.equal((await remover()).rows.length,0,'Perfis sem autorização não removem');
  }
  await asUser(gestora);
  assert.equal((await remover()).rows.length,1,'Gestora remove a aprovação selecionada');
  // Nova consulta representa a recarga: registro segue ausente.
  assert.equal((await db.query('select * from conferencias_pa where usuario_id=$1 and mes=$2 and loja_id=$3',
    [vendedora,'2026-09-01',1])).rows.length,0);
  assert.equal((await db.query('select * from conferencias_pa')).rows.length,3,'Preserva outras lojas, meses e vendedoras');
  await asUser(admin);
  assert.equal((await db.query('delete from conferencias_pa where usuario_id=$1 and mes=$2 and loja_id=2 returning *',
    [vendedora,'2026-09-01'])).rows.length,1,'Admin também remove');
  assert.equal((await remover()).rows.length,0,'Uma segunda tentativa não deve ser apresentada como nova remoção');
});
