import { ResourceEditor } from "@/components/admin/resource-editor";
import { getDictionary } from "@/lib/dictionaries";
export default function EventsPage() {
  const { admin: t, adminExtra: x } = getDictionary("ru");
  return (
    <ResourceEditor
      resource="events"
      title={t.events}
      addLabel={t.addEvent}
      titleField="title_ru"
      detailField="description_ru"
      imageField="image_url"
      search
      defaults={{
        date: "",
        time: "19:00",
        title_ru: "",
        title_en: "",
        description_ru: "",
        description_en: "",
        image_url: "",
        status: "draft",
      }}
      fields={[
        { key: "date", label: t.date, type: "date", required: true },
        { key: "time", label: t.time, type: "time", required: true },
        { key: "title_ru", label: t.titleRu, required: true },
        { key: "title_en", label: t.titleEn, required: true },
        { key: "description_ru", label: t.descriptionRu, type: "textarea" },
        { key: "description_en", label: t.descriptionEn, type: "textarea" },
        { key: "image_url", label: x.imageUrl, type: "url" },
        {
          key: "status",
          label: t.status,
          type: "select",
          options: [
            { value: "draft", label: t.draft },
            { value: "published", label: t.published },
            { value: "moderation", label: t.moderation },
          ],
        },
      ]}
    />
  );
}
