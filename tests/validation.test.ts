import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";
import { verifyHoneypot } from "@/lib/honeypot";
import { bookingSchema, resourceSchemas, adminPatchSchema, adminDeleteSchema, adminEditorPayload, adminResourceSchema, mediaMetadataSchema } from "@/lib/schemas";

const booking = { name: "Атабек", phone: "+996 (700) 123-456", date: "2026-11-01", time: "19:00", guests: "2" };

describe("Kyrgyzstan phone normalization", () => {
  it.each(["+996 700 123-456", "996700123456", "0700123456", "700123456"])("normalizes %s", (value) => expect(normalizePhone(value)).toBe("+996700123456"));
  it.each(["+79991234567", "+99670012345", "+9967001234567", "+996abc123456", "++996700123456", "700123456ext1", "", null, 996700123456])("rejects unsupported or invalid phone %s", (value) => expect(normalizePhone(value)).toBeNull());
});

describe("honeypot", () => {
  it.each([{}, { website: "" }, { website: "  " }, { website: null }])("passes a legitimate form", (body) => expect(verifyHoneypot(body)).toBe(true));
  it.each([{ website: "https://spam.example" }, { website: 1 }, { website: {} }, { website: false }])("rejects populated or malformed hidden fields", (body) => expect(verifyHoneypot(body)).toBe(false));
});

describe("strict request schemas", () => {
  it("normalizes booking inputs and defaults optional fields", () => {
    expect(bookingSchema.parse(booking)).toMatchObject({ phone: "+996700123456", guests: 2, comment: "" });
  });
  it.each([{ guests: 0 }, { guests: 21 }, { guests: 1.5 }, { guests: "" }, { guests: true }, { date: "2026-02-30" }, { time: "24:00" }, { name: " " }, { status: "confirmed" }, { phone: "+79991234567" }])("rejects invalid booking %j", (changes) => expect(bookingSchema.safeParse({ ...booking, ...changes }).success).toBe(false));
  it.each(Object.keys(resourceSchemas) as Array<keyof typeof resourceSchemas>)("rejects unknown fields in %s", (resource) => {
    expect(adminPatchSchema(resource).safeParse({ id: "11111111-1111-4111-8111-111111111111", malicious_column: "value" }).success).toBe(false);
  });
  it("keeps PATCH partial without applying create defaults", () => {
    expect(adminPatchSchema("events").parse({ id: "11111111-1111-4111-8111-111111111111", title_ru: "Новое название" })).toEqual({ id: "11111111-1111-4111-8111-111111111111", title_ru: "Новое название" });
    expect(adminPatchSchema("events").safeParse({ id: "11111111-1111-4111-8111-111111111111" }).success).toBe(false);
  });
  it("rejects invalid price, rating and IDs", () => {
    expect(adminPatchSchema("menu_items").safeParse({ id: "bad", price: -1 }).success).toBe(false);
    expect(adminPatchSchema("reviews").safeParse({ id: "11111111-1111-4111-8111-111111111111", rating: 6 }).success).toBe(false);
    expect(adminDeleteSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111", role: "admin" }).success).toBe(false);
  });
  it("reserves future resources without allowing arbitrary table names", () => {
    expect(adminResourceSchema.parse("books")).toBe("books");
    expect(adminResourceSchema.parse("event_rsvps")).toBe("event_rsvps");
    expect(adminResourceSchema.safeParse("bookings").success).toBe(false);
  });
  it("existing editors omit read-only columns", () => {
    expect(adminEditorPayload("events", { id: "id", title_ru: "Title", created_at: "now", unexpected: true })).toEqual({ id: "id", title_ru: "Title" });
  });
  it("accepts complete resource bodies and rejects invalid resource-specific values", () => {
    expect(resourceSchemas.menu_items.safeParse({ category: "Коктейли", name_ru: "Тест", name_en: "Test", price: 100 }).success).toBe(true);
    expect(resourceSchemas.events.safeParse({ date: "2026-11-01", time: "19:30:00", title_ru: "Тест", title_en: "Test" }).success).toBe(true);
    expect(resourceSchemas.gallery_photos.safeParse({ image_url: "https://example.com/photo.png" }).success).toBe(true);
    expect(resourceSchemas.reviews.safeParse({ author: "Test", rating: 5, text_ru: "Тест" }).success).toBe(true);
    expect(resourceSchemas.books.safeParse({ title_ru: "Тест", title_en: "Test", author: "Test" }).success).toBe(true);
    expect(resourceSchemas.event_rsvps.safeParse({ event_id: "11111111-1111-4111-8111-111111111111", name: "Test", phone: "0700123456", guests: 6 }).success).toBe(true);
    expect(resourceSchemas.event_rsvps.safeParse({ event_id: "11111111-1111-4111-8111-111111111111", name: "Test", phone: "0700123456", guests: 7 }).success).toBe(false);
    expect(resourceSchemas.gallery_photos.safeParse({ image_url: "javascript:alert(1)" }).success).toBe(false);
    expect(resourceSchemas.books.safeParse({ title_ru: "Тест", title_en: "Test", author: "Test", is_current: "true" }).success).toBe(false);
  });
  it("rejects oversized uploads", () => {
    expect(mediaMetadataSchema.safeParse({ folder: "books", type: "image/png", size: 5242881 }).success).toBe(false);
  });
});
