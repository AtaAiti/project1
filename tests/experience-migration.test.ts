import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll,afterAll,expect,it } from "vitest";
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
 await db.exec(await readFile(new URL("../supabase/migrations/20261013000100_0001_baseline.sql",import.meta.url),"utf8"));
 await db.exec("insert into menu_items(id,category,name_ru,name_en) values('d3e00000-0000-4000-8000-000000000001','Коктейли','Demo','Demo')");
 const sql=await readFile(new URL("../supabase/migrations/20261015000100_0004_menu_and_team.sql",import.meta.url),"utf8");
 await db.exec(sql);await db.exec("update menu_items set portion_ru='250 мл',portion_en='250 ml'");await db.exec(sql);
},30000);
afterAll(async()=>{await db?.close();});
it("preserves existing portion edits when reapplied",async()=>{expect((await db.query<{portion_ru:string}>("select portion_ru from menu_items")).rows[0].portion_ru).toBe("250 мл");});
it("keeps team identities private from browser roles",async()=>{
 await db.exec("insert into admin_members(email) values('member@example.com')");
 for(const role of ["anon","authenticated"]){await db.exec(`set role ${role}`);await expect(db.exec("select * from admin_members")).rejects.toThrow();await expect(db.exec("insert into admin_members(email) values('attacker@example.com')")).rejects.toThrow();await db.exec("reset role");}
 await db.exec("set role service_role");expect((await db.query("select email from admin_members")).rows).toHaveLength(1);await db.exec("reset role");
});
it("enforces normalized team addresses",async()=>{await expect(db.exec("insert into admin_members(email) values(' Member@Example.com ')")).rejects.toThrow();});
