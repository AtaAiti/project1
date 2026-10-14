import type { MenuItem } from "@/lib/content";
import { stockImage } from "@/lib/demo-content";
export const MENU_CATEGORIES=["Коктейли","Безалкогольные","Кофе","Чай","Вино","Пиво","Крепкий алкоголь","Закуски","Салаты","Горячее","Десерты"] as const;
export function menuImage(item: Pick<MenuItem,"category">){
 if(item.category==="Десерты")return stockImage("dessert");
 if(item.category==="Горячее")return stockImage("pasta");
 if(["Закуски","Салаты"].includes(item.category))return stockImage("salad");
 if(["Кофе","Чай","Безалкогольные"].includes(item.category))return stockImage("coffee");
 return stockImage("cocktails");
}
