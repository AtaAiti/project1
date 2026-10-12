import { ResourceEditor } from "@/components/admin/resource-editor";
import { getDictionary } from "@/lib/dictionaries";
export default function GalleryPage() {
  const { admin: t, adminExtra: x } = getDictionary("ru");
  return (
    <ResourceEditor
      resource="gallery_photos"
      title={t.gallery}
      addLabel={x.addPhoto}
      titleField="caption_ru"
      detailField="caption_en"
      imageField="image_url"
      hint={x.photoHint}
      defaults={{ image_url: "", caption_ru: "", caption_en: "" }}
      fields={[
        { key: "image_url", label: x.imageUrl, type: "url", required: true },
        { key: "caption_ru", label: x.captionRu },
        { key: "caption_en", label: x.captionEn },
      ]}
    />
  );
}
