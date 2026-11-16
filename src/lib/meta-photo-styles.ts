export const META_STYLE_IDS = ["simbang-gabi", "snow", "pajama", "street", "barong"] as const;
export type MetaPhotoStyle = (typeof META_STYLE_IDS)[number];
export const META_STYLE_NAMES: Record<MetaPhotoStyle, string> = { "simbang-gabi": "Simbang Gabi", snow: "Snow", pajama: "Pajama", street: "Street Celebration", barong: "Traditional / Barong" };
export const META_STYLE_INDEX: Record<MetaPhotoStyle, number> = { "simbang-gabi": 0, snow: 2, pajama: 1, street: 3, barong: 4 };
export const META_STYLE_PROMPTS: Record<MetaPhotoStyle, string> = {
  "simbang-gabi": "warm Simbang Gabi Christmas portrait, Filipino church at dawn, warm parol lanterns, festive lights",
  snow: "cozy winter wonderland, soft falling snow, warm coat and scarf, Christmas tree bokeh lights",
  pajama: "relaxed family Christmas at home, matching Christmas pajamas, cozy living room with Christmas tree",
  street: "bright Filipino street Christmas celebration, colorful lights, night street, parol lanterns, festive bokeh",
  barong: "elegant traditional Filipino holiday portrait, wearing elegant barong / Filipiniana, formal studio with gold Christmas lights",
};
/** Each style uses its own body pose so the five results never look like the same photo. */
export const META_STYLE_POSES: Record<MetaPhotoStyle, string> = {
  "simbang-gabi": "new pose: standing in three-quarter view at the church entrance, hands gently clasped in front, looking at the camera, full upper body",
  snow: "new pose: walking toward the camera mid-step in the snow, one hand holding the scarf, head slightly tilted, three-quarter body shot",
  pajama: "new pose: sitting cross-legged on the floor beside the Christmas tree holding a wrapped gift, relaxed and leaning slightly forward",
  street: "new pose: candid laughing pose, holding a glowing parol lantern up beside the shoulder, body turned sideways, face toward the camera",
  barong: "new pose: formal standing pose, straight posture, one hand resting on a chair back, full body portrait",
};
export function metaPhotoPrompt(style: MetaPhotoStyle) {
  return `${META_STYLE_PROMPTS[style]}. ${META_STYLE_POSES[style]}, different from the original photo pose and camera angle; keep the exact same person's face, identity, hairstyle and smile, photorealistic. Keep the same number of people. No text or watermark.`;
}
