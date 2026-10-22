import type { MenuItem } from "@/lib/content";
import { stockImage } from "@/lib/demo-content";
export const MENU_CATEGORIES=["Коктейли","Безалкогольные","Кофе","Чай","Вино","Пиво","Крепкий алкоголь","Закуски","Салаты","Горячее","Десерты"] as const;
export function categoryImage(category: string){
 if(category==="Десерты")return stockImage("dessert");
 if(category==="Горячее")return stockImage("pasta");
 if(["Закуски","Салаты"].includes(category))return stockImage("salad");
 if(["Кофе","Чай","Безалкогольные"].includes(category))return stockImage("coffee");
 return stockImage("cocktails");
}
export function menuImage(item: Pick<MenuItem,"category" | "image_url">){
 return item.image_url || categoryImage(item.category);
}
