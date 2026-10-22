import { ResourceEditor } from "@/components/admin/resource-editor";
import { getDictionary } from "@/lib/dictionaries";
import { MENU_CATEGORIES } from "@/lib/menu-presentation";
export default function MenuPage() {
  const { admin: t, experience: x, publicUi: u } = getDictionary("ru");
  return (
    <ResourceEditor
      resource="menu_items"
      title={t.menu}
      addLabel={t.addItem}
      titleField="name_ru"
      detailField="composition_ru"
      imageField="image_url"
      search
      defaults={{
        category: t.defaultCategory,
        name_ru: "",
        name_en: "",
        image_url: "",
        composition_ru: "",
        composition_en: "",
        strength: "",
        portion_ru: "",
        portion_en: "",
        price: 0,
        is_hit: false,
      }}
      fields={[
        {
          key: "category",
          label: t.category,
          type: "select",
          required: true,
          options: MENU_CATEGORIES.map((category) => ({
            value: category,
            label:
              u.categoryLabels[category as keyof typeof u.categoryLabels] ||
              category,
          })),
        },
        { key: "name_ru", label: t.nameRu, required: true },
        { key: "name_en", label: t.nameEn, required: true },
        { key: "image_url", label: getDictionary("ru").menuPhotos.field, type: "image", required: true },
        { key: "composition_ru", label: t.compositionRu, type: "textarea" },
        { key: "composition_en", label: t.compositionEn, type: "textarea" },
        { key: "strength", label: t.strength },
        { key: "portion_ru", label: x.portionRu },
        { key: "portion_en", label: x.portionEn },
        {
          key: "price",
          label: t.price,
          type: "number",
          min: 0,
          max: 1000000,
          required: true,
        },
        { key: "is_hit", label: t.hit, type: "checkbox" },
      ]}
    />
  );
}
