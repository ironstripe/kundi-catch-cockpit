import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { fetchAppSettings } from "@/lib/app-settings";

export const BRAND_BUCKET = "brand-assets";

/** Signierte URL des hinterlegten Logos; null bedeutet Standardlogo. */
export function useBrandLogo() {
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const path = settings.data?.brand.path ?? null;

  const url = useQuery({
    queryKey: ["brand-logo", path],
    enabled: Boolean(path),
    staleTime: 300_000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from(BRAND_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data.signedUrl;
    },
  });

  const iconPath = settings.data?.brand_icon.path ?? null;
  const iconUrl = useQuery({
    queryKey: ["brand-logo", iconPath],
    enabled: Boolean(iconPath),
    staleTime: 300_000,
    queryFn: async () => {
      if (!iconPath) return null;
      const { data, error } = await supabase.storage
        .from(BRAND_BUCKET)
        .createSignedUrl(iconPath, 60 * 60);
      if (error) return null;
      return data.signedUrl;
    },
  });

  return {
    url: url.data ?? null,
    brand: settings.data?.brand ?? null,
    iconUrl: iconUrl.data ?? null,
    icon: settings.data?.brand_icon ?? null,
  };
}
