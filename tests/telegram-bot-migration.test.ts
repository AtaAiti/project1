import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, expect, it } from "vitest";
let db: PGlite;
const actor="11111111-1111-4111-8111-111111111111", booking="22222222-2222-4222-8222-222222222222";
const bot=10, chat=20;
const replies={normal:[],changed:[{method:'sendMessage',params:{chat_id:chat,text:'{booking_status}'}}],conflict:[{method:'sendMessage',params:{chat_id:chat,text:'Already {booking_status}'}}],status_labels:{confirmed:'Confirmed',declined:'Declined'}};
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);");
 await db.exec(await readFile(new URL('../supabase/migrations/20261013000100_0001_baseline.sql',import.meta.url),'utf8'));
 await db.exec("alter table bookings add column if not exists status text not null default 'pending'");
 const sql=await readFile(new URL('../supabase/migrations/20261022000200_0006_telegram_bot.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await db.query('insert into auth.users(id) values($1)',[actor]);
 await db.query("insert into bookings(id,name,phone,date,time,guests,status) values($1,'Test','+996700000000','2099-11-01','19:00',2,'pending')",[booking]);
 await db.query('insert into telegram_admins(bot_id,telegram_user_id,chat_id,web_user_id) values($1,$2,$2,$3)',[bot,chat,actor]);
},30000);
afterAll(async()=>{await db?.close();});
async function finish(update:number,action:string='confirm',data:unknown=replies){return (await db.query<{result:{duplicate:boolean;outcome:string}}>('select finish_telegram_update($1,$2,$3,$3,$4,$5::jsonb,$6,$7,$8) as result',[bot,update,chat,'en',JSON.stringify(data),action,booking,actor])).rows[0].result;}
it('changes the booking, audits and queues the response atomically; replays do nothing',async()=>{
 expect(await finish(1)).toEqual({duplicate:false,outcome:'changed'});
 expect(await finish(1)).toEqual({duplicate:true});
 expect((await db.query('select * from booking_status_audit')).rows).toHaveLength(1);
 const {rows}=await db.query<{job:{params:{text:string}}}>('select job from telegram_outbox');expect(rows).toHaveLength(1);expect(rows[0].job.params.text).toBe('Confirmed');
 expect((await finish(2,'decline')).outcome).toBe('conflict');
 expect((await db.query<{status:string}>('select status from bookings where id=$1',[booking])).rows[0].status).toBe('confirmed');
});
it('rolls back both decision and dedup marker if the durable response is invalid',async()=>{
 await db.query("update bookings set status='pending' where id=$1",[booking]);
 await expect(finish(3,'confirm',{...replies,changed:[{method:'unsafeMethod',params:{}}]})).rejects.toThrow();
 expect((await db.query('select * from telegram_updates where update_id=3')).rows).toHaveLength(0);
 expect((await db.query<{status:string}>('select status from bookings where id=$1',[booking])).rows[0].status).toBe('pending');
});
it('leases deliveries and acknowledges only the matching lease',async()=>{
 const jobs=(await db.query<{id:string;lease_token:string}>('select * from claim_telegram_delivery($1,1)',[bot])).rows;expect(jobs).toHaveLength(1);
 expect((await db.query('select * from claim_telegram_delivery($1,1)',[bot])).rows).toHaveLength(0);
 expect((await db.query<{ok:boolean}>('select ack_telegram_delivery($1,$2,true,false,5) as ok',[jobs[0].id,actor])).rows[0].ok).toBe(false);
 expect((await db.query<{ok:boolean}>('select ack_telegram_delivery($1,$2,true,false,5) as ok',[jobs[0].id,jobs[0].lease_token])).rows[0].ok).toBe(true);
});
it('consumes a pairing token once and creates a private chat binding',async()=>{
 const hash='a'.repeat(64);await db.query("insert into telegram_link_tokens(token_hash,web_user_id,expires_at) values($1,$2,now()+interval '10 minutes')",[hash,actor]);
 const result=await db.query<{r:{outcome:string}}>('select finish_telegram_update($1,10,30,30,$2,$3::jsonb,$4,null,$5,$6) r',[bot,'en',JSON.stringify({normal:[],link_expired:[]}),'link',actor,hash]);expect(result.rows[0].r.outcome).toBe('normal');
 expect((await db.query('select * from telegram_link_tokens')).rows).toHaveLength(0);
 expect((await db.query('select * from telegram_admins where telegram_user_id=30')).rows).toHaveLength(1);
});
it('denies private tables and all bot/status RPCs to browser roles',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await expect(db.exec('select * from telegram_settings')).rejects.toThrow();
  await expect(db.exec('select * from telegram_outbox')).rejects.toThrow();
  await expect(db.exec(`select transition_booking_status('${booking}','declined','pending','${actor}','telegram')`)).rejects.toThrow();
  await expect(db.exec('select * from claim_telegram_delivery(10,1)')).rejects.toThrow();
  await db.exec('reset role');
 }
});
