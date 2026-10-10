import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name ?? "").trim(); const phone = String(body.phone ?? "").trim(); const date = String(body.date ?? ""); const time = String(body.time ?? ""); const guests = Number(body.guests); const comment = String(body.comment ?? "").trim();
  if (!name || phone.replace(/\D/g, "").length < 11 || !date || !time || !Number.isInteger(guests) || guests < 1 || guests > 20) return NextResponse.json({ error: "Проверьте данные формы" }, { status: 400 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: true, demo: true, message: "Supabase не настроен: заявка проверена в demo-режиме" });
  const supabase = createAdminClient(); const { data, error } = await supabase.from("bookings").insert({ name, phone, date, time, guests, comment }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) { await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: `Новая бронь ${data.id}\n${name}, ${phone}\n${date} ${time}, гостей: ${guests}\n${comment}` }) }); }
  return NextResponse.json({ ok: true, id: data.id });
}
