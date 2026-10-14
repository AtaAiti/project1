import { ResourceEditor } from "@/components/admin/resource-editor";
import { getDictionary } from "@/lib/dictionaries";
export default function MenuPage() {
  const { admin: t } = getDictionary("ru");
  return (
    <ResourceEditor
      resource="menu_items"
      title={t.menu}
      addLabel={t.addItem}
      titleField="name_ru"
      detailField="composition_ru"
      search
      defaults={{
        category: t.defaultCategory,
        name_ru: "",
        name_en: "",
        composition_ru: "",
        composition_en: "",
        strength: "",
        price: 0,
        is_hit: false,
      }}
      fields={[
        { key: "category", label: t.category, required: true },
        { key: "name_ru", label: t.nameRu, required: true },
        { key: "name_en", label: t.nameEn, required: true },
        { key: "composition_ru", label: t.compositionRu, type: "textarea" },
        { key: "composition_en", label: t.compositionEn, type: "textarea" },
        { key: "strength", label: t.strength },
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
