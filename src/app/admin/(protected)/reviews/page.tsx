import { ResourceEditor } from "@/components/admin/resource-editor";
import { getDictionary } from "@/lib/dictionaries";
export default function ReviewsPage() {
  const { admin: t, adminExtra: x } = getDictionary("ru");
  return (
    <ResourceEditor
      resource="reviews"
      title={t.reviews}
      addLabel={x.addReview}
      titleField="author"
      detailField="text_ru"
      search
      defaults={{
        author: "",
        rating: 5,
        text_ru: "",
        text_en: "",
        status: "moderation",
      }}
      fields={[
        { key: "author", label: x.author, required: true },
        {
          key: "rating",
          label: x.rating,
          type: "number",
          min: 1,
          max: 5,
          required: true,
        },
        { key: "text_ru", label: x.textRu, type: "textarea", required: true },
        { key: "text_en", label: x.textEn, type: "textarea" },
        {
          key: "status",
          label: t.status,
          type: "select",
          options: [
            { value: "moderation", label: t.moderation },
            { value: "published", label: t.published },
          ],
        },
      ]}
    />
  );
}
