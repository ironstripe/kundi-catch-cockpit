import { useQuery } from "@tanstack/react-query";

import { createSignedImageUrl } from "@/lib/catches";

/** Liefert eine signierte URL für ein privat gespeichertes Produktbild. */
export function useSignedImage(path: string | null | undefined) {
  return useQuery({
    queryKey: ["catch-image", path],
    queryFn: () => createSignedImageUrl(path!),
    enabled: Boolean(path),
    staleTime: 1000 * 60 * 30,
  });
}
