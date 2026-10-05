import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const kenyaPhone = /^(?:(?:\+254|254)\s?(?:7\d{2}|1\d{2})\s?\d{3}\s?\d{3}|0(?:7\d{2}|1\d{2})\s?\d{3}\s?\d{3})$/;
export const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your name").max(100),
  phone: z.string().trim().regex(kenyaPhone, "Enter a valid Kenyan phone number").max(20),
  business_name: z.string().trim().min(1, "Enter your business name").max(120),
  stall_location: z.string().trim().max(120),
  preferred_language: z.enum(["en", "sw"]),
});
export type ProfileForm = z.infer<typeof profileSchema>;
export type VendorProfile = ProfileForm & {
  id: string; email: string | null; avatar_url: string | null; role: "vendor" | "admin";
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  rejection_reason: string | null; created_at: string; approved_at: string | null;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<VendorProfile> => {
      const [{ data: authData, error: authError }, { data, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("profiles").select("*").single(),
      ]);
      if (error) throw error;
      if (authError) throw authError;
      return { ...data, email: authData.user.email ?? null } as VendorProfile;
    },
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (values: ProfileForm) => {
      const { data, error } = await supabase.from("profiles").update(values).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/)) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Image must be 2 MB or smaller.");
  const path = `${userId}/avatar-${Date.now()}.${file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1]}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error: updateError } = await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
  if (updateError) throw updateError;
  return data.publicUrl;
}

export type AdminVendor = {
  user_id: string; full_name: string; business_name: string; phone: string; email: string;
  email_verified: boolean; approval_status: VendorProfile["approval_status"];
  rejection_reason: string | null; created_at: string;
};
export function useVendors() {
  return useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_vendor_list");
      if (error) throw error;
      return (data ?? []) as AdminVendor[];
    },
  });
}
export function useVendorAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: "approve_vendor" | "reject_vendor" | "suspend_vendor" | "reinstate_vendor"; reason?: string }) => {
      const result = action === "reject_vendor"
        ? await supabase.rpc(action, { vendor_id: id, reason: reason ?? null })
        : await supabase.rpc(action, { vendor_id: id });
      if (result.error) throw result.error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin-vendors"] }),
  });
}

export function useApproveVendor() {
  const mutation = useVendorAction();
  return { ...mutation, mutateAsync: (id: string) => mutation.mutateAsync({ id, action: "approve_vendor" }) };
}
export function useRejectVendor() {
  const mutation = useVendorAction();
  return { ...mutation, mutateAsync: (id: string, reason?: string) => mutation.mutateAsync({ id, action: "reject_vendor", reason }) };
}
export function useSuspendVendor() {
  const mutation = useVendorAction();
  return { ...mutation, mutateAsync: (id: string) => mutation.mutateAsync({ id, action: "suspend_vendor" }) };
}
export function useReinstateVendor() {
  const mutation = useVendorAction();
  return { ...mutation, mutateAsync: (id: string) => mutation.mutateAsync({ id, action: "reinstate_vendor" }) };
}
