import { describe, expect, it } from "vitest";
import { menuImage, categoryImage } from "@/lib/menu-presentation";
import { resourceSchemas } from "@/lib/schemas";
const item = { category: "Горячее", name_ru: "Блюдо", name_en: "Dish", price: 200 };
describe("per-item menu images", () => {
  it("prefers the assigned photo on both public surfaces over category illustrations", () => {
    expect(menuImage({ ...item, image_url: "https://example.com/actual-dish.jpg" })).toBe("https://example.com/actual-dish.jpg");
    expect(menuImage(item)).toBe(categoryImage("Горячее"));
  });
  it.each([undefined, "", "http://example.com/photo.jpg", "javascript:alert(1)", "/private/photo.jpg"])("rejects missing or unsafe menu photos: %s", (image_url) => {
    expect(resourceSchemas.menu_items.safeParse({ ...item, image_url }).success).toBe(false);
  });
  it.each(["https://example.com/photo.jpg", "/images/stock/pasta.jpg"])("accepts an assigned photo or an explicit legacy illustration: %s", image_url => {
    expect(resourceSchemas.menu_items.safeParse({ ...item, image_url }).success).toBe(true);
  });
});
