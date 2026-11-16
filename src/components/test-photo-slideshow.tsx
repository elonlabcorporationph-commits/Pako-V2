import { useMemo } from "react";
import { Slideshow } from "@/components/order/Slideshow";
import { dataUrlToBlob } from "@/lib/download";
import { useRandomSlideshowTrack } from "@/lib/slideshow-music";

export function TestPhotoSlideshow({ images }: { images: (string | null)[] }) {
  const photos = useMemo(() => images.filter((image): image is string => Boolean(image)), [images]);
  const blobs = useMemo(() => Object.fromEntries(photos.map(image => [image, dataUrlToBlob(image)])), [photos]);
  const track = useRandomSlideshowTrack(photos.join("|").length + ":" + photos.length);
  if (!photos.length) return null;
  return <Slideshow images={photos} musicUrl={track?.url ?? ""} musicTitle={track?.title ?? ""} blobs={blobs} fileName="pasko-test-slideshow" />;
}