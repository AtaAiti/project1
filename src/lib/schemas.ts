import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const VENUE_TIME_ZONE = "Asia/Bishkek";
const requiredText = z
  .string({ error: "validation.required" })
  .trim()
  .min(1, "validation.required")
  .max(200, "validation.invalid");
const description = z.string().trim().max(5000, "validation.invalid");
const optionalText = z.string().trim().max(200, "validation.invalid");
const imageUrl = z.union([
  z.literal(""),
  z.url().refine((value) => value.startsWith("https://"), "validation.invalid"),
]);
export const phoneSchema = z
  .string({ error: "validation.phone" })
  .transform((input, ctx) => {
    const phone = normalizePhone(input);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "validation.phone" });
      return z.NEVER;
    }
    return phone;
  });
const formInteger = z.union(
  [
    z.number(),
    z.string().regex(/^\d+$/, "validation.guests").transform(Number),
  ],
  { error: "validation.guests" },
);
const guestsSchema = formInteger
  .pipe(z.number().int().min(1).max(20))
  .refine(Number.isSafeInteger, "validation.guests");
const dateSchema = z.iso.date({ error: "validation.date" });
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "validation.time");

export const bookingSchema = z.strictObject({
  name: requiredText,
  phone: phoneSchema,
  date: dateSchema,
  time: timeSchema,
  guests: guestsSchema,
  comment: description.default(""),
  website: z.string().max(1000).optional(),
});

export const rsvpSchema = z.strictObject({
  event_id: z.uuid({ error: "validation.invalid" }),
  name: requiredText,
  phone: phoneSchema,
  guests: formInteger
    .pipe(
      z
        .number()
        .int({ error: "validation.guests" })
        .min(1, "validation.guests")
        .max(6, "validation.guests"),
    )
    .default(1),
  website: z.string().max(1000).optional(),
});

export const resourceSchemas = {
  menu_items: z.strictObject({
    category: requiredText,
    name_ru: requiredText,
    name_en: requiredText,
    composition_ru: description.default(""),
    composition_en: description.default(""),
    strength: optionalText.default(""),
    portion_ru: optionalText.default(""),
    portion_en: optionalText.default(""),
    price: z.number().finite().min(0).max(1000000),
    is_hit: z.boolean().default(false),
  }),
  events: z.strictObject({
    date: dateSchema,
    time: timeSchema,
    title_ru: requiredText,
    title_en: requiredText,
    description_ru: description.default(""),
    description_en: description.default(""),
    image_url: imageUrl.default(""),
    capacity: z.number().int().positive().max(1000000).nullable().default(null),
    is_club_meeting: z.boolean().default(false),
    status: z.enum(["draft", "published", "moderation"]).default("draft"),
  }),
  gallery_photos: z.strictObject({
    image_url: z.url().refine((value) => value.startsWith("https://")),
    caption_ru: optionalText.default(""),
    caption_en: optionalText.default(""),
  }),
  reviews: z.strictObject({
    author: requiredText,
    rating: z.number().int().min(1).max(5),
    text_ru: description.min(1),
    text_en: description.default(""),
    status: z.enum(["published", "moderation"]).default("moderation"),
  }),
  // Reserved foundation contracts; tables/features arrive in their respective PRs.
  books: z.strictObject({
    title_ru: requiredText,
    title_en: requiredText,
    author: requiredText,
    description_ru: description.default(""),
    description_en: description.default(""),
    cover_url: imageUrl.default(""),
    is_current: z.boolean().default(false),
  }),
  event_rsvps: z.strictObject({
    event_id: z.uuid(),
    name: requiredText,
    phone: phoneSchema,
    guests: formInteger.pipe(z.number().int().min(1).max(6)).default(1),
  }),
};
export type AdminResource = keyof typeof resourceSchemas;
export const adminResourceSchema = z.enum([
  "menu_items",
  "events",
  "gallery_photos",
  "reviews",
  "books",
  "event_rsvps",
]);
export const adminDeleteSchema = z.strictObject({ id: z.uuid() });
export const adminListQuerySchema = z.strictObject({
  event_id: z.uuid().optional(),
});
export const adminBookingStatusSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(["pending", "confirmed", "declined"]),
});
export const reviewSubmissionSchema = z.strictObject({
  author: requiredText,
  rating: formInteger.pipe(z.number().int().min(1).max(5)),
  text: description.min(1, "validation.required"),
  locale: z.enum(["ru", "en"]),
  website: z.string().max(1000).optional(),
});
export const adminEmailSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email({ error: "validation.email" })),
});

export function adminPatchSchema(resource: AdminResource) {
  const shape = Object.fromEntries(
    Object.entries(resourceSchemas[resource].shape).map(([key, field]) => [
      key,
      (field instanceof z.ZodDefault
        ? field.removeDefault()
        : field
      ).optional(),
    ]),
  );
  return z
    .strictObject({ ...shape, id: z.uuid() })
    .refine(
      (value) => Object.keys(value).some((key) => key !== "id"),
      "validation.required",
    );
}

/** Strip read-only DB columns in existing editors, while the API rejects unknown input. */
export function adminEditorPayload(
  resource: "menu_items" | "events",
  input: object,
) {
  const fields = Object.keys(resourceSchemas[resource].shape);
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) =>
        fields.includes(key) || (key === "id" && Boolean(value)),
    ),
  );
}

export const mediaMetadataSchema = z.strictObject({
  folder: z.enum(["gallery", "books"]),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});
