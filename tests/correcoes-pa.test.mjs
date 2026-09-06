import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const admin = '00000000-0000-0000-0000-000000000001';
const gestora = '00000000-0000-0000-0000-000000000002';
const inativa = '00000000-0000-0000-0000-000000000003';
const vendedora = '00000000-0000-0000-0000-000000000004';
const outra = '00000000-0000-0000-0000-000000000005';
const dia = '10000000-0000-0000-0000-000000000001';

test('correção atômica, autorização, conflito e isolamento dos avisos', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  // Estrutura mínima das tabelas existentes; as migrations em teste são executadas sem alterações.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to authenticated, anon;
    create table auth.users (id uuid primary key);
    create table public.perfis (id uuid primary key, nome text, papel text, ativo boolean);
    create table public.usuarios_pa (id uuid primary key, ativo boolean);
    create table public.lojas (id bigint primary key, codigo text, nome text);
    create table public.dias_pa (id uuid primary key, usuario_id uuid, data date, situacao text);
    create table public.lancamentos_pa (id bigint primary key, dia_id uuid, loja_id bigint,
      vendas integer check(vendas >= 0), pecas integer check(pecas >= vendas), atualizado_em timestamptz,
      unique(dia_id,loja_id));
    alter table public.perfis enable row level security;
    alter table public.usuarios_pa enable row level security;
    alter table public.lancamentos_pa enable row level security;
    create policy perfil_proprio on public.perfis for select to authenticated using(id=auth.uid());
    create policy usuario_proprio on public.usuarios_pa for select to authenticated using(id=auth.uid());
    grant select on public.perfis,public.usuarios_pa to authenticated;
    insert into auth.users values ('${admin}'),('${gestora}'),('${inativa}'),('${vendedora}'),('${outra}');
    insert into public.perfis values ('${admin}','Admin','admin',true),('${gestora}','Gestora','gestora',true),
      ('${inativa}','Inativa','admin',false),('${vendedora}','Vendedora','vendedora',true);
    insert into public.usuarios_pa values ('${vendedora}',true),('${outra}',true);
    insert into public.lojas values (1,'CB','Clube Bijoux'),(2,'AA','Arte Acessórios');
    insert into public.dias_pa values ('${dia}','${vendedora}','2026-09-01','trabalhado');
    insert into public.lancamentos_pa values (1,'${dia}',1,10,20,now());
  `);
  for (const name of ['20260903222000_criar_conferencias_pa.sql', '20260904014006_correcoes_pa_com_notificacao.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
  await db.exec(`insert into public.conferencias_pa values
    ('${vendedora}','2026-09-01',1,'${admin}',now()),('${vendedora}','2026-09-01',2,'${admin}',now());`);
  const asUser = async (id) => {
    await db.exec('reset role; set role authenticated;');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  };
  const corrigir = (vendas=12,pecas=26,antesVendas=10,antesPecas=20,motivo='Conferência do comprovante',usuario=vendedora) => db.query(
    'select public.corrigir_lancamento_pa($1,$2,$3,$4,$5,$6,$7,$8,$9) as id',
    [usuario,dia,'2026-09-01',1,antesVendas,antesPecas,vendas,pecas,motivo]);
  await t.test('vendedora e gestão inativa não corrigem', async () => {
    for (const id of [vendedora,inativa]) {
      await asUser(id);
      await assert.rejects(corrigir(), /Somente a gestão ativa/);
    }
    await db.exec('reset role; set role anon;');
    await assert.rejects(corrigir(), /permission denied/);
  });
  let correcao;
  await t.test('gestora corrige, registra antes/depois e invalida só a loja afetada', async () => {
    await asUser(gestora);
    correcao=(await corrigir()).rows[0].id;
    const aviso=(await db.query('select * from public.correcoes_pa')).rows[0];
    assert.equal(aviso.vendas_antes,10); assert.equal(aviso.vendas_depois,12);
    assert.equal(aviso.pecas_antes,20); assert.equal(aviso.pecas_depois,26);
    assert.equal(aviso.corrigido_por,gestora); assert.equal(aviso.usuario_id,vendedora);
    assert.equal(aviso.corrigido_por_nome,'Gestora'); assert.equal(aviso.lida_em,null);
    await db.exec('reset role');
    assert.equal((await db.query('select vendas from public.lancamentos_pa')).rows[0].vendas,12);
    assert.deepEqual((await db.query('select loja_id from public.conferencias_pa')).rows.map(r=>Number(r.loja_id)),[2]);
  });
  await t.test('validação e conflito não produzem correções extras', async () => {
    await asUser(admin);
    await assert.rejects(corrigir(), /lançamento mudou/);
    await assert.rejects(corrigir(12,26,12,26), /Altere vendas/);
    await assert.rejects(corrigir(10,9,12,26), /Informe vendas/);
    await assert.rejects(corrigir(-1,1,12,26), /Informe vendas/);
    await assert.rejects(corrigir(1,1000,12,26), /Informe vendas/);
    await assert.rejects(corrigir(1,2,12,26,' '), /Informe o motivo/);
    await assert.rejects(corrigir(1,2,12,26,'Motivo',outra), /dia foi alterado/);
    assert.equal((await db.query('select count(*)::int n from public.correcoes_pa')).rows[0].n,1);
  });
  await t.test('somente a destinatária marca como lido, sem editar o histórico', async () => {
    await asUser(outra);
    assert.equal((await db.query('select * from public.correcoes_pa')).rows.length,0);
    assert.equal((await db.query('update public.correcoes_pa set lida_em=now() returning id')).rows.length,0);
    await asUser(gestora);
    assert.equal((await db.query('update public.correcoes_pa set lida_em=now() returning id')).rows.length,0);
    await asUser(vendedora);
    assert.equal((await db.query('select * from public.correcoes_pa')).rows.length,1);
    await assert.rejects(db.query("update public.correcoes_pa set motivo='Outro motivo'"),/permission denied/);
    await assert.rejects(db.query('delete from public.correcoes_pa'),/permission denied/);
    const lida=await db.query('update public.correcoes_pa set lida_em=now() where id=$1 returning id',[correcao]);
    assert.equal(lida.rows[0].id,correcao);
  });
  await t.test('falha no aviso desfaz a alteração dos números', async () => {
    await db.exec(`reset role; create function public.falhar_aviso() returns trigger language plpgsql as
      $$begin raise exception 'Falha simulada no aviso'; end;$$;
      create trigger teste_falha before insert on public.correcoes_pa for each row execute function public.falhar_aviso();`);
    await asUser(admin);
    await assert.rejects(corrigir(13,30,12,26),/Falha simulada/);
    await db.exec('reset role');
    assert.equal((await db.query('select vendas from public.lancamentos_pa')).rows[0].vendas,12);
    await db.exec('drop trigger teste_falha on public.correcoes_pa');
  });
  await t.test('zero é válido e gera um novo aviso, mesmo após leitura anterior', async () => {
    await asUser(admin);
    await corrigir(0,0,12,26);
    await asUser(vendedora);
    assert.equal((await db.query('select count(*)::int n from public.correcoes_pa where lida_em is null')).rows[0].n,1);
  });
});
